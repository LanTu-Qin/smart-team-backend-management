// ============================================================================
// 看板统计接口层 —— 严格按 docs/api.md 第 3 节实现（跨集合聚合）
//
// 契约端点是 GET /dashboard/overview —— 一个**服务端聚合**接口（[后端新增]，契约第 8 节第 2 条）。
// 它目前**还没实现**，所以真后端模式下这里有一个显式的临时方案（下面第 3 节），
// 而不是"悄悄返回 mock 数据" —— 看板与列表页的数字口径必须永远一致，混着来最危险。
//
// ⚠️ 契约明确**不做"新增趋势"折线**：user / teams 集合都没有 createdAt 字段，
//    硬补会得到一条历史断裂的假曲线。宁可不做，也不画假数据。
// ============================================================================

import { USE_MOCK, callCloud, mockApi } from './client'
import { getCompetitions, getTeams, getUsers } from './mock/db'

/** 按字段分组计数 → [{name, value}]，按数量降序（图表直接用） */
function groupBy(rows, key) {
  const map = new Map()
  rows.forEach((r) => {
    const k = r[key] || '未标注'
    map.set(k, (map.get(k) || 0) + 1)
  })
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

/** teamsPerComp：展开每支队伍的 cid_list 计数，取前 6（契约第 3 节：可算） */
function teamsPerComp(teams, compName) {
  const perComp = new Map()
  teams.forEach((t) =>
    (t.cid_list || []).forEach((cid) => {
      perComp.set(cid, (perComp.get(cid) || 0) + 1)
    }),
  )
  return [...perComp.entries()]
    .map(([cid, value]) => ({ cid, name: compName(cid), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
}

/* ==========================================================================
 * 一、mock 实现（Tier-1）
 * ========================================================================== */

/** GET /dashboard/overview —— 所有数字都必须能回答"它从哪来" */
const mockGetOverview = mockApi(() => {
  const users = getUsers()
  const teams = getTeams()
  const comps = getCompetitions()
  const compName = (cid) => comps.find((c) => c.cid === cid)?.name || `赛事 ${cid}`

  return {
    userTotal: users.length,
    teamTotal: teams.length,
    compTotal: comps.length,
    openCompCount: comps.filter((c) => c.status === '报名中').length,
    matchingUsers: users.filter((u) => u.is_matching).length,
    matchingTeams: teams.filter((t) => t.is_matching).length,
    distByLevel: groupBy(comps, 'level'),
    distByStatus: groupBy(comps, 'status'),
    distByType: groupBy(comps, 'type'),
    teamsPerComp: teamsPerComp(teams, compName),
  }
})

/* ==========================================================================
 * 二、真实实现（云函数）—— 临时方案：前端聚合
 * ==========================================================================
 *
 * 【为什么是临时的】契约要的是**一次服务端聚合**（一次请求返回所有数字）。
 *   服务端那个 action 还没做，而看板又是首页 —— 与其让它空着或显示假数据，
 *   这里先按"契约字段口径"在前端把三次列表查询的结果聚合出来，并把 `partial` 标记出来：
 *     - 好处：数字全部来自真实库，与各列表页同源，不会出现"看板说 100、列表只有 12"；
 *     - 代价：**它是 O(全表) 的**：要拉全量用户/队伍/赛事才能算 is_matching 与分组。
 *       数据量上去以后（用户破千）必须换回服务端聚合 —— 这也正是契约把它列为后端待做的原因。
 *   `partial: true` 表示"翻页上限内没取全"，此时页面上数字是偏小的，必须让用户看得见。
 * ========================================================================== */

/** 单页上限 100（服务端强约束），最多翻 10 页 = 1000 行，取不全就标记 partial */
const PAGE_SIZE = 100
const MAX_PAGES = 10

async function fetchAll(listFn) {
  const first = (await listFn({ page: 1, pageSize: PAGE_SIZE })) || {}
  const rows = Array.isArray(first.list) ? [...first.list] : []
  const total = Number(first.total) || rows.length

  let page = 1
  while (rows.length < total && page < MAX_PAGES) {
    page += 1
    const next = (await listFn({ page, pageSize: PAGE_SIZE })) || {}
    const batch = Array.isArray(next.list) ? next.list : []
    if (!batch.length) break // 服务端说还有、但这一页空了：防死循环
    rows.push(...batch)
  }
  return { rows, total, partial: rows.length < total }
}

async function cloudGetOverview() {
  // 团队这里直接用 callCloud 取**原始行**：看板只需要 is_matching / cid_list / name，
  // 走 api/teams.js 会顺带做"成员姓名 + 技能名"回填，对看板是纯浪费
  const [users, teams, comps] = await Promise.all([
    fetchAll((p) => callCloud('userApi', 'getPage', p)),
    fetchAll((p) => callCloud('teamsApi', 'getPage', p)),
    fetchAll((p) => callCloud('competitionApi', 'getPage', p)),
  ])

  const compName = (cid) => comps.rows.find((c) => c.cid === cid)?.name || `赛事 ${cid}`

  return {
    userTotal: users.total,
    teamTotal: teams.total,
    compTotal: comps.total,
    openCompCount: comps.rows.filter((c) => c.status === '报名中').length,
    matchingUsers: users.rows.filter((u) => u.is_matching).length,
    matchingTeams: teams.rows.filter((t) => t.is_matching).length,
    distByLevel: groupBy(comps.rows, 'level'),
    distByStatus: groupBy(comps.rows, 'status'),
    distByType: groupBy(comps.rows, 'type'),
    teamsPerComp: teamsPerComp(teams.rows, compName),
    // 临时方案的自曝标记：前端聚合 + 是否取全（服务端聚合上线后这两个字段即可删除）
    aggregatedOnClient: true,
    partial: users.partial || teams.partial || comps.partial,
  }
}

/* ==========================================================================
 * 三、对外接口（按模式二选一）
 * ========================================================================== */

/** GET /dashboard/overview —— 总量 / 报名中赛事 / 匹配中用户与队伍 / 三个分布 / 队伍数 Top6 */
export const getOverview = USE_MOCK ? mockGetOverview : cloudGetOverview
