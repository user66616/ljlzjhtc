// 种子数据写入 MySQL：3 个用户 + 15 个员工 + 1 条默认规则 + 考勤记录
// 运行：npm run db:seed   （需先运行 npm run db:init）
import { pool } from '../server/db.js'

// ---- 用户 ----
const users = [
  { username: 'admin', password: '123456', role: 'admin', name: '系统管理员', dept: null, employeeId: null },
  { username: 'manager', password: '123456', role: 'manager', name: '张伟', dept: '技术部', employeeId: 'E002' },
  { username: 'employee', password: '123456', role: 'employee', name: '李明', dept: '技术部', employeeId: 'E001' }
]

// ---- 员工（15 人：技术部 5 + 市场部 5 + 人事部 5，确保 >10 以演示可见性限制）----
const employees = [
  { employeeId: 'E001', name: '李明', dept: '技术部', position: '前端工程师' },
  { employeeId: 'E002', name: '张伟', dept: '技术部', position: '技术经理' },
  { employeeId: 'E003', name: '王芳', dept: '技术部', position: '后端工程师' },
  { employeeId: 'E004', name: '赵强', dept: '技术部', position: '测试工程师' },
  { employeeId: 'E005', name: '孙丽', dept: '技术部', position: '运维工程师' },
  { employeeId: 'E006', name: '周杰', dept: '市场部', position: '市场专员' },
  { employeeId: 'E007', name: '吴敏', dept: '市场部', position: '市场经理' },
  { employeeId: 'E008', name: '郑超', dept: '市场部', position: '策划专员' },
  { employeeId: 'E009', name: '陈静', dept: '市场部', position: '品牌专员' },
  { employeeId: 'E010', name: '刘洋', dept: '市场部', position: '销售代表' },
  { employeeId: 'E011', name: '杨光', dept: '人事部', position: 'HR专员' },
  { employeeId: 'E012', name: '冯涛', dept: '人事部', position: 'HR经理' },
  { employeeId: 'E013', name: '许婷', dept: '人事部', position: '招聘专员' },
  { employeeId: 'E014', name: '何军', dept: '人事部', position: '薪酬专员' },
  { employeeId: 'E015', name: '林雪', dept: '人事部', position: '培训专员' }
]

// ---- 默认规则 ----
const rule = { lateAfter: '09:05', earlyBefore: '18:00', overtimeAfter: '18:30', missingStrategy: 'mark' }

// ---- 考勤记录生成（与原 gen-data.mjs 算法一致，保证可复现）----
function getWorkdays(year, month, fromDay, toDay) {
  const days = []
  for (let d = fromDay; d <= toDay; d++) {
    const date = new Date(year, month - 1, d)
    const dow = date.getDay()
    if (dow !== 0 && dow !== 6) days.push(d)
  }
  return days
}
const pad = (n) => String(n).padStart(2, '0')
const fmtDate = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`
const fmtTime = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`

const patterns = {
  // 技术部
  E001: { lateRate: 0.15, earlyRate: 0.05, missingRate: 0.05, absentRate: 0.02, overtimeRate: 0.3 },
  E002: { lateRate: 0.05, earlyRate: 0.02, missingRate: 0.02, absentRate: 0.0, overtimeRate: 0.5 },
  E003: { lateRate: 0.25, earlyRate: 0.1, missingRate: 0.08, absentRate: 0.03, overtimeRate: 0.1 },
  E004: { lateRate: 0.18, earlyRate: 0.06, missingRate: 0.04, absentRate: 0.02, overtimeRate: 0.2 },
  E005: { lateRate: 0.1, earlyRate: 0.04, missingRate: 0.03, absentRate: 0.0, overtimeRate: 0.35 },
  // 市场部
  E006: { lateRate: 0.2, earlyRate: 0.2, missingRate: 0.05, absentRate: 0.05, overtimeRate: 0.05 },
  E007: { lateRate: 0.08, earlyRate: 0.03, missingRate: 0.03, absentRate: 0.0, overtimeRate: 0.4 },
  E008: { lateRate: 0.12, earlyRate: 0.08, missingRate: 0.05, absentRate: 0.02, overtimeRate: 0.2 },
  E009: { lateRate: 0.14, earlyRate: 0.06, missingRate: 0.04, absentRate: 0.01, overtimeRate: 0.25 },
  E010: { lateRate: 0.22, earlyRate: 0.12, missingRate: 0.06, absentRate: 0.04, overtimeRate: 0.1 },
  // 人事部
  E011: { lateRate: 0.06, earlyRate: 0.04, missingRate: 0.02, absentRate: 0.0, overtimeRate: 0.25 },
  E012: { lateRate: 0.04, earlyRate: 0.02, missingRate: 0.02, absentRate: 0.0, overtimeRate: 0.35 },
  E013: { lateRate: 0.16, earlyRate: 0.07, missingRate: 0.05, absentRate: 0.02, overtimeRate: 0.15 },
  E014: { lateRate: 0.1, earlyRate: 0.05, missingRate: 0.03, absentRate: 0.01, overtimeRate: 0.3 },
  E015: { lateRate: 0.13, earlyRate: 0.06, missingRate: 0.04, absentRate: 0.02, overtimeRate: 0.2 }
}

