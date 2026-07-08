<template>
  <div class="page appeals-page" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">{{ pageTitle }}</h2>
      <p class="page-desc">{{ pageDesc }}</p>
      <el-button
        v-if="auth.role === 'employee'"
        type="primary"
        :icon="Plus"
        style="margin-top: 12px"
        @click="submitDialog.visible = true; prepareSubmitForm()"
      >发起申诉</el-button>
    </div>

    <!-- 统计卡片 -->
    <div class="stat-row fade-up" v-if="auth.role !== 'employee'">
      <div class="stat-card pending">
        <div class="stat-num">{{ stats.pending }}</div>
        <div class="stat-label">待审核</div>
      </div>
      <div class="stat-card approved">
        <div class="stat-num">{{ stats.approved }}</div>
        <div class="stat-label">已通过</div>
      </div>
      <div class="stat-card rejected">
        <div class="stat-num">{{ stats.rejected }}</div>
        <div class="stat-label">已驳回</div>
      </div>
    </div>

    <div class="glass-card filter-bar fade-up">
      <el-radio-group v-model="statusFilter" size="default" @change="loadAppeals">
        <el-radio-button label="">全部</el-radio-button>
        <el-radio-button label="pending">待处理</el-radio-button>
        <el-radio-button label="approved">已通过</el-radio-button>
        <el-radio-button label="rejected">已驳回</el-radio-button>
      </el-radio-group>
    </div>

    <div class="glass-card fade-up">
      <el-empty v-if="filteredAppeals.length === 0" :description="emptyDesc" />
      <template v-else>
        <el-table :data="filteredAppeals" border size="default" max-height="600">
          <el-table-column type="index" label="#" width="55" align="center" />
          <el-table-column prop="employeeId" label="工号" width="90" v-if="auth.role !== 'employee'" />
          <el-table-column label="员工姓名" width="110" v-if="auth.role !== 'employee'">
            <template #default="{ row }">{{ empMap[row.employeeId]?.name || row.employeeId }}</template>
          </el-table-column>
          <el-table-column label="申诉记录" width="200">
            <template #default="{ row }">
              <div>{{ row.recordDate || '—' }}</div>
              <el-tag size="small" :type="STATUS_META[row.recordStatus]?.type" effect="light">
                {{ STATUS_META[row.recordStatus]?.label || row.recordStatus || '异常' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="reason" label="申诉原因" min-width="220" show-overflow-tooltip />
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="statusMeta[row.status]?.type" size="small" effect="dark">{{ statusMeta[row.status]?.label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="审核意见" min-width="180" show-overflow-tooltip v-if="auth.role !== 'employee' || statusFilter !== 'pending'">
            <template #default="{ row }">
              <template v-if="row.status === 'pending'">
                <span style="color: #c0c4cc">待审核</span>
              </template>
              <template v-else>
                <div>{{ row.reviewNote || '（无意见）' }}</div>
                <div style="font-size: 12px; color: #909399; margin-top: 4px">审核人：{{ row.reviewer }}</div>
              </template>
            </template>
          </el-table-column>
          <el-table-column label="提交时间" width="165">
            <template #default="{ row }">{{ (row.createdAt || '').slice(0, 19) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="160" align="center" v-if="auth.role === 'admin' || auth.role === 'manager'">
            <template #default="{ row }">
              <template v-if="row.status === 'pending'">
                <el-button type="success" link size="small" @click="review(row, 'approved')">通过</el-button>
                <el-button type="danger" link size="small" @click="review(row, 'rejected')">驳回</el-button>
              </template>
              <span v-else style="color: var(--text-2); font-size: 12px">已处理</span>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </div>

    <!-- 发起申诉对话框（员工端） -->
    <el-dialog v-model="submitDialog.visible" title="发起考勤申诉" width="520px">
      <el-form :model="submitForm" label-width="90px">
        <el-form-item label="申诉日期">
          <el-select v-model="submitForm.recordId" placeholder="请选择要申诉的异常记录" style="width: 100%" filterable>
            <el-option
              v-for="rec in myExceptionRecords"
              :key="rec.id"
              :label="`${rec.date} ${STATUS_META[rec.status]?.label || rec.status}（已有${rec.appealed ? '申诉' : '无'}）`"
              :value="rec.id"
              :disabled="rec.appealed"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="申诉原因">
          <el-input
            v-model="submitForm.reason"
            type="textarea"
            :rows="4"
            placeholder="请说明申诉理由，如：忘记打卡、设备故障、外出办公等"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="submitDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="submitDialog.saving" @click="submitAppeal">提交申诉</el-button>
      </template>
    </el-dialog>

    <!-- 申诉审核对话框 -->
    <el-dialog v-model="reviewDialog.visible" :title="reviewDialog.action === 'approved' ? '通过申诉' : '驳回申诉'" width="480px">
      <el-form :model="reviewForm" label-width="80px">
        <el-form-item label="处理意见">
          <el-input v-model="reviewForm.comment" type="textarea" :rows="4" placeholder="请输入处理意见（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewDialog.visible = false">取消</el-button>
        <el-button :type="reviewDialog.action === 'approved' ? 'success' : 'danger'" :loading="reviewDialog.saving" @click="submitReview">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import request from '../api/request'
import { useAuthStore } from '../stores/auth'
import { useRulesStore } from '../stores/rules'
import { STATUS_META, calcAll } from '../utils/attendance'

const auth = useAuthStore()
const rulesStore = useRulesStore()
const loading = ref(false)
const appeals = ref([])
const employees = ref([])
const myRecords = ref([])
const myAppeals = ref([])
const statusFilter = ref('')

const pageTitle = computed(() => {
  if (auth.role === 'employee') return '我的考勤申诉'
  return '考勤申诉管理'
})
const pageDesc = computed(() => {
  if (auth.role === 'employee') return '对异常考勤记录发起申诉，等待审核'
  return '员工申诉记录审核与处理'
})

const emptyDesc = computed(() => {
  if (auth.role === 'employee') return '暂无申诉记录，遇到异常考勤可点击「发起申诉」'
  return '暂无申诉记录'
})

const statusMeta = {
  pending: { label: '待审核', type: 'warning' },
  approved: { label: '已通过', type: 'success' },
  rejected: { label: '已驳回', type: 'danger' }
}

const empMap = computed(() => {
  const m = {}
  employees.value.forEach((e) => { m[e.employeeId] = e })
  return m
})

const stats = computed(() => {
  const s = { pending: 0, approved: 0, rejected: 0 }
  appeals.value.forEach((a) => { if (s[a.status] !== undefined) s[a.status]++ })
  return s
})

const scopedAppeals = computed(() => {
  if (auth.role === 'admin') return appeals.value
  if (auth.role === 'manager') {
    return appeals.value.filter((a) => empMap.value[a.employeeId]?.dept === auth.dept)
  }
  return appeals.value.filter((a) => a.employeeId === auth.employeeId)
})

const filteredAppeals = computed(() => {
  if (!statusFilter.value) return scopedAppeals.value
  return scopedAppeals.value.filter((a) => a.status === statusFilter.value)
})

const myExceptionRecords = computed(() => {
  const appealedIds = new Set(myAppeals.value.filter((a) => a.status === 'pending').map((a) => a.recordId))
  const rules = rulesStore.rules
  const calc = calcAll(myRecords.value, rules)
  return calc
    .filter((r) => ['late', 'early', 'missing', 'absent'].includes(r.status))
    .map((r) => ({ ...r, appealed: appealedIds.has(r.id) }))
    .sort((a, b) => b.date.localeCompare(a.date))
})

async function loadAppeals() {
  loading.value = true
  try {
    const params = {}
    if (auth.role === 'employee') params.employeeId = auth.employeeId
    const { data } = await request.get('/appeals', { params })
    appeals.value = data
    myAppeals.value = data
  } finally {
    loading.value = false
  }
}

async function loadMyRecords() {
  if (auth.role !== 'employee') return
  const { data } = await request.get('/attendanceRecords', {
    params: { employeeId: auth.employeeId }
  })
  myRecords.value = data
}

const submitDialog = reactive({ visible: false, saving: false })
const submitForm = reactive({ recordId: null, reason: '' })

function prepareSubmitForm() {
  submitForm.recordId = null
  submitForm.reason = ''
  loadMyRecords().then(() => {
    nextTick(() => {
      const presetId = sessionStorage.getItem('appeal_record_id')
      if (presetId) {
        const exists = myExceptionRecords.value.find((r) => r.id === Number(presetId) || r.id === presetId)
        if (exists && !exists.appealed) {
          submitForm.recordId = exists.id
        }
        sessionStorage.removeItem('appeal_record_id')
      }
    })
  })
}

async function submitAppeal() {
  if (!submitForm.recordId) return ElMessage.warning('请选择要申诉的记录')
  if (!submitForm.reason.trim()) return ElMessage.warning('请填写申诉原因')
  submitDialog.saving = true
  try {
    await request.post('/appeals', {
      recordId: submitForm.recordId,
      employeeId: auth.employeeId,
      reason: submitForm.reason.trim()
    })
    ElMessage.success('申诉已提交，请等待审核')
    submitDialog.visible = false
    await loadAppeals()
  } catch (e) {
    // 拦截器提示
  } finally {
    submitDialog.saving = false
  }
}

const reviewDialog = reactive({ visible: false, saving: false, action: 'approved', row: null })
const reviewForm = reactive({ comment: '' })

function review(row, action) {
  reviewDialog.row = row
  reviewDialog.action = action
  reviewForm.comment = ''
  reviewDialog.visible = true
}

async function submitReview() {
  reviewDialog.saving = true
  try {
    await request.patch(`/appeals/${reviewDialog.row.id}`, {
      status: reviewDialog.action,
      reviewNote: reviewForm.comment,
      reviewer: auth.name
    })
    ElMessage.success(reviewDialog.action === 'approved' ? '申诉已通过' : '申诉已驳回')
    reviewDialog.visible = false
    await loadAppeals()
  } catch (e) { /* 拦截器提示 */ }
  finally {
    reviewDialog.saving = false
  }
}

onMounted(async () => {
  await rulesStore.load()
  const [{ data: empData }] = await Promise.all([request.get('/employees')])
  employees.value = empData
  await loadAppeals()
  if (auth.role === 'employee') {
    await loadMyRecords()
    const presetId = sessionStorage.getItem('appeal_record_id')
    if (presetId) {
      submitDialog.visible = true
      nextTick(() => {
        const exists = myExceptionRecords.value.find((r) => r.id === Number(presetId) || r.id === presetId)
        if (exists && !exists.appealed) {
          submitForm.recordId = exists.id
        }
        sessionStorage.removeItem('appeal_record_id')
      })
    }
  }
})
</script>

<style scoped>
.stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.stat-card {
  background: #fff;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 20px;
  text-align: center;
}
.stat-card.pending { border-top: 3px solid #faad14; }
.stat-card.approved { border-top: 3px solid #52c41a; }
.stat-card.rejected { border-top: 3px solid #ff4d4f; }
.stat-num {
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
}
.pending .stat-num { color: #faad14; }
.approved .stat-num { color: #52c41a; }
.rejected .stat-num { color: #ff4d4f; }
.stat-label {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-2);
}

.filter-bar {
  margin-bottom: 16px;
  padding: 14px 20px;
}
.glass-card {
  padding: 20px;
  margin-bottom: 20px;
}
.page-header {
  margin-bottom: 20px;
}
.page-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 6px;
}
.page-desc {
  font-size: 13px;
  color: var(--text-2);
  margin: 0;
}
</style>
