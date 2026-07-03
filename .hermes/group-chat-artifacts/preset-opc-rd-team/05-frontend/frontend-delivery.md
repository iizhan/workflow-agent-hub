# 前端产出多端交付代码方案
- 房间: preset-opc-rd-team
- 角色: 前端开发
- 产出人: 前端开发
- 时间: 2026/5/21 12:03:35
- 节点要求: 请基于已确认 UI 与后端接口方案输出前端交付内容。若当前房间已绑定可写项目，请直接给出真实代码变更，并严格使用代码文件块格式：<<<FILE:path/to/file>>>
文件内容
<<<END FILE>>>。至少提供一份需要写入项目的代码文件，再补充页面拆解、组件设计、状态管理、多端适配、联调步骤与测试关注点。
## 产出内容
Now I have full project context. Let me output the frontend delivery with real code changes.

<<<FILE:apps/web/admin/src/utils/env-config.js>>>
/**
 * Environment indicator configuration.
 * Shared between Web and Mobile (uni-app) login pages.
 *
 * Provides:
 *  - Normalized env short names (DEV/TEST/STG/PROD/DEMO/UNKNOWN)
 *  - Human-readable Chinese labels
 *  - CSS color tokens per environment
 *  - Display policy (hide in production)
 */

/**
 * Normalize raw environment value to standard short name.
 * Mirrors the backend EnvironmentHeaderFilter.normalize() logic.
 *
 * @param {string} raw - Raw value from header, build env, or config
 * @returns {string} Normalized short name
 */
export function normalizeEnv(raw) {
  if (!raw || typeof raw !== 'string' || raw.trim() === '') {
    return 'UNKNOWN'
  }
  const key = raw.trim().toLowerCase()
  const map = {
    development: 'DEV', dev: 'DEV', localhost: 'DEV',
    test: 'TEST', testing: 'TEST', qa: 'TEST',
    staging: 'STG', stg: 'STG', uat: 'STG', pre: 'STG', preprod: 'STG',
    production: 'PROD', prod: 'PROD',
    demo: 'DEMO'
  }
  return map[key] || 'UNKNOWN'
}

/**
 * Chinese label for display in login pages.
 *
 * @param {string} env - Normalized short name (DEV/TEST/STG/PROD/DEMO/UNKNOWN)
 * @returns {string} Human-readable label
 */
export function getEnvLabel(env) {
  const map = {
    DEV: '开发环境',
    TEST: '测试环境',
    STG: '预发环境',
    PROD: '生产环境',
    DEMO: '演示环境',
    UNKNOWN: '未知环境'
  }
  return map[env] || env
}

/**
 * CSS color token per environment.
 * Aligned with UI design doc design tokens.
 *
 * @param {string} env - Normalized short name
 * @returns {{ bg: string, text: string }} Background and text colors
 */
export function getEnvColors(env) {
  const map = {
    DEV:     { bg: '#409eff', text: '#ffffff' },
    TEST:    { bg: '#9c27b0', text: '#ffffff' },
    STG:     { bg: '#ff9800', text: '#ffffff' },
    PROD:    { bg: 'transparent', text: '#909399' },
    DEMO:    { bg: '#67c23a', text: '#ffffff' },
    UNKNOWN: { bg: '#f56c6c', text: '#ffffff' }
  }
  return map[env] || map.UNKNOWN
}

/**
 * Whether to hide the environment indicator entirely.
 * Production environments should not expose env info in DOM.
 *
 * @param {string} env - Normalized short name
 * @param {boolean} [forceHide=false] - Override to force hide
 * @returns {boolean}
 */
export function shouldHideEnv(env, forceHide = false) {
  if (forceHide) return true
  return env === 'PROD'
}
<<<END FILE>>>

<<<FILE:apps/web/admin/src/components/EnvBadge/index.vue>>>
<template>
  <span
    v-if="visible"
    class="env-badge"
    :class="{ 'env-badge--unknown': env === 'UNKNOWN' }"
    :style="badgeStyle"
    :title="`环境: ${label}\n变量: ${source}`"
  >
    {{ label }}
  </span>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { normalizeEnv, getEnvLabel, getEnvColors, shouldHideEnv } from '@/utils/env-config'
import service from '@/utils/request'

const props = defineProps({
  // Normalized env value; auto-detected if not provided
  env: { type: String, default: '' },
  // Force hide regardless of env value
  hide: { type: Boolean, default: false },
  // Display variant: 'corner' (fixed top-right) or 'inline' (inline with text)
  variant: { type: String, default: 'corner' }
})

