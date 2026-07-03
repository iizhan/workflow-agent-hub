<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { NButton, NModal, useMessage } from "naive-ui";
import { useAppStore } from "@/stores/hermes/app";
import { useSessionSearch } from '@/composables/useSessionSearch'
import { changelog } from "@/data/changelog";
import { BRAND_FULL_NAME, BRAND_LOGO_PATH, BRAND_NAME } from "@/constants/branding";

const { t } = useI18n();
const message = useMessage();
const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const { openSessionSearch } = useSessionSearch();
const selectedKey = computed(() => route.name as string);
const logoPath = BRAND_LOGO_PATH;
const collapsedGroups = reactive<Record<string, boolean>>({
  conversation: true,
  agent: true,
  monitoring: true,
  system: true,
})

const currentWorkbenchSection = computed(() => String(route.query.section || '').trim())
const applicationsActive = computed(() => {
  if (selectedKey.value === 'workbench.applicationDetail') {
    return !['runs', 'collaboration'].includes(currentWorkbenchSection.value)
  }
  return ['workbench.applications', 'workbench.applicationCreate'].includes(String(selectedKey.value))
})
const runsActive = computed(() =>
  selectedKey.value === 'workbench.runs'
  || (selectedKey.value === 'workbench.applicationDetail' && currentWorkbenchSection.value === 'runs'),
)

