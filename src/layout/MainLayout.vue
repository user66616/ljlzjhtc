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
        </div>
        <div class="header-right">
          <el-tag :type="roleTagType" effect="light" round>{{ roleLabel }}</el-tag>
          <el-dropdown @command="onCommand">
            <span class="user-chip">
              <el-avatar :size="30" class="user-avatar">{{ avatarText }}</el-avatar>
              <span class="user-name">{{ auth.name }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">
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
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const collapsed = ref(false)

const allMenus = [
  { path: '/dashboard', title: '统计看板', icon: 'DataAnalysis', roles: ['admin', 'manager', 'employee'] },
  { path: '/import', title: '数据导入', icon: 'UploadFilled', roles: ['admin'] },
  { path: '/records', title: '考勤记录', icon: 'Document', roles: ['admin', 'manager', 'employee'] },
  { path: '/exceptions', title: '异常处理', icon: 'WarningFilled', roles: ['admin', 'manager'] },
  { path: '/reports', title: '月报中心', icon: 'Document', roles: ['admin', 'manager'] },
  { path: '/rules', title: '规则配置', icon: 'Setting', roles: ['admin'] }
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

function onCommand(cmd) {
  if (cmd === 'logout') {
    ElMessageBox.confirm('确认退出登录吗？', '提示', { type: 'warning' })
      .then(() => {
        auth.logout()
        router.push('/login')
      })
      .catch(() => {})
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
  background: #fff;
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
