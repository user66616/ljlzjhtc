<template>
  <div class="page logs-page" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">操作日志（P2-17）</h2>
      <p class="page-desc">记录导入数据、修改规则、处理异常等关键操作</p>
    </div>

    <div class="glass-card filter-bar fade-up">
      <el-input v-model="keyword" placeholder="搜索操作人/动作/详情" clearable style="width: 280px" />
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        style="margin-left: 12px"
      />
    </div>

    <div class="glass-card fade-up">
      <el-table :data="filteredLogs" border size="small" max-height="600">
        <el-table-column prop="id" label="ID" width="60" align="center" />
        <el-table-column prop="operator" label="操作人" width="100" />
        <el-table-column prop="action" label="操作动作" width="140">
          <template #default="{ row }">
            <el-tag :type="actionMeta[row.action]?.type || 'info'" size="small">{{ row.action }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="detail" label="操作详情" min-width="250" show-overflow-tooltip />
        <el-table-column label="操作时间" width="170">
          <template #default="{ row }">{{ (row.createdAt || '').slice(0, 19) }}</template>
        </el-table-column>
      </el-table>
      <el-empty v-if="filteredLogs.length === 0" description="暂无操作日志" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import request from '../api/request'

const loading = ref(false)
const logs = ref([])
const keyword = ref('')
const dateRange = ref(null)

const actionMeta = {
  '导入数据': { type: 'primary' },
  '清空数据': { type: 'danger' },
  '修改规则': { type: 'warning' },
  '回滚规则': { type: 'warning' },
  '回滚数据': { type: 'warning' },
  '修改打卡': { type: 'primary' },
  '处理异常': { type: 'warning' },
  '审核申诉': { type: 'success' }
}

const filteredLogs = computed(() => {
  let arr = logs.value
  if (keyword.value) {
    const k = keyword.value.toLowerCase()
    arr = arr.filter((l) =>
      (l.operator || '').toLowerCase().includes(k) ||
      (l.action || '').toLowerCase().includes(k) ||
      (l.detail || '').toLowerCase().includes(k)
    )
  }
  if (dateRange.value && dateRange.value.length === 2) {
    const [start, end] = dateRange.value
    arr = arr.filter((l) => {
      const d = (l.createdAt || '').slice(0, 10)
      return d >= start && d <= end
    })
  }
  return arr
})

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await request.get('/operationLogs')
    logs.value = data
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.filter-bar {
  margin-bottom: 16px;
  padding: 12px 20px;
  display: flex;
  align-items: center;
}
.glass-card {
  padding: 20px;
  margin-bottom: 20px;
}
</style>