const routeGroups: Record<string, string> = {
  'workbench.overview': 'workbench',
  'workbench.applications': 'workbench',
  'workbench.applicationDetail': 'workbench',
  'workbench.applicationCreate': 'workbench',
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

function toggleGroup(key: string) {
  collapsedGroups[key] = !collapsedGroups[key];
}

function isGroupCollapsed(key: string) {
  return !!collapsedGroups[key];
}

function handleNav(key: string) {
  const group = routeGroups[key]
  if (group) {
    collapsedGroups[group] = false
  }
  router.push({ name: key });
}

async function handleUpdate() {
  const ok = await appStore.doUpdate();
  if (ok) {
    message.success(t('sidebar.updateSuccess'), { duration: 5000 });
  } else {
    message.error(t('sidebar.updateFailed'));
  }
}

function handleLogout() {
  localStorage.clear();
  router.replace({ name: 'login' });
}

// Changelog
const showChangelog = ref(false);

function openChangelog() {
  showChangelog.value = true;
}
</script>

<template>
  <aside class="sidebar" :class="{ open: appStore.sidebarOpen, collapsed: appStore.sidebarCollapsed }">
    <div class="sidebar-header">
        <div class="sidebar-brand-row">
        <div class="sidebar-logo" @click="router.push({ name: 'workbench.overview' })">
          <img :src="logoPath" :alt="BRAND_NAME" class="logo-img" />
          <span class="logo-text">{{ BRAND_NAME }}</span>
          <!-- <video class="logo-dance" :src="isDark ? danceVideoDark : danceVideoLight" autoplay loop muted playsinline /> -->
        </div>

        <button class="collapse-btn" @click="appStore.toggleSidebarCollapsed()" :title="appStore.sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline v-if="appStore.sidebarCollapsed" points="9 18 15 12 9 6" />
            <polyline v-else points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

    </div>

    <div class="sidebar-body">
      <nav class="sidebar-nav">
        <div class="nav-group">
          <div class="nav-group-label" @click="toggleGroup('workbench')">
            <span>{{ t("sidebar.groupWorkbench") }}</span>
            <svg class="nav-group-arrow" :class="{ collapsed: isGroupCollapsed('workbench') }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          <div v-show="!isGroupCollapsed('workbench')">
            <button
              class="nav-item"
              :class="{ active: selectedKey === 'workbench.overview' }"
              :title="t('sidebar.overviewWorkbench')"
              @click="handleNav('workbench.overview')"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 13h8V3H3z" />
                <path d="M13 21h8v-6h-8z" />
                <path d="M13 11h8V3h-8z" />
                <path d="M3 21h8v-6H3z" />
              </svg>
              <span>{{ t("sidebar.overviewWorkbench") }}</span>
            </button>
            <button
              class="nav-item"
              :class="{ active: selectedKey === 'workbench.applications' || selectedKey === 'workbench.applicationDetail' || selectedKey === 'workbench.applicationCreate' || applicationsActive }"
              :title="t('sidebar.applications')"
              @click="handleNav('workbench.applications')"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M3 10h18" />
                <path d="M8 4v6" />
              </svg>
              <span>{{ t("sidebar.applications") }}</span>
            </button>
            <button class="nav-item" :class="{ active: runsActive }" :title="t('sidebar.runsWorkbench')" @click="handleNav('workbench.runs')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
              <span>{{ t("sidebar.runsWorkbench") }}</span>
            </button>
            <button class="nav-item" :class="{ active: selectedKey === 'workbench.resources' }" :title="t('sidebar.resources')" @click="handleNav('workbench.resources')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2 4 6v6c0 5 3.4 9.6 8 10 4.6-.4 8-5 8-10V6l-8-4Z" />
                <path d="M12 8v8" />
                <path d="M8.5 11h7" />
              </svg>
              <span>{{ t("sidebar.resources") }}</span>
            </button>
            <button class="nav-item" :class="{ active: selectedKey === 'workbench.system' }" :title="t('sidebar.systemWorkbench')" @click="handleNav('workbench.system')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.7 0 1.31.4 1.51 1H21a2 2 0 1 1 0 4h-.09c-.2.6-.81 1-1.51 1Z" />
              </svg>
              <span>{{ t("sidebar.systemWorkbench") }}</span>
            </button>
          </div>
        </div>

      <!-- Conversation -->
      <div class="nav-group">
        <div class="nav-group-label" @click="toggleGroup('conversation')">
          <span>{{ t("sidebar.groupConversation") }}</span>
          <svg class="nav-group-arrow" :class="{ collapsed: isGroupCollapsed('conversation') }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div v-show="!isGroupCollapsed('conversation')">
          <button class="nav-item" :class="{ active: selectedKey === 'hermes.chat' }" :title="t('sidebar.chat')" @click="handleNav('hermes.chat')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>{{ t("sidebar.chat") }}</span>
          </button>
          <button class="nav-item" :class="{ active: selectedKey === 'hermes.history' }" :title="t('sidebar.history')" @click="handleNav('hermes.history')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{{ t("sidebar.history") }}</span>
          </button>
          <button class="nav-item" :class="{ active: selectedKey === 'hermes.groupChat' }" :title="t('sidebar.groupChat')" @click="handleNav('hermes.groupChat')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>{{ t("sidebar.groupChat") }}</span>
          </button>
          <button class="nav-item" :title="t('sidebar.search')" @click="openSessionSearch">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span>{{ t("sidebar.search") }}</span>
          </button>
          <a class="nav-item fun-link" :title="t('sidebar.apiRelay')" href="https://www.jspin.cn" target="_blank" rel="noopener noreferrer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            <span>{{ t('sidebar.apiRelay') }}</span>
          </a>
        </div>
      </div>

      <!-- Agent -->
      <div class="nav-group">
        <div class="nav-group-label" @click="toggleGroup('agent')">
          <span>{{ t("sidebar.groupAgent") }}</span>
          <svg class="nav-group-arrow" :class="{ collapsed: isGroupCollapsed('agent') }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div v-show="!isGroupCollapsed('agent')">
          <button class="nav-item" :class="{ active: selectedKey === 'hermes.jobs' }" :title="t('sidebar.jobs')" @click="handleNav('hermes.jobs')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>{{ t("sidebar.jobs") }}</span>
          </button>
          <button class="nav-item" :class="{ active: selectedKey === 'hermes.kanban' }" :title="t('sidebar.kanban')" @click="handleNav('hermes.kanban')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="5" height="18" rx="1" />
              <rect x="10" y="3" width="5" height="12" rx="1" />
              <rect x="17" y="3" width="5" height="18" rx="1" />
            </svg>
            <span>{{ t("sidebar.kanban") }}</span>
          </button>
          <button class="nav-item" :class="{ active: selectedKey === 'hermes.channels' }" :title="t('sidebar.channels')" @click="handleNav('hermes.channels')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            <span>{{ t("sidebar.channels") }}</span>
          </button>
          <button class="nav-item" :class="{ active: selectedKey === 'hermes.skills' }" :title="t('sidebar.skills')" @click="handleNav('hermes.skills')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <span>{{ t("sidebar.skills") }}</span>
          </button>
          <button class="nav-item" :class="{ active: selectedKey === 'hermes.memory' }" :title="t('sidebar.memory')" @click="handleNav('hermes.memory')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18h6" />
              <path d="M10 22h4" />
              <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
            </svg>
            <span>{{ t("sidebar.memory") }}</span>
          </button>
          <button class="nav-item" :class="{ active: selectedKey === 'hermes.models' }" :title="t('sidebar.models')" @click="handleNav('hermes.models')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4" />
              <path d="M12 19v4" />
              <path d="M1 12h4" />
              <path d="M19 12h4" />
              <path d="M4.22 4.22l2.83 2.83" />
              <path d="M16.95 16.95l2.83 2.83" />
              <path d="M4.22 19.78l2.83-2.83" />
              <path d="M16.95 7.05l2.83-2.83" />
            </svg>
            <span>{{ t("sidebar.models") }}</span>
          </button>
        </div>
      </div>

      <!-- Monitoring -->
      <div class="nav-group">
        <div class="nav-group-label" @click="toggleGroup('monitoring')">
          <span>{{ t("sidebar.groupMonitoring") }}</span>
          <svg class="nav-group-arrow" :class="{ collapsed: isGroupCollapsed('monitoring') }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div v-show="!isGroupCollapsed('monitoring')">
          <button class="nav-item" :class="{ active: selectedKey === 'hermes.logs' }" :title="t('sidebar.logs')" @click="handleNav('hermes.logs')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>{{ t("sidebar.logs") }}</span>
          </button>
          <button class="nav-item" :class="{ active: selectedKey === 'hermes.usage' }" :title="t('sidebar.usage')" @click="handleNav('hermes.usage')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="12" width="4" height="9" rx="1" />
              <rect x="10" y="7" width="4" height="14" rx="1" />
              <rect x="17" y="3" width="4" height="18" rx="1" />
            </svg>
            <span>{{ t("sidebar.usage") }}</span>
          </button>
        </div>
      </div>

      <!-- System -->
      <div class="nav-group">
        <div class="nav-group-label" @click="toggleGroup('system')">
          <span>{{ t("sidebar.groupSystem") }}</span>
          <svg class="nav-group-arrow" :class="{ collapsed: isGroupCollapsed('system') }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div v-show="!isGroupCollapsed('system')">
          <button class="nav-item" :class="{ active: selectedKey === 'hermes.gateways' }" :title="t('sidebar.gateways')" @click="handleNav('hermes.gateways')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
            <span>{{ t("sidebar.gateways") }}</span>
          </button>
          <button class="nav-item" :class="{ active: selectedKey === 'hermes.profiles' }" :title="t('sidebar.profiles')" @click="handleNav('hermes.profiles')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>{{ t("sidebar.profiles") }}</span>
          </button>
          <button class="nav-item" :class="{ active: selectedKey === 'hermes.settings' }" :title="t('sidebar.settings')" @click="handleNav('hermes.settings')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>{{ t("sidebar.settings") }}</span>
          </button>
        </div>
      </div>
      </nav>
    </div>

    <div class="sidebar-footer">
      <div class="sidebar-footer-meta">
        <button class="nav-item logout-item" :title="t('sidebar.logout')" @click="handleLogout">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>{{ t("sidebar.logout") }}</span>
        </button>
        <div class="version-info">
          <a class="github-link" href="https://gitee.com/keyDemo/workflow-agent-hub" target="_blank" rel="noopener noreferrer" title="Repository">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          </a>
          <span class="version-text" @click="openChangelog">{{ BRAND_FULL_NAME }} v{{ appStore.serverVersion || "0.1.0" }}</span>
        </div>
      </div>
      <NButton v-if="appStore.updateAvailable" type="primary" size="tiny" block class="update-btn" :loading="appStore.updating" @click="handleUpdate">
        {{ appStore.updating ? t('sidebar.updating') : t('sidebar.updateVersion', { version: appStore.latestVersion }) }}
      </NButton>
    </div>

    <!-- Changelog modal -->
    <NModal v-model:show="showChangelog" preset="dialog" :title="t('sidebar.changelog')" style="width: 520px;">
      <div class="changelog-list">
        <div v-for="entry in changelog" :key="entry.version" class="changelog-version-block">
          <div class="changelog-version-header">
            <span class="changelog-version-tag">v{{ entry.version }}</span>
            <span class="changelog-date">{{ entry.date }}</span>
          </div>
          <ul class="changelog-changes">
            <li v-for="(change, idx) in entry.changes" :key="idx">{{ t(change) }}</li>
          </ul>
        </div>
      </div>
    </NModal>
  </aside>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.sidebar {
  position: relative;
  width: $sidebar-width;
  height: calc(100 * var(--vh));
  background-color: $bg-sidebar;
  border-right: 1px solid $border-color;
  display: flex;
  flex-direction: column;
  padding: 0 12px 16px;
  flex-shrink: 0;
  transition: width $transition-normal;
  overflow: hidden;
}

.logo-img {
  width: 28px;
  height: 28px;
  border-radius: 0;
  flex-shrink: 0;
}

.sidebar-header {
  position: relative;
  z-index: 2;
  margin: 0 -12px;
  padding: 12px 12px 10px;
  background: $bg-sidebar;
  border-bottom: 1px solid $border-color;
}

.sidebar-brand-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  padding: 12px;
  color: $text-primary;
  cursor: pointer;
  background-color: rgba(255, 255, 255, 0.72);
  border: 1px solid $border-color;
  border-radius: $radius-md;

  .dark & {
    background-color: rgba(57, 57, 57, 0.88);
  }
  position: relative;
  overflow: hidden;

  .logo-text {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .logo-dance {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    height: 100px;
    border-radius: $radius-md;
    object-fit: contain;
    flex-shrink: 0;
    width: auto;
    pointer-events: none;
  }
}

.sidebar-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 8px 8px;
  border-radius: $radius-md;
  background: rgba(255, 255, 255, 0.54);
  border: 1px solid rgba(0, 0, 0, 0.04);

  &.nav-group-bottom {
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid $border-color;
  }
}

