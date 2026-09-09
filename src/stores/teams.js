import { defineStore } from 'pinia'
import { loadCollection, saveCollection, todayStr } from './collection'

const SEED = [
  { id: 1, name: '算法突击队', category: '算法', captain: '王宇翔', members: ['苏子航', '许文博', '郑凯文'], status: 'active', points: 3620, createdAt: '2026-01-06' },
  { id: 2, name: '二进制拆弹组', category: '算法', captain: '许文博', members: ['郑凯文', '谢明轩'], status: 'active', points: 3140, createdAt: '2026-01-18' },
  { id: 3, name: '云端筑梦师', category: '工程', captain: '赵梦琪', members: ['李雨桐', '何家乐', '罗欣妍'], status: 'active', points: 2880, createdAt: '2026-02-11' },
  { id: 4, name: 'Data Pirates', category: '数据', captain: '林一诺', members: ['孙若曦', '高天宇'], status: 'active', points: 2560, createdAt: '2026-02-24' },
  { id: 5, name: '量子纠缠队', category: '算法', captain: '苏子航', members: ['王宇翔', '谢明轩', '何家乐'], status: 'frozen', points: 1990, createdAt: '2026-03-05' },
  { id: 6, name: '像素守望者', category: '工程', captain: '罗欣妍', members: ['李雨桐', '赵梦琪'], status: 'active', points: 1740, createdAt: '2026-03-27' },
  { id: 7, name: '智算未来', category: '数据', captain: '孙若曦', members: ['林一诺'], status: 'active', points: 1430, createdAt: '2026-04-16' },
  { id: 8, name: '键盘侠客行', category: '综合', captain: '周浩宇', members: ['高天宇', '陈梓萌'], status: 'frozen', points: 980, createdAt: '2026-05-08' },
]

export const useTeamsStore = defineStore('teams', {
  state: () => loadCollection('teams', SEED),

  getters: {
    total: (s) => s.items.length,
    activeCount: (s) => s.items.filter((i) => i.status === 'active').length,
    byCategory: (s) => (cat) => s.items.filter((i) => i.category === cat).length,
    // 按积分取榜单
    ranking: (s) => [...s.items].sort((a, b) => b.points - a.points).slice(0, 5),
  },

  actions: {
    addTeam(payload) {
      const id = this.nextId++
      const item = { id, members: [], points: 0, createdAt: todayStr(), ...payload }
      this.items.unshift(item)
      this.persist()
      return item
    },
    updateTeam(id, patch) {
      const i = this.items.find((x) => x.id === id)
      if (i) Object.assign(i, patch)
      this.persist()
    },
    removeTeam(id) {
      this.items = this.items.filter((x) => x.id !== id)
      this.persist()
    },
    persist() {
      saveCollection('teams', this)
    },
  },
})
