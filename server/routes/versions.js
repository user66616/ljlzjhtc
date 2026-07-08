import { Router } from 'express'

const router = Router()

function toCamel(r) {
  return {
    id: r.id,
    lateAfter: r.late_after,
    earlyBefore: r.early_before,
    overtimeAfter: r.overtime_after,
    missingStrategy: r.missing_strategy,
    lunchStart: r.lunch_start,
    lunchEnd: r.lunch_end,
    operator: r.operator,
    createdAt: r.created_at
  }
}

// GET /api/ruleVersions
router.get('/', async (req, res) => {
  try {
    const [rows] = await req.app.get('pool').query('SELECT * FROM rule_versions ORDER BY created_at DESC')
    res.json(rows.map(toCamel))
  } catch (e) {
    res.status(500).json({ message: '查询规则版本失败：' + e.message })
  }
})

// POST /api/ruleVersions —— 保存当前规则为历史版本
router.post('/', async (req, res) => {
  try {
    const { lateAfter, earlyBefore, overtimeAfter, missingStrategy, lunchStart, lunchEnd, operator } = req.body
    const [result] = await req.app.get('pool').execute(
      'INSERT INTO rule_versions (late_after, early_before, overtime_after, missing_strategy, lunch_start, lunch_end, operator) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [lateAfter, earlyBefore, overtimeAfter, missingStrategy, lunchStart || null, lunchEnd || null, operator || 'system']
    )
    const [rows] = await req.app.get('pool').query('SELECT * FROM rule_versions WHERE id = ?', [result.insertId])
    res.status(201).json(toCamel(rows[0]))
  } catch (e) {
    res.status(500).json({ message: '保存规则版本失败：' + e.message })
  }
})

// POST /api/ruleVersions/:id/rollback —— 回滚到指定版本
router.post('/:id/rollback', async (req, res) => {
  try {
    const pool = req.app.get('pool')
    const [rows] = await pool.query('SELECT * FROM rule_versions WHERE id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: '版本不存在' })
    const v = rows[0]
    // 更新当前规则
    await pool.execute(
      'UPDATE attendance_rules SET late_after = ?, early_before = ?, overtime_after = ?, missing_strategy = ?, lunch_start = ?, lunch_end = ? WHERE id = (SELECT id FROM (SELECT id FROM attendance_rules LIMIT 1) AS t)',
      [v.late_after, v.early_before, v.overtime_after, v.missing_strategy, v.lunch_start, v.lunch_end]
    )
    // 返回回滚后的规则（驼峰）
    const [current] = await pool.query('SELECT * FROM attendance_rules LIMIT 1')
    res.json({
      id: current[0].id,
      lateAfter: current[0].late_after,
      earlyBefore: current[0].early_before,
      overtimeAfter: current[0].overtime_after,
      missingStrategy: current[0].missing_strategy,
      lunchStart: current[0].lunch_start,
      lunchEnd: current[0].lunch_end
    })
  } catch (e) {
    res.status(500).json({ message: '回滚失败：' + e.message })
  }
})

export default router
