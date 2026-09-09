import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // ① 独立页面：不走后台布局
    {
      path: '/login',
      name: 'login',
      meta: { title: '登录', public: true },
      component: () => import('@/views/LoginView.vue'),
    },
    // ② 后台布局 + 嵌套子路由
    {
      path: '/',
      component: () => import('@/layouts/AdminLayout.vue'),
      redirect: '/dashboard',
      children: [
        { path: 'dashboard', name: 'dashboard', meta: { title: '数据看板' }, component: () => import('@/views/DashboardView.vue') },
        { path: 'users', name: 'users', meta: { title: '用户管理' }, component: () => import('@/views/UsersView.vue') },
        { path: 'teams', name: 'teams', meta: { title: '队伍管理' }, component: () => import('@/views/TeamsView.vue') },
        { path: 'competitions', name: 'competitions', meta: { title: '赛事管理' }, component: () => import('@/views/CompetitionsView.vue') },
      ],
    },
    // ③ 兜底 404：必须放最后
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      meta: { title: '页面未找到', public: true },
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
})

// 登录守卫：未登录只能访问 public 页面
router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!auth.isLoggedIn && !to.meta.public) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (auth.isLoggedIn && to.name === 'login') {
    return { path: '/dashboard' }
  }
})

// 同步浏览器标签标题
router.afterEach((to) => {
  const base = '智队搭 · 管理后台'
  document.title = to.meta?.title ? `${to.meta.title} - ${base}` : base
})

export default router
