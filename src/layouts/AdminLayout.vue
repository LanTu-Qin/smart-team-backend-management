<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  LayoutDashboard, Users, Flag, Trophy, Tags,
  Menu, LogOut, Bell, Zap, Sparkles,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/composables/toast'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const menus = [
  { to: '/dashboard', label: '数据看板', icon: LayoutDashboard },
  { to: '/users', label: '用户管理', icon: Users },
  { to: '/teams', label: '队伍管理', icon: Flag },
  { to: '/competitions', label: '赛事管理', icon: Trophy },
  { to: '/skills', label: '技能字典', icon: Tags },
]

// 响应式：<=1024px 侧栏变为抽屉
const isMobile = ref(typeof window !== 'undefined' && window.innerWidth <= 1024)
const mobileOpen = ref(false)
const collapsed = ref(false)

const handleResize = () => {
  isMobile.value = window.innerWidth <= 1024
  if (!isMobile.value) mobileOpen.value = false
}
onMounted(() => window.addEventListener('resize', handleResize))
onBeforeUnmount(() => window.removeEventListener('resize', handleResize))

const pageTitle = computed(() => route.meta?.title || '')
const initials = computed(() => (auth.user?.username || '管').slice(0, 1))
// role 是身份（student/teacher/admin），展示用中文；权限一律看 isAdmin
const roleLabel = computed(() => ({ student: '学生', teacher: '教师', admin: '管理员' })[auth.user?.role] || '')

function toggleSide() {
  if (isMobile.value) mobileOpen.value = !mobileOpen.value
  else collapsed.value = !collapsed.value
}

watch(
  () => route.fullPath,
  () => { mobileOpen.value = false },
)

function logout() {
  auth.logout()
  toast('已安全退出登录', 'info')
  router.replace('/login')
}

const notify = () => toast('暂无新通知', 'info')
</script>

<template>
  <div class="layout" :class="{ 'is-collapsed': !isMobile && collapsed }">
    <!-- 移动端抽屉遮罩 -->
    <Transition name="fade">
      <div v-if="isMobile && mobileOpen" class="side-mask" @click="mobileOpen = false"></div>
    </Transition>

    <!-- 侧边导航 -->
    <aside class="sidebar" :class="{ open: isMobile && mobileOpen }">
      <div class="brand">
        <div class="brand-logo"><Zap :size="18" :stroke-width="2.6" /></div>
        <div class="brand-text">
          <b>智队搭</b>
          <small>赛事组队管理</small>
        </div>
      </div>

      <nav class="nav">
        <RouterLink
          v-for="m in menus"
          :key="m.to"
          :to="m.to"
          class="nav-item"
          :title="m.label"
        >
          <component :is="m.icon" :size="19" />
          <span class="nav-label">{{ m.label }}</span>
        </RouterLink>
      </nav>

      <div class="side-foot">
        <Sparkles :size="13" />
        <span class="nav-label">v1.0.0</span>
      </div>
    </aside>

    <!-- 主内容 -->
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-btn" :title="isMobile ? '打开菜单' : '收起/展开菜单'" @click="toggleSide">
          <Menu :size="20" />
        </button>

        <div class="crumb">
          <span class="crumb-root u-hide-sm">管理后台</span>
          <span class="crumb-sep u-hide-sm">/</span>
          <strong>{{ pageTitle }}</strong>
        </div>

        <div class="topbar-right">
          <button class="icon-btn" title="通知" @click="notify">
            <Bell :size="18" />
            <i class="notify-dot"></i>
          </button>
          <div class="divider u-hide-sm"></div>

          <div class="user-chip">
            <div class="avatar sm">{{ initials }}</div>
            <div class="user-meta u-hide-sm">
              <b>{{ auth.user?.username }}</b>
              <span>{{ roleLabel }}</span>
            </div>
          </div>

          <button class="btn btn-ghost btn-sm" @click="logout">
            <LogOut :size="15" />
            <span class="u-hide-sm">退出</span>
          </button>
        </div>
      </header>

      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.layout { min-height: 100vh; }

