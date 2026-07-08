<template>
  <div class="page dashboard-page" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">统计看板</h2>
      <p class="page-desc">{{ scopeDesc }}</p>
    </div>

    <!-- KPI 卡片 -->
    <div class="kpi-grid fade-up">
      <div class="kpi-card" v-for="k in kpis" :key="k.label" :style="{ '--accent': k.color }">
        <div class="kpi-icon"><el-icon :size="24"><component :is="k.icon" /></el-icon></div>
        <div class="kpi-body">
          <div class="kpi-value">{{ k.value }}<span class="kpi-unit">{{ k.unit }}</span></div>
          <div class="kpi-label">{{ k.label }}</div>
        </div>
      </div>
    </div>

    <!-- 图表区 -->
    <div class="chart-grid fade-up">
      <div class="glass-card chart-card chart-trend">
        <div class="card-title">
          <el-icon><TrendCharts /></el-icon><span>出勤率趋势</span>
          <el-radio-group v-model="trendRange" class="trend-range" size="small" @change="onTrendRangeChange">
            <el-radio-button label="7">最近7天</el-radio-button>
            <el-radio-button label="14">最近14天</el-radio-button>
            <el-radio-button label="30">最近30天</el-radio-button>
            <el-radio-button label="all">全部</el-radio-button>
          </el-radio-group>
        </div>
        <div ref="trendRef" class="chart-box"></div>
      </div>
      <div class="glass-card chart-card chart-dept">
        <div class="card-title">
          <el-icon><Histogram /></el-icon><span>部门迟到次数</span>
        </div>
        <div ref="deptRef" class="chart-box"></div>
      </div>
    </div>

    <!-- Top5 考勤最佳员工（公开主页） -->
    <div class="glass-card top-card fade-up">
      <div class="card-title">
        <el-icon><Trophy /></el-icon><span>考勤之星 Top 5</span>
        <el-tag type="success" effect="plain" size="small" round>公开可见</el-tag>
        <span class="card-sub">点击行可查看员工主页（含热力图）</span>
      </div>
      <el-table :data="topBest" border size="default" @row-click="goProfile" class="clickable-table">
        <el-table-column type="index" label="排名" width="80" align="center">
          <template #default="{ $index }">
            <el-tag :type="$index < 3 ? 'success' : 'info'" effect="dark" round size="small">
              {{ $index + 1 }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="employeeId" label="工号" width="100" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="dept" label="部门" width="120" />
        <el-table-column prop="attendanceRate" label="出勤率" align="center">
          <template #default="{ row }">
            <span class="good-num">{{ row.attendanceRate }}%</span>
          </template>
        </el-table-column>
        <el-table-column prop="anomalyScore" label="异常分" align="center">
          <template #default="{ row }">
            <span class="good-num">{{ row.anomalyScore }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center">
          <template #default>
            <el-button type="primary" link size="small">查看主页</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 后5 待改进员工（公开主页） -->
    <div class="glass-card top-card fade-up">
      <div class="card-title">
        <el-icon><Warning /></el-icon><span>待改进 后 5</span>
        <el-tag type="danger" effect="plain" size="small" round>公开可见</el-tag>
        <span class="card-sub">异常分越高，考勤越需改进</span>
      </div>
      <el-table :data="bottomWorst" border size="default" @row-click="goProfile" class="clickable-table">
        <el-table-column type="index" label="排名" width="80" align="center">
          <template #default="{ $index }">
            <el-tag :type="$index < 3 ? 'danger' : 'warning'" effect="dark" round size="small">
              {{ $index + 1 }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="employeeId" label="工号" width="100" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="dept" label="部门" width="120" />
        <el-table-column prop="lateCount" label="迟到次数" align="center">
          <template #default="{ row }">
            <span class="late-num">{{ row.lateCount }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="anomalyScore" label="异常分" align="center">
          <template #default="{ row }">
            <span class="late-num">{{ row.anomalyScore }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center">
          <template #default>
            <el-button type="danger" link size="small">查看主页</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import {
  TrendCharts, Histogram, Trophy, Warning, DataLine, AlarmClock, Clock, Timer
} from '@element-plus/icons-vue'
import request from '../api/request'
import { useAuthStore } from '../stores/auth'
import { useRulesStore } from '../stores/rules'
import { calcAll, summarize } from '../utils/attendance'
import { computeRanking } from '../utils/ranking'

const auth = useAuthStore()
const rulesStore = useRulesStore()

const loading = ref(false)
const employees = ref([])
const records = ref([])

const trendRef = ref()
const deptRef = ref()
let trendChart = null
let deptChart = null

const scopeDesc = computed(() => {
  if (auth.role === 'admin') return '全公司考勤数据统计'
  if (auth.role === 'manager') return `本部门（${auth.dept}）考勤数据统计`
  return '个人考勤数据统计'
})

const empMap = computed(() => {
  const m = {}
  employees.value.forEach((e) => { m[e.employeeId] = e })
  return m
})

// 计算状态并附加员工信息
const computedRecords = computed(() => {
  const rules = rulesStore.rules
  const calc = calcAll(records.value, rules)
  const map = empMap.value
  return calc.map((r) => {
    const emp = map[r.employeeId] || {}
    return { ...r, name: emp.name || '未知', dept: emp.dept || '未知' }
  })
})

// 角色范围过滤
const scoped = computed(() => {
  if (auth.role === 'admin') return computedRecords.value
  if (auth.role === 'manager') return computedRecords.value.filter((r) => r.dept === auth.dept)
  return computedRecords.value.filter((r) => r.employeeId === auth.employeeId)
})

// KPI 汇总
const summaryData = computed(() => summarize(scoped.value))

const kpis = computed(() => [
  { label: '出勤率', value: summaryData.value.attendanceRate, unit: '%', icon: 'DataLine', color: '#1677ff' },
  { label: '迟到次数', value: summaryData.value.lateCount, unit: '次', icon: 'AlarmClock', color: '#faad14' },
  { label: '早退次数', value: summaryData.value.earlyCount, unit: '次', icon: 'Clock', color: '#faad14' },
  { label: '缺勤次数', value: summaryData.value.absent, unit: '次', icon: 'AlarmClock', color: '#ef4444' },
  { label: '累计加班', value: summaryData.value.overtimeHours, unit: '小时', icon: 'Timer', color: '#16a34a' }
])

// 趋势时间范围：7/14/30/all
const trendRange = ref('30')

function parseDateStr(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function fmtDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addDays(d, days) {
  const nd = new Date(d)
  nd.setDate(nd.getDate() + days)
  return nd
}

// 趋势：按日期出勤率（支持时间范围筛选）
const trendData = computed(() => {
  const allDates = scoped.value.map((r) => r.date)
  if (allDates.length === 0) return { dates: [], rates: [] }
  const maxDate = parseDateStr(allDates.sort()[allDates.length - 1])
  let minDate = null
  if (trendRange.value !== 'all') {
    const days = Number(trendRange.value)
    // 包含起始日：往前推 days-1 天
    minDate = addDays(maxDate, -(days - 1))
  }

  const byDate = {}
  scoped.value.forEach((r) => {
    const d = parseDateStr(r.date)
    if (minDate && d < minDate) return
    if (!byDate[r.date]) byDate[r.date] = { total: 0, attended: 0 }
    byDate[r.date].total++
    if (r.status !== 'absent') byDate[r.date].attended++
  })
  const dates = Object.keys(byDate).sort()
  const rates = dates.map((d) => +((byDate[d].attended / byDate[d].total) * 100).toFixed(1))
  return { dates, rates }
})

function onTrendRangeChange() {
  nextTick(() => {
    if (trendChart) trendChart.dispose()
    renderCharts()
  })
}

// 部门迟到
const deptLate = computed(() => {
  const byDept = {}
  scoped.value.forEach((r) => {
    if (!byDept[r.dept]) byDept[r.dept] = 0
    if (r.isLate) byDept[r.dept]++
  })
  const entries = Object.entries(byDept).map(([dept, count]) => ({ dept, count }))
  entries.sort((a, b) => b.count - a.count)
  return entries
})

// 员工考勤排名（基于异常分）
const ranking = computed(() => computeRanking(records.value, employees.value, rulesStore.rules))

// Top5 最佳考勤（异常分最低）
const topBest = computed(() => ranking.value.top5)

// 后5 待改进（异常分最高）
const bottomWorst = computed(() => ranking.value.bottom5)

const router = useRouter()
function goProfile(row) {
  router.push(`/employee/${row.employeeId}`)
}

function renderCharts() {
  if (trendRef.value) {
    trendChart = echarts.init(trendRef.value)
    const { dates, rates } = trendData.value
    trendChart.setOption({
      tooltip: { trigger: 'axis', formatter: (p) => `${p[0].axisValue}<br/>出勤率：<b>${p[0].data}%</b>` },
      grid: { left: 40, right: 20, top: 20, bottom: 40 },
      xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 11, rotate: dates.length > 8 ? 35 : 0 } },
      yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
      series: [{
        type: 'line',
        data: rates,
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 3, color: '#1677ff' },
        itemStyle: { color: '#1677ff' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(22,119,255,0.3)' },
            { offset: 1, color: 'rgba(22,119,255,0.02)' }
          ])
        }
      }]
    })
  }
  if (deptRef.value) {
    deptChart = echarts.init(deptRef.value)
    // 横向条形图：按迟到次数降序（最多的在最上方）
    const data = [...deptLate.value].sort((a, b) => b.count - a.count)
    deptChart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => `${params[0].name}<br/>迟到次数：<b>${params[0].value}</b>`
      },
      grid: { left: 72, right: 40, top: 20, bottom: 20 },
      xAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 11 } },
      yAxis: {
        type: 'category',
        data: data.map((d) => d.dept),
        axisLabel: { fontSize: 12 },
        axisTick: { show: false },
        axisLine: { show: false }
      },
      series: [{
        type: 'bar',
        data: data.map((d) => d.count),
        barWidth: 22,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#8b5cf6' },
            { offset: 1, color: '#7c3aed' }
          ]),
          borderRadius: [0, 6, 6, 0]
        },
        label: {
          show: true,
          position: 'right',
          formatter: '{c}',
          fontSize: 12,
          color: '#6b7280'
        }
      }]
    })
  }
}

