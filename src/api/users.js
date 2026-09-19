// ============================================================================
// 用户接口层 —— 严格按 docs/api.md 第 5 节实现
// 两种实现同签名：mock（Tier-1）｜ 云函数（Tier-2，userApi）
//
//   契约端点                          → 云函数 action
//   GET  /users?keyword&role&page…    → userApi.getPage   （仅管理员）
//   GET  /users/:uid                  → userApi.getByUid  （公开；flat:true 才扁平 + email）
//   PATCH /users/:uid/admin           → userApi.setAdmin  （仅管理员）
// ============================================================================

import { ApiError, USE_MOCK, callCloud, mockApi } from './client'
import { commitUsers, getUsers } from './mock/db'

/** role 身份枚举（契约第 5 节，源码确认）：权限一律看 isAdmin，不看这个字段 */
export const USER_ROLES = [
  { value: 'student', label: '学生' },
  { value: 'teacher', label: '教师' },
  { value: 'admin', label: '管理员' },
]

// 脱敏字段：列表不下发（对齐云函数 getPage 的既有行为，契约 1.5）
const PRIVATE_FIELDS = ['email']

function stripPrivate(user) {
  const copy = { ...user }
  PRIVATE_FIELDS.forEach((f) => delete copy[f])
  return copy
}

/* ==========================================================================
 * 一、真实实现（云函数 userApi）
 * ========================================================================== */

/**
 * GET /users?keyword&role&page&pageSize
 * params 名必须精确：page / pageSize（不是 size）/ keyword / role
 * 返回：{ list, total, page, pageSize }（云函数已拍平 DTO，并剔除 email / _openid / _id）
 * ⚠️ 服务端 pageSize 上限 100、默认 20
 */
const cloudListUsers = ({ keyword = '', role = '', page = 1, pageSize = 10 } = {}) =>
  callCloud('userApi', 'getPage', { keyword, role, page, pageSize })

/** GET /users/:uid —— 详情才下发 email（脱敏按"使用场景"决定） */
async function cloudGetUserDetail(uid) {
  const data = await callCloud('userApi', 'getByUid', { uid: Number(uid), flat: true })
  // ⚠️ 云函数查不到时返回的是 `code:0, data:null`（不是 -404）——
  //    这是它作为 C 端接口的历史行为，直接透传会让页面拿到 null 再崩在渲染期。
  //    在接口层补成契约里的 -404，mock 与真实两条路才能给出同样的行为。
  if (!data) throw new ApiError(-404, `用户 ${uid} 不存在`)
  // 类型归一：老数据里 skill_rating 的值可能是字符串（见契约第 8 节第 15 条），
  // 不归一的话前端排序 / 星级渲染会静默失真
  if (data.skill_rating && typeof data.skill_rating === 'object') {
    const normalized = {}
    Object.entries(data.skill_rating).forEach(([sid, level]) => {
      const n = Number(level)
      if (Number.isFinite(n)) normalized[sid] = n
    })
    data.skill_rating = normalized
  }
  return data
}

/**
 * PATCH /users/:uid/admin —— 只改 isAdmin（权限），不动 role（身份）
 * ⚠️ 必须传真布尔：云函数内部是 `!!isAdmin`，传字符串 "false" 会被判成 true（= 误授予管理员）
 */
async function cloudSetAdmin(uid, isAdmin) {
  const id = Number(uid)
  const flag = !!isAdmin
  await callCloud('userApi', 'setAdmin', { uid: id, isAdmin: flag })
  return { uid: id, isAdmin: flag }
}

/* ==========================================================================
 * 二、mock 实现（Tier-1）
 * ========================================================================== */

const mockListUsers = mockApi(({ keyword = '', role = '', page = 1, pageSize = 10 } = {}) => {
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

const mockGetUserDetail = mockApi((uid) => {
  const user = getUsers().find((u) => u.uid === Number(uid))
  if (!user) throw new ApiError(-404, `用户 ${uid} 不存在`)
  return { ...user }
})

const mockSetAdmin = mockApi((uid, isAdmin) => {
  const user = getUsers().find((u) => u.uid === Number(uid))
  if (!user) throw new ApiError(-404, `用户 ${uid} 不存在`)
  user.isAdmin = !!isAdmin
  commitUsers()
  return { uid: user.uid, isAdmin: user.isAdmin }
})

/* ==========================================================================
 * 三、对外接口（按模式二选一）
 * ========================================================================== */

/** GET /users?keyword&role&page&pageSize —— 用户列表/搜索（服务端分页） */
export const listUsers = USE_MOCK ? mockListUsers : cloudListUsers

/** GET /users/:uid —— 单用户完整信息（含 email） */
export const getUserDetail = USE_MOCK ? mockGetUserDetail : cloudGetUserDetail

/** PATCH /users/:uid/admin —— 授予 / 撤销管理员 */
export const setAdmin = USE_MOCK ? mockSetAdmin : cloudSetAdmin
