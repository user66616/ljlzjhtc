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
  return { id: r.id, date: fmtDate(r.date), dayType: r.day_type, label: r.label }
}

// GET /api/workCalendar
router.get('/', async (req, res) => {
  try {
    const [rows] = await req.app.get('pool').query('SELECT * FROM work_calendar ORDER BY date')
    res.json(rows.map(toCamel))
  } catch (e) {
    res.status(500).json({ message: '查询工作日历失败：' + e.message })
  }
})

// POST /api/workCalendar —— 批量设置
router.post('/', async (req, res) => {
  try {
    const { entries } = req.body // [{ date, dayType, label }]
    for (const e of entries) {
      await req.app.get('pool').execute(
        'INSERT INTO work_calendar (date, day_type, label) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE day_type = VALUES(day_type), label = VALUES(label)',
        [e.date, e.dayType, e.label || null]
      )
    }
    res.json({ count: entries.length })
  } catch (e) {
    res.status(500).json({ message: '保存工作日历失败：' + e.message })
  }
})

// DELETE /api/workCalendar —— 批量删除（body: { dates: ['YYYY-MM-DD', ...] }）
router.delete('/', async (req, res) => {
  try {
    const { dates } = req.body || {}
    if (!Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ message: '请传入要删除的日期数组' })
    }
    const placeholders = dates.map(() => '?').join(',')
    const [result] = await req.app.get('pool').execute(
      `DELETE FROM work_calendar WHERE date IN (${placeholders})`,
      dates
    )
    res.json({ deleted: result.affectedRows })
  } catch (e) {
    res.status(500).json({ message: '批量删除失败：' + e.message })
  }
})

// DELETE /api/workCalendar/:date —— 单条删除
router.delete('/:date', async (req, res) => {
  try {
    await req.app.get('pool').execute('DELETE FROM work_calendar WHERE date = ?', [req.params.date])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ message: '删除失败：' + e.message })
  }
})

export default router
