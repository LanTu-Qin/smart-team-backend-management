// ============================================================================
// auth store —— 只做两件事：存"当前登录态" + 转发 api 调用
// ----------------------------------------------------------------------------
// ⚠️ 对比旧版：账号表曾经写死在 store 里（admin/admin123），那是把"用户库"搬进了前端。
//    现在账号校验属于 api/auth.js 的职责，store 只负责拿到 token/user 后记住它。
//    会话持久化属于"客户端会话"而非业务数据，所以留在 store（Tier-2 换成 cookie 同理）。
//
// 【为什么 store 里看不到 adminToken】token 交给 api/client.js 统一携带（setAuthToken），
//    这样"带 token"这件事只有一处实现，页面与各 api 模块都不知道 token 长什么样。
// ============================================================================

import { defineStore } from 'pinia'
import {
  changePassword as apiChangePassword,
  getMe,
  login as apiLogin,
  logout as apiLogout,
  setPassword as apiSetPassword,
} from '@/api/auth'
import { setAuthToken } from '@/api/client'

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
    /**
     * 启动时把本地会话里的 token 交给请求层（main.js 在挂载路由前调用一次）
     * 为什么要显式这一步：state 只负责"读回来"，而"带着它去请求"是 client.js 的事；
     * 少了它，刷新页面后的第一个接口会因为没带 token 而被判 401。
     */
    restore() {
      if (this.token) setAuthToken(this.token)
    },

    /** 清空本地会话（401 / 主动退出 / 校验失败都走它，保证三处行为一致） */
    clearSession() {
      this.token = ''
      this.user = null
      this.sessionChecked = false
      setAuthToken('')
      localStorage.removeItem(KEY)
    },

    /** POST /auth/login —— 失败时抛出 ApiError，由页面决定怎么提示 */
    async login(payload) {
      this.loading = true
      try {
        const { token, user } = await apiLogin(payload)
        this.token = token
        this.user = user
        setAuthToken(token)
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
      this.clearSession()
    },

    /**
     * GET /auth/me —— 校验会话是否仍然有效（路由守卫在刷新后的第一个页面调用一次）
     * 失败原因有两类：token 过期/被强制下线（401）、管理员权限已被取消（403）——都清空本地会话
     */
    async fetchMe() {
      if (!this.token) {
        this.sessionChecked = true
        return null
      }
      try {
        this.user = await getMe()
        localStorage.setItem(KEY, JSON.stringify({ token: this.token, user: this.user }))
        return this.user
      } catch (e) {
        this.clearSession()
        return null
      } finally {
        this.sessionChecked = true
      }
    },

    /** POST /auth/set-password —— 首次设置密码（成功后即为登录态） */
    async setPassword(payload) {
      const { token, user } = await apiSetPassword(payload)
      this.token = token
      this.user = user
      setAuthToken(token)
      this.sessionChecked = true
      localStorage.setItem(KEY, JSON.stringify({ token, user }))
      return user
    },

    /**
     * POST /auth/change-password —— 改密成功会返回**新 token**：
     * 服务端 adminTokenVersion +1 → 其它设备上的登录立即失效，本机用新 token 继续用。
     */
    async changePassword(payload) {
      const { token, user } = await apiChangePassword(payload)
      this.token = token
      this.user = user
      setAuthToken(token)
      localStorage.setItem(KEY, JSON.stringify({ token, user }))
      return user
    },
  },
})
