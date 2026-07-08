import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Vite 配置：将 /api 代理到 Express + MySQL 后端 (3001)
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
