<template>
  <div class="page dashboard-page" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">统计看板</h2>
      <p class="page-desc">{{ scopeDesc }}</p>
      <div class="header-actions">
        <el-radio-group v-model="dashRange" size="small" @change="onDashRangeChange">
          <el-radio-button label="week">本周</el-radio-button>
          <el-radio-button label="month">本月</el-radio-button>
          <el-radio-button label="all">全部</el-radio-button>
        </el-radio-group>
      </div>
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

    <!-- P2-06 同环比指标 -->
    <div class="glass-card mom-card fade-up" v-if="auth.role !== 'employee'">
      <div class="card-title">
        <el-icon><DataLine /></el-icon><span>同环比指标（本月 vs 上月）</span>
      </div>
      <div class="mom-grid">
        <div class="mom-item">
          <div class="mom-label">出勤率</div>
          <div class="mom-value">{{ momData.attendanceRate.thisMonth }}%</div>
          <div class="mom-change" :class="momData.attendanceRate.delta >= 0 ? 'up' : 'down'">
            <el-icon><Top v-if="momData.attendanceRate.delta >= 0" /><Bottom v-else /></el-icon>
            {{ Math.abs(momData.attendanceRate.delta).toFixed(1) }}% 环比{{ momData.attendanceRate.delta >= 0 ? '上升' : '下降' }}
          </div>
        </div>
        <div class="mom-item">
          <div class="mom-label">迟到次数</div>
          <div class="mom-value">{{ momData.lateCount.thisMonth }} 次</div>
          <div class="mom-change" :class="momData.lateCount.delta <= 0 ? 'up' : 'down'">
            <el-icon><Top v-if="momData.lateCount.delta > 0" /><Bottom v-else /></el-icon>
            {{ Math.abs(momData.lateCount.delta) }} 次 环比{{ momData.lateCount.delta <= 0 ? '减少' : '增加' }}
          </div>
        </div>
        <div class="mom-item">
          <div class="mom-label">加班总时长</div>
          <div class="mom-value">{{ momData.overtimeHours.thisMonth }} 小时</div>
          <div class="mom-change" :class="momData.overtimeHours.delta >= 0 ? 'up' : 'down'">
            <el-icon><Top v-if="momData.overtimeHours.delta >= 0" /><Bottom v-else /></el-icon>
            {{ Math.abs(momData.overtimeHours.delta).toFixed(1) }} 小时 环比{{ momData.overtimeHours.delta >= 0 ? '上升' : '下降' }}
          </div>
        </div>
      </div>
    </div>

    <!-- P2-08 连续异常预警 -->
    <div class="glass-card alert-card fade-up" v-if="alertEmployees.length > 0 && auth.role !== 'employee'">
      <div class="card-title">
        <el-icon><WarningFilled /></el-icon><span>连续异常预警名单（P2-08）</span>
        <el-tag type="danger" effect="dark" size="small">{{ alertEmployees.length }} 人预警</el-tag>
        <span class="card-sub">连续迟到 ≥ 3 天的员工自动标记为预警</span>
      </div>
      <el-table :data="alertEmployees" border size="small">
        <el-table-column prop="employeeId" label="工号" width="90" />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="dept" label="部门" width="120" />
        <el-table-column prop="consecutiveLate" label="连续迟到天数" width="140" align="center">
          <template #default="{ row }">
            <el-tag type="danger" effect="dark" size="small">{{ row.consecutiveLate }} 天</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalLate" label="本月迟到总次数" width="140" align="center" />
        <el-table-column label="最近迟到日期" min-width="120">
          <template #default="{ row }">{{ row.lastLateDate }}</template>
        </el-table-column>
      </el-table>
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

    <!-- P1-12 异常类型占比饼图 + P1-13 部门加班排行 -->
    <div class="chart-grid2 fade-up">
      <div class="glass-card chart-card">
        <div class="card-title">
          <el-icon><PieChart /></el-icon><span>异常类型占比</span>
        </div>
        <div ref="pieRef" class="chart-box"></div>
      </div>
      <div class="glass-card chart-card">
        <div class="card-title">
          <el-icon><DataAnalysis /></el-icon><span>部门加班排行</span>
        </div>
        <div ref="otRef" class="chart-box"></div>
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
  TrendCharts, Histogram, Trophy, Warning, DataLine, AlarmClock, Clock, Timer,
  PieChart, DataAnalysis, WarningFilled, Top, Bottom
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
const pieRef = ref()
const otRef = ref()
let trendChart = null
let deptChart = null
let pieChart = null
let otChart = null

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

