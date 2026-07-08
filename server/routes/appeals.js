import { Router } from 'express'

const router = Router()

function fmtDateTime(d) {
  if (!d) return null
  const dt = d instanceof Date ? d : new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`
}

function toCamel(r) {
  return {
    id: r.id,
    recordId: r.record_id,
    employeeId: r.employee_id,
    reason: r.reason,
    status: r.status,
    reviewer: r.reviewer,
    reviewNote: r.review_note,
    createdAt: fmtDateTime(r.created_at),
    reviewedAt: fmtDateTime(r.reviewed_at),
    recordDate: fmtDate(r.date) || r.record_date || null,
    recordStatus: r.record_status || null
  }
}

function fmtDate(d) {
  if (!d) return null
  if (d instanceof Date) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  if (typeof d === 'string') return d.slice(0, 10)
  return d
}

// GET /api/appeals
router.get('/', async (req, res) => {
  try {
    const { status, employeeId } = req.query
    let sql = `SELECT a.*, r.date, r.check_in, r.check_out
               FROM attendance_appeals a
               LEFT JOIN attendance_records r ON a.record_id = r.id`
    const params = []
    const where = []
    if (status) { where.push('a.status = ?'); params.push(status) }
    if (employeeId) { where.push('a.employee_id = ?'); params.push(employeeId) }
    if (where.length) sql += ' WHERE ' + where.join(' AND ')
    sql += ' ORDER BY a.created_at DESC'
    const [rows] = await req.app.get('pool').query(sql, params)
    res.json(rows.map(toCamel))
  } catch (e) {
    res.status(500).json({ message: '查询申诉失败：' + e.message })
  }
})

// POST /api/appeals —— 员工发起申诉
router.post('/', async (req, res) => {
  try {
    const { recordId, employeeId, reason, recordStatus } = req.body
    if (!recordId || !employeeId || !reason) {
      return res.status(400).json({ message: '参数不完整' })
    }
    // 查询记录日期用于展示
    const [recRows] = await req.app.get('pool').query('SELECT date FROM attendance_records WHERE id = ?', [recordId])
    const recordDate = recRows[0]?.date || null
    const [result] = await req.app.get('pool').execute(
      'INSERT INTO attendance_appeals (record_id, employee_id, reason, record_date, record_status) VALUES (?, ?, ?, ?, ?)',
      [recordId, employeeId, reason, recordDate, recordStatus || '']
    )
    const [rows] = await req.app.get('pool').query('SELECT * FROM attendance_appeals WHERE id = ?', [result.insertId])
    res.status(201).json(toCamel(rows[0]))
  } catch (e) {
    res.status(500).json({ message: '创建申诉失败：' + e.message })
  }
})

// PATCH /api/appeals/:id —— 管理员审核申诉
router.patch('/:id', async (req, res) => {
  try {
    const { status, reviewer, reviewNote } = req.body
    if (!status || !reviewer) {
      return res.status(400).json({ message: '参数不完整' })
    }
    await req.app.get('pool').execute(
      'UPDATE attendance_appeals SET status = ?, reviewer = ?, review_note = ?, reviewed_at = NOW() WHERE id = ?',
      [status, reviewer, reviewNote || '', req.params.id]
    )
    const [rows] = await req.app.get('pool').query('SELECT * FROM attendance_appeals WHERE id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: '申诉不存在' })
    res.json(toCamel(rows[0]))
  } catch (e) {
    res.status(500).json({ message: '审核申诉失败：' + e.message })
  }
})

// DELETE /api/appeals/:id —— 员工撤销未审核的申诉
router.delete('/:id', async (req, res) => {
  try {
    // 先查询申诉状态，只能撤销待审核的
    const [rows] = await req.app.get('pool').query('SELECT * FROM attendance_appeals WHERE id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: '申诉不存在' })
    if (rows[0].status !== 'pending') {
      return res.status(400).json({ message: '只能撤销待审核的申诉' })
    }
    await req.app.get('pool').execute('DELETE FROM attendance_appeals WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ message: '撤销申诉失败：' + e.message })
  }
})

export default router
