<template>
  <div class="page appeals-page" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">{{ pageTitle }}</h2>
      <p class="page-desc">{{ pageDesc }}</p>
    </div>

    <!-- 员工端：我的异常记录（可直接申诉） -->
    <template v-if="auth.role === 'employee'">
      <div class="glass-card fade-up">
        <div class="section-title">
          <el-icon><WarningFilled /></el-icon>
          <span>我的异常记录</span>
          <el-tag type="danger" size="small" effect="light" style="margin-left: 8px">{{ myExceptionRecords.length }} 条</el-tag>
        </div>
        <el-empty v-if="myExceptionRecords.length === 0" description="暂无异常考勤，继续保持！" />
        <el-table v-else :data="myExceptionRecords" border size="default" max-height="420">
          <el-table-column type="index" label="#" width="55" align="center" />
          <el-table-column prop="date" label="日期" width="120" />
          <el-table-column label="异常类型" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="STATUS_META[row.status]?.type" effect="dark" size="small">
                {{ STATUS_META[row.status]?.label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="打卡情况" min-width="200">
            <template #default="{ row }">
              <span v-if="!row.checkIn && !row.checkOut" style="color:#ff4d4f">无打卡记录</span>
              <span v-else>
                上班：<span :class="{ miss: !row.checkIn }">{{ row.checkIn || '缺卡' }}</span>
                ｜ 下班：<span :class="{ miss: !row.checkOut }">{{ row.checkOut || '缺卡' }}</span>
              </span>
              <span v-if="row.lateMinutes" style="color:#faad14; margin-left:6px">迟到{{ row.lateMinutes }}分</span>
              <span v-if="row.earlyMinutes" style="color:#faad14; margin-left:6px">早退{{ row.earlyMinutes }}分</span>
            </template>
          </el-table-column>
          <el-table-column label="申诉状态" width="120" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.appealStatus === 'pending'" type="warning" effect="dark" size="small">待审核</el-tag>
              <el-tag v-else-if="row.appealStatus === 'approved'" type="success" effect="dark" size="small">已通过</el-tag>
              <el-tag v-else-if="row.appealStatus === 'rejected'" type="danger" effect="dark" size="small">已驳回</el-tag>
              <span v-else style="color:#c0c4cc">未申诉</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center">
            <template #default="{ row }">
              <el-button
                v-if="!row.appealStatus || row.appealStatus === 'rejected'"
                type="primary"
                link
                size="small"
                @click="openAppealDialog(row)"
              >{{ row.appealStatus === 'rejected' ? '重新申诉' : '申诉' }}</el-button>
              <el-button
                v-else-if="row.appealStatus === 'pending'"
                type="danger"
                link
                size="small"
                @click="confirmRevoke(row.appealId)"
              >撤销申诉</el-button>
              <span v-else style="color:#909399; font-size:12px">已处理</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 员工端：我的申诉历史 -->
      <div class="glass-card fade-up" style="margin-top: 20px">
        <div class="section-title">
          <el-icon><Document /></el-icon>
          <span>我的申诉记录</span>
        </div>
        <el-radio-group v-model="statusFilter" size="small" style="margin-bottom: 12px">
          <el-radio-button label="">全部</el-radio-button>
          <el-radio-button label="pending">待审核</el-radio-button>
          <el-radio-button label="approved">已通过</el-radio-button>
          <el-radio-button label="rejected">已驳回</el-radio-button>
        </el-radio-group>
        <el-empty v-if="filteredAppeals.length === 0" description="暂无申诉记录" />
        <el-table v-else :data="filteredAppeals" border size="small">
          <el-table-column type="index" label="#" width="55" align="center" />
          <el-table-column label="异常日期" width="120">
            <template #default="{ row }">{{ (row.recordDate || '').slice(0, 10) }}</template>
          </el-table-column>
          <el-table-column label="异常类型" width="100" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="STATUS_META[row.recordStatus]?.type" effect="light">
                {{ STATUS_META[row.recordStatus]?.label || '异常' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="reason" label="申诉原因" min-width="200" show-overflow-tooltip />
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="statusMeta[row.status]?.type" size="small" effect="dark">{{ statusMeta[row.status]?.label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="审核意见" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">
              <template v-if="row.status === 'pending'"><span style="color:#c0c4cc">待审核</span></template>
              <template v-else>
                <div>{{ row.reviewNote || '（无意见）' }}</div>
                <div style="font-size:12px;color:#909399;margin-top:4px">审核人：{{ row.reviewer }}</div>
              </template>
            </template>
          </el-table-column>
          <el-table-column label="提交时间" width="165">
            <template #default="{ row }">{{ (row.createdAt || '').slice(0, 19) }}</template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- 管理端：统计卡片 + 申诉列表 -->
    <template v-else>
      <div class="stat-row fade-up">
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
        <el-empty v-if="filteredAppeals.length === 0" description="暂无申诉记录" />
        <template v-else>
          <el-table :data="filteredAppeals" border size="default" max-height="600">
            <el-table-column type="index" label="#" width="55" align="center" />
            <el-table-column prop="employeeId" label="工号" width="90" />
            <el-table-column label="员工姓名" width="110">
              <template #default="{ row }">{{ empMap[row.employeeId]?.name || row.employeeId }}</template>
            </el-table-column>
            <el-table-column label="异常日期" width="130">
              <template #default="{ row }">
                <div>{{ (row.recordDate || '').slice(0, 10) }}</div>
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
            <el-table-column label="审核意见" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                <template v-if="row.status === 'pending'"><span style="color:#c0c4cc">待审核</span></template>
                <template v-else>
                  <div>{{ row.reviewNote || '（无意见）' }}</div>
                  <div style="font-size:12px;color:#909399;margin-top:4px">审核人：{{ row.reviewer }}</div>
                </template>
              </template>
            </el-table-column>
            <el-table-column label="提交时间" width="165">
              <template #default="{ row }">{{ (row.createdAt || '').slice(0, 19) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="160" align="center">
              <template #default="{ row }">
                <template v-if="row.status === 'pending'">
                  <el-button type="success" link size="small" @click="review(row, 'approved')">通过</el-button>
                  <el-button type="danger" link size="small" @click="review(row, 'rejected')">驳回</el-button>
                </template>
                <span v-else style="color:var(--text-2);font-size:12px">已处理</span>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </div>
    </template>

    <!-- 申诉填写对话框 -->
    <el-dialog v-model="submitDialog.visible" title="发起考勤申诉" width="500px">
      <el-form :model="submitForm" label-width="90px">
        <el-form-item label="申诉日期">
          <el-tag size="large">{{ submitForm.recordDate }}</el-tag>
          <el-tag size="large" :type="STATUS_META[submitForm.recordStatus]?.type" effect="dark" style="margin-left:8px">
            {{ STATUS_META[submitForm.recordStatus]?.label }}
          </el-tag>
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { WarningFilled, Document } from '@element-plus/icons-vue'
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
const statusFilter = ref('')

const pageTitle = computed(() => {
  if (auth.role === 'employee') return '我的考勤申诉'
  return '考勤申诉管理'
})
const pageDesc = computed(() => {
  if (auth.role === 'employee') return '对异常考勤记录直接发起申诉，查看审核进度与结果'
  return '员工申诉记录审核与处理'
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

const appealRecordMap = computed(() => {
  const m = {}
  appeals.value.forEach((a) => {
    if (a.recordId && (a.status === 'pending' || !m[a.recordId])) {
      m[a.recordId] = { status: a.status, id: a.id }
    }
  })
  return m
})

const myExceptionRecords = computed(() => {
  const rules = rulesStore.rules
  const calc = calcAll(myRecords.value, rules)
  return calc
    .filter((r) => ['late', 'early', 'missing', 'absent'].includes(r.status))
    .map((r) => ({
      ...r,
      appealStatus: appealRecordMap.value[r.id]?.status || null,
      appealId: appealRecordMap.value[r.id]?.id || null
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
})

async function loadAppeals() {
  loading.value = true
  try {
    const params = {}
    if (auth.role === 'employee') params.employeeId = auth.employeeId
    const { data } = await request.get('/appeals', { params })
    appeals.value = data
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
const submitForm = reactive({ recordId: null, recordDate: '', recordStatus: '', reason: '' })

function openAppealDialog(row) {
  submitForm.recordId = row.id
  submitForm.recordDate = row.date
  submitForm.recordStatus = row.status
  submitForm.reason = ''
  submitDialog.visible = true
}

async function submitAppeal() {
  if (!submitForm.reason.trim()) return ElMessage.warning('请填写申诉原因')
  submitDialog.saving = true
  try {
    await request.post('/appeals', {
      recordId: submitForm.recordId,
      employeeId: auth.employeeId,
      reason: submitForm.reason.trim(),
      recordStatus: submitForm.recordStatus
    })
    ElMessage.success('申诉已提交，请等待审核')
    submitDialog.visible = false
    await Promise.all([loadAppeals(), loadMyRecords()])
  } catch (e) {
    // 拦截器提示
  } finally {
    submitDialog.saving = false
  }
}

async function confirmRevoke(appealId) {
  if (!appealId) return
  try {
    await ElMessageBox.confirm(
      '确定要撤销这条申诉吗？撤销后可以重新提交。',
      '撤销申诉',
      { confirmButtonText: '确认撤销', cancelButtonText: '取消', type: 'warning', confirmButtonClass: 'el-button--danger' }
    )
    await request.delete(`/appeals/${appealId}`)
    ElMessage.success('申诉已撤销')
    await Promise.all([loadAppeals(), loadMyRecords()])
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e?.response?.data?.message || '撤销失败')
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
      nextTick(() => {
        const target = myExceptionRecords.value.find((r) => r.id === Number(presetId) || r.id === presetId)
        if (target && !target.appealStatus) openAppealDialog(target)
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
  margin-bottom: 0;
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
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 14px;
}
.miss {
  color: #ff4d4f;
  font-weight: 600;
}
</style>
