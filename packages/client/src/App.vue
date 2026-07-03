<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { darkTheme, NConfigProvider, NMessageProvider, NDialogProvider, NNotificationProvider, NPopover } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { getThemeOverrides } from '@/styles/theme'
import { useTheme } from '@/composables/useTheme'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import LanguageSwitch from '@/components/layout/LanguageSwitch.vue'
import ThemeSwitch from '@/components/layout/ThemeSwitch.vue'
import ModelSelector from '@/components/layout/ModelSelector.vue'
import ProfileSelector from '@/components/layout/ProfileSelector.vue'
import { useKeyboard } from '@/composables/useKeyboard'
import { useAppStore } from '@/stores/hermes/app'
import { useApplicationsStore } from '@/stores/workbench/applications'
import SessionSearchModal from '@/components/hermes/chat/SessionSearchModal.vue'
import { BRAND_FULL_NAME, BRAND_LOGO_PATH } from '@/constants/branding'
import { useBrandingDocumentTitle } from '@/composables/useBranding'

const { isDark } = useTheme()
const { t, locale } = useI18n()
const appStore = useAppStore()
const applicationsStore = useApplicationsStore()
const route = useRoute()
const router = useRouter()
const ready = ref(false)

const themeOverrides = computed(() => getThemeOverrides(isDark.value))
const naiveTheme = computed(() => isDark.value ? darkTheme : null)

const isLoginPage = computed(() => route.name === 'login')

const nodeVersionLow = computed(() => {
  const v = appStore.nodeVersion
  const major = parseInt(v.split('.')[0], 10)
  return !isNaN(major) && major < 23
})
const healthPending = computed(() => !appStore.healthChecked || appStore.healthChecking)
const gatewayHealthy = computed(() => appStore.gatewayStatus === 'running')
const connectionLabel = computed(() => {
  if (healthPending.value) return t('sidebar.gatewayChecking')
  return gatewayHealthy.value ? t('sidebar.gatewayRunning') : t('sidebar.gatewayStopped')
})
const topbarMeta = computed(() => {
  const name = String(route.name || '')
  const section = String(route.query.section || '').trim()

  const groupLabelMap: Record<string, string> = {
    workbench: t('sidebar.groupWorkbench'),
    conversation: t('sidebar.groupConversation'),
    agent: t('sidebar.groupAgent'),
    monitoring: t('sidebar.groupMonitoring'),
    system: t('sidebar.groupSystem'),
  }

  const groupKeyMap: Record<string, string> = {
    'workbench.overview': 'workbench',
    'workbench.applications': 'workbench',
    'workbench.applicationCreate': 'workbench',
    'workbench.applicationDetail': 'workbench',
    'workbench.runs': 'workbench',
    'workbench.resources': 'workbench',
    'workbench.system': 'workbench',
    'hermes.chat': 'conversation',
    'hermes.history': 'conversation',
    'hermes.groupChat': 'conversation',
    'hermes.jobs': 'agent',
    'hermes.kanban': 'agent',
    'hermes.channels': 'agent',
    'hermes.skills': 'agent',
    'hermes.memory': 'agent',
    'hermes.models': 'agent',
    'hermes.logs': 'monitoring',
    'hermes.usage': 'monitoring',
    'hermes.gateways': 'system',
    'hermes.profiles': 'system',
    'hermes.settings': 'system',
  }

  const detailApplicationName = applicationsStore.currentApplication?.name?.trim()
  const detailTitle = detailApplicationName || t('appHeader.applicationDetail')

  const titleMap: Record<string, string> = {
    'workbench.overview': t('sidebar.overviewWorkbench'),
    'workbench.applications': t('sidebar.applications'),
    'workbench.applicationCreate': t('appHeader.applicationCreate'),
    'workbench.applicationDetail': section === 'runs'
      ? t('sidebar.runsWorkbench')
      : section === 'collaboration'
        ? t('sidebar.groupChat')
        : detailTitle,
    'workbench.runs': t('sidebar.runsWorkbench'),
    'workbench.resources': t('sidebar.resources'),
    'workbench.system': t('sidebar.systemWorkbench'),
    'hermes.chat': t('sidebar.chat'),
    'hermes.history': t('sidebar.history'),
    'hermes.groupChat': t('sidebar.groupChat'),
    'hermes.jobs': t('sidebar.jobs'),
    'hermes.kanban': t('sidebar.kanban'),
    'hermes.channels': t('sidebar.channels'),
    'hermes.skills': t('sidebar.skills'),
    'hermes.memory': t('sidebar.memory'),
    'hermes.models': t('sidebar.models'),
    'hermes.logs': t('sidebar.logs'),
    'hermes.usage': t('sidebar.usage'),
    'hermes.gateways': t('sidebar.gateways'),
    'hermes.profiles': t('sidebar.profiles'),
    'hermes.settings': t('sidebar.settings'),
  }

  const title = titleMap[name] || t('appHeader.workspace')
  const groupKey = groupKeyMap[name]
  const breadcrumb = groupKey ? [groupLabelMap[groupKey], title] : [title]

  return { title, breadcrumb }
})

