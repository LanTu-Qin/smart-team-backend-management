import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'

import App from './App.vue'
import router from './router'
import { setUnauthorizedHandler } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
// 业务全局样式放最后，用于覆盖 Element Plus 主题变量
import '@/styles/main.css'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)

// ① 把本地会话里的 token 交给请求层（刷新页面后第一个接口才不会漏带 token）
const auth = useAuthStore(pinia)
auth.restore()

// ② 401 的统一出口：token 过期 / 被改密强制下线 → 清会话 + 回登录页（带上 redirect，登录后回到原页面）
//    为什么放在这里而不是 client.js：client 不该知道路由与 store 的存在（依赖方向是单向的）
setUnauthorizedHandler(() => {
  const current = router.currentRoute.value
  auth.clearSession()
  if (current.name !== 'login') {
    router.replace({ name: 'login', query: { redirect: current.fullPath } })
  }
})

app.use(router)
app.use(ElementPlus, { locale: zhCn })

app.mount('#app')
