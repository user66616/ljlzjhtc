import { Router } from 'express'

const router = Router()

function fmtDate(d) {
  if (d instanceof Date) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return d
}

function toCamel(r) {
  return {
    id: r.id,
    employeeId: r.employee_id,
    startDate: fmtDate(r.start_date),
    endDate: fmtDate(r.end_date),
    leaveType: r.leave_type,
    reason: r.reason
  }
}

// GET /api/leaveRecords
router.get('/', async (req, res) => {
  try {
    const [rows] = await req.app.get('pool').query('SELECT * FROM leave_records ORDER BY start_date DESC')
    res.json(rows.map(toCamel))
  } catch (e) {
    res.status(500).json({ message: '查询请假记录失败：' + e.message })
  }
})

// POST /api/leaveRecords
router.post('/', async (req, res) => {
  try {
    const { employeeId, startDate, endDate, leaveType = 'leave', reason = '' } = req.body
    const [result] = await req.app.get('pool').execute(
      'INSERT INTO leave_records (employee_id, start_date, end_date, leave_type, reason) VALUES (?, ?, ?, ?, ?)',
      [employeeId, startDate, endDate, leaveType, reason]
    )
    const [rows] = await req.app.get('pool').query('SELECT * FROM leave_records WHERE id = ?', [result.insertId])
    res.status(201).json(toCamel(rows[0]))
  } catch (e) {
    res.status(500).json({ message: '新增请假记录失败：' + e.message })
  }
})

// DELETE /api/leaveRecords/:id
router.delete('/:id', async (req, res) => {
  try {
    await req.app.get('pool').execute('DELETE FROM leave_records WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ message: '删除失败：' + e.message })
  }
})

export default router
