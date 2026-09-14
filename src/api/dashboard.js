// ============================================================================
// 看板统计接口层 —— 严格按 docs/api.md 第 3 节实现（[后端新增]，跨集合聚合）
//
//   Tier-2 长这样：
//     export const getOverview = () => client.get('/dashboard/overview')
//
// ⚠️ 契约明确**不做"新增趋势"折线**：user / teams 集合都没有 createdAt 字段，
//    硬补会得到一条历史断裂的假曲线。宁可不做，也不画假数据。
// ============================================================================

import { mockApi } from './client'
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

/** GET /dashboard/overview —— 所有数字都必须能回答"它从哪来" */
export const getOverview = mockApi(() => {
  const users = getUsers()
  const teams = getTeams()
  const comps = getCompetitions()

  // teamsPerComp：展开每支队伍的 cid_list 计数，取前 6（契约第 3 节：可算）
  const compName = (cid) => comps.find((c) => c.cid === cid)?.name || `赛事 ${cid}`
  const perComp = new Map()
  teams.forEach((t) => (t.cid_list || []).forEach((cid) => {
    perComp.set(cid, (perComp.get(cid) || 0) + 1)
  }))
  const teamsPerComp = [...perComp.entries()]
    .map(([cid, value]) => ({ cid, name: compName(cid), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

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
    teamsPerComp,
  }
})
