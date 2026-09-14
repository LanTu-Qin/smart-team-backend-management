<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Zap, User, LockKeyhole, ArrowRight, ShieldCheck, Trophy, UsersRound, Sparkles } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/composables/toast'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const formRef = ref(null)
const form = reactive({ username: '', password: '' })
const loading = ref(false)
const error = ref('')

const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

// 文案只写真实能力（对应 docs/api.md 的接口清单），不写旧模型里的虚构概念
// （"队员画像 / 标签画像 / 算法-工程-数据赛道 / 成绩沉淀"在真实数据模型里都不存在）
const features = [
  { icon: UsersRound, text: '学生与教师账号、技能与队伍关系统一管理' },
  { icon: Trophy, text: '赛事信息聚合，AI 生成赛事简介与含金量' },
  { icon: Sparkles, text: '匹配池按技能与赛事双重交集推荐队友' },
  { icon: ShieldCheck, text: '身份与权限分离，敏感操作服务端二次校验' },
]

/** 登录走 POST /auth/login：账号校验、权限判断都在服务端，页面只负责展示结果 */
function submit() {
  error.value = ''
  formRef.value?.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      const user = await auth.login({ username: form.username, password: form.password })
      toast(`欢迎回来，${user.username}`)
      const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
      router.replace(redirect)
    } catch (err) {
      error.value = err.message || '登录失败，请重试'
    } finally {
      loading.value = false
    }
  })
}

function fillDemo(u) {
  form.username = u === 'admin' ? 'admin' : 'demo'
  form.password = u === 'admin' ? 'admin123' : '123456'
  error.value = ''
  formRef.value?.clearValidate()
}
</script>

<template>
  <div class="login">
    <!-- 品牌区 -->
    <section class="side">
      <div class="blob b1"></div>
      <div class="blob b2"></div>

      <div class="side-inner">
        <div class="brand">
          <div class="brand-logo"><Zap :size="19" :stroke-width="2.6" /></div>
          <div class="brand-txt">
            <b>智队搭</b>
            <span>Smart Team Build</span>
          </div>
        </div>

        <div class="slogan">
          <h1>让每一次赛事<br />组队都高效而科学</h1>
          <p>从 AI 技能评级到队伍构建，从赛事内容到智能匹配，一站式高校赛事组队平台。</p>
        </div>

        <ul class="features">
          <li v-for="f in features" :key="f.text">
            <span class="feat-icon"><component :is="f.icon" :size="16" /></span>
            {{ f.text }}
          </li>
        </ul>
      </div>

      <footer class="side-foot">© 2026 智队搭 · Smart Team Build</footer>
    </section>

    <!-- 登录表单区 -->
    <section class="panel">
      <div class="panel-inner">
        <div class="brand mobile-brand">
          <div class="brand-logo"><Zap :size="19" :stroke-width="2.6" /></div>
          <div class="brand-txt"><b>智队搭</b></div>
        </div>

        <h2 class="form-title">欢迎回来</h2>
        <p class="form-sub">登录管理后台，管理赛事内容与队伍数据</p>

        <el-alert
          v-if="error"
          :title="error"
          type="error"
          show-icon
          :closable="false"
          class="login-error"
        />

        <div class="demo-tip">
          <Sparkles :size="14" />
          <span>演示账号：</span>
          <el-link type="primary" :underline="false" @click="fillDemo('admin')">admin / admin123（管理员）</el-link>
          <span class="sep">·</span>
          <el-link type="primary" :underline="false" @click="fillDemo('demo')">demo / 123456（教师身份 + 管理员权限）</el-link>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" class="form" @submit.prevent="submit">
          <el-form-item prop="username">
            <el-input
              v-model="form.username"
              size="large"
              placeholder="请输入管理员账号"
              autocomplete="username"
            >
              <template #prefix>
                <User :size="16" />
              </template>
            </el-input>
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              size="large"
              type="password"
              placeholder="请输入密码"
              autocomplete="current-password"
              show-password
            >
              <template #prefix>
                <LockKeyhole :size="16" />
              </template>
            </el-input>
          </el-form-item>

          <el-button
            type="primary"
            size="large"
            class="submit"
            native-type="submit"
            :loading="loading"
          >
            <template v-if="!loading">登 录<ArrowRight :size="16" class="submit-arrow" /></template>
          </el-button>
        </el-form>

        <p class="footnote">演示环境：数据均为模拟数据，仅用于作品展示；接入真实云开发环境后即为线上数据。</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login { display: flex; min-height: 100vh; background: var(--bg); }

