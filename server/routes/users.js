import { Router } from 'express'

const router = Router()

// GET /api/users —— 支持按 username/password 查询（登录）
router.get('/', async (req, res) => {
  try {
    const { username, password } = req.query
    let sql = 'SELECT * FROM users'
    const params = []
    const where = []
    if (username) { where.push('username = ?'); params.push(username) }
    if (password) { where.push('password = ?'); params.push(password) }
    if (where.length) sql += ' WHERE ' + where.join(' AND ')
    const [rows] = await req.app.get('pool').query(sql, params)
    // 字段驼峰化（保持与原 json-server 返回结构一致）
    res.json(rows.map((u) => ({
      id: u.id,
      username: u.username,
      password: u.password,
      role: u.role,
      name: u.name,
      dept: u.dept,
      employeeId: u.employee_id
    })))
  } catch (e) {
    res.status(500).json({ message: '查询用户失败：' + e.message })
  }
})

export default router
