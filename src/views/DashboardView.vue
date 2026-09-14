<script setup>
import { computed, onMounted } from 'vue'
import { Users, Flag, Trophy, Radio } from 'lucide-vue-next'

// ===== ECharts 按需注册（图表由 vue-echarts 渲染） =====
import { use, graphic } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
use([CanvasRenderer, BarChart, PieChart, GridComponent, TooltipComponent])

import { useDashboardStore } from '@/stores/dashboard'
import { useAuthStore } from '@/stores/auth'

const store = useDashboardStore()
const auth = useAuthStore()

/* ---------------------------------------------------------------------------
 * 页面只做渲染：所有数字都来自 GET /dashboard/overview（契约第 3 节）。
 * 没有"新增趋势"折线 —— user / teams 集合都没有 createdAt，画出来就是假曲线。
 * ------------------------------------------------------------------------- */
const d = computed(() => store.data)

const stats = computed(() => [
  { label: '平台用户', value: d.value.userTotal, icon: Users, cls: 'indigo', sub: `匹配中 ${d.value.matchingUsers} 人` },
  { label: '队伍', value: d.value.teamTotal, icon: Flag, cls: 'sky', sub: `匹配中 ${d.value.matchingTeams} 支` },
  { label: '赛事', value: d.value.compTotal, icon: Trophy, cls: 'amber', sub: `报名中 ${d.value.openCompCount} 场` },
  { label: '匹配池用户', value: d.value.matchingUsers, icon: Radio, cls: 'violet', sub: `匹配中队伍 ${d.value.matchingTeams} 支` },
])

const fmt = (n) => Number(n || 0).toLocaleString('zh-CN')
const axisColor = '#94a3b8'
const tooltipBase = {
  backgroundColor: '#0f172a',
  borderWidth: 0,
  padding: [8, 12],
  textStyle: { color: '#fff', fontSize: 12 },
}
const PIE_COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#22c55e', '#a855f7', '#94a3b8']

/* ===== 各赛事队伍数（横向柱状图，取 TOP 6） ===== */
const compTeamsOption = computed(() => {
  const rows = [...d.value.teamsPerComp].reverse() // ECharts 类目轴自下而上，反转让最大的在上
  return {
    animationDuration: 600,
    grid: { left: 6, right: 24, top: 8, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltipBase,
      trigger: 'item',
      formatter: (p) => `${p.name}<br/>队伍 <b style="color:#818cf8">${p.value}</b> 支`,
    },
    xAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: axisColor, fontSize: 10 },
      splitLine: { lineStyle: { color: '#eef1f7', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: rows.map((r) => r.name),
      axisLine: { lineStyle: { color: '#e5e9f2' } },
      axisTick: { show: false },
      axisLabel: { color: axisColor, fontSize: 10, width: 150, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        data: rows.map((r) => r.value),
        barWidth: 13,
        itemStyle: {
          borderRadius: [0, 7, 7, 0],
          color: new graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#6366f1' },
            { offset: 1, color: '#a855f7' },
          ]),
        },
      },
    ],
  }
})

/** 环形图通用配置：{rows, unit} */
const donutOption = (rows, unit) => ({
  animationDuration: 500,
  tooltip: { ...tooltipBase, trigger: 'item', formatter: (p) => `${p.name}<br/>${p.value} ${unit} · ${p.percent}%` },
  series: [
    {
      type: 'pie',
      radius: ['62%', '88%'],
      center: ['50%', '50%'],
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
      label: { show: false },
      labelLine: { show: false },
      emphasis: { itemStyle: { shadowBlur: 16, shadowColor: 'rgba(99, 102, 241, 0.35)' } },
      data: rows.map((r, i) => ({
        name: r.name,
        value: r.value,
        itemStyle: { color: PIE_COLORS[i % PIE_COLORS.length] },
      })),
    },
  ],
})

const levelOption = computed(() => donutOption(d.value.distByLevel, '场'))
const statusOption = computed(() => donutOption(d.value.distByStatus, '场'))
const typeOption = computed(() => donutOption(d.value.distByType, '场'))

/** 图例列表：颜色与图表一一对应（ECharts 关掉自带 label，用列表更易读） */
const legendRows = (rows) =>
  rows.map((r, i) => ({ ...r, color: PIE_COLORS[i % PIE_COLORS.length] }))
const levelRows = computed(() => legendRows(d.value.distByLevel))
const statusRows = computed(() => legendRows(d.value.distByStatus))
const typeRows = computed(() => legendRows(d.value.distByType))

onMounted(() => store.fetchOverview())
</script>

