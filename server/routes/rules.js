import { Router } from 'express'

const router = Router()

// 将数据库行转换为前端期望的驼峰字段
function toCamel(r) {
  return {
    id: r.id,
    lateAfter: r.late_after,
    earlyBefore: r.early_before,
    overtimeAfter: r.overtime_after,
    missingStrategy: r.missing_strategy
  }
}

// GET /api/attendanceRules —— 返回数组（保持与原 json-server 一致）
router.get('/', async (req, res) => {
  try {
    const [rows] = await req.app.get('pool').query('SELECT * FROM attendance_rules ORDER BY id')
    res.json(rows.map(toCamel))
  } catch (e) {
    res.status(500).json({ message: '查询规则失败：' + e.message })
  }
})

// POST /api/attendanceRules —— 新增规则
router.post('/', async (req, res) => {
  try {
    const { lateAfter, earlyBefore, overtimeAfter, missingStrategy } = req.body
    const [result] = await req.app.get('pool').execute(
      'INSERT INTO attendance_rules (late_after, early_before, overtime_after, missing_strategy) VALUES (?, ?, ?, ?)',
      [lateAfter, earlyBefore, overtimeAfter, missingStrategy]
    )
    const [rows] = await req.app.get('pool').query('SELECT * FROM attendance_rules WHERE id = ?', [result.insertId])
    res.status(201).json(toCamel(rows[0]))
  } catch (e) {
    res.status(500).json({ message: '新增规则失败：' + e.message })
  }
})

// PUT /api/attendanceRules/:id —— 更新规则
router.put('/:id', async (req, res) => {
  try {
    const { lateAfter, earlyBefore, overtimeAfter, missingStrategy } = req.body
    await req.app.get('pool').execute(
      'UPDATE attendance_rules SET late_after = ?, early_before = ?, overtime_after = ?, missing_strategy = ? WHERE id = ?',
      [lateAfter, earlyBefore, overtimeAfter, missingStrategy, req.params.id]
    )
    const [rows] = await req.app.get('pool').query('SELECT * FROM attendance_rules WHERE id = ?', [req.params.id])
    res.json(toCamel(rows[0]))
  } catch (e) {
    res.status(500).json({ message: '更新规则失败：' + e.message })
  }
})

export default router
