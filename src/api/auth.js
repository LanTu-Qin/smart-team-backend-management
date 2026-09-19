// ============================================================================
// 认证接口层 —— 严格按 docs/api.md 第 2 节实现
// ----------------------------------------------------------------------------
// 两种实现共用**同一个函数签名**（login / getMe / setPassword / changePassword / logout），
// 页面与 store 只认签名，切模式（mock ↔ 云函数）不改调用方一行：
//
//   mock  ：账号表在本地，token 形如 mock.<uid>.<v>.<ts>（也能演示"改密即强制下线"）
//   cloud ：调 adminAuth 云函数，token 是服务端 HMAC 自签的（前端只负责存与带）
//
// ⚠️ 注意：token 不进本文件。真实通道的 token 由 client.js 统一带上（setAuthToken），
//    所以这里没有一处需要传 token —— 少一个参数，就少一处"忘了传"的机会。
// ============================================================================

import { ApiError, USE_MOCK, callCloud, getAuthToken, mockApi } from './client'
import { getUsers } from './mock/db'

// ---------------------------------------------------------------------------
// mock 实现
// ---------------------------------------------------------------------------

/**
 * 演示账号（真实环境由 adminAuth 查 user 集合，见契约第 8 节第 1 条）
 * 只存"账号 → uid"的映射，用户名/角色一律取自 user 集合，杜绝两份数据打架。
 */
const DEMO_ACCOUNTS = [
  { account: 'admin', password: 'admin123', uid: 10001 }, // 已设密码 → 正常登录
  { account: '10001', password: 'admin123', uid: 10001 }, // 与真环境工号对齐，切模式时手感一致
  { account: 'demo', password: null, uid: 10003 }, // 未设密码 → 演示 -2「首次设置密码」流程
]

/**
 * 令牌版本（mock 版"强制下线"）：与真实后端的 user.adminTokenVersion 同一语义。
 * 改密 +1 → 旧 token 的 v 与之不等 → 立即失效。
 */
const mockTokenVersion = {}
const bumpVersion = (uid) => (mockTokenVersion[uid] = (mockTokenVersion[uid] || 0) + 1)

const mockSign = (uid) => `mock.${uid}.${mockTokenVersion[uid] || 0}.${Date.now()}`

/** 从 mock token 解出 uid 与版本号（真后端由服务端验签解析，前端不需要知道细节） */
function parseMockToken(token) {
  const [, uid, v] = String(token || '').split('.')
  return { uid: Number(uid), v: Number(v) }
}

function findAccount(account) {
  const acct = String(account || '').trim()
  return DEMO_ACCOUNTS.find((a) => a.account === acct) || null
}

function toMockUser(acc) {
  const user = getUsers().find((u) => u.uid === acc.uid)
  if (!user) throw new ApiError(-404, '账号对应用户不存在')
  return { uid: user.uid, username: user.username, isAdmin: user.isAdmin, role: user.role }
}

function mockLogin({ account = '', password = '' } = {}) {
  const acc = findAccount(account)
  // 与真后端逐条对齐：不区分"账号不存在"与"密码错误"（都是 401，减少账号枚举）
  if (!acc) throw new ApiError(401, '账号或密码错误')
  if (!acc.password) throw new ApiError(-2, '该账号尚未设置管理端密码，请先设置密码')
  if (acc.password !== password) throw new ApiError(401, '账号或密码错误')
  const user = toMockUser(acc)
  if (!user.isAdmin) throw new ApiError(403, '该账号没有管理端权限')
  return { token: mockSign(acc.uid), user }
}

