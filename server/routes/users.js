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

// PUT /api/users/password —— 修改密码（P2-01）
router.put('/password', async (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body
    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ message: '参数不完整' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: '新密码长度不能少于6位' })
    }
    const [rows] = await req.app.get('pool').query('SELECT * FROM users WHERE id = ? AND password = ?', [userId, oldPassword])
    if (rows.length === 0) {
      return res.status(400).json({ message: '原密码不正确' })
    }
    await req.app.get('pool').execute('UPDATE users SET password = ? WHERE id = ?', [newPassword, userId])
    res.json({ ok: true, message: '密码修改成功，请重新登录' })
  } catch (e) {
    res.status(500).json({ message: '修改密码失败：' + e.message })
  }
})

export default router
