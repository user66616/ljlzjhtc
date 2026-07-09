import { Router } from 'express'

const router = Router()

// 获取本地时间格式化字符串（YYYY-MM-DD HH:mm:ss），避免 UTC 时差
function getLocalTimeStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}:${s}`
}

function toCamel(r) {
  return {
    id: r.id,
    backupName: r.backup_name,
    recordCount: r.record_count,
    operator: r.operator,
    createdAt: r.created_at
  }
}

// GET /api/dataBackups
router.get('/', async (req, res) => {
  try {
    const [rows] = await req.app.get('pool').query('SELECT * FROM data_backups ORDER BY created_at DESC')
    res.json(rows.map(toCamel))
  } catch (e) {
    res.status(500).json({ message: '查询备份失败：' + e.message })
  }
})

// POST /api/dataBackups/backup —— 创建备份
router.post('/backup', async (req, res) => {
  try {
    const pool = req.app.get('pool')
    const { operator } = req.body
    const backupName = `备份_${getLocalTimeStr()}`
    // 创建备份记录
    const [result] = await pool.execute(
      'INSERT INTO data_backups (backup_name, operator) VALUES (?, ?)',
      [backupName, operator || 'system']
    )
    const backupId = result.insertId
    // 复制当前全量考勤记录到备份详情表
    const [records] = await pool.query('SELECT employee_id, date, check_in, check_out, overtime_minutes FROM attendance_records')
    if (records.length > 0) {
      const values = records.map((r) => [backupId, r.employee_id, r.date, r.check_in, r.check_out, r.overtime_minutes])
      await pool.query(
        'INSERT INTO data_backup_records (backup_id, employee_id, date, check_in, check_out, overtime_minutes) VALUES ?',
        [values]
      )
    }
    // 更新备份记录数
    await pool.execute('UPDATE data_backups SET record_count = ? WHERE id = ?', [records.length, backupId])
    const [rows] = await pool.query('SELECT * FROM data_backups WHERE id = ?', [backupId])
    res.status(201).json(toCamel(rows[0]))
  } catch (e) {
    res.status(500).json({ message: '创建备份失败：' + e.message })
  }
})

// POST /api/dataBackups/:id/rollback —— 回滚到指定备份
router.post('/:id/rollback', async (req, res) => {
  try {
    const pool = req.app.get('pool')
    const [backup] = await pool.query('SELECT * FROM data_backups WHERE id = ?', [req.params.id])
    if (backup.length === 0) return res.status(404).json({ message: '备份不存在' })
    // 清空当前考勤记录
    await pool.execute('DELETE FROM attendance_records')
    // 从备份恢复
    const [records] = await pool.query('SELECT employee_id, date, check_in, check_out, overtime_minutes FROM data_backup_records WHERE backup_id = ?', [req.params.id])
    if (records.length > 0) {
      const values = records.map((r) => [r.employee_id, r.date, r.check_in, r.check_out, r.overtime_minutes])
      await pool.query(
        'INSERT INTO attendance_records (employee_id, date, check_in, check_out, overtime_minutes) VALUES ?',
        [values]
      )
    }
    res.json({ ok: true, restored: records.length })
  } catch (e) {
    res.status(500).json({ message: '回滚失败：' + e.message })
  }
})

export default router