/* ===== 品牌侧 ===== */
.side {
  position: relative; flex: 1.1;
  display: flex; flex-direction: column;
  padding: 48px 56px;
  background:
    radial-gradient(1200px 600px at -10% -10%, rgba(129, 140, 248, 0.5), transparent 60%),
    radial-gradient(900px 500px at 110% 110%, rgba(168, 85, 247, 0.35), transparent 55%),
    linear-gradient(165deg, #101b3d 0%, #0c1226 100%);
  color: #fff; overflow: hidden;
}
.blob { position: absolute; border-radius: 50%; filter: blur(10px); opacity: 0.35; }
.b1 { width: 300px; height: 300px; right: -80px; top: 30%; background: radial-gradient(circle, #6366f1, transparent 70%); }
.b2 { width: 220px; height: 220px; left: -60px; bottom: 8%; background: radial-gradient(circle, #a855f7, transparent 70%); }

.brand { display: flex; align-items: center; gap: 11px; }
.brand-logo {
  width: 38px; height: 38px; border-radius: 11px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  box-shadow: 0 10px 26px -8px rgba(129, 140, 248, 0.7);
}
.brand-txt { display: flex; flex-direction: column; line-height: 1.2; }
.brand-txt b { font-size: 18px; letter-spacing: 1px; }
.brand-txt span { font-size: 11px; color: #8b9bc4; letter-spacing: 0.4px; }

.side-inner { position: relative; margin: auto 0; max-width: 520px; }
.slogan h1 { font-size: 38px; line-height: 1.32; font-weight: 700; letter-spacing: 1px; }
.slogan p { margin-top: 18px; font-size: 14.5px; line-height: 1.9; color: #b6c2dd; max-width: 460px; }

.features { list-style: none; margin: 34px 0 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.features li { display: flex; align-items: center; gap: 12px; font-size: 13.5px; color: #cfd8ee; }
.feat-icon {
  width: 30px; height: 30px; border-radius: 9px; flex: none;
  display: flex; align-items: center; justify-content: center;
  background: rgba(129, 140, 248, 0.18); color: #a5b4fc;
}
.side-foot { position: relative; font-size: 12px; color: #5f6f93; }

/* ===== 表单侧 ===== */
.panel { flex: 1; display: flex; align-items: center; justify-content: center; padding: 32px 20px; }
.panel-inner { width: min(400px, 100%); }
.mobile-brand { display: none; margin-bottom: 30px; color: var(--t1); }
.mobile-brand .brand-txt b { color: var(--t1); }
.form-title { font-size: 27px; font-weight: 700; }
.form-sub { color: var(--t3); margin-top: 8px; font-size: 13.5px; }
.form { margin-top: 22px; }
.form :deep(.el-input__prefix) { color: var(--t3); }

.login-error { margin-bottom: 16px; }
.login-error :deep(.el-alert__title) { font-size: 13px; }

.demo-tip {
  margin-top: 18px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px;
  font-size: 12.5px; color: var(--t3);
  padding: 9px 12px; border: 1px dashed var(--border); border-radius: var(--radius-sm);
  background: #fafbfe;
}
.demo-tip > svg { color: var(--c-warning); flex: none; }
.demo-tip .el-link { font-size: 12.5px; }
.sep { color: var(--border); margin: 0 3px; }

.submit {
  width: 100%; margin-top: 6px;
  font-size: 15px; letter-spacing: 2px;
}
.submit-arrow { letter-spacing: 0; }

.footnote { margin-top: 24px; text-align: center; font-size: 12px; color: var(--t3); }

/* ===== 响应式 ===== */
@media (max-width: 960px) {
  .side { display: none; }
  .mobile-brand { display: flex; }
  .panel { align-items: flex-start; padding-top: 46px; }
}
</style>
