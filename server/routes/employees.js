import { Router } from 'express'

const router = Router()

// 字段驼峰化（保持与前端一致）
function toCamel(e) {
  return {
    id: e.id,
    employeeId: e.employee_id,
    name: e.name,
    dept: e.dept,
    position: e.position
  }
}

// GET /api/employees
router.get('/', async (req, res) => {
  try {
    const [rows] = await req.app.get('pool').query('SELECT * FROM employees ORDER BY id')
    res.json(rows.map(toCamel))
  } catch (e) {
    res.status(500).json({ message: '查询员工失败：' + e.message })
  }
})

export default router
