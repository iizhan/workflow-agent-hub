import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import { i18n } from './i18n'
import App from './App.vue'
import './styles/global.scss'
import { consumeLoginTokenFromLocation } from './utils/login-token'

// Apply dark class before mount to prevent FOUC
const savedTheme = localStorage.getItem('hermes_theme') || 'system'
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
if (savedTheme === 'dark' || (savedTheme === 'system' && prefersDark)) {
  document.documentElement.classList.add('dark')
}

// Read token from URL BEFORE router initializes (hash router strips params)
const urlToken = consumeLoginTokenFromLocation(window.location, (nextUrl) => {
  window.history.replaceState(null, '', nextUrl)
})
if (urlToken) {
  ;(window as any).__LOGIN_TOKEN__ = urlToken
}

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
app.use(router)
app.mount('#app')
