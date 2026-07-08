// 考勤状态计算核心逻辑（口径统一）
// 默认阈值：迟到 09:05、早退 18:00、加班 18:30

export function toMinutes(t) {
  if (t === null || t === undefined || t === '') return null
  const str = String(t).trim()
  const parts = str.split(':')
  if (parts.length !== 2) return null
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

// 校验 HH:mm 格式（空值合法）
export function isValidTime(t) {
  if (t === null || t === undefined || t === '') return true
  const str = String(t).trim()
  if (!/^\d{1,2}:\d{2}$/.test(str)) return false
  const m = toMinutes(str)
  return m !== null
}

// 状态元信息：标签文字 + Element Plus Tag 类型
export const STATUS_META = {
  normal: { label: '正常', type: 'success', color: '#52c41a' },
  late: { label: '迟到', type: 'warning', color: '#faad14' },
  early: { label: '早退', type: 'warning', color: '#faad14' },
  missing: { label: '缺卡', type: 'danger', color: '#ff4d4f' },
  absent: { label: '缺勤', type: 'info', color: '#8c8c8c' },
  overtime: { label: '加班', type: 'primary', color: '#1677ff' }
}

// 单条记录状态计算
export function calcRecord(rec, rules) {
  const lateAfter = toMinutes(rules.lateAfter)
  const earlyBefore = toMinutes(rules.earlyBefore)
  const overtimeAfter = toMinutes(rules.overtimeAfter)
  const inMin = rec.checkIn ? toMinutes(rec.checkIn) : null
  const outMin = rec.checkOut ? toMinutes(rec.checkOut) : null
  const hasIn = inMin !== null
  const hasOut = outMin !== null

  let status = 'normal'
  let isLate = false
  let isEarly = false
  let isOvertime = false
  let lateMinutes = 0
  let earlyMinutes = 0
  let overtimeMinutes = 0

  if (!hasIn && !hasOut) {
    // 无任何打卡：缺勤
    status = 'absent'
  } else if (!hasIn || !hasOut) {
    // 仅缺一次卡：按缺卡策略处理
    status = rules.missingStrategy === 'absent' ? 'absent' : 'missing'
  } else {
    // 两次打卡齐全
    if (inMin > lateAfter) {
      isLate = true
      lateMinutes = inMin - lateAfter
    }
    if (outMin < earlyBefore) {
      isEarly = true
      earlyMinutes = earlyBefore - outMin
    }
    if (outMin > overtimeAfter) {
      isOvertime = true
      overtimeMinutes = outMin - overtimeAfter
    }
    // 主状态优先级：迟到 > 早退 > 加班 > 正常
    if (isLate) status = 'late'
    else if (isEarly) status = 'early'
    else if (isOvertime) status = 'overtime'
    else status = 'normal'
  }

  return {
    ...rec,
    status,
    isLate,
    isEarly,
    isOvertime,
    lateMinutes,
    earlyMinutes,
    overtimeMinutes
  }
}

// 批量计算
export function calcAll(records, rules) {
  if (!rules) return records.map((r) => ({ ...r, status: 'normal' }))
  return records.map((r) => calcRecord(r, rules))
}

// KPI 汇总
export function summarize(records) {
  const total = records.length
  const absent = records.filter((r) => r.status === 'absent').length
  const attended = total - absent
  const lateCount = records.filter((r) => r.isLate).length
  const earlyCount = records.filter((r) => r.isEarly).length
  const overtimeCount = records.filter((r) => r.isOvertime).length
  const overtimeMinutes = records.reduce((s, r) => s + (r.overtimeMinutes || 0), 0)
  const attendanceRate = total === 0 ? 0 : (attended / total) * 100
  return {
    total,
    attended,
    absent,
    lateCount,
    earlyCount,
    overtimeCount,
    overtimeMinutes,
    overtimeHours: +(overtimeMinutes / 60).toFixed(1),
    attendanceRate: +attendanceRate.toFixed(1)
  }
}