// 角色范围过滤 + 时间范围筛选（P1-14）
const dashRange = ref('all')

function getRangeStart() {
  if (dashRange.value === 'all') return null
  const now = new Date()
  if (dashRange.value === 'week') {
    const day = now.getDay() || 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - day + 1)
    return monday.toISOString().slice(0, 10)
  }
  if (dashRange.value === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  }
  return null
}

const scoped = computed(() => {
  let arr = computedRecords.value
  if (auth.role === 'manager') arr = arr.filter((r) => r.dept === auth.dept)
  if (auth.role === 'employee') arr = arr.filter((r) => r.employeeId === auth.employeeId)
  const start = getRangeStart()
  if (start) arr = arr.filter((r) => r.date >= start)
  return arr
})

function onDashRangeChange() {
  nextTick(() => {
    trendChart?.dispose()
    deptChart?.dispose()
    pieChart?.dispose()
    otChart?.dispose()
    renderCharts()
  })
}

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
    trendChart?.dispose()
    pieChart?.dispose()
    otChart?.dispose()
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

// P1-12 异常类型占比
const anomalyBreakdown = computed(() => {
  const counts = { late: 0, early: 0, missing: 0, absent: 0 }
  scoped.value.forEach((r) => {
    if (r.status === 'late') counts.late++
    if (r.status === 'early') counts.early++
    if (r.status === 'missing') counts.missing++
    if (r.status === 'absent') counts.absent++
  })
  return counts
})

