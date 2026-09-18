// ============================================================================
// skills store —— 存"服务端返回的当前状态" + 编排请求
// ----------------------------------------------------------------------------
// 与 users / teams / competitions 的差异：**这里不做服务端分页**。
// 契约第 7 节的 GET /skills 是"全表"接口（字典表数据量小），所以搜索在本地过滤即可，
// 不需要发请求。判断依据是数据规模，不是习惯 —— 字典表 25 条，users 上千条。
// ============================================================================

import { defineStore } from 'pinia'
import { createSkill, deleteSkill, listSkills, updateSkill } from '@/api/skills'

export const useSkillsStore = defineStore('skills', {
  state: () => ({
    list: [],
    loading: false,
    submitting: false,
    // 本地搜索关键词（全表已在前端，无需请求）
    keyword: '',
  }),

  getters: {
    isEmpty: (s) => !s.loading && s.list.length === 0,
    /** 本地过滤：技能名 + 描述，不区分大小写 */
    filtered: (s) => {
      const kw = s.keyword.trim().toLowerCase()
      if (!kw) return s.list
      return s.list.filter(
        (x) => x.name.toLowerCase().includes(kw) || (x.desc || '').toLowerCase().includes(kw),
      )
    },
    /** 按 sid 升序（字典表的自然顺序，别用后端返回顺序） */
    sorted: (s) => [...s.filtered].sort((a, b) => a.sid - b.sid),
    usedCount: (s) => s.list.filter((x) => x.usage.users > 0 || x.usage.teams > 0).length,
  },

  actions: {
    /** GET /skills */
    async fetchList() {
      this.loading = true
      try {
        this.list = await listSkills()
      } catch (err) {
        this.list = []
        throw err
      } finally {
        this.loading = false
      }
    },

    setKeyword(keyword) {
      this.keyword = keyword
    },

    /** POST /skills —— 新增（真实 skillApi.add 支持 name + desc） */
    async create(payload) {
      this.submitting = true
      try {
        await createSkill(payload)
        await this.fetchList()
      } finally {
        this.submitting = false
      }
    },

    /** PATCH /skills/:sid —— 改名 / 改描述 */
    async update(sid, payload) {
      this.submitting = true
      try {
        await updateSkill(sid, payload)
        await this.fetchList()
      } finally {
        this.submitting = false
      }
    },

    /** DELETE /skills/:sid —— 被引用时后端会拒绝（code 2），由页面提示 */
    async remove(sid) {
      await deleteSkill(sid)
      await this.fetchList()
    },
  },
})
