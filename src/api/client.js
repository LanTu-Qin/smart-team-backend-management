// ============================================================================
// 统一请求层 —— Tier-1(mock) 与 Tier-2(axios) 的同一个"插槽"
// 契约见 docs/api.md 第 1 节：/api/v1 前缀、Bearer 认证、{code,message,data} 封装
// ----------------------------------------------------------------------------
// 为什么要单独一层？因为"数据从哪来"只应该有一个地方知道答案。
// 页面 → store → api/client → (mock | 真后端)，换后端只改这一层。
//
// Tier-2 时这个文件会变成 axios 实例 + 两个拦截器，页面与 store 一行都不用改：
//
//   const client = axios.create({
//     baseURL: `${import.meta.env.VITE_API_BASE}/api/v1`,
//     timeout: 15000,
//   })
//   client.interceptors.request.use((cfg) => {
//     cfg.headers.Authorization = `Bearer ${token}`   // 契约 1.2：认证头
//     return cfg
//   })
//   client.interceptors.response.use(
//     (res) => res.data.data,                        // 拆封 {code,message,data}
//     (err) => {
//       const status = err.response?.status
//       if (status === 401) { /* 清 token → 跳登录（契约 1.3：401=不知道你是谁） */ }
//       if (status === 403) { /* toast 无管理员权限（403=知道你是谁但不够格，不跳登录） */ }
//       throw new ApiError(err.response?.data?.code ?? -500, err.response?.data?.message ?? '网络异常')
//     },
//   )
// ============================================================================

// 模拟网络延迟：让 loading、空状态、失败提示从第一天就是真的，
// 而不是等接上真后端才发现"原来请求是异步的"。
const LATENCY = 150

/** 业务错误：对齐云函数业务码（-1/1/2/3/-403/-404/-500），见契约 1.3 */
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
 * 注意：resolve 的是 data 而不是整个 {code,message,data} —— 因为 Tier-2 的 axios
 * 拦截器已经负责拆封了，这里保持一致，将来换实现时 store 无需改动。
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
