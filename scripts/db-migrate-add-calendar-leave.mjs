// 迁移：创建 work_calendar 和 leave_records 表
import mysql from 'mysql2/promise'
import { dbConfig } from '../server/db.config.js'

async function main() {
  const conn = await mysql.createConnection({
    host: dbConfig.host, port: dbConfig.port,
    user: dbConfig.user, password: dbConfig.password, database: dbConfig.database
  })
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS work_calendar (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        day_type ENUM('workday','weekend','holiday') NOT NULL DEFAULT 'workday',
        label VARCHAR(50) NULL,
        INDEX idx_date (date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    console.log('✓ work_calendar 表已创建')

    await conn.query(`
      CREATE TABLE IF NOT EXISTS leave_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id VARCHAR(20) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        leave_type ENUM('leave','business_trip','comp_off') NOT NULL DEFAULT 'leave',
        reason VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_emp (employee_id),
        INDEX idx_date (start_date, end_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    console.log('✓ leave_records 表已创建')
  } finally {
    await conn.end()
  }
  console.log('迁移完成')
}

main().catch(e => { console.error('迁移失败:', e.message); process.exit(1) })
