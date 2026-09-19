// ============================================================================
// 赛事接口层 —— 严格按 docs/api.md 第 4 节实现（内容运营核心）
// 两种实现同签名：mock（Tier-1）｜ 云函数（Tier-2，competitionApi）
//
//   GET    /competitions?page&pageSize&keyword&status → competitionApi.getPage（零鉴权）
//   POST   /competitions                              → competitionApi.create（管理员）
//   PATCH  /competitions/:cid                         → competitionApi.update（管理员）
//   DELETE /competitions/:cid                         → competitionApi.delete（管理员）
//   POST   /competitions/:cid/ai-detail               → competitionApi.aiGenDetail（管理员，10~25s）
//
// ⚠️ 真实云函数的入参是**嵌套**的：`params = { compInfo: {...}, imageBase64: '' }`，
//    不是契约里的扁平 body —— 契约里的"扁平化"由网关负责，本项目直连云函数，
//    所以这层要负责这次的"拆装"（契约第 4 节「映射备注」）。
// ============================================================================

import { ApiError, USE_MOCK, callCloud, mockApi } from './client'
import {
  commitCompetitions,
  commitTeams,
  getCompetitions,
  getTeams,
  nextCid,
} from './mock/db'

/* 枚举以真实数据取值为准（契约第 4 节），UI 直接复用，避免前后端各写一份 */
// level：真实 60 条数据里出现 国A/国B/省B/国C；因 省B 存在，下拉给全 6 档
export const COMP_LEVELS = ['国A', '国B', '国C', '省A', '省B', '省C']
// type：注意存在"个人/团体"混合类型，UI 不能做成二选一
export const COMP_TYPES = ['团体', '个人/团体', '个人']
// status：已结束 是发布队伍与入池的拦截条件（对齐云函数 checkCompActive）
export const COMP_STATUS = ['未开始', '报名中', '已结束']

/* 写入白名单 —— 契约第 8 节第 8 条（安全项）
 * 与云函数 service.js 的 COMP_EDITABLE_FIELDS **逐字一致**，
 * 前端这份只是"提前告诉用户哪些字段可填"，真正的过滤在服务端（不信客户端）。 */
export const EDITABLE_FIELDS = [
  'name',
  'url',
  'level',
  'type',
  'status',
  'start',
  'end',
  'organizer',
]

// 服务端独占字段（真实库里的字段名：poster / content / detailPoster / detailImageList）
const SERVER_ONLY_FIELDS = ['cid', 'content', 'poster', 'detailPoster', 'detailImageList']

/** mock 行为开关（只影响 Tier-1 假数据） */
const AI_MOCK = {
  // 真实云函数耗时 10~25s；用命名常量而不是裸写 12000，避免"魔法数字"
  delayMs: 12000,
  // 想测"失败 + 重试"路径时调成 0.3：异步 UI 只测成功路径等于没测
  failRate: 0,
}

/**
 * 白名单挑字段：只保留 EDITABLE_FIELDS，其余（含 cid/content/poster、
 * __proto__ 等脏东西）全部丢弃。
 * 采用"静默丢弃"而不是报错：避免把服务端字段结构回显给调用方（信息泄露面最小化）。
 */
function pickEditable(payload = {}) {
  if (payload === null || typeof payload !== 'object') {
    throw new ApiError(400, '赛事参数格式不正确')
  }
  const picked = {}
  EDITABLE_FIELDS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      picked[key] = payload[key]
    }
  })

  // Tier-1 本地开发提示：客户端夹带服务端独占字段时，控制台可见"拦下了什么"
  if (import.meta.env?.DEV) {
    const smuggled = SERVER_ONLY_FIELDS.filter((key) =>
      Object.prototype.hasOwnProperty.call(payload, key),
    )
    if (smuggled.length) console.warn(`[competitions] 已丢弃非白名单字段：${smuggled.join(', ')}`)
  }

  return picked
}

/** 白名单 + 日期先后校验（真实服务端同样校验；这里是为了不等一个来回就给出提示） */
function validate(payload = {}, { partial = false } = {}) {
  const data = pickEditable(payload)

  // 字符串统一 trim：杜绝 "  " 这类空白脏值进库
  EDITABLE_FIELDS.forEach((key) => {
    if (typeof data[key] === 'string') data[key] = data[key].trim()
  })

  if (!partial && !data.name) throw new ApiError(400, '请填写赛事名称')
  if (partial && 'name' in data && !data.name) throw new ApiError(400, '赛事名称不能为空')

  if (data.start && data.end && String(data.end) < String(data.start)) {
    throw new ApiError(400, '结束日期不能早于开始日期')
  }
  return data
}

