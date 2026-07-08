import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/Login.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('../layout/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { roles: ['admin', 'manager', 'employee'], title: '统计看板' }
      },
      {
        path: 'import',
        name: 'import',
        component: () => import('../views/Import.vue'),
        meta: { roles: ['admin'], title: '数据导入' }
      },
      {
        path: 'records',
        name: 'records',
        component: () => import('../views/Records.vue'),
        meta: { roles: ['admin', 'manager', 'employee'], title: '考勤记录' }
      },
      {
        path: 'rules',
        name: 'rules',
        component: () => import('../views/Rules.vue'),
        meta: { roles: ['admin'], title: '规则配置' }
      },
      {
        path: 'exceptions',
        name: 'exceptions',
        component: () => import('../views/Exceptions.vue'),
        meta: { roles: ['admin', 'manager'], title: '异常处理' }
      },
      {
        path: 'reports',
        name: 'reports',
        component: () => import('../views/Reports.vue'),
        meta: { roles: ['admin', 'manager'], title: '月报中心' }
      },
      {
        path: 'employee/:employeeId',
        name: 'employee-profile',
        component: () => import('../views/EmployeeProfile.vue'),
        meta: { roles: ['admin', 'manager', 'employee'], title: '员工主页' }
      },
      {
        path: 'appeals',
        name: 'appeals',
        component: () => import('../views/Appeals.vue'),
        meta: { roles: ['admin', 'manager', 'employee'], title: '考勤申诉' }
      },
      {
        path: 'ai-insight',
        name: 'ai-insight',
        component: () => import('../views/AIInsight.vue'),
        meta: { roles: ['admin', 'manager', 'employee'], title: '智能解读' }
      },
      {
        path: 'operation-logs',
        name: 'operation-logs',
        component: () => import('../views/OperationLogs.vue'),
        meta: { roles: ['admin'], title: '操作日志' }
      }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 全局前置守卫：登录态 + 角色权限
router.beforeEach((to) => {
  const auth = useAuthStore()
  auth.init()
  if (to.meta.public) return true
  if (!auth.isLoggedIn) return { name: 'login' }
  const roles = to.meta.roles
  if (roles && !roles.includes(auth.role)) return { name: 'dashboard' }
  return true
})

export default router
