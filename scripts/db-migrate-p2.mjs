// P2 迁移脚本：添加 P2 阶段新增的表（不影响现有数据）
// 运行：node scripts/db-migrate-p2.mjs
import mysql from 'mysql2/promise'
import { dbConfig } from '../server/db.config.js'

const SQL = `
USE ${dbConfig.database};

-- 规则版本历史表（P2-04）
CREATE TABLE IF NOT EXISTS rule_versions (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  late_after        VARCHAR(5) NOT NULL,
  early_before      VARCHAR(5) NOT NULL,
  overtime_after    VARCHAR(5) NOT NULL,
  missing_strategy  ENUM('mark','absent') NOT NULL DEFAULT 'mark',
  lunch_start       VARCHAR(5) NULL,
  lunch_end         VARCHAR(5) NULL,
  operator          VARCHAR(50) NOT NULL DEFAULT 'system',
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 操作日志表（P2-17）
CREATE TABLE IF NOT EXISTS operation_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  operator    VARCHAR(50) NOT NULL,
  action      VARCHAR(50) NOT NULL,
  detail      VARCHAR(500) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 考勤申诉表（P2-10）
CREATE TABLE IF NOT EXISTS attendance_appeals (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  record_id    INT NOT NULL,
  employee_id  VARCHAR(20) NOT NULL,
  reason       VARCHAR(500) NOT NULL,
  status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewer     VARCHAR(50) NULL,
  review_note  VARCHAR(500) NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at  TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 数据备份主表（P2-02）
CREATE TABLE IF NOT EXISTS data_backups (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  backup_name   VARCHAR(100) NOT NULL,
  record_count  INT NOT NULL DEFAULT 0,
  operator      VARCHAR(50) NOT NULL DEFAULT 'system',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 数据备份详情表（P2-02）
CREATE TABLE IF NOT EXISTS data_backup_records (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  backup_id        INT NOT NULL,
  employee_id      VARCHAR(20) NOT NULL,
  date             DATE NOT NULL,
  check_in         VARCHAR(5) NULL,
  check_out        VARCHAR(5) NULL,
  overtime_minutes INT NOT NULL DEFAULT 0,
  FOREIGN KEY (backup_id) REFERENCES data_backups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- AI 配置表（P2-14）
CREATE TABLE IF NOT EXISTS ai_config (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  api_key     VARCHAR(200) NULL,
  api_url     VARCHAR(200) NULL,
  model_name  VARCHAR(50) NULL,
  enabled     TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 给 attendance_rules 表添加午休字段（P2-05，如果不存在）
-- 注意：MySQL 8.0 支持 ADD COLUMN IF NOT EXISTS，但为兼容性使用存储过程
`

async function run() {
  const conn = await mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    multipleStatements: true
  })

  console.log('开始执行 P2 迁移...')
  await conn.query(SQL)

  // 检查 attendance_rules 是否有 lunch_start 字段
  const [cols] = await conn.query(`SHOW COLUMNS FROM attendance_rules LIKE 'lunch_start'`)
  if (cols.length === 0) {
    console.log('添加 attendance_rules.lunch_start / lunch_end 字段...')
    await conn.query(`ALTER TABLE attendance_rules ADD COLUMN lunch_start VARCHAR(5) NULL AFTER missing_strategy`)
    await conn.query(`ALTER TABLE attendance_rules ADD COLUMN lunch_end VARCHAR(5) NULL AFTER lunch_start`)
  } else {
    console.log('attendance_rules 已有 lunch_start 字段，跳过')
  }

  console.log('✓ P2 迁移完成：rule_versions / operation_logs / attendance_appeals / data_backups / data_backup_records / ai_config')
  await conn.end()
}

run().catch((e) => {
  console.error('迁移失败：', e.message)
  process.exit(1)
})
