<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import ChatPanel from '@/components/hermes/chat/ChatPanel.vue'
import { useAppStore } from '@/stores/hermes/app'
import { useChatStore } from '@/stores/hermes/chat'
import { useProfilesStore } from '@/stores/hermes/profiles'
import { useSettingsStore } from '@/stores/hermes/settings'
import { getSourceLabel } from '@/shared/session-display'

const router = useRouter()
const { t } = useI18n()
const appStore = useAppStore()
const chatStore = useChatStore()
const profilesStore = useProfilesStore()
const settingsStore = useSettingsStore()

const chatShellRef = ref<HTMLDivElement | null>(null)

const gatewayHealthy = computed(() => appStore.gatewayStatus === 'running')
const activeSession = computed(() => chatStore.activeSession)
const activeSessionSourceLabel = computed(() =>
  activeSession.value?.source ? getSourceLabel(activeSession.value.source) : t('chat.summarySourceNone'),
)

const liveSessionCount = computed(() =>
  chatStore.sessions.filter(session => chatStore.isSessionLive(session.id)).length,
)

const workspaceSessionCount = computed(() =>
  chatStore.sessions.filter(session => String(session.workspace || '').trim().length > 0).length,
)

const issueCount = computed(() =>
  chatStore.sessions.filter(session => session.id === chatStore.activeSessionId && !!chatStore.activeSessionIssue).length,
)

const currentRuntimeLabel = computed(() => {
  if (!gatewayHealthy.value) return t('chat.summaryRuntimeGatewayDown')
  if (chatStore.isStreaming) return t('chat.summaryRuntimeLive')
  if (activeSession.value) return t('chat.summaryRuntimeReady')
  return t('chat.summaryRuntimeIdle')
})

const currentWorkspaceLabel = computed(() =>
  activeSession.value?.workspace || t('chat.summaryWorkspaceNone'),
)

type ChatPrimaryAction = 'focus-chat' | 'open-gateways' | 'open-history' | 'open-applications'

const primaryDecision = computed(() => {
  if (!gatewayHealthy.value) {
    return {
      action: 'open-gateways' as ChatPrimaryAction,
      tone: 'warning' as const,
      eyebrow: t('chat.primaryDecisionGatewayEyebrow'),
      title: t('chat.primaryDecisionGatewayTitle'),
      body: t('chat.primaryDecisionGatewayBody'),
      actionLabel: t('chat.openGateways'),
    }
  }

  if (chatStore.activeSessionIssue) {
    return {
      action: 'focus-chat' as ChatPrimaryAction,
      tone: 'warning' as const,
      eyebrow: t('chat.primaryDecisionIssueEyebrow'),
      title: t('chat.primaryDecisionIssueTitle'),
      body: t('chat.primaryDecisionIssueBody'),
      actionLabel: t('chat.focusChat'),
    }
  }

  if (chatStore.isStreaming && activeSession.value) {
    return {
      action: 'focus-chat' as ChatPrimaryAction,
      tone: 'accent' as const,
      eyebrow: t('chat.primaryDecisionLiveEyebrow'),
      title: t('chat.primaryDecisionLiveTitle', { title: activeSession.value.title || t('chat.newChat') }),
      body: t('chat.primaryDecisionLiveBody', {
        source: activeSessionSourceLabel.value,
      }),
      actionLabel: t('chat.focusChat'),
    }
  }

  if (activeSession.value) {
    return {
      action: 'focus-chat' as ChatPrimaryAction,
      tone: 'calm' as const,
      eyebrow: t('chat.primaryDecisionReadyEyebrow'),
      title: t('chat.primaryDecisionReadyTitle', { title: activeSession.value.title || t('chat.newChat') }),
      body: t('chat.primaryDecisionReadyBody', {
        workspace: currentWorkspaceLabel.value,
      }),
      actionLabel: t('chat.focusChat'),
    }
  }

  if (chatStore.sessions.length > 0) {
    return {
      action: 'open-history' as ChatPrimaryAction,
      tone: 'default' as const,
      eyebrow: t('chat.primaryDecisionArchiveEyebrow'),
      title: t('chat.primaryDecisionArchiveTitle'),
      body: t('chat.primaryDecisionArchiveBody'),
      actionLabel: t('chat.openHistory'),
    }
  }

  return {
    action: 'open-applications' as ChatPrimaryAction,
    tone: 'calm' as const,
    eyebrow: t('chat.primaryDecisionEmptyEyebrow'),
    title: t('chat.primaryDecisionEmptyTitle'),
    body: t('chat.primaryDecisionEmptyBody'),
    actionLabel: t('chat.openApplications'),
  }
})

