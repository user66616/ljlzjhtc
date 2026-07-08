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
        <el-form-item label="部门" v-if="auth.role === 'admin'">
          <el-select v-model="filters.dept" placeholder="全部部门" clearable style="width: 140px">
            <el-option v-for="d in deptOptions" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词" v-if="auth.role !== 'employee'">
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
          <el-button :icon="RefreshLeft" @click="onReset">重置</el-button>
          <el-button type="success" plain :icon="Download" @click="onExport">导出 CSV</el-button>
        </el-form-item>
        <el-form-item>
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button label="table">表格视图</el-radio-button>
            <el-radio-button label="calendar">日历视图</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </div>

    <!-- P2-03 日历视图 -->
    <div v-if="viewMode === 'calendar'" class="glass-card calendar-card fade-up" v-loading="loading">
      <div class="calendar-toolbar">
        <el-button :icon="ArrowLeft" size="small" @click="calMonth--">上月</el-button>
        <span class="cal-title">{{ calYear }}年{{ calMonth }}月</span>
        <el-button size="small" @click="calMonth++">下月<el-icon class="el-icon--right"><ArrowRight /></el-icon></el-button>
        <el-select v-if="auth.role !== 'employee'" v-model="calEmployeeId" placeholder="选择员工" filterable style="width: 200px; margin-left: 16px">
          <el-option v-for="e in calendarEmployees" :key="e.employeeId" :label="`${e.name} (${e.employeeId})`" :value="e.employeeId" />
        </el-select>
        <div class="cal-legend">
          <span v-for="(meta, key) in STATUS_META" :key="key" class="legend-item">
            <i class="legend-dot" :style="{ background: meta.color }"></i>{{ meta.label }}
          </span>
        </div>
      </div>
      <div class="calendar-grid">
        <div class="cal-weekday" v-for="w in weekdays" :key="w">{{ w }}</div>
        <div v-for="(day, idx) in calendarDays" :key="idx" class="cal-day" :class="{ 'cal-empty': !day, 'cal-weekend': day && (idx % 7 === 0 || idx % 7 === 6) }">
          <template v-if="day">
            <div class="cal-day-num">{{ day.day }}</div>
            <div v-if="day.record" class="cal-day-status" :style="{ background: STATUS_META[day.record.status]?.color + '22', color: STATUS_META[day.record.status]?.color, borderColor: STATUS_META[day.record.status]?.color }">
              <el-tag :type="STATUS_META[day.record.status]?.type" size="small" effect="light">{{ STATUS_META[day.record.status]?.label }}</el-tag>
              <div class="cal-day-time" v-if="day.record.checkIn">{{ day.record.checkIn }} - {{ day.record.checkOut || '?' }}</div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 列表 -->
    <div v-if="viewMode === 'table'" class="glass-card table-card fade-up" v-loading="loading">
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
          <el-table-column label="操作" width="90" align="center" v-if="auth.role === 'employee'">
            <template #default="{ row }">
              <el-button
                v-if="!row._virtualLeave && ['late','early','missing','absent'].includes(row.status)"
                type="primary"
                link
                size="small"
                @click.stop="goAppeal(row)"
              >申诉</el-button>
              <span v-else class="dim-text">—</span>
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
          <template v-if="detail.row._virtualLeave">
            <div class="detail-row">
              <span>状态</span>
              <el-tag type="primary" size="small">{{ { leave:'请假', business_trip:'出差', comp_off:'调休' }[detail.row._leaveType] || '请假' }}</el-tag>
            </div>
            <div class="detail-row" v-if="detail.row.reason"><span>原因</span><b>{{ detail.row.reason }}</b></div>
          </template>
          <template v-else>
            <div class="detail-row" v-if="!detail.editing"><span>上班打卡</span><b>{{ detail.row.checkIn || '未打卡' }}</b></div>
            <div class="detail-row" v-if="!detail.editing"><span>下班打卡</span><b>{{ detail.row.checkOut || '未打卡' }}</b></div>
            <div class="detail-row" v-if="detail.editing">
              <span>上班打卡</span>
              <el-time-select v-model="detail.editForm.checkIn" start="06:00" step="00:05" end="12:00" placeholder="选择时间" clearable style="width: 140px" />
            </div>
            <div class="detail-row" v-if="detail.editing">
              <span>下班打卡</span>
              <el-time-select v-model="detail.editForm.checkOut" start="15:00" step="00:05" end="23:59" placeholder="选择时间" clearable style="width: 140px" />
            </div>
          </template>
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
        <!-- P1-09 单条记录修正 -->
        <div class="detail-actions" v-if="(auth.role === 'admin' || auth.role === 'manager') && !detail.row._virtualLeave">
          <template v-if="!detail.editing">
            <el-button type="primary" plain @click="startEdit">修改打卡时间</el-button>
          </template>
          <template v-else>
            <el-button type="primary" :loading="detail.saving" @click="saveEdit">保存修改</el-button>
            <el-button @click="detail.editing = false">取消</el-button>
          </template>
        </div>

        <!-- P2-10 申诉功能（员工） -->
        <div class="detail-actions" v-if="auth.role === 'employee' && detail.row && !detail.row._virtualLeave && (detail.row.isLate || detail.row.isEarly || detail.row.status === 'absent' || detail.row.status === 'missing')">
          <el-button type="warning" plain @click="appealDialog.visible = true">发起申诉</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- P2-10 申诉对话框 -->
    <el-dialog v-model="appealDialog.visible" title="考勤申诉" width="480px">
      <el-form :model="appealForm" label-width="80px">
        <el-form-item label="申诉记录">
          <span>{{ detail.row?.date }} {{ STATUS_META[detail.row?.status]?.label }}</span>
        </el-form-item>
        <el-form-item label="申诉原因">
          <el-input v-model="appealForm.reason" type="textarea" :rows="4" placeholder="请详细说明申诉原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="appealDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="appealDialog.saving" @click="submitAppeal">提交申诉</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, RefreshLeft, Download, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
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
const leaves = ref([])
const appeals = ref([])
const viewMode = ref('table')

