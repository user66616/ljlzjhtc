<template>
  <div class="login-page">
    <div class="login-bg">
      <div class="bg-blob blob-1"></div>
      <div class="bg-blob blob-2"></div>
      <div class="bg-blob blob-3"></div>
    </div>

    <div class="login-wrap fade-up">
      <!-- 左侧品牌区 -->
      <div class="brand-panel">
        <div class="brand-logo">
          <el-icon :size="36"><DataAnalysis /></el-icon>
        </div>
        <h1>企业考勤数据<br />智能统计系统</h1>
        <p>文件导入 · 自动清洗 · 规则配置 · 统计分析 · 看板报表</p>
        <div class="role-hint">
          <div class="hint-item">
            <el-tag type="danger" effect="dark" size="small" round>admin</el-tag>
            <span>管理员 / 123456</span>
          </div>
          <div class="hint-item">
            <el-tag type="warning" effect="dark" size="small" round>manager</el-tag>
            <span>部门负责人 / 123456</span>
          </div>
          <div class="hint-item">
            <el-tag type="success" effect="dark" size="small" round>employee</el-tag>
            <span>普通员工 / 123456</span>
          </div>
        </div>
      </div>

      <!-- 右侧表单区 -->
      <div class="form-panel">
        <h2>欢迎登录</h2>
        <p class="form-sub">请输入您的账号信息</p>
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          size="large"
          @submit.prevent="onLogin"
        >
          <el-form-item prop="username">
            <el-input v-model="form.username" placeholder="用户名" :prefix-icon="User" clearable />
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="密码"
              :prefix-icon="Lock"
              show-password
              @keyup.enter="onLogin"
            />
          </el-form-item>
          <el-button
            type="primary"
            class="login-btn"
            :loading="loading"
            @click="onLogin"
          >
            登 录
          </el-button>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const formRef = ref()
const loading = ref(false)

const form = reactive({ username: 'admin', password: '123456' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function onLogin() {
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      const user = await auth.login(form.username, form.password)
      ElMessage.success(`欢迎回来，${user.name}`)
      router.push('/dashboard')
    } catch (e) {
      // 错误已由 request 拦截器提示；此处补充用户名密码错误
      ElMessage.error(e.message || '登录失败')
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped>
.login-page {
  position: relative;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0f172a 100%);
}

.login-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.bg-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
  animation: float 8s ease-in-out infinite;
}
.blob-1 {
  width: 420px;
  height: 420px;
  background: #3b82f6;
  top: -120px;
  left: -80px;
}
.blob-2 {
  width: 360px;
  height: 360px;
  background: #8b5cf6;
  bottom: -100px;
  right: -60px;
  animation-delay: 2s;
}
.blob-3 {
  width: 280px;
  height: 280px;
  background: #06b6d4;
  top: 40%;
  left: 50%;
  animation-delay: 4s;
}
@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(30px, -30px) scale(1.1);
  }
}

.login-wrap {
  position: relative;
  z-index: 1;
  width: 880px;
  max-width: 94vw;
  height: 520px;
  max-height: 90vh;
  display: flex;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
}

.brand-panel {
  flex: 1;
  background: linear-gradient(160deg, rgba(59, 130, 246, 0.25), rgba(139, 92, 246, 0.25));
  padding: 48px 44px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: #fff;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}
.brand-logo {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 28px;
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.5);
}
.brand-panel h1 {
  font-size: 30px;
  font-weight: 800;
  line-height: 1.3;
  margin: 0 0 16px;
  letter-spacing: -0.02em;
}
.brand-panel p {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 40px;
  line-height: 1.6;
}
.role-hint {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.hint-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
}
.hint-item :deep(.el-tag) {
  min-width: 80px;
  text-align: center;
}

.form-panel {
  width: 380px;
  background: #fff;
  padding: 56px 44px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.form-panel h2 {
  font-size: 26px;
  font-weight: 700;
  margin: 0 0 8px;
  color: var(--text);
}
.form-sub {
  color: var(--text-2);
  font-size: 13px;
  margin: 0 0 32px;
}
.login-btn {
  width: 100%;
  height: 46px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.35);
  transition: transform 0.2s, box-shadow 0.2s;
}
.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(59, 130, 246, 0.45);
}

@media (max-width: 720px) {
  .login-wrap {
    flex-direction: column;
    height: auto;
  }
  .brand-panel {
    padding: 32px;
  }
  .form-panel {
    width: 100%;
    padding: 32px;
  }
}
</style>