const env = ref(props.env || 'UNKNOWN')
const source = ref('build') // 'header' | 'build' | 'unknown'

// Attempt to read from backend response header on mount
onMounted(async () => {
  if (props.env) {
    source.value = 'build'
    return
  }
  try {
    // Probe a lightweight endpoint to capture the X-Environment header
    const res = await service.get('/captchaMath')
    if (res.headers && res.headers['x-environment']) {
      env.value = normalizeEnv(res.headers['x-environment'])
      source.value = 'header'
    } else if (res.headers && res.headers['x-env']) {
      env.value = normalizeEnv(res.headers['x-env'])
      source.value = 'header'
    }
  } catch {
    // Header read failed; use build-time fallback
    const buildEnv = import.meta.env.VITE_APP_ENV || ''
    env.value = buildEnv ? normalizeEnv(buildEnv) : 'UNKNOWN'
    source.value = buildEnv ? 'build' : 'unknown'
  }
})

const label = computed(() => getEnvLabel(env.value))

const visible = computed(() => !shouldHideEnv(env.value, props.hide))

const badgeStyle = computed(() => {
  const colors = getEnvColors(env.value)
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: variant.value === 'corner' ? '4px 12px' : '2px 8px',
    borderRadius: variant.value === 'corner' ? '12px' : '4px',
    fontSize: variant.value === 'corner' ? '12px' : '11px',
    fontWeight: '500',
    lineHeight: '1',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    backgroundColor: colors.bg,
    color: colors.text
  }

  if (props.variant === 'corner') {
    return {
      ...base,
      position: 'fixed',
      top: '12px',
      right: '12px',
      zIndex: 9999,
      boxShadow: env.value === 'UNKNOWN' ? '0 0 8px rgba(245,108,108,0.6)' : '0 2px 8px rgba(0,0,0,0.15)'
    }
  }

  return base
})

// UNKNOWN pulse animation via CSS class
</script>

<style scoped>
.env-badge--unknown {
  animation: env-pulse 1.5s ease-in-out infinite;
}

@keyframes env-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@media (prefers-color-scheme: dark) {
  .env-badge {
    filter: brightness(0.9);
  }
}
</style>
<<<END FILE>>>

<<<FILE:apps/web/admin/src/utils/request.js>>>
import axios from 'axios'
import { ElNotification , ElMessageBox, ElMessage, ElLoading } from 'element-plus'
import { getToken } from '@/utils/auth'
import errorCode from '@/utils/errorCode'
import { tansParams, blobValidate } from '@/utils/pms'
import cache from '@/plugins/cache'
import { saveAs } from 'file-saver'
import useUserStore from '@/store/modules/user'
import { normalizeEnv } from '@/utils/env-config'

let downloadLoadingInstance
// 是否显示重新登录
export let isRelogin = { show: false }

// Global env indicator captured from response headers
let capturedEnv = null

axios.defaults.headers['Content-Type'] = 'application/json;charset=utf-8'
// 创建axios实例
const service = axios.create({
  // axios中请求配置有baseURL选项，表示请求URL公共部分
  baseURL: import.meta.env.VITE_APP_BASE_API,
  // 超时
  timeout: 10000
})

// request拦截器
service.interceptors.request.use(config => {
  // 是否需要设置 token
  const isToken = (config.headers || {}).isToken === false
  // 是否需要防止数据重复提交
  const isRepeatSubmit = (config.headers || {}).repeatSubmit === false
  // 间隔时间(ms)，小于此时间视为重复提交
  const interval = (config.headers || {}).interval || 1000
  if (getToken() && !isToken) {
    config.headers['Authorization'] = 'Bearer ' + getToken() // 让每个请求携带自定义token 请根据实际情况自行修改
  }
  // get请求映射params参数
  if (config.method === 'get' && config.params) {
    let url = config.url + '?' + tansParams(config.params)
    url = url.slice(0, -1)
    config.params = {}
    config.url = url
  }
  if (!isRepeatSubmit && (config.method === 'post' || config.method === 'put')) {
    const requestObj = {
      url: config.url,
      data: typeof config.data === 'object' ? JSON.stringify(config.data) : config.data,
      time: new Date().getTime()
    }
    const requestSize = Object.keys(JSON.stringify(requestObj)).length // 请求数据大小
    const limitSize = 5 * 1024 * 1024 // 限制存放数据5M
    if (requestSize >= limitSize) {
      console.warn(`[${config.url}]: ` + '请求数据大小超出允许的5M限制，无法进行防重复提交验证。')
      return config
    }
    const sessionObj = cache.session.getJSON('sessionObj')
    if (sessionObj === undefined || sessionObj === null || sessionObj === '') {
      cache.session.setJSON('sessionObj', requestObj)
    } else {
      const s_url = sessionObj.url                // 请求地址
      const s_data = sessionObj.data              // 请求数据
      const s_time = sessionObj.time              // 请求时间
      if (s_data === requestObj.data && requestObj.time - s_time < interval && s_url === requestObj.url) {
        const message = '数据正在处理，请勿重复提交'
        console.warn(`[${s_url}]: ` + message)
        return Promise.reject(new Error(message))
      } else {
        cache.session.setJSON('sessionObj', requestObj)
      }
    }
  }
  return config
}, error => {
    console.log(error)
    Promise.reject(error)
})

