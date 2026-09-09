import { defineStore } from 'pinia'
import { loadCollection, saveCollection, todayStr } from './collection'

// 演示种子数据
const SEED = [
  { id: 1, name: '陈梓萌', email: 'chenzm@smartteam.cn', role: 'admin', status: 'active', rating: 2310, createdAt: '2025-11-03' },
  { id: 2, name: '林一诺', email: 'linyn@smartteam.cn', role: 'organizer', status: 'active', rating: 1985, createdAt: '2025-11-16' },
  { id: 3, name: '王宇翔', email: 'wangyx@stu.smartteam.cn', role: 'player', status: 'active', rating: 2102, createdAt: '2025-12-02' },
  { id: 4, name: '苏子航', email: 'suzh@stu.smartteam.cn', role: 'player', status: 'active', rating: 1766, createdAt: '2025-12-19' },
  { id: 5, name: '赵梦琪', email: 'zhaomq@stu.smartteam.cn', role: 'player', status: 'active', rating: 1893, createdAt: '2026-01-08' },
  { id: 6, name: '周浩宇', email: 'zhouhy@stu.smartteam.cn', role: 'player', status: 'disabled', rating: 1542, createdAt: '2026-01-21' },
  { id: 7, name: '李雨桐', email: 'liyt@stu.smartteam.cn', role: 'player', status: 'active', rating: 1720, createdAt: '2026-02-14' },
  { id: 8, name: '郑凯文', email: 'zhengkw@stu.smartteam.cn', role: 'player', status: 'active', rating: 2011, createdAt: '2026-02-27' },
  { id: 9, name: '孙若曦', email: 'sunrx@smartteam.cn', role: 'organizer', status: 'active', rating: 1588, createdAt: '2026-03-09' },
  { id: 10, name: '何家乐', email: 'hejl@stu.smartteam.cn', role: 'player', status: 'active', rating: 1677, createdAt: '2026-03-22' },
  { id: 11, name: '高天宇', email: 'gaoty@stu.smartteam.cn', role: 'player', status: 'disabled', rating: 1330, createdAt: '2026-04-05' },
  { id: 12, name: '罗欣妍', email: 'luoxy@stu.smartteam.cn', role: 'player', status: 'active', rating: 1880, createdAt: '2026-04-18' },
  { id: 13, name: '谢明轩', email: 'xiemx@stu.smartteam.cn', role: 'player', status: 'active', rating: 1719, createdAt: '2026-05-02' },
  { id: 14, name: '许文博', email: 'xuwb@stu.smartteam.cn', role: 'player', status: 'active', rating: 2044, createdAt: '2026-05-20' },
]

export const useUsersStore = defineStore('users', {
  state: () => loadCollection('users', SEED),

  getters: {
    total: (s) => s.items.length,
    activeCount: (s) => s.items.filter((i) => i.status === 'active').length,
    byRole: (s) => (role) => s.items.filter((i) => i.role === role).length,
    playerOptions: (s) => s.items.filter((i) => i.status === 'active').map((i) => ({ value: i.name, id: i.id })),
  },

  actions: {
    addUser(payload) {
      const id = this.nextId++
      const item = { id, createdAt: todayStr(), rating: 0, ...payload }
      this.items.unshift(item)
      this.persist()
      return item
    },
    updateUser(id, patch) {
      const i = this.items.find((x) => x.id === id)
      if (i) Object.assign(i, patch)
      this.persist()
    },
    removeUser(id) {
      this.items = this.items.filter((x) => x.id !== id)
      this.persist()
    },
    persist() {
      saveCollection('users', this)
    },
  },
})
