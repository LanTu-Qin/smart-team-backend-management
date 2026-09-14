// ============================================================================
// 队伍接口层 —— 严格按 docs/api.md 第 6 节实现
// 管理端队伍页定位：**只读 + 删除**（组队/加人/匹配属于 C 端小程序，契约明确不纳入 v1）
//
//   Tier-2 长这样：
//     export const listTeams = (params) => client.get('/teams', { params })
//     export const getTeamDetail = (tid) => client.get(`/teams/${tid}`)
//     export const deleteTeam = (tid) => client.delete(`/teams/${tid}`)
// ============================================================================

import { ApiError, mockApi } from './client'
import { commitTeams, commitUsers, getSkills, getTeams, getUsers } from './mock/db'

/** uid → 用户（回填用）；查不到就返回空对象，避免整支队伍渲染失败 */
function findUser(uid) {
  return getUsers().find((u) => u.uid === Number(uid)) || {}
}
const skillName = (sid) =>
  getSkills().find((s) => s.sid === Number(sid))?.name || ''

/** {sid: 人数} → [{sid, name, count}]：字典查找属于后端职责，前端不存技能表 */
const toSkillRows = (map = {}) =>
  Object.entries(map).map(([sid, count]) => ({
    sid: Number(sid),
    name: skillName(sid) || `技能 ${sid}`,
    count,
  }))

/**
 * 数据库原形 → 契约 DTO（这一步就是"契约 ≠ 数据库行"的落点）：
 *   members  { "uid": skillId }  →  [{ uid, skillId, username, avatar, skillName }]
 *   leader   uid(number)         →  { uid, username }
 *   advisor  [uid]               →  [{ uid, username }]
 * 契约第 6 节："回填靠 GET /users/batch 联动，前端或后端做皆可" —— 这里是**后端**做
 * （mock 站在后端的位置；Tier-2 由云函数/网关做同样的事）
 */
function toDto(team) {
  return {
    ...team,
    needs: toSkillRows(team.team_needs),
    missing: toSkillRows(team.team_missing),
    leader: { uid: team.leader, username: findUser(team.leader).username || '—' },
    advisor: (team.advisor || []).map((uid) => ({
      uid,
      username: findUser(uid).username || '—',
    })),
    members: Object.entries(team.members || {}).map(([uid, skillId]) => {
      const u = findUser(uid)
      return {
        uid: Number(uid),
        skillId,
        username: u.username || `#${uid}`,
        avatar: u.avatar || '',
        skillName: skillName(skillId),
      }
    }),
  }
}

/**
 * GET /teams?cid&page&pageSize —— 可按赛事 cid 过滤
 * 注意：契约里**没有 keyword 搜索**（现云函数 getList 全量返回，分页为 [后端新增]），
 * 所以管理端 v1 也不提供队伍名搜索，避免做出"看起来能用、接后端就废"的功能。
 */
export const listTeams = mockApi(({ cid = '', page = 1, pageSize = 10 } = {}) => {
  const matched = getTeams().filter((t) => {
    if (!cid) return true
    return (t.cid_list || []).includes(Number(cid))
  })

  const start = (page - 1) * pageSize
  return {
    list: matched.slice(start, start + pageSize).map(toDto),
    total: matched.length,
    page,
    pageSize,
  }
})

/** GET /teams/:tid —— 队伍详情 */
export const getTeamDetail = mockApi((tid) => {
  const team = getTeams().find((t) => t.tid === Number(tid))
  if (!team) throw new ApiError(-404, `队伍 ${tid} 不存在`)
  return toDto(team)
})

/**
 * DELETE /teams/:tid —— 危险操作：联动清理成员的 tid_list（契约第 6 节）
 * 真实后端还要清理 onGoing_cid / 匹配池 / 指导老师关系；mock 里先把"看得见的引用"清干净
 */
export const deleteTeam = mockApi((tid) => {
  const id = Number(tid)
  const teams = getTeams()
  const idx = teams.findIndex((t) => t.tid === id)
  if (idx === -1) throw new ApiError(-404, `队伍 ${tid} 不存在`)

  const team = teams[idx]
  // 真实形态：leader 是 uid、members 是对象 map、advisor 是 uid 数组
  const touched = [
    team.leader,
    ...Object.keys(team.members || {}).map(Number),
    ...(team.advisor || []),
  ]
  getUsers().forEach((u) => {
    if (touched.includes(u.uid) && Array.isArray(u.tid_list)) {
      u.tid_list = u.tid_list.filter((t) => t !== id)
    }
  })

  teams.splice(idx, 1)
  commitUsers()
  commitTeams()
  return { tid: id }
})