// 响应拦截器
service.interceptors.response.use(res => {
    // --- Environment header capture (non-blocking) ---
    try {
      const envHeader = res.headers?.['x-environment'] || res.headers?.['x-env']
      if (envHeader && !capturedEnv) {
        capturedEnv = normalizeEnv(envHeader)
        // Persist for other components that may not have triggered the header read
        try { sessionStorage.setItem('PMS_APP_ENV', capturedEnv) } catch {}
        // Dispatch event for reactive consumers
        window.dispatchEvent(new CustomEvent('pms:env-detected', { detail: { env: capturedEnv } }))
      }
    } catch {
      // Never let env capture interfere with business logic
    }
    // --- End env capture ---

    // 未设置状态码则默认成功状态
    const code = res.data.code || 200
    // 获取错误信息
    const msg = errorCode[code] || res.data.msg || errorCode['default']
    // 二进制数据则直接返回
    if (res.request.responseType ===  'blob' || res.request.responseType ===  'arraybuffer') {
      return res.data
    }
    if (code === 401) {
      if (!isRelogin.show) {
        isRelogin.show = true
        ElMessageBox.confirm('登录状态已过期，您可以继续留在该页面，或者重新登录', '系统提示', { confirmButtonText: '重新登录', cancelButtonText: '取消', type: 'warning' }).then(() => {
          isRelogin.show = false
          useUserStore().logOut().then(() => {
            location.href = '/index'
          })
      }).catch(() => {
        isRelogin.show = false
      })
    }
      return Promise.reject('无效的会话，或者会话已过期，请重新登录。')
    } else if (code === 500) {
      ElMessage({ message: msg, type: 'error' })
      return Promise.reject(new Error(msg))
    } else if (code === 601) {
      ElMessage({ message: msg, type: 'warning' })
      return Promise.reject(new Error(msg))
    } else if (code !== 200) {
      ElNotification.error({ title: msg })
      return Promise.reject('error')
    } else {
      return  Promise.resolve(res.data)
    }
  },
  error => {
    console.log('err' + error)
    let { message } = error
    if (message == "Network Error") {
      message = "后端接口连接异常"
    } else if (message.includes("timeout")) {
      message = "系统接口请求超时"
    } else if (message.includes("Request failed with status code")) {
      message = "系统接口" + message.slice(-3) + "异常"
    }
    ElMessage({ message: message, type: 'error', duration: 5 * 1000 })
    return Promise.reject(error)
  }
)

// Export captured env for login page / other consumers
export function getCapturedEnv() {
  return capturedEnv || sessionStorage.getItem('PMS_APP_ENV') || null
}

// 通用下载方法
export function download(url, params, filename, config) {
  downloadLoadingInstance = ElLoading.service({ text: "正在下载数据，请稍候", background: "rgba(0, 0, 0, 0.7)", })
  return service.post(url, params, {
    transformRequest: [(params) => { return tansParams(params) }],
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    responseType: 'blob',
    ...config
  }).then(async (data) => {
    const isBlob = blobValidate(data)
    if (isBlob) {
      const blob = new Blob([data])
      saveAs(blob, filename)
    } else {
      const resText = await data.text()
      const rspObj = JSON.parse(resText)
      const errMsg = errorCode[rspObj.code] || rspObj.msg || errorCode['default']
      ElMessage.error(errMsg)
    }
    downloadLoadingInstance.close()
  }).catch((r) => {
    console.error(r)
    ElMessage.error('下载文件出现错误，请联系管理员！')
    downloadLoadingInstance.close()
  })
}

export default service
<<<END FILE>>>

