<template>
  <div class="page exceptions-page">
    <div class="page-header">
      <h2 class="page-title">异常记录</h2>
      <p class="page-desc">{{ scopeDesc }}</p>
    </div>

    <!-- 筛选区 -->
    <div class="glass-card filter-bar fade-up">
      <el-form :inline="true" :model="filters">
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="filters.dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item label="异常类型">
          <el-select v-model="filters.status" placeholder="全部异常" clearable style="width: 120px">
            <el-option label="迟到" value="late" />
            <el-option label="早退" value="early" />
            <el-option label="缺卡" value="missing" />
            <el-option label="缺勤" value="absent" />
          </el-select>
        </el-form-item>
        <el-form-item label="部门" v-if="auth.role === 'admin'">
          <el-select v-model="filters.dept" placeholder="全部部门" clearable style="width: 140px">
            <el-option v-for="d in deptOptions" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词" v-if="auth.role !== 'employee'">
          <el-input v-model="filters.keyword" placeholder="姓名/工号" clearable style="width: 140px" />
        </el-form-item>
        <el-form-item>
          <el-button :icon="RefreshLeft" @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 异常列表 -->
    <div class="glass-card table-card fade-up" v-loading="loading">
      <el-empty v-if="!loading && filtered.length === 0" description="暂无异常记录" />

      <template v-else>
        <el-table :data="paged" border stripe size="default" class="exceptions-table">
          <el-table-column type="index" label="#" width="60" align="center" />
          <el-table-column prop="employeeId" label="工号" min-width="110" />
          <el-table-column prop="name" label="姓名" min-width="110" />
          <el-table-column prop="dept" label="部门" min-width="130" />
          <el-table-column prop="date" label="日期" min-width="130" />
          <el-table-column label="异常类型" min-width="120" align="center">
            <template #default="{ row }">
              <el-tag :type="STATUS_META[row.status]?.type" effect="light" size="small">
                {{ STATUS_META[row.status]?.label }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-bar">
          <el-pagination v-model:current-page="page.current" v-model:page-size="page.size"
            :page-sizes="[10, 20]" :total="filtered.length"
            layout="total, sizes, prev, pager, next, jumper" background />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { RefreshLeft } from '@element-plus/icons-vue'
import request from '../api/request'
import { useAuthStore } from '../stores/auth'
import { useRulesStore } from '../stores/rules'
import { calcAll, STATUS_META } from '../utils/attendance'

const auth = useAuthStore()
const rulesStore = useRulesStore()

const loading = ref(false)
const employees = ref([])
const records = ref([])
const appeals = ref([])
const leaves = ref([])

const filters = reactive({ status: '', dept: '', dateRange: null, keyword: '' })
const page = reactive({ current: 1, size: 10 })

const scopeDesc = computed(() => {
  if (auth.role === 'admin') return '全公司考勤异常记录查询'
  if (auth.role === 'manager') return `本部门（${auth.dept}）考勤异常记录查询`
  return '个人考勤异常记录查询'
})

const deptOptions = computed(() => {
  const set = new Set(employees.value.map((e) => e.dept))
  return Array.from(set)
})

const empMap = computed(() => {
  const m = {}
  employees.value.forEach((e) => { m[e.employeeId] = e })
  return m
})

// 已通过申诉的考勤记录ID集合
const approvedAppealIds = computed(() =>
  appeals.value.filter((a) => a.status === 'approved').map((a) => a.recordId)
)

const computedRecords = computed(() => {
  const rules = rulesStore.rules
  const calc = calcAll(records.value, rules, leaves.value, approvedAppealIds.value)
  const map = empMap.value
  return calc.map((r) => {
    const emp = map[r.employeeId] || {}
    return {
      ...r,
      name: emp.name || '未知',
      dept: emp.dept || '未知'
    }
  })
})

// 仅异常记录
const exceptionRecords = computed(() => {
  return computedRecords.value.filter((r) =>
    ['late', 'early', 'missing', 'absent'].includes(r.status)
  )
})

// 角色范围过滤
const scoped = computed(() => {
  if (auth.role === 'admin') return exceptionRecords.value
  if (auth.role === 'manager') return exceptionRecords.value.filter((r) => r.dept === auth.dept)
  return exceptionRecords.value.filter((r) => r.employeeId === auth.employeeId)
})

// 条件过滤
const filtered = computed(() => {
  return scoped.value.filter((r) => {
    if (filters.status && r.status !== filters.status) return false
    if (filters.dept && r.dept !== filters.dept) return false
    if (filters.dateRange && filters.dateRange.length === 2) {
      const [start, end] = filters.dateRange
      if (r.date < start || r.date > end) return false
    }
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase()
      if (!r.name.toLowerCase().includes(kw) && !r.employeeId.toLowerCase().includes(kw)) return false
    }
    return true
  })
})

const paged = computed(() => {
  const start = (page.current - 1) * page.size
  return filtered.value.slice(start, start + page.size)
})

onMounted(async () => {
  loading.value = true
  try {
    await rulesStore.load()
    const [empRes, recRes, appealRes, leaveRes] = await Promise.all([
      request.get('/employees'),
      request.get('/attendanceRecords'),
      request.get('/appeals'),
      request.get('/leaveRecords')
    ])
    employees.value = empRes.data
    records.value = recRes.data
    appeals.value = appealRes.data
    leaves.value = leaveRes.data
  } finally {
    loading.value = false
  }
})

watch(
  () => [filters.dateRange, filters.status, filters.dept, filters.keyword],
  () => { page.current = 1 }
)

function onReset() {
  filters.status = ''
  filters.dept = ''
  filters.dateRange = null
  filters.keyword = ''
  page.current = 1
}
</script>

<style scoped>
.filter-bar {
  margin-bottom: 16px;
  padding: 16px 20px;
}
.filter-form :deep(.el-form-item) {
  margin-bottom: 0;
  margin-right: 8px;
}

.table-card {
  padding: 16px 20px;
}

.exceptions-table :deep(th) {
  font-weight: 600;
  background: #f8fafc;
  color: var(--text-1);
  height: 44px;
}
.exceptions-table :deep(td) {
  height: 48px;
  padding: 10px 12px;
}
.exceptions-table :deep(.el-table__cell) {
  font-size: 14px;
}
.exceptions-table :deep(.el-tag) {
  font-size: 13px;
  padding: 0 10px;
  height: 26px;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