/* ===== 侧边栏 ===== */
.sidebar {
  position: fixed; inset: 0 auto 0 0;
  width: var(--sidebar-w);
  display: flex; flex-direction: column;
  background: linear-gradient(180deg, #111c3a 0%, #0d1526 100%);
  color: #cbd5e1;
  z-index: 60;
  transition: width 0.2s ease, transform 0.22s ease;
  overflow: hidden;
}
.brand {
  height: var(--topbar-h); flex: none;
  display: flex; align-items: center; gap: 10px;
  padding: 0 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.brand-logo {
  width: 32px; height: 32px; flex: none;
  border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  box-shadow: 0 6px 16px -6px rgba(99, 102, 241, 0.7);
}
.brand-text { display: flex; flex-direction: column; line-height: 1.2; white-space: nowrap; }
.brand-text b { color: #fff; font-size: 16px; letter-spacing: 0.5px; }
.brand-text small { color: #7b8cb0; font-size: 10.5px; margin-top: 2px; }

.nav { flex: 1; padding: 12px 0; overflow-y: auto; }
.nav-item {
  display: flex; align-items: center; gap: 12px;
  height: 44px; margin: 2px 12px; padding: 0 12px;
  border-radius: 10px;
  color: #aeb9d4; text-decoration: none; white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}
.nav-item:hover { background: rgba(255, 255, 255, 0.06); color: #fff; }
.nav-item.router-link-active {
  background: linear-gradient(90deg, #4f46e5, #7c5cf0);
  color: #fff; font-weight: 600;
  box-shadow: 0 8px 18px -8px rgba(79, 70, 229, 0.8);
}
.side-foot {
  flex: none; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 14px; color: #5b6b8c; font-size: 12px; border-top: 1px solid rgba(255, 255, 255, 0.06);
}

/* 折叠态（桌面端） */
.is-collapsed .sidebar { width: var(--sidebar-w-sm); }
.is-collapsed .brand { justify-content: center; padding: 0; }
.is-collapsed .brand-text,
.is-collapsed .nav-label { display: none; }
.is-collapsed .nav-item { justify-content: center; padding: 0; margin: 2px 10px; }
.is-collapsed .side-foot { padding: 14px 0; }

/* ===== 主区 ===== */
.main {
  margin-left: var(--sidebar-w);
  min-height: 100vh;
  display: flex; flex-direction: column;
  transition: margin-left 0.2s ease;
}
.is-collapsed .main { margin-left: var(--sidebar-w-sm); }

.topbar {
  position: sticky; top: 0; z-index: 30;
  height: var(--topbar-h); flex: none;
  display: flex; align-items: center; gap: 6px;
  padding: 0 20px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}
.crumb { display: flex; align-items: center; gap: 7px; font-size: 15px; }
.crumb-root { color: var(--t3); font-size: 13px; }
.crumb-sep { color: var(--border); }
.crumb strong { font-weight: 600; }

.topbar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.icon-btn { position: relative; }
.notify-dot {
  position: absolute; top: 6px; right: 6px;
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--c-danger); border: 1.5px solid #fff;
}
.divider { width: 1px; height: 22px; background: var(--border); }
.user-chip { display: flex; align-items: center; gap: 9px; }
.user-meta { display: flex; flex-direction: column; line-height: 1.2; }
.user-meta b { font-size: 13px; font-weight: 600; }
.user-meta span { font-size: 11.5px; color: var(--t3); }

.content { flex: 1; padding: 22px; width: 100%; }

/* ===== 移动端抽屉 ===== */
.side-mask {
  position: fixed; inset: 0; z-index: 55;
  background: rgba(9, 14, 26, 0.5);
}
@media (max-width: 1024px) {
  .sidebar { transform: translateX(-105%); box-shadow: none; width: var(--sidebar-w); }
  .sidebar.open { transform: translateX(0); box-shadow: 24px 0 60px -20px rgba(9, 14, 26, 0.5); }
  .main { margin-left: 0; }
  .content { padding: 16px; }
}
</style>
