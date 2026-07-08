<template>
  <div class="page records-page">
    <div class="page-header">
      <h2 class="page-title">考勤记录</h2>
      <p class="page-desc">{{ scopeDesc }}</p>
    </div>

    <!-- 筛选区 -->
    <div class="glass-card filter-bar fade-up">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="filters.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            :clearable="true"
            style="width: 240px"
          />
        </el-form-item>
        <el-form-item label="部门" v-if="auth.role !== 'employee'">
          <el-select v-model="filters.dept" placeholder="全部部门" clearable style="width: 140px">
            <el-option v-for="d in deptOptions" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input
            v-model="filters.keyword"
            placeholder="姓名 / 工号"
            clearable
            :prefix-icon="Search"
            style="width: 180px"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 130px">
            <el-option
              v-for="(meta, key) in STATUS_META"
              :key="key"
              :label="meta.label"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="onSearch">查询</el-button>
          <el-button :icon="RefreshLeft" @click="onReset">重置</el-button>
          <el-button type="success" plain :icon="Download" @click="onExport">导出 CSV</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 列表 -->
    <div class="glass-card table-card fade-up" v-loading="loading">
      <!-- 空状态 F-09-02 -->
      <el-empty v-if="!loading && filtered.length === 0" description="暂无符合条件的考勤记录">
        <el-button type="primary" @click="goImport" v-if="auth.role === 'admin'">去导入数据</el-button>
      </el-empty>

      <template v-else>
        <el-table :data="paged" border stripe size="default" class="records-table" @row-click="openDetail">
          <el-table-column type="index" label="#" width="55" align="center" />
          <el-table-column prop="employeeId" label="工号" width="90" sortable />
          <el-table-column prop="name" label="姓名" width="100" sortable />
          <el-table-column prop="dept" label="部门" width="100" sortable />
          <el-table-column prop="date" label="日期" width="120" sortable />
          <el-table-column prop="checkIn" label="上班打卡" width="100">
            <template #default="{ row }">
              <span :class="{ 'miss-punch': !row.checkIn }">{{ row.checkIn || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="checkOut" label="下班打卡" width="100">
            <template #default="{ row }">
              <span :class="{ 'miss-punch': !row.checkOut }">{{ row.checkOut || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="STATUS_META[row.status]?.type" effect="light" size="small">
                {{ STATUS_META[row.status]?.label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="lateMinutes" label="迟到(分)" width="100" align="center" sortable>
            <template #default="{ row }">
              <span :class="{ warn: row.lateMinutes > 0 }">{{ row.lateMinutes || 0 }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="earlyMinutes" label="早退(分)" width="100" align="center" sortable>
            <template #default="{ row }">
              <span :class="{ warn: row.earlyMinutes > 0 }">{{ row.earlyMinutes || 0 }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="overtimeMinutes" label="加班(分)" width="100" align="center" sortable>
            <template #default="{ row }">
              <span :class="{ ot: row.overtimeMinutes > 0 }">{{ row.overtimeMinutes || 0 }}</span>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-bar">
          <el-pagination
            v-model:current-page="page.current"
            v-model:page-size="page.size"
            :page-sizes="[10, 20]"
            :total="filtered.length"
            layout="total, sizes, prev, pager, next, jumper"
            background
          />
        </div>
      </template>
    </div>

    <!-- P1-07 记录详情抽屉 -->
    <el-drawer v-model="detail.show" title="考勤记录详情" size="420px" direction="rtl">
      <template v-if="detail.row">
        <div class="detail-section">
          <h4>基本信息</h4>
          <div class="detail-row"><span>工号</span><b>{{ detail.row.employeeId }}</b></div>
          <div class="detail-row"><span>姓名</span><b>{{ detail.row.name }}</b></div>
          <div class="detail-row"><span>部门</span><b>{{ detail.row.dept }}</b></div>
          <div class="detail-row"><span>日期</span><b>{{ detail.row.date }}</b></div>
        </div>
        <div class="detail-section">
          <h4>打卡信息</h4>
          <div class="detail-row"><span>上班打卡</span><b>{{ detail.row.checkIn || '未打卡' }}</b></div>
          <div class="detail-row"><span>下班打卡</span><b>{{ detail.row.checkOut || '未打卡' }}</b></div>
        </div>
        <div class="detail-section">
          <h4>状态计算明细</h4>
          <div class="detail-row">
            <span>考勤状态</span>
            <el-tag :type="STATUS_META[detail.row.status]?.type" effect="light" size="small">
              {{ STATUS_META[detail.row.status]?.label }}
            </el-tag>
          </div>
          <div class="detail-row"><span>迟到</span><b>{{ detail.row.lateMinutes || 0 }} 分钟</b></div>
          <div class="detail-row"><span>早退</span><b>{{ detail.row.earlyMinutes || 0 }} 分钟</b></div>
          <div class="detail-row"><span>加班</span><b>{{ detail.row.overtimeMinutes || 0 }} 分钟</b></div>
        </div>
        <div class="detail-section" v-if="detail.row.__calcTrace">
          <h4>判定过程</h4>
          <div class="calc-trace" v-for="(t, i) in detail.row.__calcTrace" :key="i">{{ t }}</div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, RefreshLeft, Download } from '@element-plus/icons-vue'
import request from '../api/request'
import { useAuthStore } from '../stores/auth'
import { useRulesStore } from '../stores/rules'
import { calcAll, STATUS_META } from '../utils/attendance'
import { toCSV, downloadCSV } from '../utils/csv'

const router = useRouter()
const auth = useAuthStore()
const rulesStore = useRulesStore()

const loading = ref(false)
const employees = ref([])
const records = ref([])

const filters = reactive({
  dateRange: null,
  dept: '',
  keyword: '',
  status: ''
})
const page = reactive({ current: 1, size: 10 })

const scopeDesc = computed(() => {
  if (auth.role === 'admin') return '查看全公司所有考勤记录'
  if (auth.role === 'manager') return `仅查看本部门（${auth.dept}）考勤记录`
  return '仅查看个人考勤记录'
})

const deptOptions = computed(() => {
  const set = new Set(employees.value.map((e) => e.dept))
  return Array.from(set)
})

// 员工 Map：employeeId -> employee
const empMap = computed(() => {
  const m = {}
  employees.value.forEach((e) => { m[e.employeeId] = e })
  return m
})

// 计算状态后的记录（附带员工信息）
const computedRecords = computed(() => {
  const rules = rulesStore.rules
  const calc = calcAll(records.value, rules)
  const map = empMap.value
  return calc.map((r) => {
    const emp = map[r.employeeId] || {}
    return { ...r, name: emp.name || '未知', dept: emp.dept || '未知' }
  })
})

// 角色范围过滤
const scopedRecords = computed(() => {
  if (auth.role === 'admin') return computedRecords.value
  if (auth.role === 'manager') {
    return computedRecords.value.filter((r) => r.dept === auth.dept)
  }
  return computedRecords.value.filter((r) => r.employeeId === auth.employeeId)
})

// 条件过滤
const filtered = computed(() => {
  return scopedRecords.value.filter((r) => {
    if (filters.dateRange && filters.dateRange.length === 2) {
      const [s, e] = filters.dateRange
      if (r.date < s || r.date > e) return false
    }
    if (filters.dept && r.dept !== filters.dept) return false
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase()
      if (!r.name.toLowerCase().includes(kw) && !r.employeeId.toLowerCase().includes(kw)) return false
    }
    if (filters.status && r.status !== filters.status) return false
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
    const [empRes, recRes] = await Promise.all([
      request.get('/employees'),
      request.get('/attendanceRecords')
    ])
    employees.value = empRes.data
    records.value = recRes.data
    // 按日期升序
    records.value.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  } finally {
    loading.value = false
  }
})

function onSearch() {
  page.current = 1
}
function onReset() {
  filters.dateRange = null
  filters.dept = ''
  filters.keyword = ''
  filters.status = ''
  page.current = 1
}

function onExport() {
  if (filtered.value.length === 0) {
    ElMessage.warning('当前筛选范围内无数据可导出')
    return
  }
  const fields = ['employeeId', 'name', 'dept', 'date', 'checkIn', 'checkOut', 'status', 'lateMinutes', 'earlyMinutes', 'overtimeMinutes']
  // 导出状态用中文标签
  const exportRows = filtered.value.map((r) => ({
    ...r,
    status: STATUS_META[r.status]?.label || r.status,
    checkIn: r.checkIn || '',
    checkOut: r.checkOut || ''
  }))
  const csv = toCSV(exportRows, fields)
  downloadCSV(`考勤记录_${new Date().toISOString().slice(0, 10)}.csv`, csv)
  ElMessage.success(`已导出 ${exportRows.length} 条记录`)
}

function goImport() {
  router.push('/import')
}

// P1-07 记录详情抽屉
const detail = reactive({ show: false, row: null })

function openDetail(row) {
  // 生成判定过程说明
  const trace = []
  const rules = rulesStore.rules
  if (!row.checkIn && !row.checkOut) {
    trace.push('无任何打卡记录 → 判定为缺勤')
  } else if (!row.checkIn || !row.checkOut) {
    trace.push(`仅${!row.checkIn ? '上班' : '下班'}打卡缺失 → 按缺卡策略处理`)
    trace.push(`当前策略：${rules.missingStrategy === 'absent' ? '缺卡当作缺勤' : '仅标记异常'}`)
  } else {
    trace.push(`上班打卡 ${row.checkIn}，迟到判定线 ${rules.lateAfter}`)
    if (row.isLate) trace.push(`晚到 ${row.lateMinutes} 分钟 → 迟到`)
    else trace.push('未超过迟到判定线 → 正常')
    trace.push(`下班打卡 ${row.checkOut}，早退判定线 ${rules.earlyBefore}`)
    if (row.isEarly) trace.push(`早走 ${row.earlyMinutes} 分钟 → 早退`)
    else trace.push('未早退')
    trace.push(`加班起算线 ${rules.overtimeAfter}`)
    if (row.isOvertime) trace.push(`加班 ${row.overtimeMinutes} 分钟`)
  }
  detail.row = { ...row, __calcTrace: trace }
  detail.show = true
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
.records-table {
  width: 100%;
}
.miss-punch {
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

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

/* P1-07 详情抽屉 */
.detail-section {
  margin-bottom: 20px;
}
.detail-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
}
.detail-row span {
  color: var(--text-2);
}
.detail-row b {
  font-weight: 600;
}
.calc-trace {
  padding: 6px 12px;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--text-2);
  background: #f9fafb;
  border-radius: 4px;
  border-left: 3px solid var(--brand);
}
</style>
