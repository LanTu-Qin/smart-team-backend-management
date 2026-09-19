// ============================================================================
// 技能字典接口层 —— 按 docs/api.md 第 7 节实现
// 两种实现同签名：mock（Tier-1）｜ 云函数（Tier-2，skillApi）
//
//   契约端点              → 云函数 action
//   GET    /skills        → skillApi.getAll   （公开）
//   POST   /skills        → skillApi.add      （管理员）
//   PATCH  /skills/:sid   → skillApi.update   （管理员）
//   DELETE /skills/:sid   → skillApi.delete   （管理员，删除前 4 处引用检查）
//
// 为什么技能字典值得单开一页：它是整个平台的**公共语言** ——
//   user.skills / user.skill_rating / teams.team_needs / teams.team_missing 的键全是 sid，
//   匹配算法（getMatchList）就是拿 sid 做交集，skills.desc 还会喂给 AI 做技能评级。
//   所以改错字典，匹配结果与 AI 评级会一起错。
// ============================================================================

import { ApiError, USE_MOCK, callCloud, mockApi } from './client'
import { commitSkills, getSkills, getTeams, getUsers, nextSid } from './mock/db'

/** 对象键里是否含该 sid —— 库中键是字符串 "1"，必须按数值比对 */
function hasSidKey(obj, sid) {
  if (!obj || typeof obj !== 'object') return false
  return Object.keys(obj).some((k) => Number(k) === Number(sid))
}

/**
 * 一条技能被多少用户 / 多少队伍引用（服务端算，前端不做全表扫描）
 *
 * 扫描 **4 处**，与真实 `skillApi/service.js` 的 `checkRefs` 完全同口径：
 *   1. user.skills         数组中含该 sid
 *   2. user.skill_rating   对象键含该 sid ← 最容易漏：删了技能，评级里还留着"幽灵键"
 *   3. teams.team_needs    对象键含该 sid
 *   4. teams.team_missing  对象键含该 sid
 * 同一用户（或队伍）可能命中多处，userIds / teamIds 去重后才是真实的"人数 / 队伍数"。
 * @returns {{users:number, teams:number, detail:{userSkills,userRating,teamNeeds,teamMissing}}}
 */
function countUsage(sid) {
  const id = Number(sid)
  let userSkills = 0
  let userRating = 0
  let teamNeeds = 0
  let teamMissing = 0
  const userIds = new Set()
  const teamIds = new Set()

  getUsers().forEach((u) => {
    const inSkills = (u.skills || []).map(Number).includes(id)
    const inRating = hasSidKey(u.skill_rating, id)
    if (inSkills) userSkills++
    if (inRating) userRating++
    if (inSkills || inRating) userIds.add(u.uid)
  })

  getTeams().forEach((t) => {
    const inNeeds = hasSidKey(t.team_needs, id)
    const inMissing = hasSidKey(t.team_missing, id)
    if (inNeeds) teamNeeds++
    if (inMissing) teamMissing++
    if (inNeeds || inMissing) teamIds.add(t.tid)
  })

  return {
    users: userIds.size,
    teams: teamIds.size,
    detail: { userSkills, userRating, teamNeeds, teamMissing },
  }
}

/* ==========================================================================
 * 一、真实实现（云函数 skillApi）
 * ========================================================================== */

/** usage 兜底：真实 getAll 会返回 usage，但前端对缺失值也要能活（契约第 13 条） */
function normalizeUsage(usage) {
  const u = usage || {}
  return {
    users: Number(u.users) || 0,
    teams: Number(u.teams) || 0,
    detail: {
      userSkills: Number(u.detail?.userSkills) || 0,
      userRating: Number(u.detail?.userRating) || 0,
      teamNeeds: Number(u.detail?.teamNeeds) || 0,
      teamMissing: Number(u.detail?.teamMissing) || 0,
    },
    truncated: !!u.truncated,
  }
}

/**
 * GET /skills —— 技能全表（字典表数据量小，不分页；`_id` 已由服务端剔除）
 * ⚠️ 单次 get 上限 100 条：技能超过 100 条时服务端会静默截断（见契约第 7 节末）
 */
async function cloudListSkills() {
  const list = await callCloud('skillApi', 'getAll')
  return (Array.isArray(list) ? list : []).map((s) => ({
    // sid 类型归一：库里若存在字符串 sid，前端排序 / 比较会出错
    sid: Number(s.sid),
    name: s.name || '',
    desc: s.desc || '',
    usage: normalizeUsage(s.usage),
  }))
}

/** POST /skills —— 新增（服务端做名称 trim + 重名校验，返回新 sid） */
async function cloudCreateSkill(payload = {}) {
  const data = await callCloud('skillApi', 'add', {
    name: payload.name,
    desc: payload.desc == null ? '' : payload.desc,
  })
  return { sid: Number(data && data.sid) }
}

/** PATCH /skills/:sid —— 改名 / 改描述（sid 不可改：它是引用键） */
async function cloudUpdateSkill(sid, payload = {}) {
  const body = { sid: Number(sid) }
  if ('name' in payload) body.name = payload.name
  if ('desc' in payload) body.desc = payload.desc
  await callCloud('skillApi', 'update', body)
  return { sid: Number(sid) }
}

/**
 * DELETE /skills/:sid —— **引用检查**（契约第 7 节）
 *
 * ⚠️ 码值映射：真实云函数被引用时返回 `code:-1` + `msg` + `data:refs`（它服务的是 C 端 + 网关模式，
 *    由网关按契约 §1.3 映射成 `code 2`）。本项目直连云函数（没有网关），
 *    所以在接口层完成这次映射 —— 让 mock 与真实对页面呈现**同一个码**，
 *    否则页面里任何 `err.code === 2` 的判断都会在切模式后失效。
 */
