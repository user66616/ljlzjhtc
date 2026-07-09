<template>
  <el-container class="app-layout">
    <!-- 侧边栏 -->
    <el-aside :width="collapsed ? '64px' : '230px'" class="app-aside">
      <div class="logo">
        <el-icon class="logo-icon"><DataAnalysis /></el-icon>
        <span v-show="!collapsed" class="logo-text">考勤智能统计</span>
      </div>
      <el-menu
        :default-active="route.path"
        :collapse="collapsed"
        :collapse-transition="false"
        router
        class="app-menu"
        background-color="transparent"
        text-color="#cbd5e1"
        active-text-color="#ffffff"
      >
        <el-menu-item
          v-for="m in menus"
          :key="m.path"
          :index="m.path"
          @click="router.push(m.path)"
        >
          <el-icon><component :is="m.icon" /></el-icon>
          <template #title>{{ m.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <!-- 顶栏 -->
      <el-header class="app-header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="collapsed = !collapsed">
            <Fold v-if="!collapsed" />
            <Expand v-else />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ route.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
          <div class="live-clock">
            <el-icon><Clock /></el-icon>
            <span>{{ currentTime }}</span>
          </div>
        </div>
        <div class="header-right">
          <el-button
            v-if="auth.role === 'employee'"
            type="primary"
            plain
            round
            size="small"
            :icon="Avatar"
            @click="router.push(`/employee/${auth.employeeId}`)"
          >我的主页</el-button>
          <el-tag :type="roleTagType" effect="light" round>{{ roleLabel }}</el-tag>
                    <el-icon class="icon-btn theme-btn" :class="{ active: theme.dark }" @click="theme.toggle()" title="切换主题">
            <Moon v-if="!theme.dark" />
            <Sunny v-else />
          </el-icon>
          <el-badge :value="notifyCount" :max="99" :hidden="notifyCount === 0" class="notify-badge">
            <el-icon class="icon-btn notify-btn" :class="{ active: notifyVisible }" @click="notifyVisible = true" title="消息提醒">
              <Bell />
            </el-icon>
          </el-badge>
          <el-dropdown @command="onCommand">
            <span class="user-chip">
              <el-avatar :size="30" class="user-avatar">{{ avatarText }}</el-avatar>
              <span class="user-name">{{ auth.name }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="password">
                  <el-icon><Lock /></el-icon> 修改密码
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>
                  <el-icon><SwitchButton /></el-icon> 退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 主体 -->
      <el-main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>

  <!-- 修改密码弹窗 -->
  <ChangePasswordDialog v-model="pwdVisible" />

  <!-- 消息提醒抽屉 -->
  <el-drawer v-model="notifyVisible" title="消息提醒" size="380px" direction="rtl">
    <template #header="{ close }">
      <div class="drawer-header">
        <span class="drawer-title">消息提醒</span>
        <el-button v-if="unreadCount > 0" type="primary" link size="small" @click="markAllRead">全部已读</el-button>
      </div>
    </template>
    <div class="notify-list">
      <div
        v-for="n in notifyList"
        :key="n.id"
        class="notify-item"
        :class="['type-' + n.type, { 'is-read': readIds.has(n.id) }]"
        @click="goNotify(n)"
      >
        <span class="unread-dot" v-if="!readIds.has(n.id)"></span>
        <el-icon class="notify-icon">
          <Warning v-if="n.type === 'exception'" />
          <EditPen v-else-if="n.type === 'appeal'" />
        </el-icon>
        <div class="notify-body">
          <div class="notify-text">{{ n.text }}</div>
          <div class="notify-time">{{ n.time }}</div>
        </div>
        <el-icon class="notify-arrow"><ArrowRight /></el-icon>
      </div>
      <el-empty v-if="notifyList.length === 0" description="暂无消息" />
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { Avatar, Clock, Moon, Sunny, Bell, ArrowDown, Warning, EditPen, ArrowRight } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'
import { useThemeStore } from '../stores/theme'
import ChangePasswordDialog from '../components/ChangePasswordDialog.vue'
import request from '../api/request'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const theme = useThemeStore()
theme.init()

const collapsed = ref(false)
const pwdVisible = ref(false)
const notifyVisible = ref(false)

// 实时时钟
const currentTime = ref('')
let clockTimer = null
function updateClock() {
  const now = new Date()
  const w = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()]
  const pad = (n) => String(n).padStart(2, '0')
  currentTime.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 周${w} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}
onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
})
onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})

const allMenus = [
  { path: '/dashboard', title: '统计看板', icon: 'DataAnalysis', roles: ['admin', 'manager', 'employee'] },
  { path: '/import', title: '数据导入', icon: 'UploadFilled', roles: ['admin'] },
  { path: '/records', title: '考勤记录', icon: 'Document', roles: ['admin', 'manager', 'employee'] },
  { path: '/exceptions', title: '异常记录', icon: 'WarningFilled', roles: ['admin', 'manager'] },
  { path: '/reports', title: '月报中心', icon: 'Document', roles: ['admin', 'manager'] },
  { path: '/rules', title: '规则配置', icon: 'Setting', roles: ['admin'] },
  { path: '/appeals', title: '考勤申诉', icon: 'ChatLineRound', roles: ['admin', 'manager', 'employee'] },
  { path: '/ai-insight', title: '智能解读', icon: 'MagicStick', roles: ['admin', 'manager', 'employee'] },
  { path: '/operation-logs', title: '操作日志', icon: 'List', roles: ['admin'] }
]

const menus = computed(() => allMenus.filter((m) => m.roles.includes(auth.role)))

const roleMap = {
  admin: { label: '管理员', type: 'danger' },
  manager: { label: '部门负责人', type: 'warning' },
  employee: { label: '普通员工', type: 'success' }
}
const roleLabel = computed(() => roleMap[auth.role]?.label || '用户')
const roleTagType = computed(() => roleMap[auth.role]?.type || 'info')

const avatarText = computed(() => (auth.name || '?').slice(0, 1))

// 消息提醒
const notifyList = ref([])
const readIds = ref(new Set())

// 从 localStorage 加载已读记录
function loadReadIds() {
  try {
    const key = `notify_read_${auth.employeeId || auth.username || 'default'}`
    const saved = localStorage.getItem(key)
    if (saved) readIds.value = new Set(JSON.parse(saved))
  } catch (e) { readIds.value = new Set() }
}

// 保存已读记录
function saveReadIds() {
  try {
    const key = `notify_read_${auth.employeeId || auth.username || 'default'}`
    localStorage.setItem(key, JSON.stringify([...readIds.value]))
  } catch (e) {}
}

const unreadCount = computed(() => {
  return notifyList.value.filter((n) => !readIds.value.has(n.id)).length
})
const notifyCount = computed(() => unreadCount.value)

function markRead(id) {
  if (!readIds.value.has(id)) {
    readIds.value.add(id)
    saveReadIds()
  }
}

function markAllRead() {
  notifyList.value.forEach((n) => readIds.value.add(n.id))
  saveReadIds()
}

async function loadNotify() {
  const list = []
  try {
    // 管理员/经理：本月异常记录 + 待审核申诉
    if (auth.role === 'admin' || auth.role === 'manager') {
      const { data: records } = await request.get('/attendanceRecords')
      const today = new Date().toISOString().slice(0, 10)
      const thisMonthRecords = records.filter((r) => r.date >= today.slice(0, 8) + '01')
      const exceptionStatuses = ['late', 'early', 'missing', 'absent']
      const thisMonthExceptions = thisMonthRecords.filter((r) => exceptionStatuses.includes(r.status))
      if (thisMonthExceptions.length > 0) {
        list.push({ id: 'exc', type: 'exception', text: `${thisMonthExceptions.length} 条本月异常考勤记录`, time: '今日' })
      }
      const { data: appeals } = await request.get('/appeals', { params: { status: 'pending' } })
      appeals.forEach((a) => {
        list.push({ id: 'appeal-' + a.id, type: 'appeal', text: `${a.employeeId} 的申诉待审核`, time: (a.createdAt || '').slice(0, 16) })
      })
    }
    // 员工：查看本人申诉状态变更
    if (auth.role === 'employee' && auth.employeeId) {
      const { data: appeals } = await request.get('/appeals', { params: { employeeId: auth.employeeId } })
      appeals.forEach((a) => {
        if (a.status !== 'pending') {
          const statusText = a.status === 'approved' ? '已通过' : '已驳回'
          list.push({ id: 'appeal-' + a.id, type: 'appeal', text: `您的申诉${statusText}`, time: (a.reviewedAt || '').slice(0, 16) })
        }
      })
    }
  } catch (e) {
    console.error('加载消息失败', e)
  }
  notifyList.value = list
}

