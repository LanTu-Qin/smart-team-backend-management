// ============================================================================
// 队伍接口层 —— 严格按 docs/api.md 第 6 节实现
// 管理端队伍页定位：**只读 + 删除**（组队/加人/匹配属于 C 端小程序，契约明确不纳入 v1）
//
// 两种实现同签名：mock（Tier-1）｜ 云函数（Tier-2，teamsApi）
//   GET    /teams?cid&page&pageSize → teamsApi.getPage（零鉴权）
//   GET    /teams/:tid              → teamsApi.getByTid
//   DELETE /teams/:tid              → teamsApi.delete（Web 端走 adminToken 通道）
//
// 【为什么这一层的映射代码最多】真实 `teamsApi` 返回的是**数据库原样的行**：
//     members / team_needs / team_missing 是对象 map，leader 是裸 uid，advisor 是裸 uid 数组，
//     而且不剔 `_id`。契约第 6 节要求的是"数组 + 回填姓名"的视图模型。
//     云开发没有网关帮我们做这件事，所以这一层就是"契约 ≠ 数据库行"的落点：
//     先补人（userApi.getBatchUids）、再补技能名（skillApi.getAll），然后拼 DTO。
// ============================================================================

import { ApiError, USE_MOCK, callCloud, mockApi } from './client'
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

/* ==========================================================================
 * 一、真实实现（云函数 teamsApi）
 * ========================================================================== */

/** 技能 sid → 名称：字典表变化少，单页浏览期间缓存（避免每翻一页都拉全表） */
let skillDictPromise = null

function skillDict() {
  if (!skillDictPromise) {
    skillDictPromise = callCloud('skillApi', 'getAll')
      .then((list) => {
        const map = new Map()
        ;(Array.isArray(list) ? list : []).forEach((s) => map.set(Number(s.sid), s.name || ''))
        return map
      })
      .catch((err) => {
        skillDictPromise = null // 失败不缓存
        throw err
      })
  }
  return skillDictPromise
}

/**
 * 批量取 uid → {username, avatar}
 * ⚠️ `getBatchUids` 的入参名是 **uidList**（不是 uids），且**不做 Number 归一** →
 *    必须传数字数组，否则匹配不到库里 number 型的 userInfo.uid。
 * ⚠️ 它返回的是**原始嵌套文档**（`userInfo.xxx`，含 `_id`/`_openid`），不是扁平 DTO。
 */
async function buildUserMap(uids) {
  const ids = [...new Set(uids.map(Number).filter((n) => Number.isFinite(n)))]
  if (!ids.length) return new Map()
  const rows = await callCloud('userApi', 'getBatchUids', { uidList: ids })
  const map = new Map()
  ;(Array.isArray(rows) ? rows : []).forEach((doc) => {
    const info = doc.userInfo || doc // 兜底：万一以后改成扁平 DTO
    const uid = Number(info.uid)
    if (Number.isFinite(uid)) {
      map.set(uid, { username: info.username || '', avatar: info.avatar || '' })
    }
  })
  return map
}

/** 收集一页队伍里出现的所有 uid（队长 + 成员 + 指导老师） */
function collectUids(teams) {
  const uids = []
  teams.forEach((t) => {
    if (t.leader != null) uids.push(t.leader)
    Object.keys(t.members || {}).forEach((uid) => uids.push(uid))
    ;(t.advisor || []).forEach((uid) => uids.push(uid))
    if (t.teacher_uid) uids.push(t.teacher_uid) // 旧字段兼容
  })
  return uids
}

/** 数据库原形 → 契约 DTO（契约第 6 节） */
function toCloudDto(team, userMap, skillMap) {
  const nameOf = (uid) => userMap.get(Number(uid))?.username || '—'
  const nameOfSkill = (sid) => skillMap.get(Number(sid)) || `技能 ${sid}`

  // `_id` 是内部主键：teamsApi 没有像 userApi/competitionApi 那样剔除它，
  // 这里补一刀（已经在契约第 8 节记为待整改项），避免文档主键流进页面与 store
  const { _id, ...row } = team

  return {
    ...row,
    needs: Object.entries(team.team_needs || {}).map(([sid, count]) => ({
      sid: Number(sid),
      name: nameOfSkill(sid),
      count,
    })),
    missing: Object.entries(team.team_missing || {}).map(([sid, count]) => ({
      sid: Number(sid),
      name: nameOfSkill(sid),
      count,
    })),
    leader: { uid: Number(team.leader), username: nameOf(team.leader) },
    advisor: (team.advisor || []).map((uid) => ({ uid: Number(uid), username: nameOf(uid) })),
    members: Object.entries(team.members || {}).map(([uid, skillId]) => {
      const u = userMap.get(Number(uid)) || {}
      return {
        uid: Number(uid),
        skillId,
        username: u.username || `#${uid}`,
        avatar: u.avatar || '',
        skillName: nameOfSkill(skillId),
      }
    }),
  }
}

