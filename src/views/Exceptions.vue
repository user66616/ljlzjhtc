<template>
  <div class="page exceptions-page">
    <div class="page-header">
      <h2 class="page-title">异常处理</h2>
      <p class="page-desc">{{ scopeDesc }}</p>
    </div>

    <!-- 统计 -->
    <div class="stat-row fade-up">
      <div class="stat-card pending">
        <div class="stat-num">{{ pendingCount }}</div>
        <div class="stat-label">待处理</div>
      </div>
      <div class="stat-card handled">
        <div class="stat-num">{{ handledCount }}</div>
        <div class="stat-label">已处理</div>
      </div>
      <div class="stat-card total">
        <div class="stat-num">{{ exceptionRecords.length }}</div>
        <div class="stat-label">异常总数</div>
      </div>
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
        <el-form-item label="处理状态">
          <el-select v-model="filters.handleStatus" placeholder="全部" clearable style="width: 120px">
            <el-option label="待处理" value="pending" />
            <el-option label="已处理" value="handled" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="姓名/工号" clearable style="width: 140px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="onSearch">查询</el-button>
          <el-button :icon="RefreshLeft" @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 异常列表 -->
    <div class="glass-card table-card fade-up" v-loading="loading">
      <el-empty v-if="!loading && filtered.length === 0" description="暂无异常记录" />

      <template v-else>
        <el-table :data="paged" border stripe size="default">
          <el-table-column type="index" label="#" width="50" align="center" />
          <el-table-column prop="employeeId" label="工号" width="90" />
          <el-table-column prop="name" label="姓名" width="90" />
          <el-table-column prop="dept" label="部门" width="100" />
          <el-table-column prop="date" label="日期" width="120" />
          <el-table-column label="异常类型" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="STATUS_META[row.status]?.type" effect="light" size="small">
                {{ STATUS_META[row.status]?.label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="处理状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.handleStatus === 'handled' ? 'success' : 'warning'" effect="dark" size="small"
                style="cursor: pointer" @click="toggleStatus(row)">
                {{ row.handleStatus === 'handled' ? '已处理' : '待处理' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="处理备注" min-width="200">
            <template #default="{ row }">
              <span v-if="!row._editing" class="remark-text" @click="startEditRemark(row)">
                {{ row.remark || '点击添加备注...' }}
              </span>
              <div v-else class="remark-edit">
                <el-input v-model="row._remarkInput" size="small" placeholder="如：已补卡、事假抵扣" style="width: 180px"
                  @keyup.enter="saveRemark(row)" @keyup.esc="row._editing = false" />
                <el-button type="primary" size="small" @click="saveRemark(row)">保存</el-button>
                <el-button size="small" @click="row._editing = false">取消</el-button>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="toggleStatus(row)">
                {{ row.handleStatus === 'handled' ? '标记待处理' : '标记已处理' }}
              </el-button>
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
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, RefreshLeft } from '@element-plus/icons-vue'
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

const filters = reactive({ status: '', dept: '', handleStatus: '', dateRange: null, keyword: '' })
const page = reactive({ current: 1, size: 10 })

const scopeDesc = computed(() => {
  if (auth.role === 'admin') return '集中处理全公司考勤异常记录'
  if (auth.role === 'manager') return `处理本部门（${auth.dept}）考勤异常`
  return '查看个人考勤异常记录'
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
  const calc = calcAll(records.value, rules, [], approvedAppealIds.value)
  const map = empMap.value
  return calc.map((r) => {
    const emp = map[r.employeeId] || {}
    return {
      ...r,
      name: emp.name || '未知',
      dept: emp.dept || '未知',
      handleStatus: r.handleStatus || 'pending',
      remark: r.remark || '',
      _editing: false,
      _remarkInput: ''
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
    if (filters.handleStatus && r.handleStatus !== filters.handleStatus) return false
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

const pendingCount = computed(() => scoped.value.filter((r) => r.handleStatus === 'pending').length)
const handledCount = computed(() => scoped.value.filter((r) => r.handleStatus === 'handled').length)

onMounted(async () => {
  loading.value = true
  try {
    await rulesStore.load()
    const [empRes, recRes, appealRes] = await Promise.all([
      request.get('/employees'),
      request.get('/attendanceRecords'),
      request.get('/appeals')
    ])
    employees.value = empRes.data
    records.value = recRes.data
    appeals.value = appealRes.data
  } finally {
    loading.value = false
  }
})

function onSearch() { page.current = 1 }
function onReset() {
  filters.status = ''
  filters.dept = ''
  filters.handleStatus = ''
  filters.dateRange = null
  filters.keyword = ''
  page.current = 1
}

// P1-19 切换处理状态
async function toggleStatus(row) {
  const newStatus = row.handleStatus === 'handled' ? 'pending' : 'handled'
  try {
    const res = await request.patch(`/attendanceRecords/${row.id}`, { handleStatus: newStatus })
    row.handleStatus = res.data.handleStatus
    ElMessage.success(newStatus === 'handled' ? '已标记为已处理' : '已标记为待处理')
  } catch (e) {
    // 错误已由拦截器提示
  }
}

// P1-20 处理备注
function startEditRemark(row) {
  row._remarkInput = row.remark || ''
  row._editing = true
}

async function saveRemark(row) {
  try {
    const res = await request.patch(`/attendanceRecords/${row.id}`, { remark: row._remarkInput })
    row.remark = res.data.remark
    row._editing = false
    ElMessage.success('备注已保存')
  } catch (e) {
    // 错误已由拦截器提示
  }
}
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
.stat-card.handled { border-top: 3px solid #52c41a; }
.stat-card.total { border-top: 3px solid #1677ff; }
.stat-num {
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
}
.pending .stat-num { color: #faad14; }
.handled .stat-num { color: #52c41a; }
.total .stat-num { color: #1677ff; }
.stat-label {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-2);
}

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

.remark-text {
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
}
.remark-text:hover {
  color: var(--brand);
  text-decoration: underline;
}

.remark-edit {
  display: flex;
  gap: 6px;
  align-items: center;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
