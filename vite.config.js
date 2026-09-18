import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(() => ({
  // 【部署路径】云开发「Web 应用托管 / 静态托管」给每个应用分配独立域名
  // （形如 <app>-<env>.webapps.tcloudbase.com），**该域名本身就是站点根** ——
  // 内部前缀（如 smart-team-backend-management/）对 URL 不可见，所以 base 必须是 '/'。
  // 踩坑记录：曾把 base 配成 '/smart-team-backend-management/' + 访问时又带上同名子路径，
  // 结果解析成 smart-team-backend-management//smart-team-backend-management/index.html → NoSuchKey。
  // 只有将来把站点挂在**域名下的子路径**（如自建 Nginx 的 /admin/）时，才需要改成 '/admin/'。
  base: '/',
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
