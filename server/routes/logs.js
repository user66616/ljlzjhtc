import { Router } from 'express'

const router = Router()

function toCamel(r) {
  return {
    id: r.id,
    operator: r.operator,
    action: r.action,
    detail: r.detail,
    createdAt: r.created_at
  }
}

// GET /api/operationLogs
router.get('/', async (req, res) => {
  try {
    const [rows] = await req.app.get('pool').query('SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT 200')
    res.json(rows.map(toCamel))
  } catch (e) {
    res.status(500).json({ message: '查询操作日志失败：' + e.message })
  }
})

// POST /api/operationLogs
router.post('/', async (req, res) => {
  try {
    const { operator, action, detail } = req.body
    const [result] = await req.app.get('pool').execute(
      'INSERT INTO operation_logs (operator, action, detail) VALUES (?, ?, ?)',
      [operator || 'system', action || '', detail || '']
    )
    const [rows] = await req.app.get('pool').query('SELECT * FROM operation_logs WHERE id = ?', [result.insertId])
    res.status(201).json(toCamel(rows[0]))
  } catch (e) {
    res.status(500).json({ message: '记录操作日志失败：' + e.message })
  }
})

export default router
