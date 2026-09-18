import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // 【静态托管子路径部署】部署路径填了 /smart-team-backend-management 时，
  // 构建产物里的资源引用必须带同一个前缀，否则 assets/*.js 会去根目录找 → 404 白页。
  // · 必须用**绝对路径**（结尾带 /）：相对路径 './' 在 history 模式下遇到深层路由
  //   （如 /app/users/）会把 './assets/x.js' 解析成 /app/users/assets/x.js → 依然 404。
  // · Vue Router 已写成 createWebHistory(import.meta.env.BASE_URL)，会自动跟随这里的 base，无需再改。
  // · dev 保持 '/'，免得本地开发地址也变长（只有 npm run build 时才是 production）。
  base: mode === 'production' ? '/smart-team-backend-management/' : '/',
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}))
