<template>
  <div class="page profile-page" v-loading="loading">
    <!-- 返回 -->
    <div class="back-bar">
      <el-button :icon="ArrowLeft" link @click="$router.back()">返回</el-button>
    </div>

    <!-- 无权查看 -->
    <div v-if="!loading && !allowed" class="glass-card deny-card fade-up">
      <el-icon class="deny-icon"><Lock /></el-icon>
      <h3>无权查看该员工主页</h3>
      <p>该员工不在公开榜单（Top 5 / 后 5）中，仅本人、上级或管理员可查看。</p>
      <el-button type="primary" @click="$router.push('/dashboard')">返回看板</el-button>
    </div>

    <template v-if="!loading && allowed">
      <!-- 头部信息 -->
      <div class="glass-card profile-header fade-up">
        <div class="avatar">{{ emp.name?.slice(0, 1) }}</div>
        <div class="header-info">
          <div class="hi-name">
            {{ emp.name }}
            <el-tag v-if="rankBadge" :type="rankBadge.type" effect="dark" size="small" round>{{ rankBadge.label }}</el-tag>
          </div>
          <div class="hi-meta">
            <span><el-icon><User /></el-icon> {{ emp.employeeId }}</span>
            <span><el-icon><OfficeBuilding /></el-icon> {{ emp.dept }}</span>
            <span v-if="emp.position"><el-icon><Briefcase /></el-icon> {{ emp.position }}</span>
          </div>
        </div>
        <div class="header-rank" v-if="rankInfo">
          <div class="hr-label">考勤排名</div>
          <div class="hr-value">第 {{ rankInfo.rank }} / {{ rankInfo.total }} 名</div>
          <div class="hr-score">异常分 {{ rankInfo.score }}</div>
        </div>
      </div>

      <!-- 热力图 -->
      <div class="glass-card heatmap-card fade-up">
        <AttendanceHeatmap :records="empRecords" :leaves="empLeaves" :calendar="calendar" />
      </div>

      <!-- 个人 KPI -->
      <div class="kpi-grid fade-up">
        <div class="kpi-card" v-for="k in kpis" :key="k.label" :style="{ '--accent': k.color }">
          <div class="kpi-value">{{ k.value }}<span class="kpi-unit">{{ k.unit }}</span></div>
          <div class="kpi-label">{{ k.label }}</div>
        </div>
      </div>

      <!-- 近期记录 -->
      <div class="glass-card records-card fade-up">
        <div class="card-title">
          <el-icon><Document /></el-icon>
          <span>考勤记录</span>
        </div>
        <el-table :data="empRecords" border size="small" max-height="400">
          <el-table-column prop="date" label="日期" width="120" />
          <el-table-column label="上班打卡" width="100">
            <template #default="{ row }">
              <span :class="{ miss: !row.checkIn }">{{ row.checkIn || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="下班打卡" width="100">
            <template #default="{ row }">
              <span :class="{ miss: !row.checkOut }">{{ row.checkOut || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="STATUS_META[row.status]?.type" effect="light" size="small">
                {{ STATUS_META[row.status]?.label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="迟到(分)" width="90" align="center">
            <template #default="{ row }">
              <span :class="{ warn: row.lateMinutes > 0 }">{{ row.lateMinutes || 0 }}</span>
            </template>
          </el-table-column>
          <el-table-column label="早退(分)" width="90" align="center">
            <template #default="{ row }">
              <span :class="{ warn: row.earlyMinutes > 0 }">{{ row.earlyMinutes || 0 }}</span>
            </template>
          </el-table-column>
          <el-table-column label="加班(分)" width="90" align="center">
            <template #default="{ row }">
              <span :class="{ ot: row.overtimeMinutes > 0 }">{{ row.overtimeMinutes || 0 }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft, Lock, User, OfficeBuilding, Briefcase, Grid, Document
} from '@element-plus/icons-vue'
import request from '../api/request'
import { useAuthStore } from '../stores/auth'
import { useRulesStore } from '../stores/rules'
import { calcAll, summarize, STATUS_META } from '../utils/attendance'
import { computeRanking, canViewProfile } from '../utils/ranking'
import AttendanceHeatmap from '../components/AttendanceHeatmap.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const rulesStore = useRulesStore()

const loading = ref(true)
const allowed = ref(false)
const employees = ref([])
const records = ref([])
const leaves = ref([])
const appeals = ref([])
const calendar = ref([])
const ranking = ref({ ranked: [], top5: [], bottom5: [] })

const targetId = computed(() => route.params.employeeId)

const emp = computed(() => {
  return employees.value.find((e) => e.employeeId === targetId.value) || { name: '', employeeId: targetId.value, dept: '', position: '' }
})

// 已通过申诉的考勤记录ID集合
const approvedAppealIds = computed(() =>
  appeals.value.filter((a) => a.status === 'approved').map((a) => a.recordId)
)

const empRecords = computed(() => {
  const rules = rulesStore.rules
  const empRecs = records.value.filter((r) => r.employeeId === targetId.value)
  return calcAll(empRecs, rules, leaves.value, approvedAppealIds.value)
})

const empLeaves = computed(() => {
  return leaves.value.filter((l) => l.employeeId === targetId.value)
})

const summaryData = computed(() => summarize(empRecords.value))

const kpis = computed(() => [
  { label: '出勤率', value: summaryData.value.attendanceRate, unit: '%', color: '#1677ff' },
  { label: '迟到次数', value: summaryData.value.lateCount, unit: '次', color: '#faad14' },
  { label: '早退次数', value: summaryData.value.earlyCount, unit: '次', color: '#fa8c16' },
  { label: '缺勤次数', value: summaryData.value.absent, unit: '次', color: '#ef4444' },
  { label: '累计加班', value: summaryData.value.overtimeHours, unit: '小时', color: '#16a34a' }
])

// 排名信息
const rankInfo = computed(() => {
  const idx = ranking.value.ranked.findIndex((e) => e.employeeId === targetId.value)
  if (idx < 0) return null
  return {
    rank: idx + 1,
    total: ranking.value.ranked.length,
    score: ranking.value.ranked[idx].anomalyScore
  }
})

// 公开榜单标记
const rankBadge = computed(() => {
  const inTop5 = ranking.value.top5.some((e) => e.employeeId === targetId.value)
  const inBottom5 = ranking.value.bottom5.some((e) => e.employeeId === targetId.value)
  if (inTop5) return { label: '考勤之星 Top 5', type: 'success' }
  if (inBottom5) return { label: '待改进 后 5', type: 'danger' }
  return null
})

onMounted(async () => {
  loading.value = true
  try {
    await rulesStore.load()
    const [empRes, recRes, lvRes, appealRes, calRes] = await Promise.all([
      request.get('/employees'),
      request.get('/attendanceRecords'),
      request.get('/leaveRecords'),
      request.get('/appeals'),
      request.get('/workCalendar')
    ])
    employees.value = empRes.data
    records.value = recRes.data
    leaves.value = lvRes.data
    appeals.value = appealRes.data
    calendar.value = calRes.data
    ranking.value = computeRanking(records.value, employees.value, rulesStore.rules)

    // 检查可见性
    const target = employees.value.find((e) => e.employeeId === targetId.value)
    const targetDept = target?.dept || ''
    allowed.value = canViewProfile(auth, targetId.value, targetDept, ranking.value)
    if (!allowed.value) {
      ElMessage.warning('您无权查看该员工主页')
    }
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.back-bar {
  margin-bottom: 12px;
}

.deny-card {
  text-align: center;
  padding: 60px 20px;
}
.deny-icon {
  font-size: 56px;
  color: var(--text-2, #9ca3af);
  margin-bottom: 16px;
}
.deny-card h3 {
  margin: 0 0 8px;
  font-size: 20px;
}
.deny-card p {
  color: var(--text-2, #6b7280);
  margin: 0 0 24px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  margin-bottom: 20px;
}
.avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  font-size: 30px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.3);
}
.header-info {
  flex: 1;
}
.hi-name {
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.hi-meta {
  display: flex;
  gap: 18px;
  color: var(--text-2, #6b7280);
  font-size: 13px;
}
.hi-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}
.header-rank {
  text-align: right;
  padding-left: 20px;
  border-left: 1px solid var(--border, #e5e7eb);
}
.hr-label {
  font-size: 12px;
  color: var(--text-2, #9ca3af);
}
.hr-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--brand, #1677ff);
  margin: 2px 0;
}
.hr-score {
  font-size: 12px;
  color: var(--text-2, #6b7280);
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 16px;
}
.card-title .el-icon {
  color: var(--brand, #1677ff);
}
.card-sub {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-2, #9ca3af);
}

.heatmap-card {
  margin-bottom: 20px;
  overflow-x: auto;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
@media (max-width: 1100px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
.kpi-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  padding: 18px 20px;
  border-left: 4px solid var(--accent);
}
.kpi-value {
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
}
.kpi-unit {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2, #6b7280);
  margin-left: 4px;
}
.kpi-label {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-2, #6b7280);
}

.records-card {
  padding: 20px;
}
.miss {
  color: #ef4444;
  font-weight: 600;
}
.warn {
  color: #d97706;
  font-weight: 600;
}
.ot {
  color: #1677ff;
  font-weight: 600;
}
</style>