<template>
  <div class="page" v-loading="store.loading">
    <div class="page-head">
      <div class="title-wrap">
        <h2>数据看板</h2>
        <div class="page-sub">欢迎回来，{{ auth.user?.username }} · 所有指标由 /dashboard/overview 实时聚合</div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <section class="stats">
      <div v-for="s in stats" :key="s.label" class="stat-card">
        <div class="stat-ico" :class="s.cls">
          <component :is="s.icon" :size="21" />
        </div>
        <div class="stat-info">
          <div class="stat-val">{{ fmt(s.value) }}</div>
          <div class="stat-lab">{{ s.label }}</div>
          <div class="stat-sub">{{ s.sub }}</div>
        </div>
      </div>
    </section>

    <!-- 各赛事队伍数 + 赛事级别分布 -->
    <section class="grid-2">
      <div class="card card-pad chart-card">
        <div class="card-h">
          <h3>各赛事队伍数</h3>
          <span class="badge info">TOP {{ d.teamsPerComp.length }}</span>
        </div>
        <v-chart v-if="d.teamsPerComp.length" class="bar-chart" :option="compTeamsOption" autoresize />
        <div v-else class="empty empty-pad">暂无队伍报名数据</div>
      </div>

      <div class="card card-pad">
        <div class="card-h"><h3>赛事级别分布</h3></div>
        <div class="donut-wrap">
          <div class="pie-box">
            <v-chart class="pie-chart" :option="levelOption" autoresize />
            <div class="pie-hole">
              <b>{{ fmt(d.compTotal) }}</b>
              <span>场赛事</span>
            </div>
          </div>
          <ul class="legend-list">
            <li v-for="r in levelRows" :key="r.name">
              <i class="dot" :style="{ background: r.color }"></i>
              <span class="legend-name">{{ r.name }}</span>
              <b>{{ r.value }}</b>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- 状态分布 + 参赛形式分布 -->
    <section class="grid-2 bottom">
      <div class="card card-pad">
        <div class="card-h"><h3>赛事状态分布</h3></div>
        <div class="donut-wrap">
          <div class="pie-box">
            <v-chart class="pie-chart" :option="statusOption" autoresize />
          </div>
          <ul class="legend-list">
            <li v-for="r in statusRows" :key="r.name">
              <i class="dot" :style="{ background: r.color }"></i>
              <span class="legend-name">{{ r.name }}</span>
              <b>{{ r.value }}</b>
            </li>
          </ul>
        </div>
      </div>

      <div class="card card-pad">
        <div class="card-h"><h3>参赛形式分布</h3></div>
        <div class="donut-wrap">
          <div class="pie-box">
            <v-chart class="pie-chart" :option="typeOption" autoresize />
          </div>
          <ul class="legend-list">
            <li v-for="r in typeRows" :key="r.name">
              <i class="dot" :style="{ background: r.color }"></i>
              <span class="legend-name">{{ r.name }}</span>
              <b>{{ r.value }}</b>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <div class="card card-pad note-card">
      说明：看板不做"新增趋势"折线 —— user / teams 集合都没有 <code>createdAt</code> 字段，
      历史无法追溯，宁可不画也不画假曲线。若要趋势，需从现在开始写入创建时间并向后累积。
    </div>
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
.stat-lab { font-size: 12.5px; color: var(--t3); margin-top: 3px; }
.stat-sub { font-size: 11.5px; color: var(--t3); margin-top: 1px; }

/* 双栏网格 */
.grid-2 { display: grid; grid-template-columns: 1.6fr 1fr; gap: 16px; margin-bottom: 16px; }
.grid-2.bottom { grid-template-columns: 1fr 1fr; }
.card-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.card-h h3 { font-size: 15px; font-weight: 600; }

.bar-chart { width: 100%; height: 240px; }

/* 环形图 + 图例 */
.donut-wrap { display: flex; align-items: center; gap: 18px; }
.pie-box { position: relative; width: 132px; height: 132px; flex: none; }
.pie-chart { width: 100%; height: 100%; }
.pie-hole {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  pointer-events: none;
}
.pie-hole b { font-size: 19px; line-height: 1; }
.pie-hole span { font-size: 11px; color: var(--t3); margin-top: 3px; }

.legend-list { flex: 1; list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.legend-list li { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.legend-list .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.legend-name { flex: 1; min-width: 0; color: var(--t2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.legend-list b { font-variant-numeric: tabular-nums; }

.note-card { font-size: 12.5px; line-height: 1.7; color: var(--t3); }
.note-card code {
  font-family: ui-monospace, Consolas, monospace; font-size: 12px;
  background: var(--bg-soft, #f4f6fb); padding: 1px 5px; border-radius: 5px;
}

@media (max-width: 1280px) {
  .stats { grid-template-columns: repeat(2, 1fr); }
  .grid-2, .grid-2.bottom { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .stats { grid-template-columns: 1fr; }
}
</style>