onMounted(() => {
  loadReadIds()
  loadNotify()
})

function goNotify(n) {
  markRead(n.id)
  notifyVisible.value = false
  if (n.type === 'exception') {
    router.push('/exceptions')
  } else if (n.type === 'appeal') {
    router.push('/appeals')
  }
}

function onCommand(cmd) {
  if (cmd === 'logout') {
    ElMessageBox.confirm('确认退出登录吗？', '提示', { type: 'warning' })
      .then(() => {
        auth.logout()
        router.push('/login')
      })
      .catch(() => {})
  } else if (cmd === 'password') {
    pwdVisible.value = true
  }
}
</script>

<style scoped>
.app-layout {
  height: 100vh;
}

.app-aside {
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
  transition: width 0.25s ease;
  overflow: hidden;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 18px;
  color: #fff;
  white-space: nowrap;
}
.logo-icon {
  font-size: 24px;
  color: #60a5fa;
  flex-shrink: 0;
}
.logo-text {
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(90deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.app-menu {
  padding: 8px 12px;
}
.app-menu :deep(.el-menu-item) {
  border-radius: 8px;
  margin-bottom: 4px;
  height: 46px;
  line-height: 46px;
}
.app-menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(90deg, #2563eb, #3b82f6) !important;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
}
.app-menu :deep(.el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.08) !important;
}

.app-header {
  background: var(--card);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.03);
}
.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.live-clock {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  background: var(--surface-2);
  color: var(--text-1);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.3px;
  border: 1px solid var(--border);
  .el-icon { color: var(--brand); }
}
.collapse-btn {
  font-size: 20px;
  cursor: pointer;
  color: var(--text-2);
  transition: color 0.2s;
}
.collapse-btn:hover {
  color: var(--brand);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 14px;
}
.icon-btn {
  font-size: 28px;
  cursor: pointer;
  color: var(--text-2);
  transition: all 0.2s;
  padding: 7px;
  border-radius: 12px;
  background: transparent;
}
.icon-btn:hover {
  color: var(--brand);
  background: var(--bg);
  transform: translateY(-1px);
}
.icon-btn.active {
  color: var(--brand);
  background: var(--el-color-primary-light-9);
}
.notify-badge :deep(.el-badge__content) {
  z-index: 1;
  border: none;
  font-size: 12px;
  height: 18px;
  line-height: 18px;
  padding: 0 6px;
  top: 4px;
  right: 6px;
}
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.drawer-title {
  font-size: 16px;
  font-weight: 600;
}
.notify-list {
  padding: 0 12px;
}
.notify-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 12px;
  border-radius: 10px;
  margin-bottom: 10px;
  background: var(--bg);
  transition: all 0.2s;
  cursor: pointer;
  border: 1px solid transparent;
  position: relative;
}
.notify-item.is-read {
  opacity: 0.55;
}
.notify-item.is-read .notify-text {
  font-weight: 400;
}
.unread-dot {
  position: absolute;
  top: 12px;
  left: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  flex-shrink: 0;
}
.notify-item:hover {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
  transform: translateX(2px);
}
.notify-icon {
  font-size: 20px;
  flex-shrink: 0;
}
.notify-item.type-exception .notify-icon {
  color: #ef4444;
}
.notify-item.type-appeal .notify-icon {
  color: #f59e0b;
}
.notify-arrow {
  font-size: 14px;
  color: var(--text-3);
  flex-shrink: 0;
}
.notify-item:hover .notify-arrow {
  color: var(--brand);
}
.notify-body {
  flex: 1;
  min-width: 0;
}
.notify-text {
  font-size: 14px;
  color: var(--text);
  margin-bottom: 4px;
}
.notify-time {
  font-size: 12px;
  color: var(--text-3);
}
.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 20px;
  transition: background 0.2s;
}
.user-chip:hover {
  background: var(--bg);
}
.user-avatar {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  font-weight: 600;
}
.user-name {
  font-size: 14px;
  font-weight: 500;
}

.app-main {
  padding: 0;
  background: var(--bg);
  overflow-y: auto;
}

/* 路由切换过渡 */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
}
</style>
