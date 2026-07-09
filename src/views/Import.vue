<template>
  <div class="page import-page">
    <div class="page-header">
      <h2 class="page-title">考勤数据导入</h2>
      <p class="page-desc">上传 CSV 考勤文件，系统自动校验清洗后写入数据</p>
    </div>

    <!-- 步骤一：下载模板 + 上传 -->
    <div class="glass-card fade-up step-card">
      <div class="card-title">
        <el-icon><UploadFilled /></el-icon>
        <span>步骤一 · 模板与上传</span>
      </div>
      <div class="step1-row">
        <div class="template-box" @click="downloadTemplate">
          <el-icon class="tb-icon"><Document /></el-icon>
          <div>
            <div class="tb-name">考勤数据模板.csv</div>
            <div class="tb-desc">字段：employeeId, date, checkIn, checkOut</div>
          </div>
          <el-button type="primary" link :icon="Download">下载模板</el-button>
        </div>

        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          :on-change="onFileChange"
          accept=".csv,.xlsx,.xls"
          drag
          class="upload-dragger"
        >
          <el-icon class="upload-icon"><UploadFilled /></el-icon>
          <div class="upload-text">将 CSV / Excel 文件拖到此处，或<em>点击上传</em></div>
          <template #tip>
            <div class="upload-tip">支持 .csv / .xlsx / .xls 格式，需包含工号、日期字段</div>
          </template>
        </el-upload>
      </div>
    </div>

    <!-- P1-04 字段映射 -->
    <div v-if="mapping.show" class="glass-card fade-up step-card">
      <div class="card-title">
        <el-icon><Connection /></el-icon>
        <span>字段映射 · 将文件列名对应到标准字段</span>
      </div>
      <p class="mapping-hint">系统检测到以下表头，请确认与标准字段的对应关系（无法匹配的请手动选择）</p>
      <div class="mapping-grid">
        <div class="mapping-item" v-for="f in STANDARD_FIELDS" :key="f.key">
          <div class="map-label">
            <b>{{ f.key }}</b>
            <span class="map-desc">{{ f.desc }}</span>
          </div>
          <el-select v-model="mapping.map[f.key]" placeholder="选择文件列" clearable style="width: 200px">
            <el-option v-for="h in mapping.headers" :key="h" :label="h" :value="h" />
          </el-select>
          <el-tag v-if="mapping.map[f.key]" type="success" size="small" effect="light">已映射</el-tag>
          <el-tag v-else-if="f.key === 'employeeId' || f.key === 'date'" type="danger" size="small">必填</el-tag>
        </div>
      </div>
      <div class="mapping-actions">
        <el-button type="primary" :icon="Check" @click="applyMapping">应用映射并校验</el-button>
        <el-button @click="resetMapping">取消</el-button>
      </div>
    </div>

    <!-- 步骤二：校验与预览 -->
    <div v-if="parsed" class="glass-card fade-up step-card">
      <div class="card-title">
        <el-icon><DocumentChecked /></el-icon>
        <span>步骤二 · 校验与预览（前 20 行）</span>
        <div class="step-summary">
          <el-tag type="success">有效 {{ validRows.length }}</el-tag>
          <el-tag type="danger">错误 {{ errorRows.length }}</el-tag>
          <el-tag type="warning">去重 {{ dedupCount }}</el-tag>
        </div>
      </div>

      <el-table :data="previewRows" border size="small" class="preview-table" max-height="360">
        <el-table-column type="index" label="#" width="50" align="center" />
        <el-table-column label="校验" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.__valid ? 'success' : 'danger'" size="small" effect="light">
              {{ row.__valid ? '通过' : '错误' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="employeeId" label="工号" width="120" />
        <el-table-column prop="date" label="日期" width="130" />
        <el-table-column prop="checkIn" label="上班打卡" width="110" />
        <el-table-column prop="checkOut" label="下班打卡" width="110" />
        <el-table-column label="错误信息" min-width="220">
          <template #default="{ row }">
            <span class="error-msg">{{ row.__errors?.join('；') || '—' }}</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="import-actions" v-if="validRows.length">
        <el-button type="primary" :icon="Check" :loading="importing" @click="onImport">
          确认导入（{{ dedupedRows.length }} 条）
        </el-button>
        <el-button :icon="RefreshLeft" @click="reset">重新上传</el-button>
        <el-button type="danger" plain :icon="Download" v-if="errorRows.length" @click="exportErrors">
          导出错误清单（{{ errorRows.length }} 条）
        </el-button>
      </div>
    </div>

    <!-- 步骤三：导入结果 -->
    <div v-if="result" class="glass-card fade-up result-card">
      <div class="card-title">
        <el-icon><CircleCheckFilled /></el-icon>
        <span>导入结果</span>
      </div>
      <div class="result-grid">
        <div class="result-item success">
          <div class="ri-num">{{ result.success }}</div>
          <div class="ri-label">成功条数</div>
        </div>
        <div class="result-item fail">
          <div class="ri-num">{{ result.fail }}</div>
          <div class="ri-label">失败条数</div>
        </div>
        <div class="result-item dedup">
          <div class="ri-num">{{ result.dedup }}</div>
          <div class="ri-label">去重条数</div>
        </div>
      </div>
      <div class="result-actions">
        <el-button type="primary" @click="goRecords">查看考勤记录</el-button>
        <el-button @click="reset">继续导入</el-button>
      </div>
    </div>

    <!-- P2-02 数据备份与回滚 -->
    <div class="glass-card fade-up step-card" v-if="auth.role === 'admin'">
      <div class="card-title">
        <el-icon><FolderOpened /></el-icon>
        <span>数据备份与回滚</span>
        <span class="step-summary">
          <el-tag type="info">共 {{ backups.length }} 个备份</el-tag>
          <el-tag type="warning">累计回滚 {{ rollbackCount }} 次</el-tag>
        </span>
      </div>
      <div class="clear-tip" style="margin-bottom: 12px">导入新数据前系统自动备份上一版全量数据，如导入出错可一键回滚恢复。</div>
      <el-table :data="backups" border size="small" max-height="280" v-loading="backupLoading">
        <el-table-column prop="backupName" label="备份名称" min-width="180" />
        <el-table-column prop="recordCount" label="记录数" width="90" align="center" />
        <el-table-column prop="operator" label="操作人" width="100" />
        <el-table-column label="备份时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center">
          <template #default="{ row }">
            <el-button type="warning" link size="small" @click="rollbackBackup(row.id)">回滚</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- P1-05 清空数据 -->
    <div class="glass-card fade-up step-card" v-if="auth.role === 'admin'">
      <div class="card-title">
        <el-icon><Delete /></el-icon>
        <span>数据管理 · 清空考勤记录</span>
      </div>
      <div class="clear-row">
        <el-date-picker
          v-model="clearRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          :clearable="true"
          style="width: 260px"
        />
        <el-button type="danger" plain :icon="Delete" :loading="clearing" @click="onClear">
          清空指定范围内记录
        </el-button>
      </div>
      <div class="clear-tip">注：清空操作不可恢复，请谨慎操作。不选日期则清空全部记录。</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  UploadFilled, Document, Download, DocumentChecked, Check,
  RefreshLeft, CircleCheckFilled, Delete, Connection, FolderOpened
} from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import request from '../api/request'
import { parseCSV, toCSV, downloadCSV } from '../utils/csv'
import { isValidTime, formatTime } from '../utils/attendance'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const REQUIRED_FIELDS = ['employeeId', 'date']
const STANDARD_FIELDS = [
  { key: 'employeeId', desc: '员工工号' },
  { key: 'date', desc: '考勤日期（YYYY-MM-DD）' },
  { key: 'checkIn', desc: '上班打卡时间（HH:mm）' },
  { key: 'checkOut', desc: '下班打卡时间（HH:mm）' }
]
// 字段别名自动匹配表（用于模糊识别文件表头）
const FIELD_ALIASES = {
  employeeId: ['employeeid', '工号', '员工工号', 'emp_id', 'empid', 'id'],
  date: ['date', '日期', '考勤日期', '打卡日期', 'day'],
  checkIn: ['checkin', '上班打卡', '上班时间', '签到', 'check_in', 'intime'],
  checkOut: ['checkout', '下班打卡', '下班时间', '签退', 'check_out', 'outtime']
}

const parsed = ref(null) // { headers, rows }
const importing = ref(false)
const result = ref(null)

// P1-04 字段映射状态
const mapping = reactive({
  show: false,
  headers: [],
  map: {} // standardKey -> fileHeader
})

function guessMapping(headers) {
  const map = {}
  STANDARD_FIELDS.forEach((f) => {
    const aliases = [f.key.toLowerCase(), ...(FIELD_ALIASES[f.key] || [])]
    const hit = headers.find((h) => aliases.includes(String(h).toLowerCase().trim()))
    if (hit) map[f.key] = hit
  })
  return map
}

// 校验每一行
const enrichedRows = computed(() => {
  if (!parsed.value) return []
  return parsed.value.rows.map((r) => {
    const errors = []
    REQUIRED_FIELDS.forEach((f) => {
      if (!r[f] || String(r[f]).trim() === '') errors.push(`缺少必填字段 ${f}`)
    })
    // 日期格式 YYYY-MM-DD
    if (r.date && !/^\d{4}-\d{2}-\d{2}$/.test(String(r.date).trim())) {
      errors.push('日期格式应为 YYYY-MM-DD')
    }
    // 时间格式 HH:mm 或空
    if (r.checkIn && r.checkIn.trim() !== '' && !isValidTime(r.checkIn)) {
      errors.push('上班打卡需为 HH:mm 格式')
    }
    if (r.checkOut && r.checkOut.trim() !== '' && !isValidTime(r.checkOut)) {
      errors.push('下班打卡需为 HH:mm 格式')
    }
    return { ...r, __valid: errors.length === 0, __errors: errors }
  })
})

const validRows = computed(() => enrichedRows.value.filter((r) => r.__valid))
const errorRows = computed(() => enrichedRows.value.filter((r) => !r.__valid))
const previewRows = computed(() => enrichedRows.value.slice(0, 20))

// 去重：employeeId + date 相同保留最后一条
const dedupedRows = computed(() => {
  const map = new Map()
  for (const r of validRows.value) {
    const key = `${r.employeeId}_${r.date}`
    map.set(key, r)
  }
  return Array.from(map.values())
})
const dedupCount = computed(() => validRows.value.length - dedupedRows.value.length)

function onFileChange(file) {
  const raw = file.raw
  if (!raw) return
  const name = raw.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    // P1-02 Excel 解析
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (json.length < 2) {
          ElMessage.error('Excel 文件无有效数据')
          return
        }
        const headers = json[0].map((h) => String(h).trim())
        const rows = json.slice(1).map((arr) => {
          const obj = {}
          headers.forEach((h, i) => { obj[h] = arr[i] != null ? String(arr[i]).trim() : '' })
          return obj
        })
        startMapping(headers, rows)
      } catch (err) {
        ElMessage.error('Excel 解析失败：' + err.message)
      }
    }
    reader.readAsArrayBuffer(raw)
  } else {
    // CSV
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target.result
        const { headers, rows } = parseCSV(text)
        startMapping(headers, rows)
      } catch (err) {
        ElMessage.error('CSV 解析失败：' + err.message)
      }
    }
    reader.readAsText(raw, 'utf-8')
  }
}

