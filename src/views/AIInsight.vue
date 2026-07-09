<template>
  <div class="page ai-page" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">智能解读</h2>
      <p class="page-desc">基于考勤数据自动生成总结与智能问答</p>
    </div>

    <!-- P2-11 模板化自动总结 -->
    <div class="glass-card fade-up">
      <div class="card-title">
        <el-icon><MagicStick /></el-icon>
        <span>考勤总结</span>
        <el-radio-group v-model="summaryRange" size="small" style="margin-left: auto" @change="generateSummary">
          <el-radio-button label="week">本周</el-radio-button>
          <el-radio-button label="month">本月</el-radio-button>
        </el-radio-group>
      </div>
      <div class="summary-text" v-if="summaryText">
        <p v-for="(line, i) in summaryText.split('\n')" :key="i">{{ line }}</p>
      </div>
      <el-empty v-else description="点击下方按钮生成总结" />
      <div style="margin-top: 12px">
        <el-button type="primary" :icon="MagicStick" @click="generateSummary">生成总结</el-button>
        <el-button type="success" :icon="MagicStick" :loading="cozeLoading" @click="generateCozeReport">AI 生成专业报告</el-button>
      </div>
      <div class="coze-report" v-if="cozeReport">
        <div class="coze-report-title">AI 专业考勤报告</div>
        <div class="summary-text" style="margin-top: 8px">
          <p v-for="(line, i) in cozeReport.split('\n')" :key="i">{{ line }}</p>
        </div>
      </div>
    </div>

    <!-- P2-14 LLM API 接入配置 -->
    <div class="glass-card fade-up" v-if="auth.role === 'admin'">
      <div class="card-title">
        <el-icon><Setting /></el-icon>
        <span>LLM API 配置</span>
      </div>
      <el-form :model="aiConfig" label-width="120px" style="max-width: 600px">
        <el-form-item label="接口地址">
          <el-input v-model="aiConfig.apiUrl" placeholder="https://api.openai.com/v1/chat/completions" />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input v-model="aiConfig.apiKey" type="password" show-password placeholder="sk-..." />
        </el-form-item>
        <el-form-item label="模型名称">
          <el-input v-model="aiConfig.modelName" placeholder="gpt-3.5-turbo" />
        </el-form-item>
        <el-divider content-position="left">Coze 工作流配置（用于生成专业考勤报告）</el-divider>
        <el-form-item label="Coze Token">
          <el-input v-model="aiConfig.cozeToken" type="password" show-password placeholder="pat_... 或 OAuth Token" />
        </el-form-item>
        <el-form-item label="工作流 ID">
          <el-input v-model="aiConfig.cozeWorkflowId" placeholder="如 7660329596181676075" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveAiConfig">保存配置</el-button>
          <el-button @click="testAiConfig" :loading="testing">测试连接</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- P2-15 LLM 生成区 -->
    <div class="glass-card fade-up">
      <div class="card-title">
        <el-icon><ChatDotRound /></el-icon>
        <span>AI 个性化解读（如需配置API）</span>
      </div>
      <el-input v-model="userQuestion" type="textarea" :rows="3" placeholder="请输入你的问题，如：本月哪个部门考勤最好？" />
      <div style="margin-top: 12px">
        <el-button type="primary" :loading="asking" @click="askLLM">向 AI 提问</el-button>
      </div>
      <div class="answer-box" v-if="llmAnswer">
        <div class="answer-a">{{ llmAnswer }}</div>
        <div class="quality-tip" v-if="qualityTip" :class="qualityTipClass">{{ qualityTip }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { MagicStick, Setting, ChatDotRound } from '@element-plus/icons-vue'
import request from '../api/request'
import { useAuthStore } from '../stores/auth'
import { useRulesStore } from '../stores/rules'
import { calcAll, summarize } from '../utils/attendance'

const auth = useAuthStore()
const rulesStore = useRulesStore()
const loading = ref(false)

const employees = ref([])
const records = ref([])
const appeals = ref([])
const leaves = ref([])
const computedRecords = ref([])

const approvedAppealIds = computed(() =>
  appeals.value.filter((a) => a.status === 'approved').map((a) => a.recordId)
)

// P2-11 / P2-12
const summaryRange = ref('week')
const summaryText = ref('')

// Coze 工作流报告
const cozeLoading = ref(false)
const cozeReport = ref('')

// P2-14 AI 配置
const aiConfig = reactive({
  apiUrl: '',
  apiKey: '',
  modelName: '',
  cozeToken: '',
  cozeWorkflowId: ''
})
const testing = ref(false)

// P2-15 LLM 问答
const userQuestion = ref('')
const llmAnswer = ref('')
const asking = ref(false)
const qualityTip = ref('')
const qualityTipClass = ref('')

function getRangeStart(range) {
  const now = new Date()
  if (range === 'week') {
    const day = now.getDay() || 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - day + 1)
    return monday.toISOString().slice(0, 10)
  }
  if (range === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  }
  return null
}

