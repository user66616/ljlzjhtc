<template>
  <div class="heatmap-wrap">
    <!-- 标题 + 年份选择 -->
    <div class="hm-header">
      <h3 class="hm-title">{{ year }}年度考勤热力图</h3>
      <el-date-picker
        v-model="yearVal"
        type="year"
        placeholder="选择年份"
        value-format="YYYY"
        :clearable="false"
        size="small"
        class="hm-year-picker"
        @change="buildGrid"
      />
    </div>

    <!-- 月份标签 -->
    <div class="hm-months-row">
      <div class="hm-weekday-col"></div>
      <div class="hm-months" ref="monthsRef">
        <span v-for="(m, i) in monthLabels" :key="i" class="hm-month" :style="{ left: m.x + 'px' }">{{ m.label }}</span>
      </div>
    </div>

    <!-- 主体网格 -->
    <div class="hm-body">
      <div class="hm-weekdays">
        <span v-for="(w, i) in weekdayLabels" :key="i" class="hm-wd" v-show="i === 0 || i === 2 || i === 4">{{ w }}</span>
      </div>
      <div class="hm-grid" ref="gridRef">
        <div v-for="(week, wi) in weeks" :key="wi" class="hm-week">
          <div
            v-for="(day, di) in week"
            :key="di"
            class="hm-cell"
            :style="{ background: day.color }"
            :class="{ 'hm-empty': !day.inYear }"
            @mouseenter="hoverCell($event, day)"
            @mouseleave="hideTip"
          ></div>
        </div>
      </div>
    </div>

    <!-- 图例 -->
    <div class="hm-legend-row">
      <span class="hm-legend-text">状态：</span>
      <span class="hm-legend-item">
        <span class="hm-legend-dot" :style="{ background: STATUS_COLORS.leave }"></span>
        请假/出差/调休
      </span>
      <span class="hm-legend-item">
        <span class="hm-legend-dot" :style="{ background: STATUS_COLORS.absent }"></span>
        缺勤
      </span>
      <span class="hm-legend-item">
        <span class="hm-legend-dot" :style="{ background: FUTURE_COLOR }"></span>
        未到来
      </span>
      <span class="hm-legend-sep"></span>
      <span class="hm-legend-text">工时：</span>
      <span class="hm-legend-item">少</span>
      <span class="hm-legend-dot" v-for="(c, i) in GREEN_SCALE" :key="i" :style="{ background: c }"></span>
      <span class="hm-legend-item">多</span>
    </div>

    <!-- 年度汇总 -->
    <div class="hm-summary">
      {{ year }}年 · 出勤{{ stats.attended }}天 · 迟到{{ stats.late }}次 · 早退{{ stats.early }}次 · 缺勤{{ stats.absent }}次 · 请假/出差/调休{{ stats.leave }}天 · 加班{{ stats.overtimeMin }}分钟
    </div>

    <!-- 悬浮提示 -->
    <div v-if="tip.show" class="hm-tip" :style="{ left: tip.x + 'px', top: tip.y + 'px' }">
      <div class="hm-tip-date">{{ tip.date }}</div>
      <div class="hm-tip-status" :style="{ color: tip.color }">{{ tip.status }}</div>
      <div class="hm-tip-detail" v-if="tip.detail">{{ tip.detail }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const props = defineProps({
  records: { type: Array, default: () => [] },
  leaves: { type: Array, default: () => [] },
  calendar: { type: Array, default: () => [] }
})

const CELL = 14
const GAP = 3
const WD_W = 28

const now = new Date()
const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const yearVal = ref(String(now.getFullYear()))
const year = computed(() => Number(yearVal.value))

const gridRef = ref(null)
const monthsRef = ref(null)

const weekdayLabels = ['Mon', '', 'Wed', '', 'Fri', '', '']

// 绿色色阶 —— 上班时长越久绿色越深（GitHub风格）
const GREEN_SCALE = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']

// 特殊状态颜色
const STATUS_COLORS = {
  absent: '#dc2626',
  leave: '#2563eb',
  missing: '#ea580c',
  late: '#f97316',
  early: '#eab308'
}
const FUTURE_COLOR = '#c7d2fe'  // 未到来日期：淡蓝紫色，与周末灰色明显区分

const STATUS_LABELS = {
  absent: '缺勤',
  leave: '请假/出差',
  missing: '缺卡',
  late: '迟到',
  early: '早退',
  normal: '正常出勤'
}

// 计算上班时长（分钟）
function workMinutes(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0
  const [inH, inM] = checkIn.split(':').map(Number)
  const [outH, outM] = checkOut.split(':').map(Number)
  return (outH * 60 + outM) - (inH * 60 + inM)
}

// 根据上班时长返回绿色等级
function greenForMinutes(mins) {
  if (mins <= 0) return GREEN_SCALE[0]
  if (mins < 420) return GREEN_SCALE[1]  // < 7h（浅绿）
  if (mins < 510) return GREEN_SCALE[2]  // 7-8.5h（中绿）
  if (mins < 600) return GREEN_SCALE[3]  // 8.5-10h（深绿）
  return GREEN_SCALE[4]                   // >= 10h（最深绿）
}

// 判断某天是否在请假范围内
function isOnLeave(dateStr) {
  return props.leaves.find((l) => dateStr >= l.startDate && dateStr <= l.endDate) || null
}

const LEAVE_LABEL_MAP = { leave: '请假', business_trip: '出差', comp_off: '调休' }

// 判断某天是否为周末（简单判断：周六/周日，没有打卡记录且非请假）
function isWeekend(d) {
  const dow = d.getDay()
  return dow === 0 || dow === 6
}

// 日历映射：date -> { dayType, label }
const calendarMap = computed(() => {
  const map = {}
  props.calendar.forEach((c) => { map[c.date] = c })
  return map
})

// 构建周网格
const weeks = ref([])

function fmtDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function buildGrid() {
  const y = year.value
  const startDate = new Date(y, 0, 1)
  const endDate = new Date(y, 11, 31)

  // 调整到周一
  const startDow = startDate.getDay()
  const offset = startDow === 0 ? -6 : 1 - startDow
  const gridStart = new Date(startDate)
  gridStart.setDate(startDate.getDate() + offset)

  // 记录映射
  const recMap = {}
  props.records.forEach((r) => { recMap[r.date] = r })

  const result = []
  const cur = new Date(gridStart)

  while (cur <= endDate || cur.getDay() !== 1) {
    const week = []
    for (let i = 0; i < 7; i++) {
      const key = fmtDate(cur)
      const inYear = cur.getFullYear() === y
      const rec = recMap[key]
      const leave = isOnLeave(key)
      const onLeave = !!leave
      const weekend = isWeekend(cur) && inYear && !rec
      const cal = calendarMap.value[key]
      const isHoliday = cal && (cal.dayType === 'holiday' || cal.dayType === 'weekend')

      let color = '#ebedf0'
      let status = null
      let detail = ''

      if (!inYear) {
        color = 'transparent'
      } else if (isHoliday) {
        color = '#ebedf0'
        status = null
        detail = cal.dayType === 'holiday' ? `节假日：${cal.label || '法定节假日'}` : '周末休息'
      } else if (onLeave) {
        color = STATUS_COLORS.leave
        status = 'leave'
        detail = LEAVE_LABEL_MAP[leave.leaveType] || '请假/出差/调休'
      } else if (rec) {
        if (['leave', 'business_trip', 'comp_off'].includes(rec.status)) {
          color = STATUS_COLORS.leave
          status = 'leave'
          detail = LEAVE_LABEL_MAP[rec.status] || '请假/出差/调休'
        } else if (rec.status === 'absent') {
          color = STATUS_COLORS.absent
          status = 'absent'
          detail = '缺勤'
        } else if (rec.status === 'missing') {
          color = STATUS_COLORS.absent
          status = 'absent'
          detail = '缺勤（缺卡）'
        } else if (rec.status === 'appealed') {
          // 申诉通过：视同正常出勤，按工作时长显示绿色
          const mins = workMinutes(rec.checkIn, rec.checkOut)
          color = greenForMinutes(mins)
          status = 'normal'
          const hrs = mins > 0 ? (mins / 60).toFixed(1) : 0
          detail = `申诉通过 · 工作 ${hrs} 小时`
        } else {
          // normal/late/early/overtime - 都用绿色按上班时长，迟到/早退在tooltip显示
          const mins = workMinutes(rec.checkIn, rec.checkOut)
          color = greenForMinutes(mins)
          status = 'normal'
          const hrs = mins > 0 ? (mins / 60).toFixed(1) : 0
          let extra = ''
          if (rec.status === 'late') extra += ` · 迟到 ${rec.lateMinutes || 0} 分钟`
          if (rec.status === 'early') extra += ` · 早退 ${rec.earlyMinutes || 0} 分钟`
          if (rec.status === 'overtime' || rec.overtimeMinutes > 0) extra += ` · 加班 ${rec.overtimeMinutes || 0} 分钟`
          detail = `出勤 · 工作 ${hrs} 小时${extra}`
        }
      } else if (weekend) {
        color = '#ebedf0'
        status = null
        detail = '周末休息'
      } else if (key > todayStr) {
        // 还没到那一天，不记缺勤，用淡蓝紫占位，与周末灰色明显区分
        color = FUTURE_COLOR
        status = null
        detail = '未到来'
      } else {
        // 工作日但无记录 = 缺勤（红色）
        color = STATUS_COLORS.absent
        status = 'absent'
        detail = '缺勤（无打卡记录）'
      }

      week.push({
        date: key,
        inYear,
        color,
        status,
        record: rec || null,
        detail
      })
      cur.setDate(cur.getDate() + 1)
    }
    result.push(week)
    if (cur.getFullYear() > y) break
  }
  weeks.value = result
}

// 月份标签
const monthLabels = computed(() => {
  if (weeks.value.length === 0) return []
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const result = []
  let lastMonth = -1
  weeks.value.forEach((week, wi) => {
    const firstInYear = week.find((d) => d.inYear)
    if (!firstInYear) return
    const m = Number(firstInYear.date.split('-')[1]) - 1
    if (m !== lastMonth) {
      result.push({ label: names[m], x: wi * (CELL + GAP) })
      lastMonth = m
    }
  })
  return result
})

// 统计数据
const stats = computed(() => {
  let attended = 0, late = 0, early = 0, absent = 0, leave = 0, overtimeMin = 0
  weeks.value.forEach((week) => {
    week.forEach((d) => {
      if (!d.inYear) return
      if (d.status === 'leave') {
        leave++
      } else if (d.record) {
        if (d.record.status === 'absent' || d.record.status === 'missing') {
          absent++
        } else {
          attended++
          if (d.record.isLate) late++
          if (d.record.isEarly) early++
          if (d.record.overtimeMinutes) overtimeMin += d.record.overtimeMinutes
        }
      } else if (d.status === 'absent') {
        absent++
      }
    })
  })
  return { attended, late, early, absent, leave, overtimeMin }
})

// 图例项
const legendItems = computed(() => {
  return [
    { key: 'leave', color: STATUS_COLORS.leave, label: '请假/出差/调休', count: stats.value.leave },
    { key: 'absent', color: STATUS_COLORS.absent, label: '缺勤', count: stats.value.absent },
    { key: 'g0', color: GREEN_SCALE[0], label: '休息/无', count: 0 },
    { key: 'g1', color: GREEN_SCALE[1], label: '<7h', count: 0 },
    { key: 'g2', color: GREEN_SCALE[2], label: '7-8.5h', count: 0 },
    { key: 'g3', color: GREEN_SCALE[3], label: '8.5-10h', count: 0 },
    { key: 'g4', color: GREEN_SCALE[4], label: '≥10h', count: stats.value.attended }
  ]
})

// 悬浮提示
const tip = ref({ show: false, x: 0, y: 0, date: '', status: '', color: '', detail: '' })

function hoverCell(e, day) {
  if (!day.inYear) return
  const rect = gridRef.value.getBoundingClientRect()
  const cellRect = e.target.getBoundingClientRect()
  let statusLabel = '休息'
  let statusColor = '#9ca3af'
  let tipDetail = ''
  if (day.status === 'absent') {
    statusLabel = '缺勤'
    statusColor = STATUS_COLORS.absent
    tipDetail = day.detail !== '缺勤' ? day.detail : ''
  } else if (day.status === 'leave') {
    statusLabel = day.detail
    statusColor = STATUS_COLORS.leave
    tipDetail = ''
  } else if (day.status === 'normal') {
    statusLabel = '出勤'
    statusColor = GREEN_SCALE[3]
    tipDetail = day.detail.replace(/^出勤 · /, '')
  } else if (day.detail === '未到来') {
    statusLabel = '未到来'
    statusColor = FUTURE_COLOR
  } else if (day.detail === '周末休息') {
    statusLabel = '周末休息'
    statusColor = '#9ca3af'
  } else if (day.detail && day.detail.startsWith('节假日')) {
    statusLabel = day.detail
    statusColor = '#9ca3af'
  }
  tip.value = {
    show: true,
    x: cellRect.left - rect.left + 20,
    y: cellRect.top - rect.top - 10,
    date: day.date,
    status: statusLabel,
    color: statusColor,
    detail: tipDetail
  }
}
function hideTip() { tip.value.show = false }

onMounted(() => buildGrid())
watch(() => props.records, () => buildGrid(), { deep: true })
watch(() => props.leaves, () => buildGrid(), { deep: true })
watch(() => props.calendar, () => buildGrid(), { deep: true })
</script>

<style scoped>
.heatmap-wrap {
  position: relative;
  overflow-x: auto;
  padding: 4px 0;
}
.hm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.hm-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}
.hm-year-picker {
  width: 120px;
}
.hm-months-row {
  display: flex;
  align-items: flex-end;
  margin-bottom: 4px;
}
.hm-weekday-col {
  width: 28px;
  flex-shrink: 0;
}
.hm-months {
  position: relative;
  height: 18px;
  flex: 1;
}
.hm-month {
  position: absolute;
  font-size: 11px;
  color: var(--text-2, #6b7280);
  white-space: nowrap;
}
.hm-body {
  display: flex;
  gap: 4px;
}
.hm-weekdays {
  display: flex;
  flex-direction: column;
  width: 28px;
  flex-shrink: 0;
  gap: 3px;
}
.hm-wd {
  height: 14px;
  line-height: 14px;
  font-size: 11px;
  color: var(--text-2, #6b7280);
}
.hm-grid {
  display: flex;
  gap: 3px;
  position: relative;
}
.hm-week {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.hm-cell {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  cursor: pointer;
  transition: transform 0.12s ease, outline 0.12s ease;
  border: 1px solid rgba(0, 0, 0, 0.04);
}
.hm-cell:hover {
  transform: scale(1.35);
  outline: 1.5px solid rgba(0, 0, 0, 0.25);
  z-index: 2;
  position: relative;
}
.hm-cell.hm-empty {
  border: none;
  cursor: default;
}
.hm-cell.hm-empty:hover {
  transform: none;
  outline: none;
}

.hm-legend-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  font-size: 12px;
  color: var(--text-2, #6b7280);
}
.hm-legend-text {
  font-weight: 500;
  color: var(--text-2, #6b7280);
}
.hm-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.hm-legend-sep {
  width: 1px;
  height: 12px;
  background: #d1d5db;
  margin: 0 8px;
}
.hm-legend-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}
.hm-summary {
  text-align: center;
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-2, #6b7280);
}

.hm-tip {
  position: absolute;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  pointer-events: none;
  z-index: 100;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.hm-tip-date {
  font-weight: 600;
  margin-bottom: 2px;
}
.hm-tip-status {
  font-weight: 600;
}
.hm-tip-detail {
  color: #cbd5e1;
  margin-top: 2px;
  font-size: 11px;
}
</style>