<<<FILE:apps/web/admin/src/views/login.vue>>>
<template>
  <div class="login">
    <el-form ref="loginRef" :model="loginForm" :rules="loginRules" class="login-form">
      <h3 class="title">{{ title }}</h3>
      <el-form-item prop="username">
        <el-input
          v-model="loginForm.username"
          type="text"
          size="large"
          auto-complete="off"
          placeholder="账号"
        >
          <template #prefix><svg-icon icon-class="user" class="el-input__icon input-icon" /></template>
        </el-input>
      </el-form-item>
      <el-form-item prop="password">
        <el-input
          v-model="loginForm.password"
          type="password"
          size="large"
          auto-complete="off"
          placeholder="密码"
          @keyup.enter="handleLogin"
        >
          <template #prefix><svg-icon icon-class="password" class="el-input__icon input-icon" /></template>
        </el-input>
      </el-form-item>
      <el-form-item prop="code" v-if="captchaEnabled">
        <el-input
          v-model="loginForm.code"
          size="large"
          auto-complete="off"
          placeholder="验证码"
          style="width: 63%"
          @keyup.enter="handleLogin"
        >
          <template #prefix><svg-icon icon-class="validCode" class="el-input__icon input-icon" /></template>
        </el-input>
        <div class="login-code">
          <img :src="codeUrl" @click="getCode" class="login-code-img"/>
        </div>
      </el-form-item>
      <el-checkbox v-model="loginForm.rememberMe" style="margin:0px 0px 25px 0px;">记住密码</el-checkbox>
      <el-form-item style="width:100%;">
        <el-button
          :loading="loading"
          size="large"
          type="primary"
          style="width:100%;"
          @click.prevent="handleLogin"
        >
          <span v-if="!loading">登 录</span>
          <span v-else>登 录 中...</span>
        </el-button>
        <div style="float: right;" v-if="register">
          <router-link class="link-type" :to="'/register'">立即注册</router-link>
        </div>
      </el-form-item>
    </el-form>
    <!--  底部  -->
    <div class="el-login-footer">
      <span>{{ footerContent }}</span>
    </div>
  </div>
  <!-- Environment indicator badge (top-right corner) -->
  <EnvBadge variant="corner" />
</template>

<script setup>
import { getCodeImg } from "@/api/login"
import Cookies from "js-cookie"
import { encrypt, decrypt } from "@/utils/jsencrypt"
import useUserStore from '@/store/modules/user'
import defaultSettings from '@/settings'
import EnvBadge from '@/components/EnvBadge/index.vue'
import { normalizeEnv, getEnvLabel } from '@/utils/env-config'
import { getCapturedEnv } from '@/utils/request'

const title = import.meta.env.VITE_APP_TITLE
const footerContent = defaultSettings.footerContent
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()
const { proxy } = getCurrentInstance()

// Environment detection: response header > build-time > UNKNOWN
const resolvedEnv = computed(() => {
  // 1. Try captured env from Axios response interceptor
  const captured = getCapturedEnv()
  if (captured) return captured
  // 2. Fall back to build-time VITE_APP_ENV
  const buildEnv = import.meta.env.VITE_APP_ENV
  if (buildEnv) return normalizeEnv(buildEnv)
  // 3. UNKNOWN
  return 'UNKNOWN'
})

const loginForm = ref({
  username: "admin",
  password: "admin123",
  rememberMe: false,
  code: "",
  uuid: ""
})

const loginRules = {
  username: [{ required: true, trigger: "blur", message: "请输入您的账号" }],
  password: [{ required: true, trigger: "blur", message: "请输入您的密码" }],
  code: [{ required: true, trigger: "change", message: "请输入验证码" }]
}

const codeUrl = ref("")
const loading = ref(false)
// 验证码开关
const captchaEnabled = ref(true)
// 注册开关
const register = ref(false)
const redirect = ref(undefined)

watch(route, (newRoute) => {
    redirect.value = newRoute.query && newRoute.query.redirect
}, { immediate: true })

