// 数据同步验证脚本
// 通过 API 获取数据，使用与前端一致的 calcAll/summarize 函数计算 KPI，验证各模块统计口径一致
import { calcAll, summarize } from '../src/utils/attendance.js'

const API = 'http://localhost:3001/api'

async function fetchJSON(path) {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`)
  return res.json()
}

function fmtDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function main() {
  console.log('=== 数据同步验证开始 ===\n')

  // 1. 拉取所有数据
  const [rulesArr, employees, records, leaves, appeals] = await Promise.all([
    fetchJSON('/attendanceRules'),
    fetchJSON('/employees'),
    fetchJSON('/attendanceRecords'),
    fetchJSON('/leaveRecords'),
    fetchJSON('/appeals')
  ])
  const rules = Array.isArray(rulesArr) ? rulesArr[0] : rulesArr

  console.log(`规则: lateAfter=${rules.lateAfter}, earlyBefore=${rules.earlyBefore}, overtimeAfter=${rules.overtimeAfter}`)
  console.log(`员工数: ${employees.length}`)
  console.log(`考勤记录数: ${records.length}`)
  console.log(`请假记录数: ${leaves.length}`)
  console.log(`申诉记录数: ${appeals.length}`)

  const approvedAppeals = appeals.filter((a) => a.status === 'approved')
  const approvedAppealIds = approvedAppeals.map((a) => a.recordId)
  console.log(`已通过申诉数: ${approvedAppeals.length} (recordIds: ${approvedAppealIds.join(', ') || '无'})\n`)

  // 2. 全量计算
  const computed = calcAll(records, rules, leaves, approvedAppealIds)
  const today = fmtDate(new Date())

  // 3. 验证 Dashboard 口径（全部数据）
  console.log('--- [1] 统计看板 Dashboard (全部数据) ---')
  const dashboardSummary = summarize(computed)
  console.log(JSON.stringify(dashboardSummary, null, 2))
  console.log()

  // 4. 验证 Dashboard 口径（仅到今天，趋势图口径）
  console.log('--- [2] 统计看板 趋势图 (date <= today) ---')
  const trendRecords = computed.filter((r) => r.date <= today)
  const trendSummary = summarize(trendRecords)
  console.log(`日期范围: ${trendRecords.length ? trendRecords[0].date : '-'} ~ ${trendRecords.length ? trendRecords[trendRecords.length - 1].date : '-'}`)
  console.log(JSON.stringify(trendSummary, null, 2))
  console.log()

  // 5. 验证 Reports 月报口径（2026-07）
  const monthPrefix = '2026-07'
  console.log(`--- [3] 月报中心 Reports (${monthPrefix}) ---`)
  const monthRecords = computed.filter((r) => r.date.startsWith(monthPrefix))
  const monthSummary = summarize(monthRecords)
  console.log(`当月记录数: ${monthRecords.length}`)
  console.log(JSON.stringify(monthSummary, null, 2))
  console.log()

  // 6. 验证 Exceptions 异常记录口径
  console.log('--- [4] 异常记录 Exceptions ---')
  const exceptions = computed.filter((r) => ['late', 'early', 'missing', 'absent'].includes(r.status))
  console.log(`异常总数: ${exceptions.length}`)
  const exceptionByStatus = {
    late: exceptions.filter((r) => r.status === 'late').length,
    early: exceptions.filter((r) => r.status === 'early').length,
    missing: exceptions.filter((r) => r.status === 'missing').length,
    absent: exceptions.filter((r) => r.status === 'absent').length
  }
  console.log(`明细: ${JSON.stringify(exceptionByStatus)}`)
  console.log()

  // 7. 验证申诉通过记录被正确标记
  console.log('--- [5] 申诉通过记录检查 ---')
  const appealedRecords = computed.filter((r) => r.status === 'appealed')
  console.log(`appealed 状态记录数: ${appealedRecords.length}`)
  if (appealedRecords.length > 0) {
    appealedRecords.forEach((r) => {
      console.log(`  - recordId=${r.id}, emp=${r.employeeId}, date=${r.date}`)
    })
  }
  console.log()

  // 8. 验证请假记录被正确标记
  console.log('--- [6] 请假记录检查 ---')
  const leaveRecords = computed.filter((r) => ['leave', 'business_trip', 'comp_off'].includes(r.status))
  console.log(`请假类状态记录数: ${leaveRecords.length}`)
  if (leaveRecords.length > 0) {
    leaveRecords.forEach((r) => {
      console.log(`  - emp=${r.employeeId}, date=${r.date}, status=${r.status}`)
    })
  }
  console.log()

  // 9. 一致性校验
  console.log('--- [7] 一致性校验 ---')
  const checks = []

  // 校验1: Dashboard 异常总数 = Exceptions 异常总数
  checks.push({
    name: 'Dashboard.exceptionCount == Exceptions 总数',
    pass: dashboardSummary.exceptionCount === exceptions.length,
    detail: `${dashboardSummary.exceptionCount} vs ${exceptions.length}`
  })

  // 校验2: 月报异常总数 = 当月异常明细
  const monthExceptions = monthRecords.filter((r) => ['late', 'early', 'missing', 'absent'].includes(r.status))
  checks.push({
    name: '月报.exceptionCount == 当月异常明细总数',
    pass: monthSummary.exceptionCount === monthExceptions.length,
    detail: `${monthSummary.exceptionCount} vs ${monthExceptions.length}`
  })

  // 校验3: appealed 记录不在异常列表
  const appealedInExceptions = exceptions.filter((r) => r.status === 'appealed').length
  checks.push({
    name: '申诉通过记录不在异常列表',
    pass: appealedInExceptions === 0,
    detail: `appealed 在异常列表中数量: ${appealedInExceptions}`
  })

  // 校验4: appealed 记录在 attended 中
  const appealedInAttended = computed.filter((r) => r.status === 'appealed').length
  checks.push({
    name: '申诉通过记录计入出勤',
    pass: appealedInAttended === approvedAppealIds.length,
    detail: `${appealedInAttended} vs approvedAppealIds=${approvedAppealIds.length}`
  })

  // 校验5: 趋势图不包含未来日期
  const futureInTrend = trendRecords.filter((r) => r.date > today).length
  checks.push({
    name: '趋势图不包含未来日期',
    pass: futureInTrend === 0,
    detail: `未来日期记录数: ${futureInTrend} (today=${today})`
  })

  let allPass = true
  checks.forEach((c) => {
    const tag = c.pass ? '[PASS]' : '[FAIL]'
    if (!c.pass) allPass = false
    console.log(`${tag} ${c.name}  =>  ${c.detail}`)
  })

  console.log('\n=== 验证结果 ===')
  console.log(allPass ? '所有校验通过' : '存在失败项，请检查')
  process.exit(allPass ? 0 : 1)
}

main().catch((e) => {
  console.error('验证脚本出错:', e)
  process.exit(1)
})
