import mysql from 'mysql2/promise'
import { dbConfig } from './db.config.js'

// 共享连接池（使用 attendance_db 数据库）
export const pool = mysql.createPool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
})

// 测试连接
export async function testConnection() {
  const conn = await pool.getConnection()
  try {
    await conn.ping()
    return true
  } finally {
    conn.release()
  }
}