// P1-04 启动字段映射流程
function startMapping(headers, rows) {
  mapping.headers = headers
  mapping.map = guessMapping(headers)
  mapping._rows = rows // 暂存原始行
  mapping.show = true
  parsed.value = null
  result.value = null
  // 如果所有必填字段都自动匹配成功，直接应用
  const allMapped = REQUIRED_FIELDS.every((f) => mapping.map[f])
  if (allMapped) {
    applyMapping()
  } else {
    ElMessage.info('请确认字段映射关系')
  }
}

function applyMapping() {
  // 校验必填字段映射
  const missing = REQUIRED_FIELDS.filter((f) => !mapping.map[f])
  if (missing.length) {
    ElMessage.error(`请映射必填字段：${missing.join(', ')}`)
    return
  }
  // 根据映射转换原始行
  const map = mapping.map
  const rows = (mapping._rows || []).map((r) => {
    const o = {}
    STANDARD_FIELDS.forEach((f) => {
      const src = map[f.key]
      o[f.key] = src ? r[src] : ''
    })
    return o
  })
  parsed.value = { headers: STANDARD_FIELDS.map((f) => f.key), rows }
  mapping.show = false
  ElMessage.success(`已映射并解析 ${rows.length} 行数据，请检查校验结果`)
}

function resetMapping() {
  mapping.show = false
  mapping.map = {}
  mapping._rows = null
}

