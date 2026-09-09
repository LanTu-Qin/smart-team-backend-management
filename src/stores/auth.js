import { defineStore } from 'pinia'

const KEY = 'stb-auth'
const ACCOUNTS = [
  { username: 'admin', password: 'admin123', name: '陈梓萌', role: '管理员' },
  { username: 'demo', password: '123456', name: '林一诺', role: '赛事组织者' },
]

function loadUser() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    /* ignore */
  }
  return null
}

export const useAuthStore = defineStore('auth', {
  state: () => ({ user: loadUser() }),

  getters: {
    isLoggedIn: (s) => !!s.user,
  },

  actions: {
    login({ username, password }) {
      const account = ACCOUNTS.find(
        (a) => a.username === username.trim() && a.password === password,
      )
      if (!account) return { ok: false, message: '账号或密码错误，请重试' }
      this.user = { username: account.username, name: account.name, role: account.role }
      localStorage.setItem(KEY, JSON.stringify(this.user))
      return { ok: true }
    },
    logout() {
      this.user = null
      localStorage.removeItem(KEY)
    },
  },
})
