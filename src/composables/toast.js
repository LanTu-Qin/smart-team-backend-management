import { ElMessage } from 'element-plus'

/**
 * 轻量封装：业务侧继续调用 toast(msg, type)，
 * 底层统一由 Element Plus 的 ElMessage 渲染。
 */
export function toast(message, type = 'success') {
  ElMessage({
    message,
    type,
    duration: 2400,
    grouping: true,
  })
}

export function useToast() {
  return { toast }
}