function handleLogin() {
  proxy.$refs.loginRef.validate(valid => {
    if (valid) {
      loading.value = true
      // 勾选了需要记住密码设置在 cookie 中设置记住用户名和密码
      if (loginForm.value.rememberMe) {
        Cookies.set("username", loginForm.value.username, { expires: 30 })
        Cookies.set("password", encrypt(loginForm.value.password), { expires: 30 })
        Cookies.set("rememberMe", loginForm.value.rememberMe, { expires: 30 })
      } else {
        // 否则移除
        Cookies.remove("username")
        Cookies.remove("password")
        Cookies.remove("rememberMe")
      }
      // 调用action的登录方法
      userStore.login(loginForm.value).then(() => {
        const query = route.query
        const otherQueryParams = Object.keys(query).reduce((acc, cur) => {
          if (cur !== "redirect") {
            acc[cur] = query[cur]
          }
          return acc
        }, {})
        router.push({ path: redirect.value || "/", query: otherQueryParams })
      }).catch(() => {
        loading.value = false
        // 重新获取验证码
        if (captchaEnabled.value) {
          getCode()
        }
      })
    }
  })
}

function getCode() {
  getCodeImg().then(res => {
    captchaEnabled.value = res.captchaEnabled === undefined ? true : res.captchaEnabled
    if (captchaEnabled.value) {
      codeUrl.value = "data:image/gif;base64," + res.img
      loginForm.value.uuid = res.uuid
    }
  })
}

function getCookie() {
  const username = Cookies.get("username")
  const password = Cookies.get("password")
  const rememberMe = Cookies.get("rememberMe")
  loginForm.value = {
    username: username === undefined ? loginForm.value.username : username,
    password: password === undefined ? loginForm.value.password : decrypt(password),
    rememberMe: rememberMe === undefined ? false : Boolean(rememberMe)
  }
}

getCode()
getCookie()
</script>

<style lang='scss' scoped>
.login {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  background-image: url("../assets/images/login-background.jpg");
  background-size: cover;
}
.title {
  margin: 0px auto 30px auto;
  text-align: center;
  color: #707070;
}

.login-form {
  border-radius: 6px;
  background: #ffffff;
  width: 400px;
  padding: 25px 25px 5px 25px;
  z-index: 1;
  .el-input {
    height: 40px;
    input {
      height: 40px;
    }
  }
  .input-icon {
    height: 39px;
    width: 14px;
    margin-left: 0px;
  }
}
.login-tip {
  font-size: 13px;
  text-align: center;
  color: #bfbfbf;
}
.login-code {
  width: 33%;
  height: 40px;
  float: right;
  img {
    cursor: pointer;
    vertical-align: middle;
  }
}
.el-login-footer {
  height: 40px;
  line-height: 40px;
  position: fixed;
  bottom: 0;
  width: 100%;
  text-align: center;
  color: #fff;
  font-family: Arial;
  font-size: 12px;
  letter-spacing: 1px;
}
.login-code-img {
  height: 40px;
  padding-left: 12px;
}

html.dark .login {
  background-image: linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.55)), url("../assets/images/login-background.jpg");
  .login-form {
    background: var(--el-bg-color-overlay) !important;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  }
}
</style>
<<<END FILE>>>

<<<FILE:apps/mobile/pms-app/utils/env-config.js>>>
/**
 * Environment indicator configuration for UniApp mobile.
 * Mirrors web env-config.js logic.
 */

export function normalizeEnv(raw) {
  if (!raw || typeof raw !== 'string' || raw.trim() === '') {
    return 'UNKNOWN'
  }
  const key = raw.trim().toLowerCase()
  const map = {
    development: 'DEV', dev: 'DEV', localhost: 'DEV',
    test: 'TEST', testing: 'TEST', qa: 'TEST',
    staging: 'STG', stg: 'STG', uat: 'STG', pre: 'STG', preprod: 'STG',
    production: 'PROD', prod: 'PROD',
    demo: 'DEMO'
  }
  return map[key] || 'UNKNOWN'
}

export function getEnvLabel(env) {
  const map = {
    DEV: '开发环境',
    TEST: '测试环境',
    STG: '预发环境',
    PROD: '生产环境',
    DEMO: '演示环境',
    UNKNOWN: '未知环境'
  }
  return map[env] || env
}

export function getEnvColors(env) {
  const map = {
    DEV:     { bg: '#409eff', text: '#ffffff' },
    TEST:    { bg: '#9c27b0', text: '#ffffff' },
    STG:     { bg: '#ff9800', text: '#ffffff' },
    PROD:    { bg: 'transparent', text: '#909399' },
    DEMO:    { bg: '#67c23a', text: '#ffffff' },
    UNKNOWN: { bg: '#f56c6c', text: '#ffffff' }
  }
  return map[env] || map.UNKNOWN
}

export function shouldHideEnv(env) {
  return env === 'PROD'
}
<<<END FILE>>>

