export const SUPPORTED_LOCALES = ['zh', 'en'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

const DEFAULT_LOCALE: SupportedLocale = 'zh'
const LOCALE_STORAGE_KEY = 'hermes_locale'

function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function resolveLocale(saved: string | null, detected: string | null | undefined): SupportedLocale {
  if (isSupportedLocale(saved)) {
    return saved
  }

  const normalizedDetected = String(detected || '')
    .trim()
    .slice(0, 2)
    .toLowerCase()

  if (isSupportedLocale(normalizedDetected)) {
    return normalizedDetected
  }

  return DEFAULT_LOCALE
}

export function getSavedLocale(): string | null {
  return localStorage.getItem(LOCALE_STORAGE_KEY)
}

export function persistLocale(locale: SupportedLocale) {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
}