function getRangeRecords(range) {
  const start = getRangeStart(range)
  if (!start) return computedRecords.value
  return computedRecords.value.filter((r) => r.date >= start)
}

// P2-11 模板化总结生成
function generateSummary() {
  const rangeRecords = getRangeRecords(summaryRange.value)
  const s = summarize(rangeRecords)
  const rangeLabel = summaryRange.value === 'week' ? '本周' : '本月'

  // 计算关键数字
  const totalRecords = rangeRecords.length
  const empCount = new Set(rangeRecords.map((r) => r.employeeId)).size
  const lateEmps = {}
  rangeRecords.forEach((r) => {
    if (r.status === 'late') lateEmps[r.employeeId] = (lateEmps[r.employeeId] || 0) + 1
  })
  const topLateEntry = Object.entries(lateEmps).sort((a, b) => b[1] - a[1])[0]
  const topLateEmp = topLateEntry ? employees.value.find((e) => e.employeeId === topLateEntry[0]) : null

  const deptOt = {}
  rangeRecords.forEach((r) => {
    const emp = employees.value.find((e) => e.employeeId === r.employeeId)
    const dept = emp?.dept || '未知'
    deptOt[dept] = (deptOt[dept] || 0) + (r.overtimeMinutes || 0)
  })
  const topOtDept = Object.entries(deptOt).sort((a, b) => b[1] - a[1])[0]

  const lines = [
    `${rangeLabel}考勤数据共 ${totalRecords} 条记录，涉及 ${empCount} 名员工。`,
    `整体出勤率为 ${s.attendanceRate}%，累计迟到 ${s.lateCount} 次、早退 ${s.earlyCount} 次、缺勤 ${s.absent} 次。`,
    `累计加班时长 ${s.overtimeHours} 小时，平均每人加班 ${(s.overtimeHours / Math.max(empCount, 1)).toFixed(1)} 小时。`,
    topLateEmp ? `迟到最多的员工是 ${topLateEmp.name}（${topLateEntry[1]} 次），建议关注其考勤情况。` : `${rangeLabel}无迟到记录，考勤表现良好。`,
    topOtDept ? `加班最多的部门是 ${topOtDept[0]}（${(topOtDept[1] / 60).toFixed(1)} 小时）。` : '',
    s.attendanceRate >= 95 ? '整体考勤状况优秀，建议保持。' : s.attendanceRate >= 80 ? '整体考勤状况一般，存在改进空间。' : '整体考勤状况较差，需重点关注。'
  ].filter(Boolean)

  summaryText.value = lines.join('\n')
  ElMessage.success('总结已生成')
}

