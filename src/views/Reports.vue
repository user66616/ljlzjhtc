<template>
  <div class="page reports-page" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">月报中心</h2>
      <p class="page-desc">按员工或部门维度查看月度考勤汇总</p>
    </div>

    <!-- 切换 + 月份选择 -->
    <div class="glass-card filter-bar fade-up">
      <el-radio-group v-model="reportType" size="default">
        <el-radio-button label="personal">个人月报</el-radio-button>
        <el-radio-button label="department">部门月报</el-radio-button>
      </el-radio-group>
      <el-date-picker
        v-model="month"
        type="month"
        placeholder="选择月份"
        value-format="YYYY-MM"
        :clearable="false"
        style="width: 160px; margin-left: 16px"
      />
      <el-select v-if="reportType === 'personal'" v-model="selectedEmp" placeholder="选择员工" filterable style="width: 200px; margin-left: 16px">
        <el-option v-for="e in employees" :key="e.employeeId" :label="`${e.name} (${e.employeeId})`" :value="e.employeeId" />
      </el-select>
      <el-select v-else v-model="selectedDept" placeholder="选择部门" clearable style="width: 160px; margin-left: 16px">
        <el-option v-for="d in deptOptions" :key="d" :label="d" :value="d" />
      </el-select>
      <el-button type="success" plain :icon="Download" @click="onExport" style="margin-left: 16px">导出 CSV</el-button>
    </div>

    <!-- 个人月报 -->
    <template v-if="reportType === 'personal' && personalData">
      <div class="glass-card fade-up">
        <div class="card-title">
          <el-icon><User /></el-icon>
          <span>{{ personalData.name }} - {{ month }} 月报</span>
        </div>
        <div class="kpi-row">
          <div class="kpi-item"><div class="kpi-num">{{ personalData.attendedDays }}</div><div class="kpi-lbl">出勤天数</div></div>
          <div class="kpi-item warn"><div class="kpi-num">{{ personalData.lateCount }}</div><div class="kpi-lbl">迟到次数</div></div>
          <div class="kpi-item warn"><div class="kpi-num">{{ personalData.earlyCount }}</div><div class="kpi-lbl">早退次数</div></div>
          <div class="kpi-item danger"><div class="kpi-num">{{ personalData.absentCount }}</div><div class="kpi-lbl">缺勤天数</div></div>
          <div class="kpi-item ot"><div class="kpi-num">{{ personalData.overtimeHours }}</div><div class="kpi-lbl">加班(小时)</div></div>
        </div>

        <h4 style="margin: 20px 0 10px">异常明细</h4>
        <el-table :data="personalData.exceptions" border size="small" max-height="300">
          <el-table-column prop="date" label="日期" width="120" />
          <el-table-column label="状态" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="STATUS_META[row.status]?.type" size="small" effect="light">{{ STATUS_META[row.status]?.label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="checkIn" label="上班打卡" width="100"><template #default="{ row }">{{ row.checkIn || '—' }}</template></el-table-column>
          <el-table-column prop="checkOut" label="下班打卡" width="100"><template #default="{ row }">{{ row.checkOut || '—' }}</template></el-table-column>
          <el-table-column label="说明" min-width="150">
            <template #default="{ row }">
              <span v-if="row.lateMinutes">迟到 {{ row.lateMinutes }} 分钟</span>
              <span v-else-if="row.earlyMinutes">早退 {{ row.earlyMinutes }} 分钟</span>
              <span v-else>{{ STATUS_META[row.status]?.label }}</span>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="personalData.exceptions.length === 0" description="本月无异常记录" />
      </div>
    </template>

    <!-- 部门月报 -->
    <template v-if="reportType === 'department' && deptData">
      <div class="glass-card fade-up">
        <div class="card-title">
          <el-icon><OfficeBuilding /></el-icon>
          <span>{{ deptData.dept || '全部部门' }} - {{ month }} 月报</span>
        </div>
        <div class="kpi-row">
          <div class="kpi-item"><div class="kpi-num">{{ deptData.totalEmployees }}</div><div class="kpi-lbl">员工数</div></div>
          <div class="kpi-item warn"><div class="kpi-num">{{ deptData.totalLate }}</div><div class="kpi-lbl">迟到总数</div></div>
          <div class="kpi-item warn"><div class="kpi-num">{{ deptData.totalEarly }}</div><div class="kpi-lbl">早退总数</div></div>
          <div class="kpi-item danger"><div class="kpi-num">{{ deptData.totalAbsent }}</div><div class="kpi-lbl">缺勤总数</div></div>
          <div class="kpi-item ot"><div class="kpi-num">{{ deptData.totalOvertimeHours }}</div><div class="kpi-lbl">加班(小时)</div></div>
        </div>

        <h4 style="margin: 20px 0 10px">异常员工名单</h4>
        <el-table :data="deptData.anomalyEmployees" border size="small" max-height="360">
          <el-table-column type="index" label="#" width="50" align="center" />
          <el-table-column prop="employeeId" label="工号" width="90" />
          <el-table-column prop="name" label="姓名" width="100" />
          <el-table-column prop="lateCount" label="迟到" width="70" align="center" />
          <el-table-column prop="earlyCount" label="早退" width="70" align="center" />
          <el-table-column prop="absentCount" label="缺勤" width="70" align="center" />
          <el-table-column prop="anomalyScore" label="异常分" width="80" align="center">
            <template #default="{ row }"><span :style="{ color: row.anomalyScore > 5 ? '#ef4444' : '#faad14', fontWeight: 600 }">{{ row.anomalyScore }}</span></template>
          </el-table-column>
        </el-table>
        <el-empty v-if="deptData.anomalyEmployees.length === 0" description="本部门本月无异常员工" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, User, OfficeBuilding } from '@element-plus/icons-vue'
import request from '../api/request'
import { useAuthStore } from '../stores/auth'
import { useRulesStore } from '../stores/rules'
import { calcAll, STATUS_META } from '../utils/attendance'
import { toCSV, downloadCSV } from '../utils/csv'

const auth = useAuthStore()
const rulesStore = useRulesStore()

const loading = ref(false)
const employees = ref([])
const records = ref([])

const reportType = ref('personal')
const month = ref(new Date().toISOString().slice(0, 7))
const selectedEmp = ref('')
const selectedDept = ref('')

const deptOptions = computed(() => {
  const set = new Set(employees.value.map((e) => e.dept))
  return Array.from(set)
})

const empMap = computed(() => {
  const m = {}
  employees.value.forEach((e) => { m[e.employeeId] = e })
  return m
})

const monthRecords = computed(() => {
  return records.value.filter((r) => r.date.startsWith(month.value))
})

const calcMonthRecords = computed(() => {
  const calc = calcAll(monthRecords.value, rulesStore.rules)
  const map = empMap.value
  return calc.map((r) => {
    const emp = map[r.employeeId] || {}
    return { ...r, name: emp.name || '未知', dept: emp.dept || '未知' }
  })
})

// 个人月报
const personalData = computed(() => {
  if (!selectedEmp.value) return null
  const rows = calcMonthRecords.value.filter((r) => r.employeeId === selectedEmp.value)
  if (rows.length === 0) return null
  const emp = empMap.value[selectedEmp.value] || {}
  const exceptions = rows.filter((r) => ['late', 'early', 'missing', 'absent'].includes(r.status))
  return {
    name: emp.name || selectedEmp.value,
    attendedDays: rows.filter((r) => r.status !== 'absent').length,
    lateCount: rows.filter((r) => r.status === 'late').length,
    earlyCount: rows.filter((r) => r.status === 'early').length,
    absentCount: rows.filter((r) => r.status === 'absent').length,
    overtimeHours: (rows.reduce((s, r) => s + (r.overtimeMinutes || 0), 0) / 60).toFixed(1),
    exceptions
  }
})

// 部门月报
const deptData = computed(() => {
  let rows = calcMonthRecords.value
  if (selectedDept.value) rows = rows.filter((r) => r.dept === selectedDept.value)

  const empStats = {}
  rows.forEach((r) => {
    if (!empStats[r.employeeId]) {
      empStats[r.employeeId] = {
        employeeId: r.employeeId, name: r.name, dept: r.dept,
        lateCount: 0, earlyCount: 0, absentCount: 0, missingCount: 0,
        overtimeMinutes: 0
      }
    }
    const s = empStats[r.employeeId]
    if (r.status === 'late') s.lateCount++
    if (r.status === 'early') s.earlyCount++
    if (r.status === 'absent') s.absentCount++
    if (r.status === 'missing') s.missingCount++
    s.overtimeMinutes += r.overtimeMinutes || 0
    s.anomalyScore = s.lateCount + s.earlyCount + s.missingCount + s.absentCount * 2
  })

  const allEmps = Object.values(empStats)
  const anomalyEmps = allEmps.filter((e) => e.anomalyScore > 0).sort((a, b) => b.anomalyScore - a.anomalyScore)

  return {
    dept: selectedDept.value || '全部',
    totalEmployees: allEmps.length,
    totalLate: allEmps.reduce((s, e) => s + e.lateCount, 0),
    totalEarly: allEmps.reduce((s, e) => s + e.earlyCount, 0),
    totalAbsent: allEmps.reduce((s, e) => s + e.absentCount, 0),
    totalOvertimeHours: (allEmps.reduce((s, e) => s + e.overtimeMinutes, 0) / 60).toFixed(1),
    anomalyEmployees: anomalyEmps
  }
})

onMounted(async () => {
  loading.value = true
  try {
    await rulesStore.load()
    const [empRes, recRes] = await Promise.all([
      request.get('/employees'),
      request.get('/attendanceRecords')
    ])
    employees.value = empRes.data
    records.value = recRes.data
    // 默认选中第一个员工
    if (employees.value.length > 0) selectedEmp.value = employees.value[0].employeeId
  } finally {
    loading.value = false
  }
})

function onExport() {
  if (reportType.value === 'personal' && personalData.value) {
    const rows = personalData.value.exceptions.length > 0
      ? personalData.value.exceptions.map((r) => ({
          employeeId: selectedEmp.value,
          name: personalData.value.name,
          date: r.date,
          status: STATUS_META[r.status]?.label || r.status,
          checkIn: r.checkIn || '',
          checkOut: r.checkOut || '',
          lateMinutes: r.lateMinutes || 0,
          earlyMinutes: r.earlyMinutes || 0
        }))
      : [{
          employeeId: selectedEmp.value,
          name: personalData.value.name,
          date: month.value,
          status: '正常',
          checkIn: '', checkOut: '', lateMinutes: 0, earlyMinutes: 0
        }]
    const csv = toCSV(rows, ['employeeId', 'name', 'date', 'status', 'checkIn', 'checkOut', 'lateMinutes', 'earlyMinutes'])
    downloadCSV(`个人月报_${personalData.value.name}_${month.value}.csv`, csv)
    ElMessage.success('月报导出成功')
  } else if (reportType.value === 'department' && deptData.value) {
    const rows = deptData.value.anomalyEmployees.map((e) => ({
      employeeId: e.employeeId,
      name: e.name,
      dept: e.dept,
      lateCount: e.lateCount,
      earlyCount: e.earlyCount,
      absentCount: e.absentCount,
      missingCount: e.missingCount,
      anomalyScore: e.anomalyScore,
      overtimeHours: (e.overtimeMinutes / 60).toFixed(1)
    }))
    const csv = toCSV(rows, ['employeeId', 'name', 'dept', 'lateCount', 'earlyCount', 'absentCount', 'missingCount', 'anomalyScore', 'overtimeHours'])
    downloadCSV(`部门月报_${deptData.value.dept}_${month.value}.csv`, csv)
    ElMessage.success('月报导出成功')
  }
}
</script>

<style scoped>
.filter-bar {
  margin-bottom: 16px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
}
.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}
.card-title .el-icon { color: var(--brand); }

.kpi-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}
@media (max-width: 800px) { .kpi-row { grid-template-columns: repeat(2, 1fr); } }

.kpi-item {
  text-align: center;
  padding: 20px;
  border-radius: 10px;
  background: #f9fafb;
}
.kpi-item.warn { background: linear-gradient(135deg, #fef3c7, #fde68a); }
.kpi-item.danger { background: linear-gradient(135deg, #fee2e2, #fecaca); }
.kpi-item.ot { background: linear-gradient(135deg, #d1fae5, #bbf7d0); }
.kpi-num { font-size: 30px; font-weight: 800; line-height: 1; }
.kpi-lbl { margin-top: 6px; font-size: 12px; color: var(--text-2); }
</style>
