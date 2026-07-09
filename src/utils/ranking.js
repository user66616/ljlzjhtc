// 员工排名与主页可见性判断
import { calcAll, summarize } from './attendance.js'

// 计算全部员工的考勤排名
// 返回 { ranked: [...], top5: [...], bottom5: [...] }
// ranked 按 anomalyScore 升序（分数越低=异常越少=考勤越好）
export function computeRanking(records, employees, rules, approvedAppealIds, leaves) {
  const calc = calcAll(records, rules, leaves || [], approvedAppealIds)
  const byEmp = {}
  for (const r of calc) {
    if (!byEmp[r.employeeId]) {
      const emp = employees.find((e) => e.employee_id === r.employeeId || e.employeeId === r.employeeId) || {}
      byEmp[r.employeeId] = {
        employeeId: r.employeeId,
        name: emp.name || '未知',
        dept: emp.dept || '未知',
        position: emp.position || '',
        records: []
      }
    }
    byEmp[r.employeeId].records.push(r)
  }

  const ranked = Object.values(byEmp).map((e) => {
    const s = summarize(e.records)
    // 异常分：迟到+早退+缺卡 + 缺勤*2（缺勤权重更高）
    const missingCount = e.records.filter((r) => r.status === 'missing').length
    const anomalyScore = s.lateCount + s.earlyCount + missingCount + s.absent * 2
    return { ...e, ...s, missingCount, anomalyScore }
  })

  ranked.sort((a, b) => a.anomalyScore - b.anomalyScore)

  const top5 = ranked.slice(0, 5)
  // 后5：异常最多的（取倒序前5）
  const bottom5 = [...ranked].reverse().slice(0, 5)

  return { ranked, top5, bottom5 }
}

// 判断当前用户能否查看某员工主页
// 规则：
//   - admin：可看所有人
//   - 本人：可看自己
//   - 该员工在 top5 或 bottom5：所有人可看（公开展示）
//   - manager：可看本部门员工（作为上级）
//   - 其他：无权
export function canViewProfile(auth, targetEmployeeId, targetDept, ranked) {
  if (auth.role === 'admin') return true
  if (auth.employeeId === targetEmployeeId) return true

  // top5 / bottom5 公开
  const publicIds = new Set([
    ...ranked.top5.map((e) => e.employeeId),
    ...ranked.bottom5.map((e) => e.employeeId)
  ])
  if (publicIds.has(targetEmployeeId)) return true

  // manager 看本部门员工
  if (auth.role === 'manager' && auth.dept === targetDept) return true

  return false
}