// 调用 Coze 工作流生成专业考勤报告
async function generateCozeReport() {
  if (!computedRecords.value.length) {
    ElMessage.warning('考勤数据尚未加载，请稍后再试')
    return
  }
  cozeLoading.value = true
  cozeReport.value = ''
  try {
    const rangeRecords = getRangeRecords(summaryRange.value)
    const s = summarize(rangeRecords)
    const rangeLabel = summaryRange.value === 'week' ? '本周' : '本月'
    const today = new Date().toISOString().slice(0, 10)

    // 员工维度明细
    const empCount = new Set(rangeRecords.map((r) => r.employeeId)).size
    const empMap = {}
    rangeRecords.forEach((r) => {
      if (!empMap[r.employeeId]) {
        const emp = employees.value.find((e) => e.employeeId === r.employeeId) || {}
        empMap[r.employeeId] = { name: emp.name || '未知', dept: emp.dept || '未知', late: 0, early: 0, absent: 0, missing: 0, overtime: 0, normal: 0 }
      }
      const e = empMap[r.employeeId]
      if (r.status === 'late') e.late++
      else if (r.status === 'early') e.early++
      else if (r.status === 'absent') e.absent++
      else if (r.status === 'missing') e.missing++
      else e.normal++
      e.overtime += (r.overtimeMinutes || 0)
    })
    const empLines = Object.values(empMap)
      .map((e) => `${e.name}（${e.dept}）：正常${e.normal}次，迟到${e.late}次，早退${e.early}次，缺勤${e.absent}次，缺卡${e.missing}次，加班${(e.overtime / 60).toFixed(1)}小时`)
      .join('；')

    // 部门维度明细
    const deptStats = {}
    rangeRecords.forEach((r) => {
      const emp = employees.value.find((e) => e.employeeId === r.employeeId)
      const dept = emp?.dept || '未知'
      if (!deptStats[dept]) deptStats[dept] = { late: 0, early: 0, absent: 0, overtime: 0, count: 0 }
      deptStats[dept].count++
      if (r.status === 'late') deptStats[dept].late++
      if (r.status === 'early') deptStats[dept].early++
      if (r.status === 'absent' || r.status === 'missing') deptStats[dept].absent++
      deptStats[dept].overtime += (r.overtimeMinutes || 0)
    })
    const deptLines = Object.entries(deptStats)
      .map(([d, v]) => `${d}：出勤${v.count}次，迟到${v.late}次，早退${v.early}次，缺勤${v.absent}次，加班${(v.overtime / 60).toFixed(1)}小时`)
      .join('；')

    // 请假统计
    const rangeStart = getRangeStart(summaryRange.value)
    const rangeLeaves = leaves.value.filter((l) => !rangeStart || l.startDate >= rangeStart || l.endDate >= rangeStart)
    const leaveInfo = rangeLeaves.length > 0
      ? `请假记录${rangeLeaves.length}条：${rangeLeaves.map((l) => { const e = employees.value.find(emp => emp.employeeId === l.employeeId); return `${e?.name || l.employeeId}(${l.leaveType || l.type || '事假'}) ${l.startDate}至${l.endDate}` }).join('；')}`
      : '无请假记录'

    const input = `统计周期：${rangeLabel}（截至${today}）。整体考勤数据：共${rangeRecords.length}条打卡记录，涉及${empCount}名员工。整体出勤率${s.attendanceRate}%，迟到${s.lateCount}次，早退${s.earlyCount}次，缺勤${s.absent}次，加班${s.overtimeHours}小时。${leaveInfo}。各部门明细：${deptLines}。员工个人明细：${empLines}。请基于以上考勤统计数据生成一份正式的考勤总结报告，要求包含整体情况分析、部门对比、突出问题和改进建议。`

    console.log('[AIInsight] 发送 Coze input:', input.slice(0, 200))
    const { data } = await request.post('/aiConfig/coze_run', { input }, { timeout: 120000 })
    cozeReport.value = data.reply || '报告生成失败，未返回内容'
    ElMessage.success('AI 报告已生成')
  } catch (e) {
    cozeReport.value = '报告生成失败：' + (e.response?.data?.message || e.message)
  } finally {
    cozeLoading.value = false
  }
}

// P2-14 AI 配置
async function loadAiConfig() {
  try {
    const { data } = await request.get('/aiConfig')
    if (data) {
      aiConfig.apiUrl = data.apiUrl || ''
      aiConfig.apiKey = data.apiKey || ''
      aiConfig.modelName = data.modelName || ''
      aiConfig.cozeToken = data.cozeToken || ''
      aiConfig.cozeWorkflowId = data.cozeWorkflowId || ''
    }
  } catch (e) { /* 忽略 */ }
}

