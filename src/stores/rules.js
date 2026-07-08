import { defineStore } from 'pinia'
import request from '../api/request'

const DEFAULT_RULES = {
  lateAfter: '09:05',
  earlyBefore: '18:00',
  overtimeAfter: '18:30',
  missingStrategy: 'mark'
}

export const useRulesStore = defineStore('rules', {
  state: () => ({
    rules: { ...DEFAULT_RULES },
    loaded: false
  }),
  actions: {
    async load() {
      const { data } = await request.get('/attendanceRules')
      if (data && data.length > 0) {
        this.rules = data[0]
      } else {
        // 首次进入：写入默认规则
        const { data: created } = await request.post('/attendanceRules', { ...DEFAULT_RULES })
        this.rules = created
      }
      this.loaded = true
      return this.rules
    },
    async save(payload) {
      const id = this.rules?.id
      if (id) {
        const { data } = await request.put(`/attendanceRules/${id}`, payload)
        this.rules = data
      } else {
        const { data } = await request.post('/attendanceRules', payload)
        this.rules = data
      }
      return this.rules
    }
  }
})
