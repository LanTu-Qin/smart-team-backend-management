// ============================================================================
// users store —— 只做两件事：存"服务端返回的当前状态" + 转发 api 调用
// ----------------------------------------------------------------------------
// ⚠️ 对比旧版：旧 store 里直接放种子数据 + 自己增删改（addUser/removeUser），
//    那等于把"数据库"搬进了前端。现在的分工是：
//      页面（展示） → store（状态与编排） → api（数据从哪来） → mock/真后端
//    并且 **store 的 action 与契约接口一一对应**：契约里没有"新增用户/删除用户"，
//    所以 store 里也不该有 —— 前端做不到的事，就不要在 UI 上给入口。
// ============================================================================

import { defineStore } from 'pinia'
import { getUserDetail, listUsers, setAdmin } from '@/api/users'

export const useUsersStore = defineStore('users', {
  state: () => ({
    // 列表（服务端分页后的当前页）
    list: [],
    total: 0,
    page: 1,
    pageSize: 10,
    // 查询条件：跟着请求发给服务端（契约 1.4）
    keyword: '',
    role: '',
    loading: false,
    // 详情（只有详情接口下发 email，见契约 1.5 脱敏）
    detail: null,
    detailLoading: false,
  }),

  getters: {
    isEmpty: (s) => !s.loading && s.list.length === 0,
  },

  actions: {
    /** 拉列表：GET /users?keyword&role&page&pageSize */
    async fetchList() {
      this.loading = true
      try {
        const { list, total, page, pageSize } = await listUsers({
          keyword: this.keyword,
          role: this.role,
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

    /** 改查询条件并回到第 1 页（服务端分页：筛选变化必须重新请求） */
    applyFilter({ keyword = this.keyword, role = this.role } = {}) {
      this.keyword = keyword
      this.role = role
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

    /** 详情：GET /users/:uid */
    async fetchDetail(uid) {
      this.detailLoading = true
      try {
        this.detail = await getUserDetail(uid)
        return this.detail
      } finally {
        this.detailLoading = false
      }
    },

    clearDetail() {
      this.detail = null
    },

    /** 授予/取消管理员：PATCH /users/:uid/admin（成功后重新拉列表，保证与服务端一致） */
    async toggleAdmin(uid, isAdmin) {
      await setAdmin(uid, isAdmin)
      await this.fetchList()
    },
  },
})
