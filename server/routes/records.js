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
    overtimeMinutes: r.overtime_minutes,
    handleStatus: r.handle_status,
    remark: r.remark
  }
}

// GET /api/attendanceRecords —— 返回记录（支持按 employeeId 过滤）
router.get('/', async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query
    let sql = 'SELECT * FROM attendance_records'
    const params = []
    const where = []
    if (employeeId) { where.push('employee_id = ?'); params.push(employeeId) }
    if (startDate) { where.push('date >= ?'); params.push(startDate) }
    if (endDate) { where.push('date <= ?'); params.push(endDate) }
    if (where.length) sql += ' WHERE ' + where.join(' AND ')
    sql += ' ORDER BY date ASC, employee_id ASC'
    const [rows] = await req.app.get('pool').query(sql, params)
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

// POST /api/attendanceRecords/batch —— 批量导入考勤记录（大数据量专用）
// 请求体: { records: [{ employeeId, date, checkIn, checkOut, overtimeMinutes }] }
// 返回: { success, fail, message }
router.post('/batch', async (req, res) => {
  try {
    const { records } = req.body
    if (!Array.isArray(records)) {
      return res.status(400).json({ message: 'records 字段必须为数组' })
    }
    if (records.length === 0) {
      return res.json({ success: 0, fail: 0, message: '无数据需要导入' })
    }

    const pool = req.app.get('pool')
    // 分片批量 INSERT，避免单条 SQL 过大（每片 1000 条）
    const CHUNK_SIZE = 1000
    let totalAffected = 0
    let totalFail = 0

    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE)
      const values = []
      const invalidInChunk = []
      chunk.forEach((r) => {
        const employeeId = r.employeeId != null ? String(r.employeeId).trim() : ''
        const date = r.date != null ? String(r.date).trim() : ''
        // 跳过缺少必填字段的行
        if (!employeeId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          invalidInChunk.push(r)
          return
        }
        values.push([
          employeeId,
          date,
          r.checkIn ? String(r.checkIn).trim() : null,
          r.checkOut ? String(r.checkOut).trim() : null,
          Number(r.overtimeMinutes) || 0
        ])
      })
      if (values.length > 0) {
        // 批量 INSERT：mysql2 支持用 ? 占位数组二维数组
        const [result] = await pool.query(
          'INSERT INTO attendance_records (employee_id, date, check_in, check_out, overtime_minutes) VALUES ?',
          [values]
        )
        totalAffected += result.affectedRows
      }
      totalFail += invalidInChunk.length
    }

    res.status(201).json({
      success: totalAffected,
      fail: totalFail,
      message: `批量导入完成：成功 ${totalAffected} 条，失败 ${totalFail} 条`
    })
  } catch (e) {
    res.status(500).json({ message: '批量导入失败：' + e.message })
  }
})

// DELETE /api/attendanceRecords —— 清空指定日期范围内的记录（不传日期则清空全部）
router.delete('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.body || {}
    let sql, params
    if (startDate && endDate) {
      sql = 'DELETE FROM attendance_records WHERE date >= ? AND date <= ?'
      params = [startDate, endDate]
    } else {
      sql = 'DELETE FROM attendance_records'
      params = []
    }
    const [result] = await req.app.get('pool').execute(sql, params)
    res.json({ deleted: result.affectedRows })
  } catch (e) {
    res.status(500).json({ message: '清空考勤记录失败：' + e.message })
  }
})

// PUT /api/attendanceRecords/:id —— 修改单条记录
router.put('/:id', async (req, res) => {
  try {
    const { checkIn, checkOut } = req.body
    await req.app.get('pool').execute(
      'UPDATE attendance_records SET check_in = ?, check_out = ? WHERE id = ?',
      [checkIn || null, checkOut || null, req.params.id]
    )
    const [rows] = await req.app.get('pool').query('SELECT * FROM attendance_records WHERE id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: '记录不存在' })
    res.json(toCamel(rows[0]))
  } catch (e) {
    res.status(500).json({ message: '修改考勤记录失败：' + e.message })
  }
})

// PATCH /api/attendanceRecords/:id —— 更新处理状态或备注
router.patch('/:id', async (req, res) => {
  try {
    const { handleStatus, remark } = req.body
    const fields = []
    const params = []
    if (handleStatus !== undefined) { fields.push('handle_status = ?'); params.push(handleStatus) }
    if (remark !== undefined) { fields.push('remark = ?'); params.push(remark) }
    if (fields.length === 0) return res.status(400).json({ message: '没有需要更新的字段' })
    params.push(req.params.id)
    await req.app.get('pool').execute(`UPDATE attendance_records SET ${fields.join(', ')} WHERE id = ?`, params)
    const [rows] = await req.app.get('pool').query('SELECT * FROM attendance_records WHERE id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: '记录不存在' })
    res.json(toCamel(rows[0]))
  } catch (e) {
    res.status(500).json({ message: '更新处理状态失败：' + e.message })
  }
})

export default router
