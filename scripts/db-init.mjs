// 数据库初始化：建库 + 建表（不会写入数据）
// 运行：npm run db:init
import mysql from 'mysql2/promise'
import { dbConfig } from '../server/db.config.js'

const SQL = `
CREATE DATABASE IF NOT EXISTS ${dbConfig.database} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ${dbConfig.database};

-- 用户表
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  username     VARCHAR(50)  NOT NULL UNIQUE,
  password     VARCHAR(100) NOT NULL,
  role         ENUM('admin','manager','employee') NOT NULL DEFAULT 'employee',
  name         VARCHAR(50)  NOT NULL,
  dept         VARCHAR(50)  NULL,
  employee_id  VARCHAR(20)  NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 员工表
DROP TABLE IF EXISTS employees;
CREATE TABLE employees (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  employee_id  VARCHAR(20)  NOT NULL UNIQUE,
  name         VARCHAR(50)  NOT NULL,
  dept         VARCHAR(50)  NOT NULL,
  position     VARCHAR(50)  NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 考勤规则表（仅保留一行当前规则）
DROP TABLE IF EXISTS attendance_rules;
CREATE TABLE attendance_rules (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  late_after        VARCHAR(5) NOT NULL DEFAULT '09:05',
  early_before      VARCHAR(5) NOT NULL DEFAULT '18:00',
  overtime_after    VARCHAR(5) NOT NULL DEFAULT '18:30',
  missing_strategy  ENUM('mark','absent') NOT NULL DEFAULT 'mark',
  lunch_start       VARCHAR(5) NULL DEFAULT '12:00',
  lunch_end         VARCHAR(5) NULL DEFAULT '13:00',
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 规则版本历史表（P2-04）
DROP TABLE IF EXISTS rule_versions;
CREATE TABLE rule_versions (
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
DROP TABLE IF EXISTS operation_logs;
CREATE TABLE operation_logs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  operator     VARCHAR(50) NOT NULL,
  action       VARCHAR(100) NOT NULL,
  detail       TEXT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_operator (operator),
  INDEX idx_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 考勤申诉表（P2-10）
DROP TABLE IF EXISTS attendance_appeals;
CREATE TABLE attendance_appeals (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  record_id    INT NOT NULL,
  employee_id  VARCHAR(20) NOT NULL,
  reason       VARCHAR(500) NOT NULL,
  status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewer     VARCHAR(50) NULL,
  review_note  VARCHAR(500) NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at  TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_emp (employee_id),
  INDEX idx_status (status),
  INDEX idx_record (record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 数据备份表（P2-02）
DROP TABLE IF EXISTS data_backups;
CREATE TABLE data_backups (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  backup_name  VARCHAR(100) NOT NULL,
  record_count INT NOT NULL DEFAULT 0,
  operator     VARCHAR(50) NOT NULL DEFAULT 'system',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 数据备份详情表（P2-02）
DROP TABLE IF EXISTS data_backup_records;
CREATE TABLE data_backup_records (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  backup_id    INT NOT NULL,
  employee_id  VARCHAR(20) NOT NULL,
  date         DATE NOT NULL,
  check_in     VARCHAR(5) NULL,
  check_out    VARCHAR(5) NULL,
  overtime_minutes INT NOT NULL DEFAULT 0,
  INDEX idx_backup (backup_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- AI 配置表（P2-14）
DROP TABLE IF EXISTS ai_config;
CREATE TABLE ai_config (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  api_key      VARCHAR(255) NOT NULL DEFAULT '',
  api_url      VARCHAR(500) NOT NULL DEFAULT '',
  model_name   VARCHAR(100) NOT NULL DEFAULT 'gpt-3.5-turbo',
  enabled      TINYINT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 工作日历表（P1-10）
DROP TABLE IF EXISTS work_calendar;
CREATE TABLE work_calendar (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  date         DATE NOT NULL UNIQUE,
  day_type     ENUM('workday','weekend','holiday') NOT NULL DEFAULT 'workday',
  label        VARCHAR(50) NULL,
  INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 请假记录表（P1-11）
DROP TABLE IF EXISTS leave_records;
CREATE TABLE leave_records (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  employee_id  VARCHAR(20) NOT NULL,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  leave_type   ENUM('leave','business_trip','comp_off') NOT NULL DEFAULT 'leave',
  reason       VARCHAR(255) NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_emp (employee_id),
  INDEX idx_date (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 考勤记录表
DROP TABLE IF EXISTS attendance_records;
CREATE TABLE attendance_records (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  employee_id       VARCHAR(20)  NOT NULL,
  date              DATE         NOT NULL,
  check_in          VARCHAR(5)  NULL,
  check_out         VARCHAR(5)  NULL,
  overtime_minutes  INT NOT NULL DEFAULT 0,
  handle_status     ENUM('pending','handled') NOT NULL DEFAULT 'pending',
  remark            VARCHAR(255) NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_emp_date (employee_id, date),
  INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`

async function main() {
  // 不指定 database 连接（用于 CREATE DATABASE）
  const conn = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    multipleStatements: true
  })
  try {
    console.log('正在初始化数据库...')
    await conn.query(SQL)
    console.log(`✓ 数据库 ${dbConfig.database} 初始化完成`)
    console.log('✓ 表已创建：users / employees / attendance_rules / attendance_records')
    console.log('\n下一步：运行 npm run db:seed 写入种子数据')
  } finally {
    await conn.end()
  }
}

main().catch((e) => {
  console.error('✗ 初始化失败：', e.message)
  console.error('\n请检查：')
  console.error('  1. MySQL 服务是否启动（net start mysql80 或 services.msc）')
  console.error('  2. server/db.config.js 中的密码是否正确')
  process.exit(1)
})