// P2-03 日历视图
const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const today = new Date()
const calYear = ref(today.getFullYear())
const calMonth = ref(today.getMonth() + 1)
const calEmployeeId = ref(auth.role === 'employee' ? auth.employeeId : '')

// 修正月份边界
watch(calMonth, (v) => {
  if (v < 1) { calMonth.value = 12; calYear.value-- }
  if (v > 12) { calMonth.value = 1; calYear.value++ }
})

const calendarEmployees = computed(() => {
  if (auth.role === 'employee') return employees.value.filter((e) => e.employeeId === auth.employeeId)
  if (auth.role === 'manager') return employees.value.filter((e) => e.dept === auth.dept)
  return employees.value
})

const calendarDays = computed(() => {
  const year = calYear.value
  const month = calMonth.value
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const empId = calEmployeeId.value
  const empRecords = empId ? computedRecords.value.filter((r) => r.employeeId === empId) : []
  const recordMap = {}
  empRecords.forEach((r) => { recordMap[r.date] = r })
  const days = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ day: d, record: recordMap[dateStr] || null })
  }
  return days
})

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

// 已通过申诉的考勤记录ID集合
const approvedAppealIds = computed(() =>
  appeals.value.filter((a) => a.status === 'approved').map((a) => a.recordId)
)

// 计算状态后的记录（附带员工信息）
const computedRecords = computed(() => {
  const rules = rulesStore.rules
  // 合并：原记录 + 请假期间未打卡的虚拟记录
  const merged = [...records.value]
  const existingKey = new Set(merged.map((r) => `${r.employeeId}_${r.date}`))
  leaves.value.forEach((l) => {
    const start = new Date(l.startDate)
    const end = new Date(l.endDate)
    const cur = new Date(start)
    while (cur <= end) {
      const y = cur.getFullYear()
      const m = String(cur.getMonth() + 1).padStart(2, '0')
      const d = String(cur.getDate()).padStart(2, '0')
      const dateStr = `${y}-${m}-${d}`
      const key = `${l.employeeId}_${dateStr}`
      if (!existingKey.has(key)) {
        merged.push({
          id: `leave_${l.employeeId}_${dateStr}`,
          employeeId: l.employeeId,
          date: dateStr,
          checkIn: null,
          checkOut: null,
          overtimeMinutes: 0,
          handleStatus: 'handled',
          _virtualLeave: true,
          _leaveType: l.leaveType,
          reason: l.reason || ''
        })
        existingKey.add(key)
      }
      cur.setDate(cur.getDate() + 1)
    }
  })
  const calc = calcAll(merged, rules, leaves.value, approvedAppealIds.value)
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
    const recordParams = {}
    if (auth.role === 'employee') recordParams.employeeId = auth.employeeId
    const leaveParams = {}
    if (auth.role === 'employee') leaveParams.employeeId = auth.employeeId
    const appealParams = {}
    if (auth.role === 'employee') appealParams.employeeId = auth.employeeId
    const [empRes, recRes, leaveRes, appealRes] = await Promise.all([
      request.get('/employees'),
      request.get('/attendanceRecords', { params: recordParams }),
      request.get('/leaveRecords', { params: leaveParams }),
      request.get('/appeals', { params: appealParams })
    ])
    employees.value = empRes.data
    records.value = recRes.data
    leaves.value = leaveRes.data
    appeals.value = appealRes.data
    // 按日期升序
    records.value.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  } finally {
    loading.value = false
  }
})