function downloadTemplate() {
  const a = document.createElement('a')
  a.href = `${import.meta.env.BASE_URL}template.csv`
  a.download = '考勤数据模板.csv'
  a.click()
}

async function onImport() {
  importing.value = true
  try {
    const payload = dedupedRows.value.map((r) => ({
      employeeId: String(r.employeeId).trim(),
      date: String(r.date).trim(),
      checkIn: r.checkIn ? String(r.checkIn).trim() : null,
      checkOut: r.checkOut ? String(r.checkOut).trim() : null,
      overtimeMinutes: 0
    }))
    // P2-02 导入前自动备份
    try {
      await request.post('/dataBackups/backup', { operator: auth.name || 'admin' })
    } catch (e) { /* 备份失败不阻塞导入 */ }
    // 逐条写入（json-server 自动分配 id）
    await Promise.all(
      payload.map((rec) => request.post('/attendanceRecords', rec))
    )
    // 记录操作日志
    try {
      await request.post('/operationLogs', { operator: auth.name || 'admin', action: '导入数据', detail: `导入 ${payload.length} 条记录` })
    } catch (e) { /* 忽略 */ }
    await loadBackups()
    result.value = {
      success: payload.length,
      fail: errorRows.value.length,
      dedup: dedupCount.value
    }
    parsed.value = null
    ElMessage.success(`导入成功，共写入 ${payload.length} 条记录（已自动备份上一版数据）`)
  } catch (e) {
    // 错误已由拦截器提示
  } finally {
    importing.value = false
  }
}

