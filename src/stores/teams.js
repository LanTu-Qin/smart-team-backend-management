// ============================================================================
// teams store —— 只做两件事：存"服务端返回的当前状态" + 编排请求
// ----------------------------------------------------------------------------
// ⚠️ 对比旧版：旧 store 自己维护种子数组并 addTeam/updateTeam/removeTeam，
//    那是把"数据库"搬进了前端。现在：
//      · 数据从哪来 → api/teams.js
//      · 写操作只保留契约里有的 DELETE（管理端队伍页 = 只读 + 删除，契约第 6 节）
//    "创建队伍 / 编辑队伍 / 加人"在小程序端完成，管理端不提供入口：
//    前端做不到的事，就不要在 UI 上给按钮。
// ============================================================================

import { defineStore } from 'pinia'
import { deleteTeam, getTeamDetail, listTeams } from '@/api/teams'
import { listCompetitions } from '@/api/competitions'

export const useTeamsStore = defineStore('teams', {
  state: () => ({
    list: [],
    total: 0,
    page: 1,
    pageSize: 8,
    // 筛选条件：契约只有"按赛事 cid 过滤"，没有队伍名搜索
    cid: '',
    loading: false,
    // 赛事下拉 + cid → 名称回填（ cid_list 只有一个数字，展示需要名字）
    compOptions: [],
    detail: null,
    detailLoading: false,
  }),

  getters: {
    isEmpty: (s) => !s.loading && s.list.length === 0,
    /** cid → 赛事名称；取不到就显示原始 id，不猜 */
    compName: (s) => (cid) => s.compOptions.find((c) => c.cid === cid)?.name || `赛事 ${cid}`,
  },

  actions: {
    /** 页面初始化：赛事下拉与队伍列表互不依赖，顺序拉取即可 */
    async init() {
      await this.loadCompOptions()
      return this.fetchList()
    },

    /** 赛事下拉：全量拉取（管理端量级小，无需分页） */
    async loadCompOptions() {
      const { list } = await listCompetitions({ pageSize: 100 })
      this.compOptions = list
    },

    /** GET /teams?cid&page&pageSize */
    async fetchList() {
      this.loading = true
      try {
        const { list, total, page, pageSize } = await listTeams({
          cid: this.cid,
          page: this.page,
          pageSize: this.pageSize,
        })
        this.list = list
        this.total = total
        this.page = page
        this.pageSize = pageSize
      } catch (err) {
        this.list = []
        this.total = 0
        throw err
      } finally {
        this.loading = false
      }
    },

    applyFilter({ cid = this.cid } = {}) {
      this.cid = cid
      this.page = 1
      return this.fetchList()
    },

    goPage(page) {
      this.page = page
      return this.fetchList()
    },

    changePageSize(pageSize) {
      this.pageSize = pageSize
      this.page = 1
      return this.fetchList()
    },

    /** GET /teams/:tid */
    async fetchDetail(tid) {
      this.detailLoading = true
      try {
        this.detail = await getTeamDetail(tid)
        return this.detail
      } finally {
        this.detailLoading = false
      }
    },

    clearDetail() {
      this.detail = null
    },

    /** DELETE /teams/:tid —— 删完重新拉列表，保证与服务端一致 */
    async remove(tid) {
      await deleteTeam(tid)
      // 末页最后一条被删：退回上一页，避免停在空页
      if (this.list.length === 1 && this.page > 1) this.page -= 1
      await this.fetchList()
    },
  },
})
