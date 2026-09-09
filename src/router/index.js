import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // ① 独立页面：不走后台布局
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    // ② 后台布局 + 嵌套子路由
    {
      path: '/',
      component: () => import('@/layouts/AdminLayout.vue'),
      redirect: '/dashboard', // 访问 / 直接进看板
      children: [
        { path: 'dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
        { path: 'users', name: 'users', component: () => import('@/views/UsersView.vue') },
        { path: 'teams', name: 'teams', component: () => import('@/views/TeamsView.vue') },
        { path: 'competitions', name: 'competitions', component: () => import('@/views/CompetitionsView.vue') },
      ],
    },
    // ③ 兜底 404：必须放最后
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
})

export default router