let seed = 20260701
function srand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
function sInt(min, max) { return Math.floor(srand() * (max - min + 1)) + min }

function generateRecords() {
  const workdays = getWorkdays(2026, 7, 1, 22)
  const records = []
  for (const emp of employees) {
    const p = patterns[emp.employeeId]
    for (const day of workdays) {
      const date = fmtDate(2026, 7, day)
      const r = srand()
      let checkIn = null, checkOut = null
      if (r < p.absentRate) {
        checkIn = null; checkOut = null
      } else {
        if (srand() < p.missingRate) checkIn = null
        else {
          if (srand() < p.lateRate) checkIn = fmtTime(9 * 60 + 5 + sInt(6, 85))
          else checkIn = fmtTime(9 * 60 + 5 - sInt(0, 35))
        }
        if (srand() < p.missingRate) checkOut = null
        else {
          if (srand() < p.earlyRate) checkOut = fmtTime(18 * 60 - sInt(5, 120))
          else if (srand() < p.overtimeRate) checkOut = fmtTime(18 * 60 + 30 + sInt(30, 210))
          else checkOut = fmtTime(18 * 60 + sInt(0, 30))
        }
        if (!checkIn && !checkOut) checkIn = fmtTime(9 * 60)
      }
      records.push({ employeeId: emp.employeeId, date, checkIn, checkOut, overtimeMinutes: 0 })
    }
  }
  return records
}

async function main() {
  console.log('正在写入种子数据...')
  // 清空数据（保留表结构）
  await pool.query('DELETE FROM attendance_records')
  await pool.query('DELETE FROM attendance_rules')
  await pool.query('DELETE FROM employees')
  await pool.query('DELETE FROM users')
  await pool.query('ALTER TABLE attendance_records AUTO_INCREMENT = 1')
  await pool.query('ALTER TABLE attendance_rules AUTO_INCREMENT = 1')
  await pool.query('ALTER TABLE employees AUTO_INCREMENT = 1')
  await pool.query('ALTER TABLE users AUTO_INCREMENT = 1')

  // 用户
  for (const u of users) {
    await pool.execute(
      'INSERT INTO users (username, password, role, name, dept, employee_id) VALUES (?, ?, ?, ?, ?, ?)',
      [u.username, u.password, u.role, u.name, u.dept, u.employeeId]
    )
  }
  console.log(`✓ 写入 ${users.length} 个用户`)

  // 员工
  for (const e of employees) {
    await pool.execute(
      'INSERT INTO employees (employee_id, name, dept, position) VALUES (?, ?, ?, ?)',
      [e.employeeId, e.name, e.dept, e.position]
    )
  }
  console.log(`✓ 写入 ${employees.length} 个员工`)

  // 规则
  await pool.execute(
    'INSERT INTO attendance_rules (late_after, early_before, overtime_after, missing_strategy) VALUES (?, ?, ?, ?)',
    [rule.lateAfter, rule.earlyBefore, rule.overtimeAfter, rule.missingStrategy]
  )
  console.log('✓ 写入默认考勤规则')

  // 考勤记录（批量）
  const records = generateRecords()
  const values = records.map((r) => [r.employeeId, r.date, r.checkIn, r.checkOut, r.overtimeMinutes])
  await pool.query(
    'INSERT INTO attendance_records (employee_id, date, check_in, check_out, overtime_minutes) VALUES ?',
    [values]
  )
  console.log(`✓ 写入 ${records.length} 条考勤记录`)

  console.log('\n种子数据写入完成！现在可以运行 npm run dev 启动应用')
  await pool.end()
}

main().catch(async (e) => {
  console.error('✗ 写入失败：', e.message)
  await pool.end()
  process.exit(1)
})