/* ==========================================================================
 * 一、真实实现（云函数 competitionApi）
 * ========================================================================== */

/** 原始行 → 契约 DTO：`_id` 已由服务端剔除；海报是 fileID，v1 不做图片展示 */
function toCloudDto(row) {
  return {
    ...row,
    // hasPoster：只表示"库里有没有海报"，不假装能显示 ——
    // 真图片要经 getFileTempUrl 换临时链接，而临时链接会过期（契约第 8 节第 7 条待决策）
    hasPoster: !!row.poster,
    posterUrl: '',
  }
}

/** GET /competitions?page&pageSize&keyword&status */
async function cloudListCompetitions({ keyword = '', status = '', page = 1, pageSize = 10 } = {}) {
  const data =
    (await callCloud('competitionApi', 'getPage', { keyword, status, page, pageSize })) || {}
  return {
    list: (Array.isArray(data.list) ? data.list : []).map(toCloudDto),
    total: data.total || 0,
    page: data.page || page,
    pageSize: data.pageSize || pageSize,
  }
}

/**
 * POST /competitions —— 新建
 * ⚠️ 服务端只返回 `{ cid }`（没有整条记录）→ 用入参补全其余字段返回，
 *    页面若要显示新建结果，字段是完整的；但**不要**把它当成服务端最终形态（服务端还会补 content/poster 等）
 */
async function cloudCreateCompetition(payload = {}) {
  const data = await callCloud('competitionApi', 'create', {
    compInfo: validate(payload),
    imageBase64: '', // v1 不做海报上传（契约第 8 节第 7 条待决策）
  })
  return { ...payload, cid: data && data.cid }
}

/**
 * PATCH /competitions/:cid —— 局部更新（只合并传进来的字段）
 * 服务端成功响应**没有 data**，所以返回 { cid }；调用方随后重拉列表
 */
async function cloudUpdateCompetition(cid, payload = {}) {
  const id = Number(cid)
  await callCloud('competitionApi', 'update', {
    cid: id,
    compInfo: validate(payload, { partial: true }),
    imageBase64: '',
  })
  return { cid: id }
}

/** DELETE /competitions/:cid */
async function cloudDeleteCompetition(cid) {
  const id = Number(cid)
  await callCloud('competitionApi', 'delete', { cid: id })
  return { cid: id }
}

/**
 * POST /competitions/:cid/ai-detail —— AI 生成简介（**10~25s 慢接口**）
 * ⚠️ 前端只传 cid：name / url 由服务端从库内取（避免客户端传错把不匹配的内容写进 content）
 * ⚠️ 超时：client.js 把 SDK 超时调到 35s（默认 15s 会在模型返回前就被前端掐断）
 * @returns {Promise<{content: string}>}
 */
async function cloudGenerateAiDetail(cid) {
  const id = Number(cid)
  if (!Number.isInteger(id)) throw new ApiError(400, '赛事 cid 必须为数字')
  const data = await callCloud('competitionApi', 'aiGenDetail', { cid: id })
  return { cid: id, content: (data && data.content) || '' }
}

/* ==========================================================================
 * 二、mock 实现（Tier-1）
 * ========================================================================== */

const mockListCompetitions = mockApi(
  ({ keyword = '', status = '', page = 1, pageSize = 10 } = {}) => {
    const kw = String(keyword).trim().toLowerCase()
    const matched = getCompetitions().filter((c) => {
      if (status && c.status !== status) return false
      if (!kw) return true
      return `${c.name} ${c.organizer || ''}`.toLowerCase().includes(kw)
    })

    const start = (page - 1) * pageSize
    return {
      list: matched.slice(start, start + pageSize).map((c) => ({ ...c })),
      total: matched.length,
      page,
      pageSize,
    }
  },
)

const mockCreateCompetition = mockApi((payload = {}) => {
  const data = validate(payload)
  const item = {
    // cid / content / poster 等全部由服务端生成或留空，
    // 客户端即便在 body 里塞了 cid: 1、content: 'xxx' 也会被 pickEditable 丢掉
    cid: nextCid(),
    name: data.name,
    url: data.url || '',
    level: data.level || '省B',
    type: data.type || '团体',
    status: data.status || '未开始',
    start: data.start || '',
    end: data.end || '',
    organizer: data.organizer || '',
    content: '', // AI 尚未生成 → POST /competitions/:cid/ai-detail
    posterUrl: '',
    hasPoster: false,
  }
  getCompetitions().unshift(item)
  commitCompetitions()
  return { ...item }
})

