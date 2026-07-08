// MySQL 数据库连接配置
// 修改此处后运行：npm run db:reset （会重建表并写入种子数据）
// 如 MySQL 服务未启动，请先以管理员身份启动 MySQL 服务

export const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '123456', // ← 改成你自己的 root 密码
  database: 'attendance_db'
}