async function cloudDeleteSkill(sid) {
  try {
    await callCloud('skillApi', 'delete', { sid: Number(sid) })
    return { sid: Number(sid) }
  } catch (err) {
    // -1 = 业务拒绝（被引用 / sid 不存在 / 扫描截断），统一归到契约的「不能删除」
    if (err.code === -1) throw new ApiError(2, err.message)
    throw err
  }
}

/* ==========================================================================
 * 二、mock 实现（Tier-1）
 * ========================================================================== */

/** 数据库原形 → 契约 DTO：补上 usage（用不用得上由前端决定，但计算是后端职责） */
function toDto(skill) {
  return {
    sid: skill.sid,
    name: skill.name,
    desc: skill.desc || '',
    usage: countUsage(skill.sid),
  }
}

/**
 * GET /skills —— 技能全表
 * 注意这里**故意不分页**：契约第 7 节定义它是全表接口，因为它是"字典表"——
 * 数据量小（真实 25 条）、且前端多处要用完整的 sid→name 映射。
 * 分页不是教条：列表接口按**数据规模**决定，而不是一律照抄。
 */
const mockListSkills = mockApi(() => getSkills().map(toDto))

/** POST /skills —— 新增技能（支持 name + desc，sid 自动 max+1） */
const mockCreateSkill = mockApi((payload = {}) => {
  const name = String(payload.name || '').trim()
  if (!name) throw new ApiError(400, '请填写技能名称')

  const skills = getSkills()
  if (skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    throw new ApiError(2, `技能「${name}」已存在，不能重复添加`)
  }

  const desc = String(payload.desc == null ? '' : payload.desc).trim()
  const item = { sid: nextSid(), name, desc }
  skills.push(item)
  commitSkills()
  return toDto(item)
})

/** PATCH /skills/:sid —— 修改名称 / 描述（局部更新：只改传进来的字段） */
const mockUpdateSkill = mockApi((sid, payload = {}) => {
  const id = Number(sid)
  if (!Number.isInteger(id)) throw new ApiError(400, '技能 sid 必须为数字')

  const item = getSkills().find((s) => s.sid === id)
  if (!item) throw new ApiError(-404, `技能 ${sid} 不存在`)

  if ('name' in payload) {
    const name = String(payload.name || '').trim()
    if (!name) throw new ApiError(400, '技能名称不能为空')
    const duplicated = getSkills().some(
      (s) => s.sid !== id && s.name.toLowerCase() === name.toLowerCase(),
    )
    if (duplicated) throw new ApiError(2, `技能「${name}」已存在，不能重复`)
    item.name = name
  }
  if ('desc' in payload) item.desc = String(payload.desc || '').trim()

  commitSkills()
  return toDto(item)
})

/**
 * DELETE /skills/:sid —— 被引用时**拦截**而不是级联：
 * 文档型数据库没有外键，删掉 sid 后 user.skills / teams.team_needs 里会留下**悬空引用**
 * （页面显示空白、匹配算不出来、AI 拿到不存在的 sid）。一致性只能业务层自己守，
 * 而级联删除是破坏性操作，不能替管理员做主。
 */
const mockDeleteSkill = mockApi((sid) => {
  const id = Number(sid)
  if (!Number.isInteger(id)) throw new ApiError(400, '技能 sid 必须为数字')

  const skills = getSkills()
  const idx = skills.findIndex((s) => s.sid === id)
  if (idx === -1) throw new ApiError(-404, `技能 ${sid} 不存在`)

  const { users, teams, detail } = countUsage(id)
  if (users > 0 || teams > 0) {
    throw new ApiError(
      2,
      `该技能已被 ${users} 位用户、${teams} 支队伍使用，不能删除` +
        `（用户技能 ${detail.userSkills} / 技能评级 ${detail.userRating} / ` +
        `招募需求 ${detail.teamNeeds} / 技能缺口 ${detail.teamMissing}，请先移除引用）`,
    )
  }
  // 与真实 `skillApi.delete` 的口径**已对齐**：同样扫 4 处引用，拦截时同样回传明细。
  // 剩余差异（已知，勿当成 bug）：
  //   - 真实有 MAX_SCAN(5000) 截断保护（扫不完 → truncated=true → 拒绝删除）；
  //     mock 数据量固定且很小，不存在截断场景，故不实现该分支。
  //   - 真实实现返回 code:-1（由网关映射为契约的 code 2），mock 站在网关之后所以直接给 2
  //     —— 真实通道的这次映射由上面的 cloudDeleteSkill 完成。
  skills.splice(idx, 1)
  commitSkills()
  return { sid: id }
})

/* ==========================================================================
 * 三、对外接口（按模式二选一）
 * ========================================================================== */

/** GET /skills —— 技能全表 {sid, name, desc, usage} */
export const listSkills = USE_MOCK ? mockListSkills : cloudListSkills

/** POST /skills —— 新增技能 */
export const createSkill = USE_MOCK ? mockCreateSkill : cloudCreateSkill

/** PATCH /skills/:sid —— 修改名称 / 描述 */
export const updateSkill = USE_MOCK ? mockUpdateSkill : cloudUpdateSkill

/** DELETE /skills/:sid —— 删除（被引用时服务端拦截，code 2） */
export const deleteSkill = USE_MOCK ? mockDeleteSkill : cloudDeleteSkill