function reset() {
  parsed.value = null
  result.value = null
}
function goRecords() {
  router.push('/records')
}

// P1-03 导出错误清单
function exportErrors() {
  if (errorRows.value.length === 0) {
    ElMessage.warning('没有错误记录可导出')
    return
  }
  const rows = errorRows.value.map((r, i) => ({
    row: i + 1,
    employeeId: r.employeeId || '',
    date: r.date || '',
    checkIn: r.checkIn || '',
    checkOut: r.checkOut || '',
    errors: (r.__errors || []).join('；')
  }))
  const csv = toCSV(rows, ['row', 'employeeId', 'date', 'checkIn', 'checkOut', 'errors'])
  downloadCSV(`错误清单_${new Date().toISOString().slice(0, 10)}.csv`, csv)
  ElMessage.success(`已导出 ${rows.length} 条错误记录`)
}

// P1-05 清空数据
const clearRange = ref(null)
const clearing = ref(false)

async function onClear() {
  let confirmText = '确定要清空考勤记录吗？'
  if (clearRange.value && clearRange.value.length === 2) {
    confirmText = `确定要清空 ${clearRange.value[0]} 至 ${clearRange.value[1]} 的考勤记录吗？`
  } else {
    confirmText = '未选择日期范围，将清空全部考勤记录！确定继续吗？'
  }
  try {
    await ElMessageBox.confirm(confirmText, '危险操作', {
      type: 'warning',
      confirmButtonText: '确认清空',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger'
    })
  } catch {
    return
  }
  clearing.value = true
  try {
    const params = {}
    if (clearRange.value && clearRange.value.length === 2) {
      params.startDate = clearRange.value[0]
      params.endDate = clearRange.value[1]
    }
    const res = await request.delete('/attendanceRecords', { data: params })
    ElMessage.success(`已清空 ${res.data.deleted} 条记录`)
    clearRange.value = null
  } catch (e) {
    // 错误已由拦截器提示
  } finally {
    clearing.value = false
  }
}

