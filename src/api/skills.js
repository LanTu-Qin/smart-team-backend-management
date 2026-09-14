// ============================================================================
// 技能字典接口层 —— 按 docs/api.md 第 7 节实现
//
//   Tier-2 长这样：
//     export const listSkills   = () => client.get('/skills')
//     export const createSkill  = (payload) => client.post('/skills', payload)
//     export const updateSkill  = (sid, payload) => client.patch(`/skills/${sid}`, payload)
//     export const deleteSkill  = (sid) => client.delete(`/skills/${sid}`)
//
// 为什么技能字典值得单开一页：它是整个平台的**公共语言** ——
//   user.skills / user.skill_rating / teams.team_needs / teams.team_missing 的键全是 sid，
//   匹配算法（getMatchList）就是拿 sid 做交集，skills.desc 还会喂给 AI 做技能评级。
//   所以改错字典，匹配结果与 AI 评级会一起错。
// ============================================================================

import { ApiError, mockApi } from './client'
import { commitSkills, getSkills, getTeams, getUsers, nextSid } from './mock/db'

/** 一条技能被多少用户 / 多少队伍引用（服务端算，前端不做全表扫描） */
function countUsage(sid) {
  const users = getUsers().filter((u) => (u.skills || []).includes(sid)).length
  const teams = getTeams().filter(
    (t) => Object.prototype.hasOwnProperty.call(t.team_needs || {}, String(sid)),
  ).length
  return { users, teams }
}

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
 * 映射：skill_getAll（无参数、返回全表）
 *
 * 注意这里**故意不分页**：契约第 7 节定义它是全表接口，因为它是"字典表"——
 * 数据量小（真实 25 条）、且前端多处要用完整的 sid→name 映射。
 * 分页不是教条：列表接口按**数据规模**决定，而不是一律照抄。
 */
export const listSkills = mockApi(() => getSkills().map(toDto))

/**
 * POST /skills —— 新增技能
 * 映射：skill_add（**只接收 name**，sid 自动 max+1）
 * ⚠️ 真实 action 不接收 desc，所以这里传了也会被忽略 —— 描述只能创建后再编辑。
 *    UI 要如实反映这一点（新增弹窗不出现描述输入框），否则就是给用户一个假入口。
 */
export const createSkill = mockApi((payload = {}) => {
  const name = String(payload.name || '').trim()
  if (!name) throw new ApiError(400, '请填写技能名称')

  const skills = getSkills()
  if (skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    throw new ApiError(2, `技能「${name}」已存在，不能重复添加`)
  }

  const item = { sid: nextSid(), name, desc: '' }
  skills.push(item)
  commitSkills()
  return toDto(item)
})

/**
 * PATCH /skills/:sid —— 修改名称 / 描述 [后端新增]
 * 真实后端需新增 action（现只有 skill_add / skill_getAll，无更新能力）。
 * 用 PATCH 表示局部更新：只改传进来的字段。
 */
export const updateSkill = mockApi((sid, payload = {}) => {
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
 * DELETE /skills/:sid [后端新增] —— **引用检查**（契约第 7 节）
 *
 * 为什么必须检查：文档型数据库**没有外键**，删除技能数据库不会拦你，
 * user.skills / teams.team_needs 里那些 sid 会变成**悬空引用**（幽灵技能）：
 * 页面显示空白、匹配算不出来、AI 拿到不存在的 sid。
 * 策略选"拦截"而不是"级联删除"——级联是破坏性的，不能替管理员做主。
 */
export const deleteSkill = mockApi((sid) => {
  const id = Number(sid)
  if (!Number.isInteger(id)) throw new ApiError(400, '技能 sid 必须为数字')

  const skills = getSkills()
  const idx = skills.findIndex((s) => s.sid === id)
  if (idx === -1) throw new ApiError(-404, `技能 ${sid} 不存在`)

  const { users, teams } = countUsage(id)
  if (users > 0 || teams > 0) {
    throw new ApiError(
      2,
      `该技能已被 ${users} 位用户、${teams} 支队伍使用，不能删除（请先移除引用）`,
    )
  }

  skills.splice(idx, 1)
  commitSkills()
  return { sid: id }
})