.nav-group-label {
  font-size: 11px;
  font-weight: 700;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.9px;
  padding: 0 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  border-radius: $radius-sm;
  transition: color $transition-fast;

  &:hover {
    color: $text-secondary;
  }
}

.nav-group-arrow {
  transition: transform $transition-fast;
  flex-shrink: 0;

  &.collapsed {
    transform: rotate(-90deg);
  }
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  background: none;
  color: $text-secondary;
  font-size: 13px;
  font-weight: 500;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all $transition-fast;
  width: 100%;
  text-align: left;
  position: relative;

  svg {
    flex-shrink: 0;
    color: inherit;
  }

  span {
    position: relative;
    top: 0.5px;
  }

  &:hover {
    background-color: rgba(var(--accent-primary-rgb), 0.06);
    color: $text-primary;
  }

  &.active {
    background-color: rgba(var(--accent-primary-rgb), 0.12);
    color: $accent-primary;
    font-weight: 600;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 10px;
      bottom: 10px;
      width: 3px;
      border-radius: 999px;
      background: $accent-primary;
    }
  }
}

.sidebar-footer {
  padding-top: 12px;
  border-top: 1px solid $border-color;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.logout-item {
  margin: 0;
  padding: 10px 12px;
  border-radius: $radius-sm;
  font-size: 13px;
  color: $text-muted;

  &:hover {
    color: $error;
    background: rgba(var(--error-rgb, 239, 68, 68), 0.06);
  }
}

.sidebar-footer-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.version-info {
  padding: 0 12px;
  font-size: 11px;
  color: $text-muted;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.github-link {
  color: $text-muted;
  display: flex;
  align-items: center;
  transition: color 0.2s;

  &:hover {
    color: $text-primary;
  }
}

.update-btn {
  margin: 0;
  border-radius: 4px;
}

.version-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.2s;

  &:hover {
    color: $accent-primary;
  }
}

.changelog-list {
  max-height: 400px;
  overflow-y: auto;
}

.changelog-version-block {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
}

.changelog-version-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.changelog-version-tag {
  font-weight: 600;
  font-size: 14px;
  color: $text-primary;
  font-family: $font-code;
}

.changelog-changes {
  list-style: none;
  padding: 0;
  margin: 0;

  li {
    font-size: 13px;
    color: $text-secondary;
    padding: 4px 0 4px 16px;
    position: relative;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 12px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: $text-muted;
    }
  }
}