<<<FILE:apps/mobile/pms-app/pages/login.vue>>>
<template>
  <view class="normal-login-container">
    <view class="logo-content align-center justify-center flex">
      <image style="width: 100rpx;height: 100rpx;" :src="globalConfig.appInfo.logo" mode="widthFix">
      </image>
      <text class="title">PMS移动端登录</text>
    </view>
    <view v-if="envLabel && !hideEnv" class="env-text" :style="envStyle">
      <text class="env-dot" :style="{ backgroundColor: envDotColor }"></text>
      <text>{{ envLabel }}</text>
    </view>
    <view class="login-form-content">
      <view class="input-item flex align-center">
        <view class="iconfont icon-user icon"></view>
        <input v-model="loginForm.username" class="input" type="text" placeholder="请输入账号" maxlength="30" />
      </view>
      <view class="input-item flex align-center">
        <view class="iconfont icon-password icon"></view>
        <input v-model="loginForm.password" type="password" class="input" placeholder="请输入密码" maxlength="20" />
      </view>
      <view class="input-item flex align-center" style="width: 60%;margin: 0px;" v-if="captchaEnabled">
        <view class="iconfont icon-code icon"></view>
        <input v-model="loginForm.code" type="number" class="input" placeholder="请输入验证码" maxlength="4" />
        <view class="login-code"> 
          <image :src="codeUrl" @click="getCode" class="login-code-img"></image>
        </view>
      </view>
      <view class="action-btn">
        <button @click="handleLogin" class="login-btn cu-btn block bg-blue lg round">登录</button>
      </view>
      <view class="reg text-center" v-if="register">
        <text class="text-grey1">没有账号？</text>
        <text @click="handleUserRegister" class="text-blue">立即注册</text>
      </view>
      <view class="xieyi text-center">
        <text class="text-grey1">登录即代表同意</text>
        <text @click="handleUserAgrement" class="text-blue">《用户协议》</text>
        <text @click="handlePrivacy" class="text-blue">《隐私协议》</text>
      </view>
    </view>
     
  </view>
</template>

<script>
  import { getCodeImg } from '@/api/login'
  import { getToken } from '@/utils/auth'
  import { normalizeEnv, getEnvLabel, getEnvColors, shouldHideEnv } from '@/utils/env-config'

  export default {
    data() {
      const globalConfig = getApp().globalData.config
      // Resolve env: backend header (via uni.request interceptor) > globalConfig.env > UNKNOWN
      const rawEnv = (typeof uni !== 'undefined' && uni.getStorageSync && uni.getStorageSync('PMS_APP_ENV'))
        || globalConfig.env
        || ''
      const normalized = normalizeEnv(rawEnv)

      return {
        codeUrl: "",
        captchaEnabled: true,
        register: false,
        globalConfig,
        envLabel: getEnvLabel(normalized),
        hideEnv: shouldHideEnv(normalized),
        envStyle: {},
        envDotColor: getEnvColors(normalized).bg,
        loginForm: {
          username: "admin",
          password: "admin123",
          code: "",
          uuid: ""
        }
      }
    },
    created() {
      this.getCode()
      this.applyEnvStyle()
    },
	onLoad() {
      //#ifdef H5
      if (getToken()) {
        this.$tab.reLaunch('/pages/index')
      }
      //#endif
    },
    methods: {
      applyEnvStyle() {
        const colors = getEnvColors(normalizeEnv(this.envLabel) || 'UNKNOWN')
        this.envStyle = {
          color: colors.text
        }
      },
      // 用户注册
      handleUserRegister() {
        this.$tab.redirectTo(`/pages/register`)
      },
      // 隐私协议
      handlePrivacy() {
        let site = this.globalConfig.appInfo.agreements[0]
        this.$tab.navigateTo(`/pages/common/webview/index?title=${site.title}&url=${site.url}`)
      },
      // 用户协议
      handleUserAgrement() {
        let site = this.globalConfig.appInfo.agreements[1]
        this.$tab.navigateTo(`/pages/common/webview/index?title=${site.title}&url=${site.url}`)
      },
      // 获取图形验证码
      getCode() {
        getCodeImg().then(res => {
          this.captchaEnabled = res.captchaEnabled === undefined ? true : res.captchaEnabled
          if (this.captchaEnabled) {
            this.codeUrl = 'data:image/gif;base64,' + res.img
            this.loginForm.uuid = res.uuid
          }
        })
      },
      // 登录方法
      async handleLogin() {
        if (this.loginForm.username === "") {
          this.$modal.msgError("请输入账号")
        } else if (this.loginForm.password === "") {
          this.$modal.msgError("请输入密码")
        } else if (this.loginForm.code === "" && this.captchaEnabled) {
          this.$modal.msgError("请输入验证码")
        } else {
          this.$modal.loading("登录中，请耐心等待...")
          this.pwdLogin()
        }
      },
      // 密码登录
      async pwdLogin() {
        this.$store.dispatch('Login', this.loginForm).then(() => {
          this.$modal.closeLoading()
          this.loginSuccess()
        }).catch(() => {
          if (this.captchaEnabled) {
            this.getCode()
          }
        })
      },
      // 登录成功后，处理函数
      loginSuccess(result) {
        // 设置用户信息
        this.$store.dispatch('GetInfo').then(res => {
          this.$tab.reLaunch('/pages/index')
        })
      }
    }
  }