async function saveAiConfig() {
  try {
    await request.post('/aiConfig', aiConfig)
    ElMessage.success('AI 配置已保存')
  } catch (e) { /* 拦截器提示 */ }
}

async function testAiConfig() {
  testing.value = true
  try {
    const { data } = await request.post('/aiConfig/test', { question: '你好，请回复"连接成功"' })
    ElMessage.success('连接成功：' + (data.reply || 'OK'))
  } catch (e) {
    ElMessage.error('连接失败：' + (e.response?.data?.message || e.message))
  } finally {
    testing.value = false
  }
}

// P2-15 LLM 问答 + 质量校验
async function askLLM() {
  if (!userQuestion.value.trim()) {
    ElMessage.warning('请输入问题')
    return
  }
  asking.value = true
  llmAnswer.value = ''
  qualityTip.value = ''
  try {
    // 先用本地数据生成上下文
    const rangeRecords = getRangeRecords('month')
    const s = summarize(rangeRecords)
    const context = `本月考勤数据：出勤率${s.attendanceRate}%，迟到${s.lateCount}次，早退${s.earlyCount}次，缺勤${s.absent}次，加班${s.overtimeHours}小时。`
    const { data } = await request.post('/aiConfig/ask', {
      question: userQuestion.value,
      context
    })
    const reply = data.reply || '暂无回复'
    // P2-15 质量校验：检查是否包含至少 3 个数字
    const numbers = reply.match(/\d+(\.\d+)?/g) || []
    if (numbers.length < 3) {
      qualityTip.value = `提示：回答中仅包含 ${numbers.length} 个数字，内容可能过于空泛，建议补充具体数据。`
      qualityTipClass.value = 'warn'
    } else {
      qualityTip.value = `校验通过：回答包含 ${numbers.length} 个关键数字。`
      qualityTipClass.value = 'ok'
    }
    llmAnswer.value = reply
  } catch (e) {
    // 降级：使用本地模板回答
    const rangeRecords = getRangeRecords('month')
    const s = summarize(rangeRecords)
    llmAnswer.value = `（LLM 不可用，使用本地数据回答）根据本月数据：出勤率 ${s.attendanceRate}%，迟到 ${s.lateCount} 次，早退 ${s.earlyCount} 次，缺勤 ${s.absent} 次，加班 ${s.overtimeHours} 小时。`
    qualityTip.value = '提示：LLM 接口未配置或连接失败，已使用本地数据降级回答。'
    qualityTipClass.value = 'warn'
  } finally {
    asking.value = false
  }
}

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
    computedRecords.value = calcAll(records.value, rulesStore.rules, leaves.value, approvedAppealIds.value).map((r) => {
      const emp = employees.value.find((e) => e.employeeId === r.employeeId) || {}
      return { ...r, name: emp.name || '未知', dept: emp.dept || '未知' }
    })
    if (auth.role === 'admin') await loadAiConfig()
    generateSummary()
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.ai-page {
  max-width: 1100px;
}
.glass-card {
  padding: 20px;
  margin-bottom: 20px;
}
.summary-text {
  background: var(--bg);
  padding: 16px;
  border-radius: 8px;
  line-height: 1.8;
  font-size: 14px;
}
.summary-text p {
  margin: 0 0 8px;
}
.coze-report {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid #d1fae5;
  border-radius: 8px;
  background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
}
.coze-report-title {
  font-weight: 700;
  font-size: 15px;
  color: #16a34a;
}
.answer-box {
  background: var(--bg);
  padding: 16px;
  border-radius: 8px;
  margin-top: 12px;
}
.answer-q {
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text);
}
.answer-a {
  color: var(--text-2);
  line-height: 1.8;
}
.quality-tip {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
}
.quality-tip.ok {
  background: #f0fdf4;
  color: #16a34a;
}
.quality-tip.warn {
  background: #fffbeb;
  color: #d97706;
}
</style>