// ─── Collapsed sidebar (icon-rail mode) ─────────────────────────

.sidebar.collapsed {
  width: $sidebar-collapsed-width;
  padding: 0 8px 12px;
  overflow: hidden;

  .sidebar-header {
    margin: 0 -8px;
    padding: 10px 8px 8px;
  }

  .sidebar-brand-row {
    flex-direction: column;
    gap: 8px;
  }

  .sidebar-logo {
    width: 100%;
    padding: 10px 4px;
    justify-content: center;
    gap: 0;

    .logo-text {
      display: none;
    }
  }

  .collapse-btn {
    margin: 0;
  }

  .nav-group-label {
    display: none !important;
  }

  .version-text,
  .github-link,
  .update-btn,
  .logout-item span {
    display: none !important;
  }

  .nav-group,
  .sidebar-footer {
    border-color: transparent;
  }

  .nav-group {
    padding: 6px 0;
    background: transparent;
  }

  .sidebar-body {
    padding-top: 10px;
  }

  .nav-item {
    justify-content: center;
    padding: 10px 4px;
    gap: 0;
    background: transparent !important;
    overflow: visible;

    span {
      display: none;
    }

    svg {
      flex-shrink: 0;
    }

    &::before {
      display: none;
    }

    &[title]:hover::after,
    &[title]:focus-visible::after {
      content: attr(title);
      position: absolute;
      left: calc(100% + 10px);
      top: 50%;
      transform: translateY(-50%);
      padding: 6px 10px;
      border-radius: $radius-sm;
      background: rgba(20, 20, 20, 0.92);
      color: #fff;
      font-size: 12px;
      font-weight: 500;
      line-height: 1;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
      z-index: 20;
    }
  }

  .nav-group > div:not(.nav-group-label) {
    display: flex !important;
    flex-direction: column;
    gap: 2px;
  }

  .version-info,
  .logout-item {
    justify-content: center;
  }
}

// ─── Collapse button ────────────────────────────────────────────

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid $border-color;
  background: rgba(255, 255, 255, 0.72);
  color: $text-muted;
  border-radius: $radius-sm;
  cursor: pointer;
  flex-shrink: 0;
  transition: all $transition-fast;

  &:hover {
    color: $text-primary;
    background-color: rgba(var(--accent-primary-rgb), 0.08);
  }
}

@media (max-width: $breakpoint-mobile) {
  .logo-dance {
    display: none;
  }

  .sidebar-header {
    position: sticky;
    top: 0;
  }

  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 1000;
    transform: translateX(-100%);
    transition: transform $transition-normal;

    &.open {
      transform: translateX(0);
    }

    .input-sm {
      width: 90px;
    }
  }
}

.fun-link {
  text-decoration: none;
}
</style>
