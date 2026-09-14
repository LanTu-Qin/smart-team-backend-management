// ============================================================================
// dashboard store —— 看板不做任何"自己算"的事
// ----------------------------------------------------------------------------
// 旧版看板的统计是前端拿三个 store 的数组在页面里 count 出来的（还混着积分、报名数
// 这类虚构字段）。现在跨集合聚合是**后端职责**：GET /dashboard/overview 一次返回，
// 页面只负责渲染。这样看板与列表页的数据口径永远一致。
// ============================================================================

import { defineStore } from 'pinia'
import { getOverview } from '@/api/dashboard'

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    overview: null,
    loading: false,
  }),

  getters: {
    /** 兼容首屏：数据还没到时给出安全默认值，避免模板到处判空 */
    data: (s) =>
      s.overview || {
        userTotal: 0,
        teamTotal: 0,
        compTotal: 0,
        openCompCount: 0,
        matchingUsers: 0,
        matchingTeams: 0,
        distByLevel: [],
        distByStatus: [],
        distByType: [],
        teamsPerComp: [],
      },
    isEmpty: (s) => !s.loading && !s.overview,
  },

  actions: {
    /** GET /dashboard/overview */
    async fetchOverview() {
      this.loading = true
      try {
        this.overview = await getOverview()
        return this.overview
      } finally {
        this.loading = false
      }
    },
  },
})
