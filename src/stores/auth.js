// ============================================================================
// auth store —— 只做两件事：存"当前登录态" + 转发 api 调用
// ----------------------------------------------------------------------------
// ⚠️ 对比旧版：账号表曾经写死在 store 里（admin/admin123），那是把"用户库"搬进了前端。
//    现在账号校验属于 api/auth.js 的职责，store 只负责拿到 token/user 后记住它。
//    会话持久化属于"客户端会话"而非业务数据，所以留在 store（Tier-2 换成 cookie 同理）。
// ============================================================================

import { defineStore } from 'pinia'
import { getMe, login as apiLogin, logout as apiLogout } from '@/api/auth'

const KEY = 'stb-auth'

function loadSession() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    /* 忽略损坏的会话数据：按未登录处理 */
  }
  return null
}

export const useAuthStore = defineStore('auth', {
  state: () => {
    const session = loadSession()
    return {
      token: session?.token || '',
      user: session?.user || null,
      loading: false,
      // 本次会话是否已用 /auth/me 校验过：刷新页面后是 false，路由守卫会校验一次
      sessionChecked: false,
    }
  },

  getters: {
    isLoggedIn: (s) => !!s.token && !!s.user,
  },

  actions: {
    /** POST /auth/login —— 失败时抛出 ApiError，由页面决定怎么提示 */
    async login(payload) {
      this.loading = true
      try {
        const { token, user } = await apiLogin(payload)
        this.token = token
        this.user = user
        // 刚登录成功，token 是新签发的，本次会话无需再校验
        this.sessionChecked = true
        localStorage.setItem(KEY, JSON.stringify({ token, user }))
        return user
      } finally {
        this.loading = false
      }
    },

    /** POST /auth/logout —— 后端注销失败也要清本地，否则用户会被卡在"已登录但无权" */
    async logout() {
      try {
        if (this.token) await apiLogout()
      } catch (e) {
        /* 忽略：本地会话必须清掉 */
      }
      this.token = ''
      this.user = null
      this.sessionChecked = false
      localStorage.removeItem(KEY)
    },

    /**
     * GET /auth/me —— 校验会话是否仍然有效（路由守卫在刷新后的第一个页面调用一次）
     * 失败原因有两类：token 过期（401）、管理员权限已被取消（-403）——都清空本地会话
     */
    async fetchMe() {
      if (!this.token) {
        this.sessionChecked = true
        return null
      }
      try {
        this.user = await getMe(this.token)
        return this.user
      } catch (e) {
        this.token = ''
        this.user = null
        localStorage.removeItem(KEY)
        return null
      } finally {
        this.sessionChecked = true
      }
    },
  },
})