const mockUpdateCompetition = mockApi((cid, payload = {}) => {
  const id = Number(cid)
  const item = getCompetitions().find((c) => c.cid === id)
  if (!item) throw new ApiError(-404, `赛事 ${cid} 不存在`)

  const data = validate(payload, { partial: true })
  Object.assign(item, data)
  commitCompetitions()
  return { ...item }
})

/**
 * AI 生成（mock）：12s 延迟 + 模板化内容，不需要 Key、不需要云函数就绪。
 * 输出格式必须与云函数 `normalizeAiContent` 的真实输出**逐字对齐**，否则"演示"与"真实"不一致：
 *   赛事简介（模块标题）+ 5 个标签行 → 空行 → 赛事含金量（模块标题）+ 3 个标签行，标签行全角冒号
 */
const mockGenerateAiDetail = mockApi((cid) => {
  const id = Number(cid)
  if (!Number.isInteger(id)) throw new ApiError(400, '赛事 cid 必须为数字')
  const item = getCompetitions().find((c) => c.cid === id)
  if (!item) throw new ApiError(-404, `赛事 ${cid} 不存在`)

  // 模拟大模型偶发失败（AI_MOCK.failRate > 0 时生效），用来验证失败提示与重试
  if (AI_MOCK.failRate > 0 && Math.random() < AI_MOCK.failRate) {
    throw new ApiError(-500, 'AI 服务暂时不可用，请稍后重试')
  }

  const content = buildAiContent(item)
  item.content = content // 与 C 端共用同一个 content 字段，写库的动作发生在服务端
  commitCompetitions()
  return { cid: id, content }
}, AI_MOCK.delayMs)

/**
 * AI 内容模板 —— 必须与云函数 `normalizeAiContent` 的真实输出格式**逐字对齐**。
 *
 * 真实 prompt 的硬约束（照抄，别自己发明格式）：
 *   ① 禁止 Markdown 符号、禁止【】包裹标签名；② 标签行必须是"标签名：内容"；
 *   ③ 禁止编造奖金 / 保研加分等具体数字，不确定就写"以官方/本校政策为准"。
 * mock 若用别的格式，接真后端那一刻内容长相就变了 —— 演示与真实不一致最容易被当场问穿。
 */
function buildAiContent(c) {
  const form =
    c.type === '个人'
      ? '个人参赛，独立完成全部任务模块'
      : c.type === '个人/团体'
        ? '个人或团体均可报名，团体建议按技能互补组队'
        : '团体参赛，建议按技能互补组队，规模以官方通知为准'
  const unknown = '暂无权威官方信息，请以当年赛事官网最新通知为准'
  return [
    '赛事简介',
    `主办/承办单位：${c.organizer || unknown}`,
    `赛事定位：${c.level || ''}${c.level ? ' 级' : ''}${c.type || ''}赛事，面向高校在读学生`,
    '举办宗旨：推动该方向的创新实践与人才培养',
    `参赛人群：高校在读学生（以官方通知为准）`,
    `基础组队与赛制：${form}`,
    '',
    '赛事含金量',
    '高校综测/保研认可度：高校普遍认可，具体认定以本校政策为准',
    '企业招聘参考价值：相关岗位简历中的加分经历，以用人单位标准为准',
    '行业/学术层面作用：推动该方向的技术交流与成果转化',
  ].join('\n')
}

/** DELETE /competitions/:cid —— 联动清理 teams.cid_list 中的该赛事 */
const mockDeleteCompetition = mockApi((cid) => {
  const id = Number(cid)
  const list = getCompetitions()
  const idx = list.findIndex((c) => c.cid === id)
  if (idx === -1) throw new ApiError(-404, `赛事 ${cid} 不存在`)

  getTeams().forEach((t) => {
    if (Array.isArray(t.cid_list)) t.cid_list = t.cid_list.filter((c) => c !== id)
  })

  list.splice(idx, 1)
  commitTeams()
  commitCompetitions()
  return { cid: id }
})

/* ==========================================================================
 * 三、对外接口（按模式二选一）
 * ========================================================================== */

/** GET /competitions?page&pageSize&keyword&status */
export const listCompetitions = USE_MOCK ? mockListCompetitions : cloudListCompetitions

/** POST /competitions */
export const createCompetition = USE_MOCK ? mockCreateCompetition : cloudCreateCompetition

/** PATCH /competitions/:cid */
export const updateCompetition = USE_MOCK ? mockUpdateCompetition : cloudUpdateCompetition

/** DELETE /competitions/:cid */
export const deleteCompetition = USE_MOCK ? mockDeleteCompetition : cloudDeleteCompetition

/** POST /competitions/:cid/ai-detail —— 生成 AI 简介（慢接口，10~25s） */
export const generateAiDetail = USE_MOCK ? mockGenerateAiDetail : cloudGenerateAiDetail