function mockGetMe() {
  const { uid, v } = parseMockToken(getAuthToken())
  if (!uid) throw new ApiError(401, '登录已失效，请重新登录')
  // ⚠️ 每次校验都必须**重新读数据库里的 isAdmin**：管理员权限可能已被取消。
  //    少了这一行，被撤销权限的人只要不清缓存就能一直进后台 ——
  //    权限必须依据"当前的服务端状态"，绝不能相信 token 里签发时的旧值。
  const user = getUsers().find((u) => u.uid === uid)
  if (!user || !user.isAdmin) throw new ApiError(user ? 403 : 401, user ? '该账号没有管理端权限' : '登录已失效，请重新登录')
  // 版本不一致 = 已被强制下线（改密）
  if ((mockTokenVersion[uid] || 0) !== v) throw new ApiError(401, '登录已失效，请重新登录')
  return { uid: user.uid, username: user.username, isAdmin: user.isAdmin, role: user.role }
}

/** 首次设置密码：仅当该账号尚无密码时可用（与真后端 -3 行为一致） */
function mockSetPassword({ account = '', password = '' } = {}) {
  const acc = findAccount(account)
  if (!acc) throw new ApiError(401, '账号不存在')
  if (password.length < 8) throw new ApiError(-1, '密码至少 8 位')
  if (acc.password) throw new ApiError(-3, '该账号已设置过密码，请直接登录或使用「修改密码」')
  const user = toMockUser(acc)
  if (!user.isAdmin) throw new ApiError(403, '该账号没有管理端权限')
  acc.password = password
  bumpVersion(acc.uid)
  return { token: mockSign(acc.uid), user }
}

function mockChangePassword({ oldPassword = '', newPassword = '' } = {}) {
  const { uid } = parseMockToken(getAuthToken())
  const acc = DEMO_ACCOUNTS.find((a) => a.uid === uid)
  if (!acc) throw new ApiError(401, '登录已失效，请重新登录')
  if (newPassword.length < 8) throw new ApiError(-1, '新密码至少 8 位')
  if (acc.password !== oldPassword) throw new ApiError(401, '原密码不正确')
  acc.password = newPassword
  bumpVersion(uid) // 旧 token 全部失效 = 其它设备被强制下线
  return { token: mockSign(uid), user: toMockUser(acc) }
}

// ---------------------------------------------------------------------------
// 真实实现（adminAuth 云函数）
// ---------------------------------------------------------------------------

const cloudLogin = (payload = {}) => callCloud('adminAuth', 'login', payload)
const cloudGetMe = () => callCloud('adminAuth', 'me')
const cloudSetPassword = (payload = {}) => callCloud('adminAuth', 'setPassword', payload)
const cloudChangePassword = (payload = {}) => callCloud('adminAuth', 'changePassword', payload)

// ---------------------------------------------------------------------------
// 对外接口（按模式二选一）
// ---------------------------------------------------------------------------

/**
 * POST /auth/login —— body { account, password }
 *   `account` = 工号（纯数字，匹配 `userInfo.uid`）或姓名（匹配 `userInfo.username`）
 * @returns {Promise<{token:string, user:{uid:number,username:string,role:string,isAdmin:boolean}}>}
 * 错误：401 账号或密码错误 ｜ -2 尚未设置密码 ｜ 403 无管理端权限
 */
export const login = USE_MOCK ? mockApi(mockLogin) : cloudLogin

/** GET /auth/me —— 凭 token 换当前管理员（刷新页面后校验会话是否仍有效） */
export const getMe = USE_MOCK ? mockApi(mockGetMe) : cloudGetMe

/** POST /auth/set-password —— 首次设置密码（仅当该管理员尚无密码时可用） */
export const setPassword = USE_MOCK ? mockApi(mockSetPassword) : cloudSetPassword

/**
 * POST /auth/change-password —— body { oldPassword, newPassword }
 * 返回**新 token**（旧 token 立即失效：服务端 adminTokenVersion +1 → 其它设备强制下线）
 */
export const changePassword = USE_MOCK ? mockApi(mockChangePassword) : cloudChangePassword

/**
 * POST /auth/logout —— 契约里**没有**这个接口：无服务端会话，清本地 token 即可。
 * 保留这个函数只是让 store 的 logout() 两端写法一致（真后端不需要网络请求）。
 */
export const logout = USE_MOCK ? mockApi(() => ({ ok: true })) : async () => ({ ok: true })
