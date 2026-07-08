import { Router } from 'express'

const router = Router()

// 将 Date 对象格式化为 YYYY-MM-DD（避免时区偏移导致日期 -1）
function fmtDate(d) {
  if (d instanceof Date) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return d
}

// 将数据库行转换为前端期望的驼峰字段
function toCamel(r) {
  return {
    id: r.id,
    employeeId: r.employee_id,
    date: fmtDate(r.date),
    checkIn: r.check_in,
    checkOut: r.check_out,
    overtimeMinutes: r.overtime_minutes
  }
}

// GET /api/attendanceRecords —— 返回全部记录（前端做分页/筛选/计算）
router.get('/', async (req, res) => {
  try {
    const [rows] = await req.app.get('pool').query('SELECT * FROM attendance_records ORDER BY date ASC, employee_id ASC')
    res.json(rows.map(toCamel))
  } catch (e) {
    res.status(500).json({ message: '查询考勤记录失败：' + e.message })
  }
})

// POST /api/attendanceRecords —— 新增一条
router.post('/', async (req, res) => {
  try {
    const { employeeId, date, checkIn, checkOut, overtimeMinutes = 0 } = req.body
    const [result] = await req.app.get('pool').execute(
      'INSERT INTO attendance_records (employee_id, date, check_in, check_out, overtime_minutes) VALUES (?, ?, ?, ?, ?)',
      [employeeId, date, checkIn, checkOut || null, overtimeMinutes]
    )
    const [rows] = await req.app.get('pool').query('SELECT * FROM attendance_records WHERE id = ?', [result.insertId])
    res.status(201).json(toCamel(rows[0]))
  } catch (e) {
    res.status(500).json({ message: '新增考勤记录失败：' + e.message })
  }
})

export default router
