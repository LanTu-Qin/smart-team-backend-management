import { defineStore } from 'pinia'
import { loadCollection, saveCollection, todayStr } from './collection'

const SEED = [
  { id: 1, title: '第 42 届国际大学生程序设计竞赛', host: '中国计算机学会', type: '编程竞赛', startDate: '2026-09-12', endDate: '2026-09-14', status: 'ongoing', registered: 168, quota: 200, createdAt: '2026-03-01' },
  { id: 2, title: '高校开发者黑客马拉松', host: '智队搭平台', type: '黑客马拉松', startDate: '2026-10-18', endDate: '2026-10-19', status: 'upcoming', registered: 96, quota: 120, createdAt: '2026-04-10' },
  { id: 3, title: '人工智能创新挑战赛', host: '青藤科技', type: 'AI 挑战赛', startDate: '2026-11-06', endDate: '2026-11-08', status: 'upcoming', registered: 74, quota: 100, createdAt: '2026-04-22' },
  { id: 4, title: '数据挖掘算法大赛', host: '数据科学协会', type: '数据大赛', startDate: '2026-07-15', endDate: '2026-07-17', status: 'finished', registered: 142, quota: 150, createdAt: '2026-02-01' },
  { id: 5, title: '全国高校数学建模邀请赛', host: '数模组委会', type: '数学建模', startDate: '2026-08-08', endDate: '2026-08-10', status: 'finished', registered: 210, quota: 220, createdAt: '2026-01-12' },
  { id: 6, title: '青少年网络安全夺旗赛', host: '网络空间安全学会', type: 'CTF 夺旗赛', startDate: '2026-12-05', endDate: '2026-12-06', status: 'upcoming', registered: 58, quota: 80, createdAt: '2026-05-15' },
]

export const useCompetitionsStore = defineStore('competitions', {
  state: () => loadCollection('competitions', SEED),

  getters: {
    total: (s) => s.items.length,
    ongoingCount: (s) => s.items.filter((i) => i.status === 'ongoing').length,
    upcomingCount: (s) => s.items.filter((i) => i.status === 'upcoming').length,
    totalRegistered: (s) => s.items.reduce((sum, i) => sum + (i.registered || 0), 0),
    byStatus: (s) => (status) => s.items.filter((i) => i.status === status),
  },

  actions: {
    addCompetition(payload) {
      const id = this.nextId++
      const item = { id, createdAt: todayStr(), ...payload }
      this.items.unshift(item)
      this.persist()
      return item
    },
    updateCompetition(id, patch) {
      const i = this.items.find((x) => x.id === id)
      if (i) Object.assign(i, patch)
      this.persist()
    },
    removeCompetition(id) {
      this.items = this.items.filter((x) => x.id !== id)
      this.persist()
    },
    persist() {
      saveCollection('competitions', this)
    },
  },
})