watch(
  () => [filters.dateRange, filters.dept, filters.keyword, filters.status],
  () => { page.current = 1 }
)

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

function goAppeal(row) {
  sessionStorage.setItem('appeal_record_id', row.id)
  router.push('/appeals')
}

// P1-07 记录详情抽屉
const detail = reactive({ show: false, row: null, editing: false, editForm: { checkIn: '', checkOut: '' }, saving: false })

function openDetail(row) {
  // 生成判定过程说明
  const trace = []
  const rules = rulesStore.rules
  if (row._virtualLeave) {
    trace.push(`该日期处于${ { leave:'请假', business_trip:'出差', comp_off:'调休' }[row._leaveType] || '请假' }期间，不计入异常`)
  } else if (!row.checkIn && !row.checkOut) {
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
  detail.editing = false
  detail.show = true
}

// P1-09 单条记录修正
function startEdit() {
  detail.editForm = {
    checkIn: detail.row.checkIn || '',
    checkOut: detail.row.checkOut || ''
  }
  detail.editing = true
}

async function saveEdit() {
  detail.saving = true
  try {
    const updated = await request.put(`/attendanceRecords/${detail.row.id}`, {
      checkIn: detail.editForm.checkIn || null,
      checkOut: detail.editForm.checkOut || null
    })
    // 更新本地记录
    const idx = records.value.findIndex((r) => r.id === detail.row.id)
    if (idx !== -1) {
      records.value[idx] = { ...records.value[idx], checkIn: updated.data.checkIn, checkOut: updated.data.checkOut }
    }
    ElMessage.success('修改成功，状态已重新计算')
    detail.editing = false
    // 重新生成判定明细
    const recalced = computedRecords.value.find((r) => r.id === detail.row.id)
    if (recalced) openDetail(recalced)
    else detail.show = false
  } catch (e) {
    // 错误已由拦截器提示
  } finally {
    detail.saving = false
  }
}

// P2-10 申诉
const appealDialog = reactive({ visible: false, saving: false })
const appealForm = reactive({ reason: '' })

async function submitAppeal() {
  if (!appealForm.reason || appealForm.reason.trim() === '') {
    ElMessage.warning('请填写申诉原因')
    return
  }
  appealDialog.saving = true
  try {
    await request.post('/appeals', {
      recordId: detail.row.id,
      employeeId: auth.employeeId,
      reason: appealForm.reason
    })
    ElMessage.success('申诉已提交，请等待管理员审核')
    appealDialog.visible = false
    appealForm.reason = ''
  } catch (e) {
    // 错误已由拦截器提示
  } finally {
    appealDialog.saving = false
  }
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
.dim-text {
  color: #c0c4cc;
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
.detail-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

/* P2-03 日历视图 */
.calendar-card {
  padding: 16px 20px;
  margin-bottom: 16px;
}
.calendar-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.cal-title {
  font-size: 16px;
  font-weight: 700;
  min-width: 120px;
  text-align: center;
}
.cal-legend {
  margin-left: auto;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-2);
}
.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.cal-weekday {
  text-align: center;
  font-weight: 600;
  padding: 8px 0;
  color: var(--text-2);
  font-size: 13px;
}
.cal-day {
  min-height: 90px;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: background 0.2s;
}
.cal-day:hover {
  background: var(--bg);
}
.cal-day.cal-empty {
  border: none;
  background: transparent;
}
.cal-day.cal-weekend {
  background: var(--bg);
}
.cal-day-num {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.cal-day-status {
  border: 1px solid;
  border-radius: 4px;
  padding: 4px;
  font-size: 11px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
}
.cal-day-time {
  font-size: 10px;
  opacity: 0.8;
}
</style>