function resizeCharts() {
  trendChart?.resize()
  deptChart?.resize()
}

onMounted(async () => {
  loading.value = true
  try {
    await rulesStore.load()
    const [empRes, recRes] = await Promise.all([
      request.get('/employees', { params: { _t: Date.now() } }),
      request.get('/attendanceRecords', { params: { _t: Date.now() } })
    ])
    employees.value = empRes.data
    records.value = recRes.data
    await nextTick()
    renderCharts()
    window.addEventListener('resize', resizeCharts)
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  trendChart?.dispose()
  deptChart?.dispose()
})
</script>

<style scoped>
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
@media (max-width: 1100px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 560px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}

.kpi-card {
  background: #fff;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
  overflow: hidden;
  transition: transform 0.25s, box-shadow 0.25s;
}
.kpi-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--accent);
}
.kpi-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}
.kpi-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}
.kpi-value {
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
  color: var(--text);
}
.kpi-unit {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  margin-left: 4px;
}
.kpi-label {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-2);
}

.chart-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}
@media (max-width: 980px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
}
.card-title .el-icon {
  color: var(--brand);
}
.card-title .trend-range {
  margin-left: auto;
}
.chart-box {
  width: 100%;
  height: 320px;
}

.top-card {
  padding: 20px;
}
.late-num {
  color: #d97706;
  font-weight: 700;
  font-size: 16px;
}
.good-num {
  color: #16a34a;
  font-weight: 700;
  font-size: 16px;
}
.card-sub {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-2, #9ca3af);
  margin-left: 6px;
}
.clickable-table {
  cursor: pointer;
}
.clickable-table :deep(.el-table__row:hover > td) {
  background: var(--el-color-primary-light-9, #ecf5ff) !important;
}
</style>
