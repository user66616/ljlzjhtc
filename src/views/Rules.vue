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
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Setting, Check, RefreshRight, View, Refresh, Cpu
} from '@element-plus/icons-vue'
import { useRulesStore } from '../stores/rules'

const rulesStore = useRulesStore()
const loading = ref(false)
const recalcing = ref(false)

const DEFAULT_RULES = {
  lateAfter: '09:05',
  earlyBefore: '18:00',
  overtimeAfter: '18:30',
  missingStrategy: 'mark'
}

const form = reactive({ ...DEFAULT_RULES })
const current = reactive({ ...DEFAULT_RULES })

onMounted(async () => {
  loading.value = true
  try {
    const r = await rulesStore.load()
    Object.assign(form, r)
    Object.assign(current, r)
  } finally {
    loading.value = false
  }
})

async function onSave() {
  const payload = {
    lateAfter: form.lateAfter,
    earlyBefore: form.earlyBefore,
    overtimeAfter: form.overtimeAfter,
    missingStrategy: form.missingStrategy
  }
  await rulesStore.save(payload)
  Object.assign(current, rulesStore.rules)
  ElMessage.success('规则保存成功，已即时生效')
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
</style>
