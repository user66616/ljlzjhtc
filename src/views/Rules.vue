<template>
  <div class="page rules-page" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">考勤规则配置</h2>
      <p class="page-desc">配置迟到 / 早退 / 加班判定阈值与缺卡处理策略，保存后立即生效</p>
    </div>

    <div class="rules-grid fade-up">
      <!-- 阈值配置卡片 -->
      <div class="glass-card form-card">
        <div class="card-title">
          <el-icon><Setting /></el-icon>
          <span>判定阈值</span>
        </div>
        <el-form :model="form" label-width="120px" label-position="left" class="rule-form">
          <el-form-item label="迟到判定线">
            <el-time-picker
              v-model="form.lateAfter"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="09:05"
              :picker-options="{ selectableRange: '00:00 - 23:59' }"
            />
            <span class="field-hint">上班打卡晚于此时间视为迟到</span>
          </el-form-item>
          <el-form-item label="早退判定线">
            <el-time-picker
              v-model="form.earlyBefore"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="18:00"
            />
            <span class="field-hint">下班打卡早于此时间视为早退</span>
          </el-form-item>
          <el-form-item label="加班起算线">
            <el-time-picker
              v-model="form.overtimeAfter"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="18:30"
            />
            <span class="field-hint">下班打卡晚于此时间开始累计加班</span>
          </el-form-item>
          <el-form-item label="缺卡处理策略">
            <el-radio-group v-model="form.missingStrategy">
              <el-radio value="mark">仅标记异常</el-radio>
              <el-radio value="absent">缺卡当作缺勤</el-radio>
            </el-radio-group>
            <span class="field-hint">切换后统计结果对应变化</span>
          </el-form-item>
          <el-divider content-position="left">午休配置（P2-05）</el-divider>
          <el-form-item label="午休开始">
            <el-time-picker v-model="form.lunchStart" format="HH:mm" value-format="HH:mm" placeholder="12:00" />
            <span class="field-hint">加班时长自动扣除午休时段</span>
          </el-form-item>
          <el-form-item label="午休结束">
            <el-time-picker v-model="form.lunchEnd" format="HH:mm" value-format="HH:mm" placeholder="13:00" />
          </el-form-item>
        </el-form>
        <div class="form-actions">
          <el-button type="primary" :icon="Check" @click="onSave">保存规则</el-button>
          <el-button :icon="RefreshRight" @click="onReset">恢复默认</el-button>
        </div>
      </div>

      <!-- 当前规则预览 + 重新计算 -->
      <div class="glass-card preview-card">
        <div class="card-title">
          <el-icon><View /></el-icon>
          <span>当前生效规则</span>
        </div>
        <ul class="rule-list">
          <li><span class="rl-label">迟到判定线</span><b>{{ current.lateAfter }}</b></li>
          <li><span class="rl-label">早退判定线</span><b>{{ current.earlyBefore }}</b></li>
          <li><span class="rl-label">加班起算线</span><b>{{ current.overtimeAfter }}</b></li>
          <li>
            <span class="rl-label">缺卡策略</span>
            <b>{{ current.missingStrategy === 'absent' ? '缺卡当作缺勤' : '仅标记异常' }}</b>
          </li>
          <li><span class="rl-label">午休时段</span><b>{{ current.lunchStart || '未设置' }} - {{ current.lunchEnd || '未设置' }}</b></li>
        </ul>

        <el-divider />

        <div class="recalc-box">
          <el-icon class="recalc-icon"><Cpu /></el-icon>
          <div class="recalc-text">
            <div class="rt-title">一键重新计算</div>
            <div class="rt-desc">规则修改后，重新计算所有记录的状态与时长</div>
          </div>
        </div>
        <el-button type="success" plain :icon="Refresh" :loading="recalcing" @click="onRecalc" class="recalc-btn">
          立即重新计算
        </el-button>

        <el-divider />

        <!-- P2-04 规则版本管理 -->
        <div class="card-title">
          <el-icon><Clock /></el-icon>
          <span>规则历史版本</span>
        </div>
        <el-table :data="versions" border size="small" max-height="240" v-loading="versionLoading">
          <el-table-column prop="createdAt" label="保存时间" width="160">
            <template #default="{ row }">{{ (row.createdAt || '').slice(0, 19) }}</template>
          </el-table-column>
          <el-table-column label="规则概要" min-width="200">
            <template #default="{ row }">
              迟到{{ row.lateAfter }} / 早退{{ row.earlyBefore }} / 加班{{ row.overtimeAfter }}
              <span v-if="row.lunchStart"> / 午休{{ row.lunchStart }}-{{ row.lunchEnd }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="operator" label="操作人" width="100" />
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="rollback(row.id)">回滚</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- P1-10 工作日历配置 -->
    <div class="glass-card fade-up section-card">
      <div class="card-title">
        <el-icon><Calendar /></el-icon>
        <span>工作日历配置</span>
        <span class="section-hint">设置周末和法定节假日，非工作日不计入应出勤</span>
      </div>
      <div class="calendar-row">
        <el-date-picker v-model="calForm.date" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 180px" />
        <el-select v-model="calForm.dayType" placeholder="日期类型" style="width: 140px">
          <el-option label="工作日" value="workday" />
          <el-option label="周末" value="weekend" />
          <el-option label="法定节假日" value="holiday" />
        </el-select>
        <el-input v-model="calForm.label" placeholder="标签（如：国庆节）" style="width: 160px" />
        <el-button type="primary" :icon="Plus" @click="addCalendar">添加</el-button>
        <el-button type="default" @click="genWeekends">自动填充今年周末</el-button>
        <el-button type="danger" :icon="Delete" :disabled="calSelected.length === 0" @click="batchDelCalendar">
          批量删除<span v-if="calSelected.length > 0">({{ calSelected.length }})</span>
        </el-button>
      </div>
      <el-table
        :data="calendar"
        border
        size="small"
        max-height="280"
        style="margin-top: 16px"
        v-loading="calLoading"
        @selection-change="(rows) => calSelected = rows.map((r) => r.date)"
      >
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.dayType === 'workday' ? 'success' : row.dayType === 'weekend' ? 'info' : 'warning'" size="small">
              {{ { workday: '工作日', weekend: '周末', holiday: '节假日' }[row.dayType] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="label" label="标签" min-width="120"><template #default="{ row }">{{ row.label || '—' }}</template></el-table-column>
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ row }">
            <el-button type="danger" link size="small" @click="delCalendar(row.date)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- P1-11 请假记录管理 -->
    <div class="glass-card fade-up section-card">
      <div class="card-title">
        <el-icon><DocumentRemove /></el-icon>
        <span>请假 / 出差 / 调休记录</span>
        <span class="section-hint">导入后对应时段不计入异常统计</span>
      </div>
      <div class="leave-form">
        <el-select v-model="leaveForm.employeeId" filterable placeholder="选择员工" style="width: 180px">
          <el-option v-for="e in employees" :key="e.employeeId" :label="`${e.name} (${e.employeeId})`" :value="e.employeeId" />
        </el-select>
        <el-date-picker v-model="leaveForm.range" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束"
          value-format="YYYY-MM-DD" style="width: 260px" />
        <el-select v-model="leaveForm.leaveType" placeholder="类型" style="width: 120px">
          <el-option label="请假" value="leave" />
          <el-option label="出差" value="business_trip" />
          <el-option label="调休" value="comp_off" />
        </el-select>
        <el-input v-model="leaveForm.reason" placeholder="原因（选填）" style="width: 200px" />
        <el-button type="primary" :icon="Plus" @click="addLeave">添加</el-button>
      </div>
      <el-table :data="leaves" border size="small" max-height="280" style="margin-top: 16px" v-loading="leaveLoading">
        <el-table-column prop="employeeId" label="工号" width="90" />
        <el-table-column label="姓名" width="90">
          <template #default="{ row }">{{ empName(row.employeeId) }}</template>
        </el-table-column>
        <el-table-column prop="startDate" label="开始" width="120" />
        <el-table-column prop="endDate" label="结束" width="120" />
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag size="small">{{ { leave: '请假', business_trip: '出差', comp_off: '调休' }[row.leaveType] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="原因" min-width="150"><template #default="{ row }">{{ row.reason || '—' }}</template></el-table-column>
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ row }">
            <el-button type="danger" link size="small" @click="delLeave(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Setting, Check, RefreshRight, View, Refresh, Cpu, Calendar, DocumentRemove, Plus, Clock, Delete
} from '@element-plus/icons-vue'
import request from '../api/request'
import { useRulesStore } from '../stores/rules'
import { useAuthStore } from '../stores/auth'

const rulesStore = useRulesStore()
const auth = useAuthStore()
const loading = ref(false)
const recalcing = ref(false)

const DEFAULT_RULES = {
  lateAfter: '09:05',
  earlyBefore: '18:00',
  overtimeAfter: '18:30',
  missingStrategy: 'mark',
  lunchStart: '12:00',
  lunchEnd: '13:00'
}

const form = reactive({ ...DEFAULT_RULES })
const current = reactive({ ...DEFAULT_RULES })

// P2-04 规则版本
const versions = ref([])
const versionLoading = ref(false)

async function loadVersions() {
  versionLoading.value = true
  try {
    const { data } = await request.get('/ruleVersions')
    versions.value = data
  } finally { versionLoading.value = false }
}

async function logAction(action, detail) {
  try {
    await request.post('/operationLogs', { operator: auth.name || 'admin', action, detail })
  } catch (e) { /* 忽略日志错误 */ }
}

async function onSave() {
  const payload = {
    lateAfter: form.lateAfter,
    earlyBefore: form.earlyBefore,
    overtimeAfter: form.overtimeAfter,
    missingStrategy: form.missingStrategy,
    lunchStart: form.lunchStart,
    lunchEnd: form.lunchEnd
  }
  await rulesStore.save(payload)
  Object.assign(current, rulesStore.rules)
  // 保存历史版本
  await request.post('/ruleVersions', { ...payload, operator: auth.name || 'admin' })
  await logAction('修改规则', JSON.stringify(payload))
  await loadVersions()
  ElMessage.success('规则保存成功，已即时生效')
}

async function rollback(versionId) {
  try {
    await ElMessageBox.confirm('确认回滚到此历史版本？回滚后数据将同步重算。', '提示', { type: 'warning' })
    const { data } = await request.post(`/ruleVersions/${versionId}/rollback`)
    await rulesStore.load()
    Object.assign(form, rulesStore.rules)
    Object.assign(current, rulesStore.rules)
    await logAction('回滚规则', `回滚到版本#${versionId}`)
    ElMessage.success('已回滚，请点击「重新计算」刷新数据')
  } catch (e) { /* 取消 */ }
}

function onReset() {
  Object.assign(form, DEFAULT_RULES)
  ElMessage.info('已恢复默认值（需点击保存生效）')
}

async function onRecalc() {
  recalcing.value = true
  // 规则已保存，calcAll 在各视图读取 store.rules 时自动重算
  // 这里触发一次 store 刷新并提示
  await rulesStore.load()
  setTimeout(() => {
    recalcing.value = false
    ElMessage.success('已重新计算所有记录的状态与时长，前往「考勤记录 / 统计看板」查看更新')
  }, 600)
}

// ========== P1-10 工作日历 ==========
const calendar = ref([])
const calLoading = ref(false)
const calForm = reactive({ date: '', dayType: 'holiday', label: '' })
const calSelected = ref([])

async function loadCalendar() {
  calLoading.value = true
  try {
    const res = await request.get('/workCalendar')
    calendar.value = res.data
    calSelected.value = calSelected.value.filter((d) => calendar.value.some((c) => c.date === d))
  } finally { calLoading.value = false }
}

async function addCalendar() {
  if (!calForm.date || !calForm.dayType) {
    ElMessage.warning('请选择日期和类型')
    return
  }
  await request.post('/workCalendar', { entries: [{ date: calForm.date, dayType: calForm.dayType, label: calForm.label }] })
  ElMessage.success('已添加')
  calForm.date = ''; calForm.label = ''
  await loadCalendar()
}

async function delCalendar(date) {
  await request.delete(`/workCalendar/${date}`)
  ElMessage.success('已删除')
  await loadCalendar()
}

async function batchDelCalendar() {
  if (calSelected.value.length === 0) {
    ElMessage.warning('请先选择要删除的日期')
    return
  }
  await ElMessageBox.confirm(`确认删除选中的 ${calSelected.value.length} 条日历记录？`, '批量删除', { type: 'warning' })
  await request.delete('/workCalendar', { data: { dates: calSelected.value } })
  ElMessage.success(`已删除 ${calSelected.value.length} 条`)
  calSelected.value = []
  await loadCalendar()
}

async function genWeekends() {
  const year = new Date().getFullYear()
  const entries = []
  const d = new Date(year, 0, 1)
  while (d.getFullYear() === year) {
    const day = d.getDay()
    if (day === 0 || day === 6) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      entries.push({ date: `${y}-${m}-${dd}`, dayType: 'weekend', label: '周末' })
    }
    d.setDate(d.getDate() + 1)
  }
  await request.post('/workCalendar', { entries })
  ElMessage.success(`已填充 ${entries.length} 个周末`)
  await loadCalendar()
}

// ========== P1-11 请假记录 ==========
const employees = ref([])
const leaves = ref([])
const leaveLoading = ref(false)
const leaveForm = reactive({ employeeId: '', range: [], leaveType: 'leave', reason: '' })

async function loadEmployeesAndLeaves() {
  const [empRes, lvRes] = await Promise.all([
    request.get('/employees'),
    request.get('/leaveRecords')
  ])
  employees.value = empRes.data
  leaves.value = lvRes.data
}

function empName(id) {
  return employees.value.find((e) => e.employeeId === id)?.name || id
}

async function addLeave() {
  if (!leaveForm.employeeId || !leaveForm.range || leaveForm.range.length !== 2) {
    ElMessage.warning('请填写完整信息')
    return
  }
  await request.post('/leaveRecords', {
    employeeId: leaveForm.employeeId,
    startDate: leaveForm.range[0],
    endDate: leaveForm.range[1],
    leaveType: leaveForm.leaveType,
    reason: leaveForm.reason
  })
  ElMessage.success('请假记录已添加')
  leaveForm.employeeId = ''; leaveForm.range = []; leaveForm.reason = ''
  const res = await request.get('/leaveRecords')
  leaves.value = res.data
}

async function delLeave(id) {
  await request.delete(`/leaveRecords/${id}`)
  ElMessage.success('已删除')
  const res = await request.get('/leaveRecords')
  leaves.value = res.data
}

// 初始化加载
onMounted(async () => {
  loading.value = true
  try {
    const r = await rulesStore.load()
    Object.assign(form, r)
    Object.assign(current, r)
    await Promise.all([loadCalendar(), loadEmployeesAndLeaves(), loadVersions()])
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.rules-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 20px;
}
@media (max-width: 980px) {
  .rules-grid {
    grid-template-columns: 1fr;
  }
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 24px;
  color: var(--text);
}
.card-title .el-icon {
  color: var(--brand);
}

.rule-form :deep(.field-hint) {
  display: block;
  color: var(--text-2);
  font-size: 12px;
  margin-top: 4px;
}
.rule-form :deep(.el-form-item) {
  margin-bottom: 22px;
}
.field-hint {
  display: block;
  color: var(--text-2);
  font-size: 12px;
  margin-top: 6px;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.rule-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.rule-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px dashed var(--border);
}
.rule-list li:last-child {
  border-bottom: none;
}
.rl-label {
  color: var(--text-2);
  font-size: 14px;
}
.rule-list b {
  font-size: 15px;
  color: var(--brand-dark);
}

.recalc-box {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}
.recalc-icon {
  font-size: 28px;
  color: #16a34a;
  background: #dcfce7;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rt-title {
  font-weight: 600;
  font-size: 15px;
}
.rt-desc {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 2px;
}
.recalc-btn {
  width: 100%;
}
.section-card {
  margin-top: 20px;
  padding: 20px;
}
.section-hint {
  font-size: 12px;
  color: var(--text-2);
  font-weight: 400;
  margin-left: 8px;
}
.calendar-row, .leave-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
</style>