// P1-13 部门加班排行
const deptOvertime = computed(() => {
  const byDept = {}
  scoped.value.forEach((r) => {
    if (!byDept[r.dept]) byDept[r.dept] = 0
    byDept[r.dept] += r.overtimeMinutes || 0
  })
  const entries = Object.entries(byDept)
    .map(([dept, minutes]) => ({ dept, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
  return entries
})

// 员工考勤排名（基于异常分）
const ranking = computed(() => computeRanking(records.value, employees.value, rulesStore.rules))

// Top5 最佳考勤（异常分最低）
const topBest = computed(() => ranking.value.top5)

// 后5 待改进（异常分最高）
const bottomWorst = computed(() => ranking.value.bottom5)

// P2-06 同环比指标
const momData = computed(() => {
  const now = new Date()
  const thisMonth = now.getMonth() + 1
  const thisYear = now.getFullYear()
  const lastMonthDate = new Date(thisYear, now.getMonth() - 1, 1)
  const lastMonth = lastMonthDate.getMonth() + 1
  const lastMonthYear = lastMonthDate.getFullYear()

  const thisMonthRecords = computedRecords.value.filter((r) => {
    const [y, m] = r.date.split('-').map(Number)
    return y === thisYear && m === thisMonth
  })
  const lastMonthRecords = computedRecords.value.filter((r) => {
    const [y, m] = r.date.split('-').map(Number)
    return y === lastMonthYear && m === lastMonth
  })

  const thisSummary = summarize(thisMonthRecords)
  const lastSummary = summarize(lastMonthRecords)

  return {
    attendanceRate: {
      thisMonth: thisSummary.attendanceRate,
      delta: thisSummary.attendanceRate - lastSummary.attendanceRate
    },
    lateCount: {
      thisMonth: thisSummary.lateCount,
      delta: thisSummary.lateCount - lastSummary.lateCount
    },
    overtimeHours: {
      thisMonth: thisSummary.overtimeHours,
      delta: thisSummary.overtimeHours - lastSummary.overtimeHours
    }
  }
})

// P2-08 连续异常预警
const alertEmployees = computed(() => {
  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth() + 1
  const monthPrefix = `${thisYear}-${String(thisMonth).padStart(2, '0')}`

  const empRecords = {}
  scoped.value.forEach((r) => {
    if (!r.date.startsWith(monthPrefix)) return
    if (!empRecords[r.employeeId]) empRecords[r.employeeId] = []
    if (r.isLate) empRecords[r.employeeId].push(r.date)
  })

  const result = []
  Object.keys(empRecords).forEach((empId) => {
    const lateDates = empRecords[empId].sort()
    if (lateDates.length < 3) return
    // 找最长的连续迟到天数
    let maxConsecutive = 1
    let currentConsecutive = 1
    for (let i = 1; i < lateDates.length; i++) {
      const prev = new Date(lateDates[i - 1])
      const curr = new Date(lateDates[i])
      const diffDays = (curr - prev) / (1000 * 60 * 60 * 24)
      if (diffDays === 1) {
        currentConsecutive++
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive)
      } else {
        currentConsecutive = 1
      }
    }
    if (maxConsecutive >= 3) {
      const emp = empMap.value[empId] || {}
      result.push({
        employeeId: empId,
        name: emp.name || '未知',
        dept: emp.dept || '未知',
        consecutiveLate: maxConsecutive,
        totalLate: lateDates.length,
        lastLateDate: lateDates[lateDates.length - 1]
      })
    }
  })
  return result.sort((a, b) => b.consecutiveLate - a.consecutiveLate)
})

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

  // P1-12 异常类型占比饼图
  if (pieRef.value) {
    pieChart = echarts.init(pieRef.value)
    const ab = anomalyBreakdown.value
    const pieData = [
      { name: '迟到', value: ab.late, itemStyle: { color: '#faad14' } },
      { name: '早退', value: ab.early, itemStyle: { color: '#ff8c00' } },
      { name: '缺卡', value: ab.missing, itemStyle: { color: '#ef4444' } },
      { name: '缺勤', value: ab.absent, itemStyle: { color: '#dc2626' } }
    ].filter((d) => d.value > 0)
    pieChart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} 次 ({d}%)' },
      legend: { bottom: 0, icon: 'circle', fontSize: 12 },
      series: [{
        type: 'pie',
        radius: ['40%', '68%'],
        center: ['50%', '45%'],
        data: pieData,
        label: { show: true, formatter: '{b}\n{d}%', fontSize: 12 },
        itemStyle: { borderColor: '#fff', borderWidth: 2 }
      }]
    })
  }

  // P1-13 部门加班排行（横向条形图，按加班时长降序）
  if (otRef.value) {
    otChart = echarts.init(otRef.value)
    const data = [...deptOvertime.value]
    otChart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => `${params[0].name}<br/>加班总时长：<b>${(params[0].value / 60).toFixed(1)} 小时</b>`
      },
      grid: { left: 72, right: 50, top: 20, bottom: 20 },
      xAxis: { type: 'value', axisLabel: { fontSize: 11, formatter: (v) => (v / 60).toFixed(0) + 'h' } },
      yAxis: {
        type: 'category',
        data: data.map((d) => d.dept),
        axisLabel: { fontSize: 12 },
        axisTick: { show: false },
        axisLine: { show: false }
      },
      series: [{
        type: 'bar',
        data: data.map((d) => d.minutes),
        barWidth: 22,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#34d399' },
            { offset: 1, color: '#059669' }
          ]),
          borderRadius: [0, 6, 6, 0]
        },
        label: {
          show: true,
          position: 'right',
          formatter: (p) => (p.value / 60).toFixed(1) + 'h',
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
  pieChart?.resize()
  otChart?.resize()
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
  pieChart?.dispose()
  otChart?.dispose()
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

.chart-grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}
@media (max-width: 980px) {
  .chart-grid2 {
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

/* P2-06 同环比 */
.mom-card {
  padding: 20px;
  margin-bottom: 20px;
}
.mom-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
@media (max-width: 768px) {
  .mom-grid { grid-template-columns: 1fr; }
}
.mom-item {
  text-align: center;
  padding: 20px;
  border-radius: 12px;
  background: var(--bg);
}
.mom-label {
  font-size: 13px;
  color: var(--text-2);
  margin-bottom: 8px;
}
.mom-value {
  font-size: 28px;
  font-weight: 800;
  color: var(--text);
  margin-bottom: 6px;
}
.mom-change {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
}
.mom-change.up { color: #16a34a; }
.mom-change.down { color: #dc2626; }

/* P2-08 预警 */
.alert-card {
  padding: 20px;
  margin-bottom: 20px;
  border-left: 4px solid #ef4444;
}
</style>
