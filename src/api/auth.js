// ============================================================================
// 认证接口层 —— 严格按 docs/api.md 第 2 节实现（[后端新增]，Tier-1 先由 mock 顶班）
//
//   Tier-2 长这样：
//     export const login = (data) => client.post('/auth/login', data)
//     export const logout = () => client.post('/auth/logout')
//     export const getMe = () => client.get('/auth/me')
// ============================================================================

import { ApiError, mockApi } from './client'
import { getUsers } from './mock/db'

// 演示账号（真实环境由 /auth/login 校验账号体系，见契约第 8 节第 1 条）
// 这里只存"账号 → uid"的映射，用户名/头像一律取自 user 集合，杜绝两份数据打架
const DEMO_ACCOUNTS = [
  { username: 'admin', password: 'admin123', uid: 10001 },
  { username: 'demo', password: '123456', uid: 10003 },
]

/**
 * POST /auth/login —— body {username, password}
 * 返回 { token, user:{uid, username, isAdmin} }（契约第 2 节）
 */
export const login = mockApi(({ username = '', password = '' } = {}) => {
  const acc = DEMO_ACCOUNTS.find((a) => a.username === String(username).trim())
  if (!acc || acc.password !== password) {
    throw new ApiError(401, '账号或密码错误，请重试')
  }
  const user = getUsers().find((u) => u.uid === acc.uid)
  if (!user) throw new ApiError(-404, '账号对应用户不存在')
  if (!user.isAdmin) throw new ApiError(-403, '该账号没有管理端权限')

  return {
    token: `mock.${user.uid}.${Date.now()}`,
    user: { uid: user.uid, username: user.username, isAdmin: user.isAdmin, role: user.role },
  }
})

/** POST /auth/logout */
export const logout = mockApi(() => ({ ok: true }))

/**
 * GET /auth/me —— 凭 token 换当前登录管理员
 * mock 里 uid 直接编在 token 中（真后端由 token 验签解析，前端不需要知道细节）
 */
export const getMe = mockApi((token) => {
  if (!token) throw new ApiError(401, '未登录')
  const uid = Number(String(token).split('.')[1])
  const user = getUsers().find((u) => u.uid === uid)
  if (!user) throw new ApiError(401, '登录已失效，请重新登录')
  // ⚠️ 每次校验都必须**重新读数据库里的 isAdmin**：管理员权限可能已被取消。
  //    少了这一行，被撤销权限的人只要不清缓存就能一直进后台 ——
  //    权限必须依据"当前的服务端状态"，绝不能相信 token 里签发时的旧值。
  if (!user.isAdmin) throw new ApiError(-403, '该账号没有管理端权限')
  return { uid: user.uid, username: user.username, isAdmin: user.isAdmin, role: user.role }
})