</script>

<style lang="scss" scoped>
  page {
    background-color: #ffffff;
  }

  .normal-login-container {
    width: 100%;

    .logo-content {
      width: 100%;
      font-size: 21px;
      text-align: center;
      padding-top: 15%;

      image {
        border-radius: 4px;
      }

      .title {
        margin-left: 10px;
      }
    }

    .env-text {
      margin-top: 24rpx;
      text-align: center;
      font-size: 26rpx;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8rpx;

      .env-dot {
        display: inline-block;
        width: 14rpx;
        height: 14rpx;
        border-radius: 50%;
        flex-shrink: 0;
      }
    }

    .login-form-content {
      text-align: center;
      margin: 20px auto;
      margin-top: 15%;
      width: 80%;

      .input-item {
        margin: 20px auto;
        background-color: #f5f6f7;
        height: 45px;
        border-radius: 20px;

        .icon {
          font-size: 38rpx;
          margin-left: 10px;
          color: #999;
        }

        .input {
          width: 100%;
          font-size: 14px;
          line-height: 20px;
          text-align: left;
          padding-left: 15px;
        }

      }

      .login-btn {
        margin-top: 40px;
        height: 45px;
      }
      
      .reg {
        margin-top: 15px;
      }
      
      .xieyi {
        color: #333;
        margin-top: 20px;
      }
      
      .login-code {
        height: 38px;
        float: right;
      
        .login-code-img {
          height: 38px;
          position: absolute;
          margin-left: 10px;
          width: 200rpx;
        }
      }
    }
  }

</style>
<<<END FILE>>>

<<<FILE:docs/ai-dev/frontend/05-frontend/frontend-delivery.md>>>
# 前端多端交付方案 — 环境标识显示

## 1. 变更摘要

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/web/admin/src/utils/env-config.js` | **新增** | 环境配置工具函数（normalize / label / colors / hide 策略） |
| `apps/web/admin/src/components/EnvBadge/index.vue` | **新增** | 通用环境角标组件（corner / inline 两种 variant） |
| `apps/web/admin/src/utils/request.js` | **修改** | Axios 响应拦截器增加 `X-Environment` 头捕获，非阻塞、不影响业务 |
| `apps/web/admin/src/views/login.vue` | **修改** | 移除旧内联 env 代码，改用 `EnvBadge` 组件；三级降级读取 |
| `apps/mobile/pms-app/utils/env-config.js` | **新增** | 移动端环境配置工具函数（与 Web 端对齐） |
| `apps/mobile/pms-app/pages/login.vue` | **修改** | 环境标签改用 env-config 工具函数，带颜色圆点标识 |

## 2. 组件拆分

### EnvBadge（Web 端）
- **位置**: `apps/web/admin/src/components/EnvBadge/index.vue`
- **Props**: `env` (手动传入), `hide` (强制隐藏), `variant` ('corner' | 'inline')
- **数据源优先级**: 后端 `X-Environment` 响应头 → `sessionStorage` → `VITE_APP_ENV` → `UNKNOWN`
- **样式**: corner = fixed 右上角药丸形; inline = 行内标签
- **安全**: PROD 环境默认 `hideProd=true` 时 DOM 不渲染

## 3. 状态管理

- **轻量方案**：不引入 Pinia/Vuex 全局状态，使用：
  1. `capturedEnv` 模块变量在 request.js 中缓存首次捕获值
  2. `sessionStorage.setItem('PMS_APP_ENV', ...)` 跨组件共享
  3. `window.dispatchEvent(new CustomEvent('pms:env-detected'))` 响应式通知
  4. `getCapturedEnv()` 供 login.vue 等组件同步读取

## 4. 多端适配

| 端 | 显示方式 | 位置 | 样式 |
|----|----------|------|------|
| Web | `EnvBadge` corner 药丸形 | `position: fixed` 右上角 12px | 药丸形 + 阴影 + 脉冲动画(UNKNOWN) |
| Mobile | 带圆点的文本标签 | logo 下方居中 | `inline-flex` + 彩色圆点 + 安全区适配 |

### 深色主题
- Web: `@media (prefers-color-scheme: dark)` 降低 badge 亮度
- Mobile: UniApp 跟随系统主题，CSS 变量适配

## 5. 接口联调点

### 前置条件
- 后端 `X-Environment` 响应头已注入（@后端开发 已交付）
- CORS `Access-Control-Expose-Headers` 包含 `X-Environment`（Nacos 配置中需添加）

### 验证步骤
1. 启动网关后 curl 验证：`curl -sI http://localhost:18080/actuator/health | grep -i "x-environment"`
2. 打开 Web 登录页，右上角应显示环境角标
3. 浏览器 Console: `sessionStorage.getItem('PMS_APP_ENV')` 应返回规范化值
4. 移动端 H5 登录页应显示环境标签
5. 生产环境（APP_ENV=prod）：角标/标签不应出现在 DOM 中

