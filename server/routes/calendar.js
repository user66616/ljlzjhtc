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

// DELETE /api/workCalendar/:date
router.delete('/:date', async (req, res) => {
  try {
    await req.app.get('pool').execute('DELETE FROM work_calendar WHERE date = ?', [req.params.date])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ message: '删除失败：' + e.message })
  }
})

export default router
