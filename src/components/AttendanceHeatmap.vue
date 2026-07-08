<template>
  <div class="heatmap-wrap">
    <!-- 月份标签 -->
    <div class="hm-months" :style="{ marginLeft: '28px' }">
      <span v-for="(m, i) in months" :key="i" class="hm-month" :style="{ left: m.x + 'px' }">{{ m.label }}</span>
    </div>
    <div class="hm-body">
      <!-- 星期标签 -->
      <div class="hm-weekdays">
        <span v-for="(w, i) in weekdays" :key="i" class="hm-wd" v-show="i % 2 === 0">{{ w }}</span>
      </div>
      <!-- 网格 -->
      <div class="hm-grid" ref="gridRef">
        <div v-for="(week, wi) in weeks" :key="wi" class="hm-week">
          <div
            v-for="(day, di) in week"
            :key="di"
            class="hm-cell"
            :class="'st-' + (day.status || 'none')"
            @mouseenter="hoverCell($event, day)"
            @mouseleave="hideTip"
          ></div>
        </div>
      </div>
    </div>
    <!-- 图例 -->
    <div class="hm-legend">
      <span class="hm-legend-label">少</span>
      <div class="hm-cell st-none"></div>
      <div class="hm-cell st-absent"></div>
      <div class="hm-cell st-missing"></div>
      <div class="hm-cell st-late"></div>
      <div class="hm-cell st-normal"></div>
      <div class="hm-cell st-overtime"></div>
      <span class="hm-legend-label">多</span>
      <span class="hm-legend-status">{{ hoveredStatus }}</span>
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { STATUS_META } from '../utils/attendance.js'

const props = defineProps({
  // 已计算状态的记录数组：[{ date, checkIn, checkOut, status, lateMinutes, ... }]
  records: { type: Array, default: () => [] }
})

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const CELL = 13 // 单元格尺寸
const GAP = 3

// 把日期转为 Date 对象
function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// 构建周网格：从首条记录所在周的周一开始，到末条记录所在周的周日结束
const weeks = computed(() => {
  if (props.records.length === 0) return []
  const dates = props.records.map((r) => r.date).sort()
  const start = parseDate(dates[0])
  const end = parseDate(dates[dates.length - 1])

  // 调整到周一（getDay: 0=周日, 1=周一）
  const startDow = start.getDay()
  const startMonday = new Date(start)
  const offset = startDow === 0 ? -6 : 1 - startDow // 周一为 1
  startMonday.setDate(start.getDate() + offset)

  // 记录映射 date -> record
  const map = {}
  props.records.forEach((r) => { map[r.date] = r })

  const result = []
  const cur = new Date(startMonday)
  while (cur <= end) {
    const week = []
    for (let i = 0; i < 7; i++) {
      const y = cur.getFullYear()
      const m = String(cur.getMonth() + 1).padStart(2, '0')
      const d = String(cur.getDate()).padStart(2, '0')
      const key = `${y}-${m}-${d}`
      const rec = map[key]
      week.push({
        date: key,
        status: rec ? rec.status : null,
        record: rec || null
      })
      cur.setDate(cur.getDate() + 1)
    }
    result.push(week)
  }
  return result
})

// 月份标签位置
const months = computed(() => {
  if (weeks.value.length === 0) return []
  const result = []
  let lastMonth = -1
  weeks.value.forEach((week, wi) => {
    const firstDay = week.find((d) => d.date) || week[0]
    const m = Number(firstDay.date.split('-')[1]) - 1
    if (m !== lastMonth) {
      result.push({ label: `${m + 1}月`, x: wi * (CELL + GAP) })
      lastMonth = m
    }
  })
  return result
})

// 悬浮提示
const tip = ref({ show: false, x: 0, y: 0, date: '', status: '', color: '', detail: '' })
const hoveredStatus = ref('')
const gridRef = ref(null)

function hoverCell(e, day) {
  const rect = gridRef.value.getBoundingClientRect()
  const cellRect = e.target.getBoundingClientRect()
  tip.value = {
    show: true,
    x: cellRect.left - rect.left + 20,
    y: cellRect.top - rect.top - 10,
    date: day.date,
    status: day.status ? STATUS_META[day.status]?.label : '无记录',
    color: day.status ? STATUS_META[day.status]?.color : '#999',
    detail: day.record
      ? `上班 ${day.record.checkIn || '—'} · 下班 ${day.record.checkOut || '—'}`
      : '周末/节假日'
  }
  hoveredStatus.value = day.status ? STATUS_META[day.status]?.label : '无记录'
}
function hideTip() {
  tip.value.show = false
  hoveredStatus.value = ''
}

onMounted(() => {
  // 防止 tip 超出容器
})
onBeforeUnmount(() => {})
</script>

<style scoped>
.heatmap-wrap {
  position: relative;
  overflow-x: auto;
  padding: 8px 0 4px;
}

.hm-months {
  position: relative;
  height: 18px;
  margin-bottom: 4px;
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
  width: 24px;
  flex-shrink: 0;
}
.hm-wd {
  height: 13px;
  line-height: 13px;
  font-size: 10px;
  color: var(--text-2, #6b7280);
  margin-bottom: 3px;
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
  width: 13px;
  height: 13px;
  border-radius: 2px;
  cursor: pointer;
  transition: transform 0.1s ease;
}
.hm-cell:hover {
  transform: scale(1.4);
  outline: 1px solid rgba(0, 0, 0, 0.2);
}

/* 状态颜色（GitHub 风格 + 考勤语义） */
.hm-cell.st-none {
  background: #ebedf0;
}
.hm-cell.st-absent {
  background: #d1d5db;
}
.hm-cell.st-missing {
  background: #f87171;
}
.hm-cell.st-early {
  background: #fb923c;
}
.hm-cell.st-late {
  background: #fbbf24;
}
.hm-cell.st-normal {
  background: #4ade80;
}
.hm-cell.st-overtime {
  background: #1677ff;
}

.hm-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  font-size: 11px;
  color: var(--text-2, #6b7280);
}
.hm-legend .hm-cell {
  width: 11px;
  height: 11px;
  cursor: default;
}
.hm-legend .hm-cell:hover {
  transform: none;
  outline: none;
}
.hm-legend-label {
  margin: 0 2px;
}
.hm-legend-status {
  margin-left: 12px;
  color: var(--text, #1f2937);
  font-weight: 500;
  min-width: 50px;
}

.hm-tip {
  position: absolute;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  pointer-events: none;
  z-index: 10;
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
