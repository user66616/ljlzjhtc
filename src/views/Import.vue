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
          accept=".csv"
          drag
          class="upload-dragger"
        >
          <el-icon class="upload-icon"><UploadFilled /></el-icon>
          <div class="upload-text">将 CSV 文件拖到此处，或<em>点击上传</em></div>
          <template #tip>
            <div class="upload-tip">仅支持 .csv 格式，需包含 employeeId、date 字段</div>
          </template>
        </el-upload>
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
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  UploadFilled, Document, Download, DocumentChecked, Check,
  RefreshLeft, CircleCheckFilled, Delete
} from '@element-plus/icons-vue'
import request from '../api/request'
import { parseCSV, toCSV, downloadCSV } from '../utils/csv'
import { isValidTime } from '../utils/attendance'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const REQUIRED_FIELDS = ['employeeId', 'date']

const parsed = ref(null) // { headers, rows }
const importing = ref(false)
const result = ref(null)

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
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target.result
    try {
      const { headers, rows } = parseCSV(text)
      // 校验表头是否含必填字段
      const missing = REQUIRED_FIELDS.filter((f) => !headers.includes(f))
      if (missing.length) {
        ElMessage.error(`CSV 表头缺少必填字段：${missing.join(', ')}`)
        return
      }
      parsed.value = { headers, rows }
      result.value = null
      ElMessage.success(`已解析 ${rows.length} 行数据，请检查校验结果`)
    } catch (err) {
      ElMessage.error('CSV 解析失败：' + err.message)
    }
  }
  reader.readAsText(raw, 'utf-8')
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
    // 逐条写入（json-server 自动分配 id）
    await Promise.all(
      payload.map((rec) => request.post('/attendanceRecords', rec))
    )
    result.value = {
      success: payload.length,
      fail: errorRows.value.length,
      dedup: dedupCount.value
    }
    parsed.value = null
    ElMessage.success(`导入成功，共写入 ${payload.length} 条记录`)
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
</style>
