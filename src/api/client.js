// ============================================================================
// 统一请求层 —— 唯二两种「数据从哪来」：mock（Tier-1）｜ 云开发云函数（Tier-2）
// 契约见 docs/api.md 第 1 / 2 节：路由型云函数 event = { action, params }，返回 { code, data, msg }
// ----------------------------------------------------------------------------
// 为什么单独一层？"数据从哪来"只应该有一个地方知道答案。
// 页面 → store → api/*.js → client.js →（mock | 云函数），换后端只改这一层。
//
// 【为什么不是 axios】通道定成了 CloudBase Web SDK（架构 ③，见 docs/api.md 第 2 节）：
//   静态托管页面没有 OPENID，走「SDK 匿名登录做传输 + 自签 adminToken 做鉴权」。
//   所以这里不是一个 axios 实例，而是 callFunction 的一层薄封装；
//   但「拆封 {code,data,msg}、401 清会话、403 原地提示」的职责与 axios 拦截器完全等价。
//
// 【切模式】构建期环境变量（Vite 的 import.meta.env 是编译期替换，改了要重启/重新构建）：
//   .env        → VITE_API_MODE=mock   默认，线上演示站不受影响
//   .env.cloud  → VITE_API_MODE=cloud  真后端（npm run dev:cloud / build:cloud）
// ============================================================================

/** 'mock' | 'cloud'，默认 mock：保证「没有云环境也能跑起来」是第一优先级 */
export const API_MODE = import.meta.env.VITE_API_MODE === 'cloud' ? 'cloud' : 'mock'
export const USE_MOCK = API_MODE === 'mock'

/** 云开发环境（写到 .env.cloud，不属于密钥：环境 ID 本身就是公开的） */
export const CLOUD_ENV = import.meta.env.VITE_CLOUD_ENV || 'cloud1-d8gb9nir3847ec081'
export const CLOUD_REGION = import.meta.env.VITE_CLOUD_REGION || 'ap-shanghai'

// 模拟网络延迟：让 loading、空状态、失败提示从第一天就是真的，
// 而不是等接上真后端才发现"原来请求是异步的"。
const LATENCY = 150

/** 业务错误：对齐云函数业务码（-1/1/2/3/-401/-403/-404/-500），见契约 1.3 */
export class ApiError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/**
 * mockApi —— 把"同步的假数据逻辑"包装成"异步的真接口行为"
 * @param {Function} handler 同步函数，参数/返回值与契约一致；出错就 throw new ApiError(...)
 * @returns {Function} 返回 Promise，resolve 的是**已拆封的 data**
 *
 * 注意：resolve 的是 data 而不是整个 {code,message,data} —— 与真实通道（callCloud）保持一致，
 * 将来换实现时 store 与页面无需改动。
 *
 * @param {number} [latency=LATENCY] 单次延迟，慢接口（AI 生成）可覆盖，见契约第 4 节
 */
export function mockApi(handler, latency = LATENCY) {
  return (...args) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(handler(...args))
        } catch (err) {
          reject(err)
        }
      }, latency)
    })
}

// ============================================================================
// 真实通道：CloudBase Web SDK
// ============================================================================

/**
 * 当前的 adminToken。**不放 localStorage、不放 store**，只在这里留一份内存副本：
 * - 值的来源只有一个（auth store 登录成功 / 启动时读回会话时写入），避免"两个地方各存一份"
 * - 每次云函数调用由本层自动带上，api/*.js 与页面完全不需要感知 token 的存在
 */
let authToken = ''

export function setAuthToken(token) {
  authToken = token || ''
}

export function getAuthToken() {
  return authToken
}

/** 401 时的统一动作（清会话 + 跳登录），由 main.js 注入 —— 避免 client 反向依赖 router/store */
let unauthorizedHandler = null

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn
}

/**
 * SDK 初始化（懒加载 + 单例）
 * - **动态 import**：mock 模式下这个 chunk 根本不会被下载 —— 演示站不为"用不到的能力"付体积
 * - 匿名登录只做一次：它只解决"能调云函数"这一前提，**匿名登录 ≠ 管理员**（鉴权看 adminToken）
 */
let appPromise = null

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const mod = await import('@cloudbase/js-sdk')
      const cloudbase = mod.default || mod
      const app = cloudbase.init({ env: CLOUD_ENV, region: CLOUD_REGION })

      // v2 实测 app.auth 是函数（v1 是属性），两种写法都兼容
      const auth = typeof app.auth === 'function' ? app.auth() : app.auth
      try {
        // 已有登录态（SDK 自己持久化）就别再握手一次，省一次往返
        const state = typeof auth.hasLoginState === 'function' ? auth.hasLoginState() : null
        if (!state) await auth.signInAnonymously()
      } catch (e) {
        // 匿名登录失败必须显式抛出：否则后续每个请求都会以"权限/网络异常"的名义失败，极难定位。
        // 最常见的原因是安全域名白名单 / 云函数安全规则（见 docs/api.md 第 8 节第 1 条）
        console.error('[client] 匿名登录失败', e)
        throw new ApiError(-500, `云开发环境连接失败：${(e && e.message) || e}`)
      }
      return app
    })().catch((err) => {
      appPromise = null // 失败不缓存，允许用户重试（刷新/重新登录即可再试）
      throw err
    })
  }
  return appPromise
}

/**
 * 调用路由型云函数 —— 相当于 axios 拦截器的那一层
 * @param {string} name   云函数名，如 'adminAuth' / 'userApi'
 * @param {string} action 路由型 action，如 'login' / 'getPage'
 * @param {object} [params] 业务参数（对齐契约里的 body / query）
 * @returns {Promise<any>} 已拆封的 **data**
 *
 * token 位置（契约第 2 节约定）：放 **data 顶层**（`data.adminToken`）—— 业务云函数的
 * `ensureAdmin(event)` 只读这里（见 adminGuard.js）。
 */
export async function callCloud(name, action, params = {}) {
  const app = await getApp()

  let res
  try {
    res = await app.callFunction({
      name,
      data: { action, params, adminToken: authToken || undefined },
    })
  } catch (err) {
    // 调用通道本身的异常（安全规则拦截、超时、网络）——业务码根本还没机会返回
    throw new ApiError(-500, `云函数调用失败：${(err && err.message) || err}`)
  }

  const result = (res && res.result) || {}
  const code = Number(result.code)
  const message = result.msg || result.message || '请求失败'

  if (code === 0) return result.data

  // 401 = 不知道你是谁（token 过期 / 被改密强制下线）→ 清会话、回登录页
  if (code === 401) {
    authToken = ''
    if (unauthorizedHandler) unauthorizedHandler(message)
    throw new ApiError(401, message || '登录已失效，请重新登录')
  }

  // 403 = 知道你是谁但不够格 → 原地提示，**不要**跳登录（重登也没用，见契约 2.5）
  throw new ApiError(code, message)
}
