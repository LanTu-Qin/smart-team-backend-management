<script setup>
import { useRouter } from 'vue-router'
import { ArrowLeft, Home, Zap } from 'lucide-vue-next'

const router = useRouter()
const goHome = () => router.replace('/dashboard')
const goBack = () => (window.history.length > 1 ? router.back() : goHome())
</script>

<template>
  <div class="nf">
    <div class="nf-card">
      <div class="nf-logo"><Zap :size="16" :stroke-width="2.6" /></div>
      <div class="nf-code">4<span>0</span>4</div>
      <h2>页面走丢了</h2>
      <p>你访问的地址不存在，可能已被移动或删除。<br />回到首页继续使用管理后台吧。</p>
      <div class="nf-actions">
        <el-button type="primary" size="large" :icon="Home" @click="goHome">返回首页</el-button>
        <el-button size="large" :icon="ArrowLeft" @click="goBack">上一页</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nf {
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  background:
    radial-gradient(700px 340px at 20% 0%, rgba(99, 102, 241, 0.12), transparent 60%),
    radial-gradient(700px 340px at 90% 100%, rgba(168, 85, 247, 0.1), transparent 60%),
    var(--bg);
}
.nf-card { text-align: center; max-width: 460px; }
.nf-logo {
  width: 42px; height: 42px; margin: 0 auto 20px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; color: #fff;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  box-shadow: 0 12px 30px -10px rgba(99, 102, 241, 0.7);
}
.nf-code {
  font-size: 108px; font-weight: 800; line-height: 1; letter-spacing: 2px;
  color: var(--c-primary);
}
.nf-code span { color: #c7d2fe; }
.nf-card h2 { margin-top: 14px; font-size: 22px; }
.nf-card p { margin-top: 12px; color: var(--t3); font-size: 14px; line-height: 1.8; }
.nf-actions { margin-top: 26px; display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
</style>
