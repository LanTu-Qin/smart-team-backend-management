// ============================================================================
// 用户接口层 —— 严格按 docs/api.md 第 5 节实现
// Tier-1：走 mock（函数体是"后端逻辑"）；Tier-2：只换函数体为 axios 调用，签名不变
//
//   Tier-2 长这样：
//     export const listUsers = (params) => client.get('/users', { params })
//     export const getUserDetail = (uid) => client.get(`/users/${uid}`)
//     export const setAdmin = (uid, isAdmin) => client.patch(`/users/${uid}/admin`, { isAdmin })
// ============================================================================

import { ApiError, mockApi } from './client'
import { commitUsers, getUsers } from './mock/db'

/** role 身份枚举（契约第 5 节，源码确认）：权限一律看 isAdmin，不看这个字段 */
export const USER_ROLES = [
  { value: 'student', label: '学生' },
  { value: 'teacher', label: '教师' },
  { value: 'admin', label: '管理员' },
]

// 脱敏字段：列表不下发（对齐云函数 searchUsers / getBatchUids 的既有行为，契约 1.5）
const PRIVATE_FIELDS = ['email']

function stripPrivate(user) {
  const copy = { ...user }
  PRIVATE_FIELDS.forEach((f) => delete copy[f])
  return copy
}

/**
 * GET /users?keyword&role&page&pageSize
 * 映射：userApi.searchUsers（keyword 为纯数字按 uid 精确匹配，否则用户名模糊，不区分大小写）
 * [后端新增]：分页与 role 过滤现云函数没有，mock 里先实现，Tier-2 由新增能力提供
 */
export const listUsers = mockApi(({ keyword = '', role = '', page = 1, pageSize = 10 } = {}) => {
  const kw = String(keyword).trim().toLowerCase()
  const matched = getUsers().filter((u) => {
    if (role && u.role !== role) return false
    if (!kw) return true
    return String(u.uid).includes(kw) || String(u.username).toLowerCase().includes(kw)
  })

  const start = (page - 1) * pageSize
  return {
    // 分页 + 脱敏都是"后端职责"：前端拿到的就是最终形态（契约 1.4 / 1.5）
    list: matched.slice(start, start + pageSize).map(stripPrivate),
    total: matched.length,
    page,
    pageSize,
  }
})

/** GET /users/:uid —— 详情接口才下发 email（脱敏按"使用场景"决定） */
export const getUserDetail = mockApi((uid) => {
  const user = getUsers().find((u) => u.uid === Number(uid))
  if (!user) throw new ApiError(-404, `用户 ${uid} 不存在`)
  return { ...user }
})

/**
 * PATCH /users/:uid/admin —— 只改 isAdmin（权限），不动 role（身份）
 * 映射：userApi.setAdmin（仅管理员可调用，服务端二次校验）
 */
export const setAdmin = mockApi((uid, isAdmin) => {
  const user = getUsers().find((u) => u.uid === Number(uid))
  if (!user) throw new ApiError(-404, `用户 ${uid} 不存在`)
  user.isAdmin = !!isAdmin
  commitUsers()
  return { uid: user.uid, isAdmin: user.isAdmin }
})
