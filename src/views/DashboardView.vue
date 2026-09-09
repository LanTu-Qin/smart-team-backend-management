<script setup>
import { computed } from 'vue'
import { Users, Flag, Trophy, CalendarCheck2, ArrowRight, TrendingUp, Medal } from 'lucide-vue-next'

// ===== ECharts 按需注册（图表由 vue-echarts 渲染） =====
import { use, graphic } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
use([CanvasRenderer, LineChart, PieChart, GridComponent, TooltipComponent])

import { useUsersStore } from '@/stores/users'
import { useTeamsStore } from '@/stores/teams'
import { useCompetitionsStore } from '@/stores/competitions'
import { useAuthStore } from '@/stores/auth'

const usersStore = useUsersStore()
const teamsStore = useTeamsStore()
const compsStore = useCompetitionsStore()
const auth = useAuthStore()

/* 统计卡片 */
const stats = computed(() => [
  {
    label: '注册用户', value: usersStore.total, icon: Users, cls: 'indigo',
    trend: '+12.4%', trendTxt: '较上季度',
  },
  {
    label: '活跃队伍', value: teamsStore.activeCount, icon: Flag, cls: 'sky',
    sub: `共 ${teamsStore.total} 支战队`,
  },
  {
    label: '进行中赛事', value: compsStore.ongoingCount, icon: Trophy, cls: 'amber',
    sub: `${compsStore.upcomingCount} 场即将开赛`,
  },
  {
    label: '累计报名', value: compsStore.totalRegistered, icon: CalendarCheck2, cls: 'violet',
    trend: '+8.1%', trendTxt: '较上月',
  },
])

/* ===== 用户规模趋势（ECharts 折线面积图） ===== */
const trendData = [
  { m: '25/10', v: 322 }, { m: '25/11', v: 601 }, { m: '25/12', v: 928 },
  { m: '26/01', v: 1480 }, { m: '26/02', v: 1960 }, { m: '26/03', v: 2540 },
  { m: '26/04', v: 2830 }, { m: '26/05', v: 3360 }, { m: '26/06', v: 3700 },
  { m: '26/07', v: 4180 }, { m: '26/08', v: 4520 }, { m: '26/09', v: 5020 },
]
const fmt = (n) => n.toLocaleString('zh-CN')
const axisColor = '#94a3b8'
const trendOption = {
  animationDuration: 600,
  grid: { left: 6, right: 12, top: 26, bottom: 4, containLabel: true },
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#0f172a',
    borderWidth: 0,
    padding: [8, 12],
    textStyle: { color: '#fff', fontSize: 12 },
    formatter: (params) => {
      const p = params[0]
      return `${p.axisValue}<br/>累计用户 <b style="color:#818cf8">${fmt(p.value)}</b> 人`
    },
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: trendData.map((d) => d.m),
    axisLine: { lineStyle: { color: '#e5e9f2' } },
    axisTick: { show: false },
    axisLabel: { color: axisColor, fontSize: 10 },
  },
  yAxis: {
    type: 'value',
    splitNumber: 4,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: axisColor,
      fontSize: 10,
      formatter: (v) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : v),
    },
    splitLine: { lineStyle: { color: '#eef1f7', type: 'dashed' } },
  },
  series: [
    {
      name: '注册用户',
      type: 'line',
      smooth: true,
      showSymbol: false,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: '#4f46e5', width: 2.5 },
      itemStyle: { color: '#4f46e5', borderColor: '#fff', borderWidth: 2 },
      emphasis: { scale: true, scaleSize: 5 },
      areaStyle: {
        color: new graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(99, 102, 241, 0.22)' },
          { offset: 1, color: 'rgba(99, 102, 241, 0)' },
        ]),
      },
      data: trendData.map((d) => d.v),
    },
  ],
}

/* ===== 用户角色构成（ECharts 环形图 + 列表） ===== */
const roleMeta = {
  admin: { label: '管理员', cls: 'primary', color: '#6366f1' },
  organizer: { label: '组织者', cls: 'purple', color: '#a78bfa' },
  player: { label: '队员', cls: 'info', color: '#0ea5e9' },
}
const roleRows = computed(() =>
  Object.keys(roleMeta).map((k) => ({
    key: k,
    ...roleMeta[k],
    count: usersStore.byRole(k),
  })),
)
const roleOption = computed(() => ({
  animationDuration: 500,
  tooltip: {
    trigger: 'item',
    backgroundColor: '#0f172a',
    borderWidth: 0,
    padding: [8, 12],
    textStyle: { color: '#fff', fontSize: 12 },
    formatter: (p) => `${p.name}<br/>${p.value} 人 · ${p.percent}%`,
  },
  series: [
    {
      type: 'pie',
      radius: ['70%', '92%'],
      center: ['50%', '50%'],
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
      label: { show: false },
      labelLine: { show: false },
      emphasis: {
        itemStyle: { shadowBlur: 16, shadowColor: 'rgba(99, 102, 241, 0.35)' },
      },
      data: roleRows.value.map((r) => ({
        name: r.label,
        value: r.count,
        itemStyle: { color: r.color },
      })),
    },
  ],
}))

