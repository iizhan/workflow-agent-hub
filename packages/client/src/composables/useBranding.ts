import { watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  BRAND_FULL_NAME,
} from '@/constants/branding'

const BRAND_TITLE_SUFFIX = BRAND_FULL_NAME

function resolvePageTitle(routeName: string | undefined, t: (key: string) => string) {
  switch (routeName) {
    case 'workbench.applications':
      return `${t('documentTitle.applications')} · ${BRAND_TITLE_SUFFIX}`
    case 'workbench.applicationCreate':
      return `${t('documentTitle.createWorkspace')} · ${BRAND_TITLE_SUFFIX}`
    case 'workbench.applicationDetail':
      return `${t('documentTitle.applicationWorkbench')} · ${BRAND_TITLE_SUFFIX}`
    case 'workbench.runs':
      return `${t('documentTitle.execution')} · ${BRAND_TITLE_SUFFIX}`
    case 'workbench.resources':
      return `${t('documentTitle.assets')} · ${BRAND_TITLE_SUFFIX}`
    case 'workbench.system':
      return `${t('documentTitle.operations')} · ${BRAND_TITLE_SUFFIX}`
    case 'hermes.chat':
      return `${t('documentTitle.chat')} · ${BRAND_TITLE_SUFFIX}`
    case 'hermes.history':
      return `${t('documentTitle.history')} · ${BRAND_TITLE_SUFFIX}`
    case 'hermes.groupChat':
      return `${t('documentTitle.collaboration')} · ${BRAND_TITLE_SUFFIX}`
    case 'hermes.files':
      return `${t('documentTitle.files')} · ${BRAND_TITLE_SUFFIX}`
    case 'hermes.models':
      return `${t('documentTitle.models')} · ${BRAND_TITLE_SUFFIX}`
    case 'hermes.gateways':
      return `${t('documentTitle.gateways')} · ${BRAND_TITLE_SUFFIX}`
    case 'hermes.settings':
      return `${t('documentTitle.settings')} · ${BRAND_TITLE_SUFFIX}`
    case 'hermes.skills':
      return `${t('documentTitle.skills')} · ${BRAND_TITLE_SUFFIX}`
    case 'hermes.memory':
      return `${t('documentTitle.memory')} · ${BRAND_TITLE_SUFFIX}`
    case 'hermes.usage':
      return `${t('documentTitle.usage')} · ${BRAND_TITLE_SUFFIX}`
    case 'hermes.logs':
      return `${t('documentTitle.logs')} · ${BRAND_TITLE_SUFFIX}`
    case 'hermes.jobs':
      return `${t('documentTitle.jobs')} · ${BRAND_TITLE_SUFFIX}`
    case 'hermes.kanban':
      return `${t('documentTitle.kanban')} · ${BRAND_TITLE_SUFFIX}`
    case 'hermes.channels':
      return `${t('documentTitle.channels')} · ${BRAND_TITLE_SUFFIX}`
    case 'hermes.profiles':
      return `${t('documentTitle.profiles')} · ${BRAND_TITLE_SUFFIX}`
    case 'hermes.terminal':
      return `${t('documentTitle.terminal')} · ${BRAND_TITLE_SUFFIX}`
    case 'login':
      return `${t('documentTitle.workspaceLogin')} · ${BRAND_TITLE_SUFFIX}`
    default:
      return `${t('brand.tagline')} · ${BRAND_TITLE_SUFFIX}`
  }
}

export function useBrandingDocumentTitle() {
  const route = useRoute()
  const { t, locale } = useI18n()

  watchEffect(() => {
    locale.value
    const title = resolvePageTitle(route.name ? String(route.name) : undefined, t)
    document.title = title || `${BRAND_FULL_NAME} · ${t('brand.productPromise')}`
  })
}