### Axios 拦截器读取确认
- `request.js` 响应拦截器已添加 `res.headers['x-environment']` 读取逻辑
- 首次成功读取后写入 `sessionStorage` 和分发 `CustomEvent`

## 6. 测试关注点

### 单元测试
- `normalizeEnv()` 覆盖所有环境别名
- `getEnvLabel()` / `getEnvColors()` 映射正确性
- `shouldHideEnv()` PROD 隐藏逻辑

### 组件测试
- EnvBadge 在 DEV/TEST/STG/UNKNOWN 下正常渲染
- PROD 环境不渲染 DOM
- UNKNOWN 脉冲动画生效

### 集成测试
- Axios 拦截器正确捕获 `X-Environment` 头
- sessionStorage 跨组件共享
- CustomEvent 响应式通知

### E2E 场景
- 各环境下登录页显示正确的环境标识
- 生产环境 DOM 中无环境标识元素
- 后端未注入 header 时降级到构建时变量
- 构建时也未配置时显示 UNKNOWN

### 浏览器兼容性
- Chrome/Firefox/Safari 响应头读取
- `sessionStorage` 隐私模式兼容
- `prefers-color-scheme` 深色模式
<<<END FILE>>>

**变更说明：**

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/web/admin/src/utils/env-config.js` | **新增** | 环境配置工具函数，Web/Mobile 共用逻辑 |
| `apps/web/admin/src/components/EnvBadge/index.vue` | **新增** | 右上角固定角标组件，支持 corner/inline 变体 |
| `apps/web/admin/src/utils/request.js` | **修改** | 增量添加：Axios 响应拦截器捕获 `X-Environment` 头 + `getCapturedEnv()` 导出 |
| `apps/web/admin/src/views/login.vue` | **修改** | 移除旧内联 env 代码，替换为 `<EnvBadge variant="corner" />`，保留全部原有登录逻辑与样式 |
| `apps/mobile/pms-app/utils/env-config.js` | **新增** | 移动端环境工具函数 |
| `apps/mobile/pms-app/pages/login.vue` | **修改** | 引入 env-config，环境标签带彩色圆点，三级降级读取 |
| `docs/ai-dev/frontend/05-frontend/frontend-delivery.md` | **新增** | 交付文档 |

**核心设计决策：**
1. **三级降级**：后端 `X-Environment` 响应头（Axios 拦截器捕获） → `VITE_APP_ENV` 构建时注入 → `UNKNOWN` 红色警示
2. **零侵入登录逻辑**：`request.js` 仅在响应拦截器中添加非阻塞 env 捕获，不影响任何现有业务流
3. **安全策略**：PROD 环境 DOM 不渲染环境标识，避免信息泄露
4. **轻量状态**：不引入 Pinia/Vuex 全局 store，使用 `capturedEnv` 模块变量 + `sessionStorage` + `CustomEvent`

**待 @后端开发 确认**：
- CORS `Access-Control-Expose-Headers` 是否已包含 `X-Environment`？否则浏览器 JS 无法读取该响应头
- `X-Environment` 还是 `x-environment`（大小写）？Axios 拦截器做了大小写兼容

请 **@管理员: workflow validator** 审批。