// Close mobile sidebar on route change
watch(() => route.path, () => {
  appStore.closeSidebar()
})

// Wait for router to resolve before rendering layout
router.isReady().then(() => {
  ready.value = true
})

onMounted(() => {
  if (!isLoginPage.value) {
    appStore.loadModels()
    appStore.startHealthPolling()
  }
})

onUnmounted(() => {
  appStore.stopHealthPolling()
})

useKeyboard()
useBrandingDocumentTitle()

watchEffect(() => {
  document.documentElement.lang = locale.value
})
</script>

<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <NMessageProvider>
      <NDialogProvider>
        <NNotificationProvider>
          <div v-if="nodeVersionLow && ready" class="node-warning-bar">
            {{ t('sidebar.nodeVersionWarning', { version: appStore.nodeVersion }) }}
          </div>
          <div v-if="ready" class="app-layout" :class="{ 'no-sidebar': isLoginPage }">
            <button v-if="!isLoginPage" class="hamburger-btn" @click="appStore.toggleSidebar">
              <img :src="BRAND_LOGO_PATH" :alt="`${BRAND_FULL_NAME} menu`" style="width: 24px; height: 24px;" />
            </button>
            <div v-if="!isLoginPage && appStore.sidebarOpen" class="mobile-backdrop" @click="appStore.closeSidebar" />
            <AppSidebar v-if="!isLoginPage" />
            <main class="app-main">
              <div v-if="!isLoginPage" class="app-main-shell">
                <header class="app-topbar">
                  <div class="app-topbar-meta">
                    <div class="app-topbar-breadcrumb">
                      <template v-for="(item, index) in topbarMeta.breadcrumb" :key="`${item}-${index}`">
                        <span class="app-topbar-breadcrumb__item">{{ item }}</span>
                        <span v-if="index < topbarMeta.breadcrumb.length - 1" class="app-topbar-breadcrumb__divider">/</span>
                      </template>
                    </div>
                    <div class="app-topbar-title">{{ topbarMeta.title }}</div>
                  </div>
                  <div class="app-topbar-actions">
                    <button
                      class="topbar-status-pill"
                      :class="{
                        healthy: gatewayHealthy,
                        checking: healthPending,
                        offline: !gatewayHealthy && !healthPending,
                      }"
                    >
                      <span class="topbar-status-dot"></span>
                      <span>{{ connectionLabel }}</span>
                    </button>
                    <ModelSelector compact />
                    <ProfileSelector compact />
                    <NPopover trigger="click" placement="bottom-end">
                      <template #trigger>
                        <button class="topbar-preferences-btn" :title="t('appHeader.preferences')">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.7 0 1.31.4 1.51 1H21a2 2 0 1 1 0 4h-.09c-.2.6-.81 1-1.51 1Z" />
                          </svg>
                          <span>{{ t('appHeader.preferences') }}</span>
                        </button>
                      </template>
                      <div class="topbar-preferences-panel">
                        <div class="topbar-preferences-title">{{ t('appHeader.preferences') }}</div>
                        <div class="topbar-preferences-row">
                          <span class="topbar-preferences-label">{{ t('appHeader.language') }}</span>
                          <LanguageSwitch size="small" />
                        </div>
                        <div class="topbar-preferences-row">
                          <span class="topbar-preferences-label">{{ t('appHeader.theme') }}</span>
                          <ThemeSwitch />
                        </div>
                      </div>
                    </NPopover>
                  </div>
                </header>
                <div class="app-main-content">
                  <router-view />
                </div>
              </div>
              <router-view v-else />
            </main>
          </div>
          <SessionSearchModal />
        </NNotificationProvider>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.app-layout {
  display: flex;
  height: calc(100 * var(--vh));
  width: 100vw;
  overflow: hidden;

  &.no-sidebar {
    display: block;
  }
}

