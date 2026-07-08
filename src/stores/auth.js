import { defineStore } from 'pinia'
import request from '../api/request'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    initialized: false
  }),
  getters: {
    isLoggedIn: (s) => !!s.user,
    role: (s) => s.user?.role || '',
    name: (s) => s.user?.name || '',
    dept: (s) => s.user?.dept || '',
    employeeId: (s) => s.user?.employeeId || ''
  },
  actions: {
    init() {
      if (this.initialized) return
      const saved = localStorage.getItem('attendance_user')
      if (saved) {
        try {
          const u = JSON.parse(saved)
          // 兼容旧格式：若存在下划线字段或缺少关键字段，清空重新登录
          if (!u || u.employee_id || !u.employeeId || (u.role === 'manager' && !u.dept)) {
            this.user = null
            localStorage.removeItem('attendance_user')
          } else {
            this.user = u
          }
        } catch {
          this.user = null
        }
      }
      this.initialized = true
    },
    async login(username, password) {
      const { data } = await request.get('/users', { params: { username, password } })
      if (!data || data.length === 0) {
        throw new Error('用户名或密码错误')
      }
      const user = data[0]
      this.user = user
      localStorage.setItem('attendance_user', JSON.stringify(user))
      return user
    },
    logout() {
      this.user = null
      localStorage.removeItem('attendance_user')
    },
    async changePassword(oldPassword, newPassword) {
      if (!this.user || !this.user.id) throw new Error('用户未登录')
      const { data } = await request.put('/users/password', {
        userId: this.user.id,
        oldPassword,
        newPassword
      })
      return data
    }
  }
})
