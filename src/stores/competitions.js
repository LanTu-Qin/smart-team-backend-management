// ============================================================================
// competitions store —— 只做两件事：存"服务端返回的当前状态" + 编排请求
// ----------------------------------------------------------------------------
// ⚠️ 对比旧版：旧 store 自带 SEED 数组（title/host/registered/quota 全是虚构字段）
//    并自己增删改。现在字段全部按契约第 4 节 DTO（name/url/level/type/status…），
//    写操作一律经 api/competitions.js，成功后重新拉列表，前端不自己拼数据。
// ============================================================================

import { defineStore } from 'pinia'
import {
  createCompetition,
  deleteCompetition,
  generateAiDetail,
  listCompetitions,
  updateCompetition,
} from '@/api/competitions'

export const useCompetitionsStore = defineStore('competitions', {
  state: () => ({
    list: [],
    total: 0,
    page: 1,
    pageSize: 8,
    // 查询条件：契约只提供 keyword + status
    keyword: '',
    status: '',
    loading: false,
    // 新建/编辑提交中（与列表 loading 分开，避免弹窗按钮和表格互相干扰）
    submitting: false,
    // AI 生成中：行级状态（10~25s 慢接口），不能升级成整页 loading，否则这段时间无法翻页
    generatingCid: null,
  }),

  getters: {
    isEmpty: (s) => !s.loading && s.list.length === 0,
    /** 行级 loading：只有 cid 命中的那一行按钮转圈 + 禁用 */
    isGenerating: (s) => (cid) => s.generatingCid === Number(cid),
  },

  actions: {
    /** GET /competitions?page&pageSize&keyword&status */
    async fetchList() {
      this.loading = true
      try {
        const { list, total, page, pageSize } = await listCompetitions({
          keyword: this.keyword,
          status: this.status,
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

    applyFilter({ keyword = this.keyword, status = this.status } = {}) {
      this.keyword = keyword
      this.status = status
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

    /** POST /competitions —— 新建后回到第 1 页，让人立刻看到结果 */
    async create(payload) {
      this.submitting = true
      try {
        const created = await createCompetition(payload)
        this.page = 1
        await this.fetchList()
        return created
      } finally {
        this.submitting = false
      }
    },

    /** PATCH /competitions/:cid —— 局部更新后重拉当前页（以服务端返回为准） */
    async update(cid, payload) {
      this.submitting = true
      try {
        const updated = await updateCompetition(cid, payload)
        await this.fetchList()
        return updated
      } finally {
        this.submitting = false
      }
    },

    /**
     * POST /competitions/:cid/ai-detail —— AI 生成简介（10~25s 慢接口）
     * 只置**行级** generatingCid，成功就刷新那一行；期间列表仍可正常翻页 / 查询。
     * @returns {Promise<string>} 生成的 content
     */
    async generateAiDetail(cid) {
      const id = Number(cid)
      if (!Number.isInteger(id)) throw new Error('赛事 cid 必须为数字')
      if (this.generatingCid !== null) throw new Error('已有赛事正在生成简介，请稍候再试')

      this.generatingCid = id
      try {
        const { content } = await generateAiDetail(id)
        const row = this.list.find((c) => c.cid === id)
        if (row) row.content = content // 就地刷新该行，避免整页 loading 打断浏览
        else await this.fetchList() // 已翻走：以重拉列表兜底
        return content
      } finally {
        if (this.generatingCid === id) this.generatingCid = null
      }
    },

    /** DELETE /competitions/:cid */
    async remove(cid) {
      await deleteCompetition(cid)
      if (this.list.length === 1 && this.page > 1) this.page -= 1
      await this.fetchList()
    },
  },
})
