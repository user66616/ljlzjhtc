// 迁移：给 attendance_records 表添加 handle_status 和 remark 字段
import mysql from 'mysql2/promise'
import { dbConfig } from '../server/db.config.js'

async function main() {
  const conn = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database
  })
  try {
    await conn.query("ALTER TABLE attendance_records ADD COLUMN handle_status ENUM('pending','handled') NOT NULL DEFAULT 'pending'")
    console.log('✓ 已添加 handle_status 字段')
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('• handle_status 字段已存在，跳过')
    else throw e
  }
  try {
    await conn.query('ALTER TABLE attendance_records ADD COLUMN remark VARCHAR(255) NULL')
    console.log('✓ 已添加 remark 字段')
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('• remark 字段已存在，跳过')
    else throw e
  }
  console.log('迁移完成')
  await conn.end()
}

main().catch(e => { console.error('迁移失败:', e.message); process.exit(1) })