// P2-02 数据备份与回滚
const backups = ref([])
const backupLoading = ref(false)
const rollbackCount = ref(0)

async function loadBackups() {
  backupLoading.value = true
  try {
    const { data } = await request.get('/dataBackups')
    backups.value = data
    try {
      const logsRes = await request.get('/operationLogs')
      const count = (logsRes.data || []).filter((l) => l.action === '回滚数据').length
      rollbackCount.value = count
    } catch (e) {
      rollbackCount.value = 0
    }
  } finally { backupLoading.value = false }
}

async function rollbackBackup(id) {
  try {
    await ElMessageBox.confirm('确认回滚到此备份数据？当前考勤记录将被替换。', '提示', { type: 'warning' })
    await request.post(`/dataBackups/${id}/rollback`)
    await request.post('/operationLogs', { operator: auth.name || 'admin', action: '回滚数据', detail: `回滚到备份#${id}` })
    ElMessage.success('已回滚，数据已恢复')
    await loadBackups()
  } catch (e) { /* 取消 */ }
}

// 初始化加载备份列表
loadBackups()
</script>

<style scoped>
.step-card {
  margin-bottom: 20px;
}
.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 20px;
}
.card-title .el-icon {
  color: var(--brand);
}
.step-summary {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.step1-row {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 20px;
  align-items: stretch;
}
@media (max-width: 880px) {
  .step1-row {
    grid-template-columns: 1fr;
  }
}

.template-box {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
  border: 1.5px dashed var(--border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.25s;
  background: #fafbfc;
}
.template-box:hover {
  border-color: var(--brand);
  background: var(--brand-light);
}
.tb-icon {
  font-size: 36px;
  color: var(--brand);
}
.tb-name {
  font-weight: 600;
  font-size: 14px;
}
.tb-desc {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 2px;
}
.template-box .el-button {
  margin-left: auto;
}

.upload-dragger {
  width: 100%;
}
.upload-dragger :deep(.el-upload-dragger) {
  width: 100%;
  padding: 28px 20px;
  border-radius: 12px;
}
.upload-icon {
  font-size: 40px;
  color: var(--brand);
  margin-bottom: 8px;
}
.upload-text {
  color: var(--text-2);
  font-size: 14px;
}
.upload-text em {
  color: var(--brand);
  font-style: normal;
  font-weight: 600;
}
.upload-tip {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 8px;
}

.preview-table {
  margin-bottom: 16px;
}
.error-msg {
  color: #ef4444;
  font-size: 12px;
}

.import-actions {
  display: flex;
  gap: 12px;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.result-item {
  text-align: center;
  padding: 28px 16px;
  border-radius: 12px;
  background: #f9fafb;
}
.result-item.success {
  background: linear-gradient(135deg, #dcfce7, #bbf7d0);
}
.result-item.fail {
  background: linear-gradient(135deg, #fee2e2, #fecaca);
}
.result-item.dedup {
  background: linear-gradient(135deg, #fef9c3, #fde68a);
}
.ri-num {
  font-size: 38px;
  font-weight: 800;
  line-height: 1;
}
.success .ri-num {
  color: #16a34a;
}
.fail .ri-num {
  color: #dc2626;
}
.dedup .ri-num {
  color: #d97706;
}
.ri-label {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-2);
}
.result-actions {
  display: flex;
  gap: 12px;
}

.clear-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 8px;
}
.clear-tip {
  font-size: 12px;
  color: var(--text-2);
}
.mapping-hint {
  font-size: 13px;
  color: var(--text-2);
  margin: 0 0 16px;
}
.mapping-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
@media (max-width: 800px) { .mapping-grid { grid-template-columns: 1fr; } }
.mapping-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #fafbfc;
}
.map-label {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.map-desc {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 2px;
}
.mapping-actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
}
</style>