const decisionChecklist = computed(() => [
  { key: 'sessions', label: t('chat.checklistSessions'), count: chatStore.sessions.length },
  { key: 'live', label: t('chat.checklistLiveSessions'), count: liveSessionCount.value },
  { key: 'workspace', label: t('chat.checklistWorkspaceSessions'), count: workspaceSessionCount.value },
  { key: 'issues', label: t('chat.checklistIssues'), count: issueCount.value },
  { key: 'loaded', label: t('chat.checklistReady'), count: chatStore.sessionsLoaded ? 1 : 0 },
])

function handlePrimaryDecision() {
  if (primaryDecision.value.action === 'open-gateways') {
    router.push({ name: 'hermes.gateways' })
    return
  }
  if (primaryDecision.value.action === 'open-history') {
    router.push({ name: 'hermes.history' })
    return
  }
  if (primaryDecision.value.action === 'open-applications') {
    router.push({ name: 'workbench.applications' })
    return
  }
  chatShellRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(async () => {
  appStore.loadModels()
  await Promise.all([
    profilesStore.fetchProfiles(),
    settingsStore.fetchSettings(),
  ])
  await chatStore.loadSessions()
})
</script>

<template>
  <div class="chat-view workbench-page">
    <section class="workbench-page__hero">
      <div class="workbench-page__hero-copy">
        <div class="workbench-page__eyebrow">{{ t('chat.heroEyebrow') }}</div>
        <h1 class="workbench-page__title">{{ t('chat.heroTitle') }}</h1>
        <p class="workbench-page__subtitle">{{ t('chat.heroSubtitle') }}</p>
      </div>
      <div class="workbench-page__actions">
        <NButton secondary @click="router.push({ name: 'hermes.history' })">
          {{ t('chat.openHistory') }}
        </NButton>
        <NButton type="primary" @click="router.push({ name: 'workbench.applications' })">
          {{ t('chat.openApplications') }}
        </NButton>
      </div>
    </section>

    <section class="chat-view__decision-grid">
      <article class="chat-guide workbench-panel" :class="`chat-guide--${primaryDecision.tone}`">
        <div class="workbench-section-title">{{ primaryDecision.eyebrow }}</div>
        <h2 class="chat-guide__title">{{ primaryDecision.title }}</h2>
        <p class="chat-guide__body">{{ primaryDecision.body }}</p>
        <div class="chat-guide__points">
          <div class="chat-guide__point">{{ t('chat.guidePoint1') }}</div>
          <div class="chat-guide__point">{{ t('chat.guidePoint2') }}</div>
          <div class="chat-guide__point">{{ t('chat.guidePoint3') }}</div>
        </div>
        <div class="chat-guide__actions">
          <NButton type="primary" @click="handlePrimaryDecision()">
            {{ primaryDecision.actionLabel }}
          </NButton>
          <NButton quaternary @click="router.push({ name: 'workbench.runs' })">
            {{ t('chat.openRuns') }}
          </NButton>
        </div>
      </article>

      <article class="chat-checklist workbench-panel workbench-panel--soft">
        <div class="workbench-section-title">{{ t('chat.checklistEyebrow') }}</div>
        <h2 class="chat-checklist__title">{{ t('chat.checklistTitle') }}</h2>
        <p class="chat-checklist__body">{{ t('chat.checklistBody') }}</p>
        <div class="chat-checklist__list">
          <div v-for="item in decisionChecklist" :key="item.key" class="chat-checklist__item">
            <span class="chat-checklist__label">{{ item.label }}</span>
            <span class="chat-checklist__count">{{ item.count }}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="chat-view__summary-grid">
      <article class="chat-stat workbench-panel">
        <div class="chat-stat__label">{{ t('chat.summarySession') }}</div>
        <div class="chat-stat__value">{{ activeSession?.title || t('chat.summarySessionNone') }}</div>
        <div class="chat-stat__meta">{{ t('chat.summarySessionMeta') }}</div>
      </article>

      <article class="chat-stat workbench-panel">
        <div class="chat-stat__label">{{ t('chat.summarySource') }}</div>
        <div class="chat-stat__value">{{ activeSessionSourceLabel }}</div>
        <div class="chat-stat__meta">{{ t('chat.summarySourceMeta') }}</div>
      </article>

      <article class="chat-stat workbench-panel">
        <div class="chat-stat__label">{{ t('chat.summaryRuntime') }}</div>
        <div class="chat-stat__value">{{ currentRuntimeLabel }}</div>
        <div class="chat-stat__meta">{{ t('chat.summaryRuntimeMeta') }}</div>
      </article>

      <article class="chat-stat workbench-panel">
        <div class="chat-stat__label">{{ t('chat.summaryWorkspace') }}</div>
        <div class="chat-stat__value chat-stat__value--path">{{ currentWorkspaceLabel }}</div>
        <div class="chat-stat__meta">{{ t('chat.summaryWorkspaceMeta') }}</div>
      </article>
    </section>

    <section class="chat-view__content">
      <div ref="chatShellRef" class="chat-shell workbench-panel workbench-panel--soft">
        <header class="page-header chat-shell__header">
          <div class="chat-shell__title-group">
            <h2 class="header-title">{{ t('chat.workspaceTitle') }}</h2>
            <p class="chat-shell__subtitle">{{ t('chat.panelSubtitle') }}</p>
          </div>
        </header>

        <div class="chat-view__panel-content">
          <ChatPanel />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.chat-view {
  min-height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.chat-view__decision-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 16px;
  padding: 0 24px 16px;
}

.chat-guide {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chat-guide--warning {
  background:
    linear-gradient(135deg, rgba(178, 75, 66, 0.08), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.chat-guide--accent {
  background:
    linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.09), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.chat-guide__title,
.chat-checklist__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  color: $text-primary;
}

.chat-guide__body,
.chat-checklist__body,
.chat-shell__subtitle {
  color: $text-secondary;
  line-height: 1.7;
}

.chat-guide__points {
  display: grid;
  gap: 10px;
}

.chat-guide__point {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba($color: $border-color, $alpha: 0.9);
  background: rgba(255, 255, 255, 0.74);
  color: $text-secondary;
  line-height: 1.6;
}

.chat-guide__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 4px;
}

.chat-checklist {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chat-checklist__list {
  display: grid;
  gap: 10px;
}

.chat-checklist__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba($color: $border-color, $alpha: 0.9);
}

.chat-checklist__label {
  color: $text-secondary;
}

.chat-checklist__count {
  font-size: 18px;
  font-weight: 700;
  color: $text-primary;
}

.chat-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 0 24px 16px;
}

.chat-stat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 132px;
}

.chat-stat__label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $text-muted;
}

.chat-stat__value {
  font-size: 26px;
  line-height: 1.2;
  color: $text-primary;
}

.chat-stat__value--path {
  word-break: break-word;
}

.chat-stat__meta {
  color: $text-secondary;
  line-height: 1.6;
}

.chat-view__content {
  flex: 1;
  min-height: 0;
  padding: 0 24px 24px;
}

.chat-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chat-shell__header {
  padding: 0;
}

.chat-shell__title-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chat-view__panel-content {
  flex: 1;
  min-height: 0;
}

.chat-view__panel-content :deep(.chat-panel) {
  height: 100%;
}

@media (max-width: 1100px) {
  .chat-view__decision-grid,
  .chat-view__summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .chat-view__decision-grid,
  .chat-view__summary-grid,
  .chat-view__content {
    padding-left: 16px;
    padding-right: 16px;
  }

  .chat-guide__title,
  .chat-checklist__title {
    font-size: 24px;
  }
}
</style>
