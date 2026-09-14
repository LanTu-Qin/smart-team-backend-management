// ============================================================================
// 赛事接口层 —— 严格按 docs/api.md 第 4 节实现（内容运营核心）
//
//   Tier-2 长这样：
//     export const listCompetitions = (params) => client.get('/competitions', { params })
//     export const createCompetition = (payload) => client.post('/competitions', payload)
//     export const updateCompetition = (cid, payload) => client.patch(`/competitions/${cid}`, payload)
//     export const deleteCompetition = (cid) => client.delete(`/competitions/${cid}`)
// ============================================================================

import { ApiError, mockApi } from './client'
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

/** mock 行为开关（只影响 Tier-1 假数据，Tier-2 删掉即可） */
const AI_MOCK = {
  // 真实云函数耗时 10~25s；用命名常量而不是裸写 12000，避免"魔法数字"
  delayMs: 12000,
  // 想测"失败 + 重试"路径时调成 0.3：异步 UI 只测成功路径等于没测
  failRate: 0,
}

/* ---------------------------------------------------------------------------
 * 写入白名单 —— 契约第 8 节第 8 条（安全项）
 * 现状（真实云函数 create/update 的 bug）：对 compInfo 直接 `...compInfo` 整体透传写库，
 * 客户端可以塞任意字段，甚至覆盖 cid / poster / content 等关键字段。
 * 正确做法：服务端按白名单**挑字段**，其余一律丢弃，且关键字段由服务端生成/维护。
 * ------------------------------------------------------------------------- */
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

// 服务端独占字段：只能由服务端写，客户端传了也一律忽略
// cid（自增主键）/ content（AI 生成）/ posterUrl / hasPoster（图片通道，见契约第 8 节第 7 条）
const SERVER_ONLY_FIELDS = ['cid', 'content', 'posterUrl', 'hasPoster']

/**
 * 白名单挑字段：只保留 EDITABLE_FIELDS，其余（含 cid/content/posterUrl/hasPoster、
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

/**
 * 白名单 + 枚举 + 日期先后校验（真实后端同样要做）
 * @param {object} payload 客户端原始 body
 * @param {boolean} partial true=PATCH 语义（未提供字段不落库、不校验）；false=POST 语义（name 必填）
 */
function validate(payload = {}, { partial = false } = {}) {
  const data = pickEditable(payload)

  // 字符串统一 trim：杜绝 "  " 这类空白脏值进库
  EDITABLE_FIELDS.forEach((key) => {
    if (typeof data[key] === 'string') data[key] = data[key].trim()
  })

  if (!partial && !data.name) throw new ApiError(400, '请填写赛事名称')
  if (partial && 'name' in data && !data.name) throw new ApiError(400, '赛事名称不能为空')

  if (data.level != null && !COMP_LEVELS.includes(data.level)) {
    throw new ApiError(400, `赛事级别只能是：${COMP_LEVELS.join(' / ')}`)
  }
  if (data.type != null && !COMP_TYPES.includes(data.type)) {
    throw new ApiError(400, `参赛形式只能是：${COMP_TYPES.join(' / ')}`)
  }
  if (data.status != null && !COMP_STATUS.includes(data.status)) {
    throw new ApiError(400, `赛事状态只能是：${COMP_STATUS.join(' / ')}`)
  }
  if (data.start && data.end && String(data.end) < String(data.start)) {
    throw new ApiError(400, '结束日期不能早于开始日期')
  }
  return data
}

/** GET /competitions?page&pageSize&keyword&status（分页/筛选为 [后端新增]） */
export const listCompetitions = mockApi(
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

/**
 * POST /competitions
 * body：{name, url, level, type, status, start, end, organizer}
 * 说明：content（AI 简介）不在此处写入 —— 它由 POST /competitions/:cid/ai-detail 生成
 */
export const createCompetition = mockApi((payload = {}) => {
  const data = validate(payload)
  const item = {
    // cid / content / posterUrl / hasPoster 全部由服务端生成或留空，
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

/**
 * PATCH /competitions/:cid —— 只按白名单**挑字段**合并（局部更新，用 PATCH 不用 PUT）
 * ① cid 取路由参数（body 里的 cid 一律忽略，杜绝"改 A 的 cid 把 B 覆盖掉"）
 * ② content / posterUrl / hasPoster 不在白名单里，永远不会被这里改写
 * ③ PUT 的语义是"整体替换"（没传的字段应被清空），与"合并"不符，所以用 PATCH
 */
export const updateCompetition = mockApi((cid, payload = {}) => {
  const id = Number(cid)
  const item = getCompetitions().find((c) => c.cid === id)
  if (!item) throw new ApiError(-404, `赛事 ${cid} 不存在`)

  const data = validate(payload, { partial: true })
  Object.assign(item, data)
  commitCompetitions()
  return { ...item }
})

/**
 * POST /competitions/:cid/ai-detail —— 契约第 4 节：AI 生成简介（**10~25s 慢接口**）
 * body：{ cid, name, url }（**cid 必须为数字**，云函数以此定位赛事）
 * 返回：{ cid, content }（content 为规整后的 9 标签内容）
 *
 * Tier-2：
 *   export const generateAiDetail = (cid) =>
 *     client.post(`/competitions/${cid}/ai-detail`, { cid: Number(cid) })
 *   ⚠️ axios timeout 与网关对齐（契约 1.5：网关已设 30s → 前端建议 35s）。
 *      设得比网关更长没有意义：网关先断，用户白等。
 *
 * mock 依据契约第 4 节第 5 条：返回模板化 9 标签内容 + 12s 延迟，不需要 Key、不需要云函数就绪
 */
export const generateAiDetail = mockApi((cid) => {
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

/** 9 标签模板：与 C 端 aiGenDetail 的 normalizeAiContent 输出格式保持一致 */
function buildAiContent(c) {
  const period = `${c.start || '待定'} 至 ${c.end || '待定'}`
  const form =
    c.type === '个人'
      ? '个人参赛，独立完成全部任务模块'
      : c.type === '个人/团体'
        ? '个人或团体均可报名，团体建议 3-5 人按技能互补组队'
        : '团体参赛，建议 3-5 人按技能互补组队'
  return [
    `【赛事定位】${c.level} 级${c.type}赛事，主办方为${c.organizer || '赛事组委会'}`,
    '【含金量】高校普遍认定的学科竞赛，在推免与综测中常被参考（具体认定以本校政策为准）',
    `【参赛形式】${form}`,
    '【适合方向】技术研发、产品设计、商业落地三类能力均有发挥空间',
    `【周期】${period}，当前状态：${c.status}`,
    '【准备周期】建议提前 3 个月选题并完成组队',
    '【核心产出】项目原型 + 技术文档 + 路演答辩材料',
    '【获奖率】官方未公开统一比例，建议参考历年获奖名单自行评估',
    '【建议】尽早锁定指导老师，明确分工与里程碑后再报名，避免中途换题',
  ].join('；') + '。'
}

/** DELETE /competitions/:cid —— 联动清理 teams.cid_list 中的该赛事 */
export const deleteCompetition = mockApi((cid) => {
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
