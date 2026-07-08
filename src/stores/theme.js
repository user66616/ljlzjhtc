import { defineStore } from 'pinia'

export const useThemeStore = defineStore('theme', {
  state: () => ({
    dark: false
  }),
  actions: {
    init() {
      const saved = localStorage.getItem('theme')
      this.dark = saved === 'dark'
      this.apply()
    },
    toggle() {
      this.dark = !this.dark
      localStorage.setItem('theme', this.dark ? 'dark' : 'light')
      this.apply()
    },
    apply() {
      const html = document.documentElement
      if (this.dark) {
        html.classList.add('dark-mode')
      } else {
        html.classList.remove('dark-mode')
      }
    }
  }
})
