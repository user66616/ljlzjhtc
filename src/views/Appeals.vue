<template>
  <div class="page appeals-page" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">考勤申诉管理</h2>
      <p class="page-desc">员工申诉记录审核与处理</p>
    </div>

    <div class="glass-card filter-bar fade-up">
      <el-radio-group v-model="statusFilter" size="small" @change="loadAppeals">
        <el-radio-button label="">全部</el-radio-button>
        <el-radio-button label="pending">待处理</el-radio-button>
        <el-radio-button label="approved">已通过</el-radio-button>
        <el-radio-button label="rejected">已驳回</el-radio-button>
      </el-radio-group>
    </div>

    <div class="glass-card fade-up">
      <el-table :data="filteredAppeals" border size="small" max-height="600">
        <el-table-column prop="id" label="ID" width="60" align="center" />
        <el-table-column prop="employeeId" label="工号" width="90" />
        <el-table-column label="员工姓名" width="100">
          <template #default="{ row }">{{ empMap[row.employeeId]?.name || row.employeeId }}</template>
        </el-table-column>
        <el-table-column label="申诉记录" min-width="180">
          <template #default="{ row }">
            <span>{{ row.recordDate || '—' }} </span>
            <el-tag size="small" :type="STATUS_META[row.recordStatus]?.type" effect="light">{{ STATUS_META[row.recordStatus]?.label || row.recordStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="申诉原因" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusMeta[row.status]?.type" size="small" effect="dark">{{ statusMeta[row.status]?.label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="160">
          <template #default="{ row }">{{ (row.createdAt || '').slice(0, 19) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" align="center" v-if="auth.role === 'admin' || auth.role === 'manager'">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button type="success" link size="small" @click="review(row, 'approved')">通过</el-button>
              <el-button type="danger" link size="small" @click="review(row, 'rejected')">驳回</el-button>
            </template>
            <span v-else style="color: var(--text-2); font-size: 12px">已处理</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 申诉审核对话框 -->
    <el-dialog v-model="reviewDialog.visible" :title="reviewDialog.action === 'approved' ? '通过申诉' : '驳回申诉'" width="480px">
      <el-form :model="reviewForm" label-width="80px">
        <el-form-item label="处理意见">
          <el-input v-model="reviewForm.comment" type="textarea" :rows="4" placeholder="请输入处理意见" />
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
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '../api/request'
import { useAuthStore } from '../stores/auth'
import { STATUS_META } from '../utils/attendance'

const auth = useAuthStore()
const loading = ref(false)
const appeals = ref([])
const employees = ref([])
const statusFilter = ref('')

const statusMeta = {
  pending: { label: '待处理', type: 'warning' },
  approved: { label: '已通过', type: 'success' },
  rejected: { label: '已驳回', type: 'danger' }
}

const empMap = computed(() => {
  const m = {}
  employees.value.forEach((e) => { m[e.employeeId] = e })
  return m
})

const filteredAppeals = computed(() => {
  if (!statusFilter.value) return appeals.value
  return appeals.value.filter((a) => a.status === statusFilter.value)
})

async function loadAppeals() {
  loading.value = true
  try {
    const { data } = await request.get('/appeals')
    appeals.value = data
  } finally {
    loading.value = false
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
  const [{ data: empData }] = await Promise.all([
    request.get('/employees')
  ])
  employees.value = empData
  await loadAppeals()
})
</script>

<style scoped>
.filter-bar {
  margin-bottom: 16px;
  padding: 12px 20px;
}
.glass-card {
  padding: 20px;
  margin-bottom: 20px;
}
</style>