/** 给一批原始行补齐人 / 技能字典，并映射成 DTO */
async function enrich(rows) {
  const [userMap, skillMap] = await Promise.all([
    buildUserMap(collectUids(rows)),
    skillDict(),
  ])
  return rows.map((t) => toCloudDto(t, userMap, skillMap))
}

/**
 * GET /teams?cid&page&pageSize
 * 注意：契约里**没有 keyword 搜索**（真实 getPage 只支持 cid 过滤 + 分页），
 * 所以管理端 v1 也不提供队伍名搜索，避免做出"看起来能用、接后端就废"的功能。
 */
async function cloudListTeams({ cid = '', page = 1, pageSize = 10 } = {}) {
  const data =
    (await callCloud('teamsApi', 'getPage', {
      // cid 为空串时服务端不做筛选（源码判断的是 undefined / null / ''）
      cid,
      page,
      pageSize,
    })) || {}
  const rows = Array.isArray(data.list) ? data.list : []
  return {
    list: await enrich(rows),
    total: data.total || 0,
    page: data.page || page,
    pageSize: data.pageSize || pageSize,
  }
}

/** GET /teams/:tid —— 队伍详情（真实 action 叫 getByTid；查不到返回 data:null） */
async function cloudGetTeamDetail(tid) {
  const row = await callCloud('teamsApi', 'getByTid', { tid: Number(tid) })
  if (!row) throw new ApiError(-404, `队伍 ${tid} 不存在`)
  const [dto] = await enrich([row])
  return dto
}

/**
 * DELETE /teams/:tid —— 危险操作：服务端联动清理成员 tid_list / onGoing_cid / 匹配池 / 指导老师关系
 *
 * 【鉴权说明】Web 端没有 OPENID，走的是 `ensureAdmin(event)` 的 adminToken 通道
 * （`teamsApi.delete` 是唯一带双通道的写操作；**其余写操作在 Web 端恒 -401**，
 *  因为 `checkTeamPerm` 第一条就要求小程序身份 —— 所以管理端不做"编辑队伍"入口）。
 * 权限判定全部在云函数，前端只负责"不给非管理员显示入口"。
 */
async function cloudDeleteTeam(tid) {
  await callCloud('teamsApi', 'delete', { tid: Number(tid) })
  return { tid: Number(tid) }
}

/* ==========================================================================
 * 二、mock 实现（Tier-1）
 * ========================================================================== */

/**
 * 数据库原形 → 契约 DTO（mock 站在后端的位置；Tier-2 由上面的 enrich 做同样的事）
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

const mockListTeams = mockApi(({ cid = '', page = 1, pageSize = 10 } = {}) => {
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

const mockGetTeamDetail = mockApi((tid) => {
  const team = getTeams().find((t) => t.tid === Number(tid))
  if (!team) throw new ApiError(-404, `队伍 ${tid} 不存在`)
  return toDto(team)
})

const mockDeleteTeam = mockApi((tid) => {
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

/* ==========================================================================
 * 三、对外接口（按模式二选一）
 * ========================================================================== */

/** GET /teams?cid&page&pageSize —— 队伍列表（可按赛事 cid 过滤） */
export const listTeams = USE_MOCK ? mockListTeams : cloudListTeams

/** GET /teams/:tid —— 队伍详情 */
export const getTeamDetail = USE_MOCK ? mockGetTeamDetail : cloudGetTeamDetail

/** DELETE /teams/:tid —— 删除队伍（服务端联动清理引用） */
export const deleteTeam = USE_MOCK ? mockDeleteTeam : cloudDeleteTeam
