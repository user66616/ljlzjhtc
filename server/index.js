import express from 'express'
import cors from 'cors'
import { pool, testConnection } from './db.js'
import usersRouter from './routes/users.js'
import employeesRouter from './routes/employees.js'
import rulesRouter from './routes/rules.js'
import recordsRouter from './routes/records.js'
import calendarRouter from './routes/calendar.js'
import leavesRouter from './routes/leaves.js'
import versionsRouter from './routes/versions.js'
import logsRouter from './routes/logs.js'
import appealsRouter from './routes/appeals.js'
import backupsRouter from './routes/backups.js'
import aiRouter from './routes/ai.js'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

// 共享连接池
app.set('pool', pool)

// 路由（统一前缀 /api，与前端代理一致）
app.use('/api/users', usersRouter)
app.use('/api/employees', employeesRouter)
app.use('/api/attendanceRules', rulesRouter)
app.use('/api/attendanceRecords', recordsRouter)
app.use('/api/workCalendar', calendarRouter)
app.use('/api/leaveRecords', leavesRouter)
app.use('/api/ruleVersions', versionsRouter)
app.use('/api/operationLogs', logsRouter)
app.use('/api/appeals', appealsRouter)
app.use('/api/dataBackups', backupsRouter)
app.use('/api/aiConfig', aiRouter)

// 健康检查
app.get('/api/health', async (req, res) => {
  try {
    await testConnection()
    res.json({ status: 'ok', db: 'connected' })
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: e.message })
  }
})

app.listen(PORT, async () => {
  console.log(`\n[server] Express 已启动: http://localhost:${PORT}`)
  try {
    await testConnection()
    console.log('[server] MySQL 连接成功 ✓')
    // 自动迁移：给 attendance_appeals 表补充字段（兼容旧版本）
    try {
      await pool.query(`ALTER TABLE attendance_appeals ADD COLUMN record_date DATE NULL AFTER reason`)
    } catch (e) { /* 字段已存在忽略 */ }
    try {
      await pool.query(`ALTER TABLE attendance_appeals ADD COLUMN record_status VARCHAR(20) NULL AFTER record_date`)
    } catch (e) { /* 字段已存在忽略 */ }
  } catch (e) {
    console.error('[server] MySQL 连接失败 ✗')
    console.error('  请检查：1) MySQL 服务是否启动  2) server/db.config.js 配置是否正确')
    console.error('  错误：', e.message)
    console.error('  提示：运行 npm run db:reset 初始化数据库')
  }
  console.log(`[server] API 文档: http://localhost:${PORT}/api/health\n`)
})
