import { Router } from 'express'

const router = Router()

function fmtDateTime(d) {
  if (!d) return null
  if (d instanceof Date) {
    return d.toISOString().replace('T', ' ').slice(0, 19)
  }
  return d
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
    recordDate: r.record_date || null,
    recordStatus: r.record_status || null
  }
}

// GET /api/appeals
router.get('/', async (req, res) => {
  try {
    const { status, employeeId } = req.query
    let sql = 'SELECT a.* FROM attendance_appeals a'
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

export default router
