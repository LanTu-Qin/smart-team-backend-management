<script setup>
// 菜单先写死；D5 之后可以改成"登录后按角色动态生成"
const menus = [
  { to: '/dashboard', label: '数据看板' },
  { to: '/users', label: '用户管理' },
  { to: '/teams', label: '队伍管理' },
  { to: '/competitions', label: '赛事管理' },
]
</script>

<template>
  <div class="admin-layout">
    <aside class="sidebar">
      <h1 class="brand">智队搭 · 管理后台</h1>
      <nav>
        <RouterLink v-for="m in menus" :key="m.to" :to="m.to" class="menu-item">
          {{ m.label }}
        </RouterLink>
      </nav>
    </aside>

    <div class="content">
      <header class="topbar">
        <span>管理员</span>
        <RouterLink to="/login">退出</RouterLink>
      </header>
      <main>
        <RouterView /><!-- 子路由页面都渲染在这里 -->
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-layout { display: flex; min-height: 100vh; }
.sidebar { width: 200px; background: #1f2937; color: #fff; padding: 16px; box-sizing: border-box; }
.brand { font-size: 16px; margin-bottom: 8px; }
.menu-item { display: block; color: #d1d5db; text-decoration: none; padding: 10px 12px; margin-top: 6px; border-radius: 6px; }
.menu-item:hover { background: #374151; color: #fff; }
/* 命中当前路由时 RouterLink 会自动加 router-link-active 类，直接用它做高亮 */
.menu-item.router-link-active { background: #3b82f6; color: #fff; }
.content { flex: 1; display: flex; flex-direction: column; }
.topbar { height: 48px; display: flex; align-items: center; justify-content: flex-end; gap: 12px; padding: 0 16px; background: #fff; border-bottom: 1px solid #e5e7eb; }
main { padding: 20px; }
</style>