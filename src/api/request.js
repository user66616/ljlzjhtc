import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
})

// 响应拦截：统一错误提示（F-09-01）
request.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.message || err.message || '请求失败，请稍后重试'
    ElMessage.error(msg)
    return Promise.reject(err)
  }
)

export default request