/* 战队积分榜 */
const topMedals = ['gold', 'silver', 'bronze']
const ranking = computed(() => teamsStore.ranking)
const maxPts = computed(() => ranking.value[0]?.points || 1)
const barWidth = (pts) => Math.max(6, Math.round((pts / maxPts.value) * 100))

/* 近期赛事 */
const statusMeta = {
  ongoing: { label: '进行中', cls: 'success' },
  upcoming: { label: '未开始', cls: 'info' },
  finished: { label: '已结束', cls: '' },
}
const recentComps = computed(() =>
  compsStore.items
    .filter((c) => c.status !== 'finished')
    .concat(compsStore.byStatus('finished'))
    .slice(0, 4),
)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div class="title-wrap">
        <h2>数据看板</h2>
        <div class="page-sub">欢迎回来，{{ auth.user?.name }} · 平台运行概览一览无余</div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <section class="stats">
      <div v-for="s in stats" :key="s.label" class="stat-card">
        <div class="stat-ico" :class="s.cls">
          <component :is="s.icon" :size="21" />
        </div>
        <div class="stat-info">
          <div class="stat-val">{{ s.value }}</div>
          <div class="stat-lab">
            {{ s.label }}
            <em v-if="s.trend" class="trend"><TrendingUp :size="11" />{{ s.trend }}</em>
          </div>
          <div v-if="s.sub" class="stat-sub">{{ s.sub }}</div>
        </div>
      </div>
    </section>

    <!-- 趋势 + 角色构成 -->
    <section class="grid-2">
      <div class="card card-pad chart-card">
        <div class="card-h">
          <h3>用户规模趋势</h3>
          <span class="badge info">近 12 个月</span>
        </div>
        <v-chart class="trend-chart" :option="trendOption" autoresize />
        <div class="chart-note">累计注册用户 <b>{{ fmt(trendData[trendData.length - 1].v) }}</b> 人 · 月均新增约 427 人</div>
      </div>

      <div class="card card-pad">
        <div class="card-h"><h3>用户角色构成</h3></div>
        <div class="donut-wrap">
          <div class="pie-box">
            <v-chart class="pie-chart" :option="roleOption" autoresize />
            <div class="pie-hole">
              <b>{{ usersStore.total }}</b>
              <span>用户</span>
            </div>
          </div>
          <ul class="role-list">
            <li v-for="r in roleRows" :key="r.key">
              <div class="role-top">
                <span class="badge" :class="r.cls">{{ r.label }}</span>
                <b>{{ r.count }}</b>
              </div>
              <div class="bar">
                <i :class="`bar-${r.cls}`" :style="{ width: `${(r.count / Math.max(1, usersStore.total)) * 100}%` }"></i>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- 近期赛事 + 战队榜 -->
    <section class="grid-2 bottom">
      <div class="card card-pad">
        <div class="card-h">
          <h3>近期赛事</h3>
          <RouterLink to="/competitions" class="link">
            查看全部 <ArrowRight :size="13" />
          </RouterLink>
        </div>
        <ul class="comp-list">
          <li v-for="c in recentComps" :key="c.id" class="comp-row">
            <div class="comp-main">
              <span class="badge" :class="statusMeta[c.status].cls">
                <span class="dot"></span>{{ statusMeta[c.status].label }}
              </span>
              <div class="comp-title">{{ c.title }}</div>
              <div class="comp-meta">{{ c.host }} · {{ c.type }}</div>
            </div>
            <div class="comp-side">
              <b class="comp-date">{{ c.startDate }}</b>
              <span class="comp-reg">{{ c.registered }}/{{ c.quota }} 队</span>
            </div>
          </li>
        </ul>
      </div>

      <div class="card card-pad">
        <div class="card-h">
          <h3>战队积分榜</h3>
          <RouterLink to="/teams" class="link">
            全部队伍 <ArrowRight :size="13" />
          </RouterLink>
        </div>
        <ul class="rank-list">
          <li v-for="(t, i) in ranking" :key="t.id" class="rank-row">
            <span class="rank-no" :class="topMedals[i]">{{ i + 1 }}</span>
            <div class="rank-main">
              <div class="rank-top">
                <span class="rank-name" :title="t.name">{{ t.name }}</span>
                <b>{{ t.points }}</b>
              </div>
              <div class="bar">
                <i class="bar-rank" :style="{ width: `${barWidth(t.points)}%` }"></i>
              </div>
              <span class="rank-cat">{{ t.category }} · 队长 {{ t.captain }}</span>
            </div>
          </li>
        </ul>
        <div v-if="ranking.length === 0" class="empty empty-pad">
          <Medal :size="30" />
          <div class="empty-t">暂无队伍数据</div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 统计卡 */
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
.stat-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  padding: 18px 16px; display: flex; align-items: center; gap: 13px;
  transition: transform 0.16s, box-shadow 0.16s;
}
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 14px 34px -18px rgba(15, 23, 42, 0.22); }
.stat-ico {
  width: 46px; height: 46px; border-radius: 13px; flex: none;
  display: flex; align-items: center; justify-content: center; color: #fff;
}
.stat-ico.indigo { background: linear-gradient(135deg, #6366f1, #818cf8); }
.stat-ico.sky { background: linear-gradient(135deg, #0ea5e9, #38bdf8); }
.stat-ico.amber { background: linear-gradient(135deg, #f59e0b, #fbbf24); }
.stat-ico.violet { background: linear-gradient(135deg, #8b5cf6, #a78bfa); }
.stat-info { min-width: 0; }
.stat-val { font-size: 26px; font-weight: 800; line-height: 1.1; }
.stat-lab { font-size: 12.5px; color: var(--t3); margin-top: 3px; display: flex; align-items: center; gap: 6px; }
.stat-sub { font-size: 11.5px; color: var(--t3); margin-top: 1px; }
.trend {
  display: inline-flex; align-items: center; gap: 2px; font-style: normal;
  color: var(--c-success); background: var(--c-success-soft);
  padding: 0 6px; border-radius: 999px; font-size: 11px; line-height: 17px;
}

/* 双栏网格 */
.grid-2 { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-bottom: 16px; }
.grid-2.bottom { grid-template-columns: 1fr 1.1fr; margin-bottom: 0; }
.card-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.card-h h3 { font-size: 15px; font-weight: 600; }
.link { display: inline-flex; align-items: center; gap: 3px; color: var(--t3); font-size: 12.5px; }
.link:hover { color: var(--c-primary); }

/* ECharts 折线趋势图 */
.trend-chart { width: 100%; height: 236px; }
.chart-note { margin-top: 10px; font-size: 12px; color: var(--t3); }
.chart-note b { color: var(--c-primary); }

/* 角色构成：环形图 + 列表 */
.donut-wrap { display: flex; align-items: center; gap: 20px; }
.pie-box { position: relative; width: 148px; height: 148px; flex: none; }
.pie-chart { width: 100%; height: 100%; }
.pie-hole {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  pointer-events: none;
}
.pie-hole b { font-size: 20px; line-height: 1; }
.pie-hole span { font-size: 11px; color: var(--t3); margin-top: 3px; }
.role-list { flex: 1; list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 13px; min-width: 0; }
.role-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; }
.role-top b { font-size: 13px; }
.bar { height: 6px; border-radius: 99px; background: var(--border-light); overflow: hidden; }
.bar i { display: block; height: 100%; border-radius: 99px; }
.bar-primary { background: #6366f1; }
.bar-purple { background: #a78bfa; }
.bar-info { background: #0ea5e9; }

/* 近期赛事列表 */
.comp-list, .rank-list { list-style: none; margin: 0; padding: 0; }
.comp-row {
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  padding: 13px 0; border-bottom: 1px dashed var(--border-light);
}
.comp-row:last-child { border-bottom: 0; padding-bottom: 0; }
.comp-row:first-child { padding-top: 0; }
.comp-main { min-width: 0; }
.comp-title {
  font-weight: 600; font-size: 13.5px; margin-top: 6px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 340px;
}
.comp-meta { font-size: 12px; color: var(--t3); margin-top: 3px; }
.comp-side { text-align: right; flex: none; }
.comp-date { font-size: 13px; font-variant-numeric: tabular-nums; }
.comp-reg { display: block; font-size: 11.5px; color: var(--t3); margin-top: 3px; }

/* 榜单 */
.rank-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; }
.rank-no {
  width: 24px; height: 24px; flex: none; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  background: #eef1f7; color: var(--t2); font-size: 12px; font-weight: 700;
}
.rank-no.gold { background: linear-gradient(135deg, #f59e0b, #fbbf24); color: #fff; }
.rank-no.silver { background: linear-gradient(135deg, #94a3b8, #cbd5e1); color: #fff; }
.rank-no.bronze { background: linear-gradient(135deg, #d97706, #f59e0b); color: #fff; }
.rank-main { flex: 1; min-width: 0; }
.rank-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.rank-name { font-weight: 600; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rank-top b { font-size: 13px; font-variant-numeric: tabular-nums; }
.bar-rank { background: linear-gradient(90deg, #6366f1, #a855f7); }
.rank-cat { font-size: 11.5px; color: var(--t3); margin-top: 4px; display: block; }

/* 响应式 */
@media (max-width: 1280px) {
  .stats { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 1024px) {
  .grid-2, .grid-2.bottom { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .stats { grid-template-columns: 1fr; }
  .comp-side { display: none; }
  .comp-title { max-width: 100%; }
}
</style>