.app-main {
  flex: 1;
  background-color: $bg-primary;
  min-width: 0;
  overflow: hidden;

  .no-sidebar & {
    height: calc(100 * var(--vh));
    overflow-y: auto;
  }
}

.app-main-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.app-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 24px 10px;
  background: rgba(246, 246, 243, 0.92);
  border-bottom: 1px solid $border-color;
  backdrop-filter: blur(10px);

  .dark & {
    background: rgba(32, 32, 32, 0.9);
  }
}

.app-topbar-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.app-topbar-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: $text-muted;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
}

.app-topbar-breadcrumb__item {
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-topbar-breadcrumb__divider {
  flex-shrink: 0;
  opacity: 0.6;
}

.app-topbar-title {
  min-width: 0;
  color: $text-primary;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
  justify-content: flex-end;
  flex-shrink: 0;
}

.app-topbar-actions :deep(.model-selector.compact) {
  width: 196px;
}

.app-topbar-actions :deep(.profile-selector.compact) {
  width: 132px;
}

.topbar-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid $border-color;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: $text-secondary;
  font-size: 12px;
  font-weight: 600;
}

.topbar-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: $text-muted;
}

.topbar-status-pill.healthy {
  color: $success;
  border-color: rgba(var(--success-rgb), 0.24);
  background: rgba(var(--success-rgb), 0.08);

  .topbar-status-dot {
    background: $success;
  }
}

.topbar-status-pill.checking {
  color: $accent-primary;
  border-color: rgba(var(--accent-primary-rgb), 0.24);
  background: rgba(var(--accent-primary-rgb), 0.08);

  .topbar-status-dot {
    background: $accent-primary;
  }
}

.topbar-status-pill.offline {
  color: $error;
  border-color: rgba(var(--error-rgb, 239, 68, 68), 0.22);
  background: rgba(var(--error-rgb, 239, 68, 68), 0.06);

  .topbar-status-dot {
    background: $error;
  }
}

.topbar-preferences-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: rgba(255, 255, 255, 0.72);
  color: $text-secondary;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    color: $text-primary;
    border-color: rgba(var(--accent-primary-rgb), 0.22);
    background: rgba(var(--accent-primary-rgb), 0.06);
  }
}

.topbar-preferences-panel {
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.topbar-preferences-title {
  font-size: 12px;
  font-weight: 700;
  color: $text-primary;
}

.topbar-preferences-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.topbar-preferences-label {
  font-size: 12px;
  color: $text-secondary;
  flex: 0 0 40px;
  white-space: nowrap;
}

.topbar-preferences-row :deep(.language-switch) {
  min-width: 104px;
}

.topbar-preferences-row :deep(.theme-switch) {
  width: 32px;
  height: 32px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: rgba(255, 255, 255, 0.72);
}

.app-main-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.node-warning-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 100;
  padding: 4px 16px;
  font-size: 12px;
  font-weight: 500;
  color: #b45309;
  background-color: #fef3c7;
  border-bottom: 1px solid #fde68a;
  text-align: center;
  line-height: 1.4;
}

@media (max-width: $breakpoint-mobile) {
  .app-topbar {
    height: 56px;
    padding: 10px 16px 8px 64px;
  }

  .app-topbar-title {
    font-size: 16px;
  }

  .app-topbar-actions {
    gap: 8px;
    flex-wrap: nowrap;
  }

  .app-topbar-actions :deep(.model-selector.compact),
  .app-topbar-actions :deep(.profile-selector.compact) {
    display: none;
  }

  .topbar-status-pill {
    display: none;
  }

  .topbar-preferences-btn {
    width: auto;
    min-width: 32px;
    padding: 0 8px;

    span {
      display: none;
    }
  }
}
</style>
