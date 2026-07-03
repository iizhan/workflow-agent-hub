import { createI18n } from 'vue-i18n'
import { getSavedLocale, resolveLocale } from './config'
import { messages } from './messages'

const saved = getSavedLocale()
const detected = navigator.language.slice(0, 2)

export const i18n = createI18n({
  legacy: false,
  locale: resolveLocale(saved, detected),
  fallbackLocale: 'zh',
  messages,
})
