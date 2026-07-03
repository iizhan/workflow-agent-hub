<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NButton, NSpin } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import PlatformSettings from '@/components/hermes/settings/PlatformSettings.vue'
import { useSettingsStore } from '@/stores/hermes/settings'

const settingsStore = useSettingsStore()
const router = useRouter()
const { t } = useI18n()
const channelsShellRef = ref<HTMLElement | null>(null)

const platformKeys = [
  'telegram',
  'discord',
  'slack',
  'whatsapp',
  'matrix',
  'wecom',
  'feishu',
  'dingtalk',
  'weixin',
] as const

const totalChannels = computed(() => platformKeys.length)

const configuredChannels = computed(() =>
  platformKeys.filter(key => {
    const credentials = (settingsStore.platforms?.[key] || {}) as Record<string, unknown>
    const section = (settingsStore[key] || {}) as Record<string, unknown>

    const hasCredentials = Object.values(credentials).some(value => {
      if (typeof value === 'boolean') return value
      return String(value || '').trim().length > 0
    })

    const hasSectionConfig = Object.values(section).some(value => {
      if (typeof value === 'boolean') return value
      return String(value || '').trim().length > 0
    })

    return hasCredentials || hasSectionConfig
  }).length,
)

const weixinReady = computed(() => {
  const credentials = (settingsStore.platforms?.weixin || {}) as Record<string, unknown>
  return !!String(credentials.token || '').trim() || !!String(credentials.account_id || '').trim()
})

const whatsappReady = computed(() => {
  const credentials = (settingsStore.platforms?.whatsapp || {}) as Record<string, unknown>
  return Boolean(credentials.enabled)
})

type ChannelsPrimaryAction = 'focus-channels' | 'open-profiles' | 'open-system'

const primaryDecision = computed(() => {
  if (configuredChannels.value === 0) {
    return {
      action: 'focus-channels' as ChannelsPrimaryAction,
      tone: 'calm' as const,
      eyebrow: t('channels.primaryDecisionEmptyEyebrow'),
      title: t('channels.primaryDecisionEmptyTitle'),
      body: t('channels.primaryDecisionEmptyBody'),
      actionLabel: t('channels.focusChannels'),
    }
  }

  if (!weixinReady.value && !whatsappReady.value) {
    return {
      action: 'focus-channels' as ChannelsPrimaryAction,
      tone: 'warning' as const,
      eyebrow: t('channels.primaryDecisionEntryEyebrow'),
      title: t('channels.primaryDecisionEntryTitle'),
      body: t('channels.primaryDecisionEntryBody'),
      actionLabel: t('channels.focusChannels'),
    }
  }

  if (weixinReady.value || whatsappReady.value) {
    return {
      action: 'focus-channels' as ChannelsPrimaryAction,
      tone: 'accent' as const,
      eyebrow: t('channels.primaryDecisionReadyEyebrow'),
      title: t('channels.primaryDecisionReadyTitle'),
      body: t('channels.primaryDecisionReadyBody', {
        count: configuredChannels.value,
      }),
      actionLabel: t('channels.focusChannels'),
    }
  }

  return {
    action: 'open-system' as ChannelsPrimaryAction,
    tone: 'default' as const,
    eyebrow: t('channels.primaryDecisionReviewEyebrow'),
    title: t('channels.primaryDecisionReviewTitle'),
    body: t('channels.primaryDecisionReviewBody'),
    actionLabel: t('channels.openSystemControl'),
  }
})

onMounted(() => {
  settingsStore.fetchSettings()
})

function handlePrimaryDecision() {
  if (primaryDecision.value.action === 'open-profiles') {
    router.push({ name: 'hermes.profiles' })
    return
  }
  if (primaryDecision.value.action === 'open-system') {
    router.push({ name: 'workbench.system' })
    return
  }
  channelsShellRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="channels-view workbench-page">
    <section class="workbench-page__hero">
      <div class="workbench-page__hero-copy">
        <div class="workbench-page__eyebrow">{{ t('channels.heroEyebrow') }}</div>
        <h1 class="workbench-page__title">{{ t('channels.heroTitle') }}</h1>
        <p class="workbench-page__subtitle">{{ t('channels.heroSubtitle') }}</p>
      </div>
      <div class="workbench-page__actions">
        <NButton secondary @click="router.push({ name: 'hermes.profiles' })">
          {{ t('channels.openProfiles') }}
        </NButton>
        <NButton type="primary" @click="router.push({ name: 'workbench.system' })">
          {{ t('channels.openSystemControl') }}
        </NButton>
      </div>
    </section>

    <section class="channels-view__decision-grid">
      <article class="channels-guide workbench-panel" :class="`channels-guide--${primaryDecision.tone}`">
        <div class="workbench-section-title">{{ primaryDecision.eyebrow }}</div>
        <h2 class="channels-guide__title">{{ primaryDecision.title }}</h2>
        <p class="channels-guide__body">{{ primaryDecision.body }}</p>
        <div class="channels-guide__points">
          <div class="channels-guide__point">{{ t('channels.guidePoint1') }}</div>
          <div class="channels-guide__point">{{ t('channels.guidePoint2') }}</div>
          <div class="channels-guide__point">{{ t('channels.guidePoint3') }}</div>
        </div>
        <div class="channels-guide__actions">
          <NButton type="primary" @click="handlePrimaryDecision()">
            {{ primaryDecision.actionLabel }}
          </NButton>
          <NButton quaternary @click="router.push({ name: 'workbench.applications' })">
            {{ t('channels.openApplications') }}
          </NButton>
        </div>
      </article>

      <article class="channels-checklist workbench-panel workbench-panel--soft">
        <div class="workbench-section-title">{{ t('channels.checklistEyebrow') }}</div>
        <h2 class="channels-checklist__title">{{ t('channels.checklistTitle') }}</h2>
        <p class="channels-checklist__body">{{ t('channels.checklistBody') }}</p>
        <div class="channels-checklist__list">
          <div class="channels-checklist__item">
            <span class="channels-checklist__label">{{ t('channels.totalChannelsLabel') }}</span>
            <span class="channels-checklist__value">{{ totalChannels }}</span>
          </div>
          <div class="channels-checklist__item">
            <span class="channels-checklist__label">{{ t('channels.configuredChannelsLabel') }}</span>
            <span class="channels-checklist__value">{{ configuredChannels }}</span>
          </div>
          <div class="channels-checklist__item">
            <span class="channels-checklist__label">{{ t('channels.weixinLabel') }}</span>
            <span class="channels-checklist__value">{{ weixinReady ? t('channels.connected') : t('channels.notConnected') }}</span>
          </div>
          <div class="channels-checklist__item">
            <span class="channels-checklist__label">{{ t('channels.whatsappLabel') }}</span>
            <span class="channels-checklist__value">{{ whatsappReady ? t('channels.connected') : t('channels.notConnected') }}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="channels-view__summary-grid">
      <article class="channels-stat workbench-panel">
        <div class="channels-stat__label">{{ t('channels.totalChannelsLabel') }}</div>
        <div class="channels-stat__value">{{ totalChannels }}</div>
        <div class="channels-stat__meta">{{ t('channels.totalChannelsMeta') }}</div>
      </article>

      <article class="channels-stat workbench-panel">
        <div class="channels-stat__label">{{ t('channels.configuredChannelsLabel') }}</div>
        <div class="channels-stat__value">{{ configuredChannels }}</div>
        <div class="channels-stat__meta">{{ t('channels.configuredChannelsMeta') }}</div>
      </article>

      <article class="channels-stat workbench-panel">
        <div class="channels-stat__label">{{ t('channels.weixinLabel') }}</div>
        <div class="channels-stat__value channels-stat__value--compact">{{ weixinReady ? t('channels.connected') : t('channels.notConnected') }}</div>
        <div class="channels-stat__meta">{{ t('channels.weixinMeta') }}</div>
      </article>

      <article class="channels-stat workbench-panel">
        <div class="channels-stat__label">{{ t('channels.whatsappLabel') }}</div>
        <div class="channels-stat__value channels-stat__value--compact">{{ whatsappReady ? t('channels.connected') : t('channels.notConnected') }}</div>
        <div class="channels-stat__meta">{{ t('channels.whatsappMeta') }}</div>
      </article>
    </section>

    <section class="channels-view__content">
      <div ref="channelsShellRef" class="channels-shell workbench-panel workbench-panel--soft">
        <header class="page-header channels-shell__header">
          <div class="channels-shell__title-group">
            <h2 class="header-title">{{ t('channels.title') }}</h2>
            <p class="channels-shell__subtitle">{{ t('channels.panelSubtitle') }}</p>
          </div>
        </header>

        <div class="channels-content">
          <NSpin :show="settingsStore.loading || settingsStore.saving" size="large" :description="t('common.loading')">
            <PlatformSettings v-if="!settingsStore.loading" />
          </NSpin>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.channels-view {
  min-height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
}

.channels-view__decision-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
  gap: 16px;
  padding: 0 24px 16px;
}

.channels-guide {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 220px;
}

.channels-guide--accent {
  background:
    linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.09), rgba(255, 255, 255, 0.92)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.9));
}

.channels-guide--warning {
  background:
    linear-gradient(135deg, rgba(178, 75, 66, 0.08), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.channels-guide__title,
.channels-checklist__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  color: $text-primary;
}

.channels-guide__body,
.channels-checklist__body,
.channels-shell__subtitle {
  color: $text-secondary;
  line-height: 1.7;
}

.channels-guide__points,
.channels-checklist__list {
  display: grid;
  gap: 10px;
}

.channels-guide__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 4px;
}

.channels-guide__point,
.channels-checklist__item {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid $border-color;
  background: rgba(255, 255, 255, 0.72);
}

.channels-checklist {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.channels-checklist__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.channels-checklist__label {
  color: $text-primary;
  font-weight: 600;
}

.channels-checklist__value {
  min-width: 34px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: $text-primary;
  font-weight: 700;
  text-align: center;
}

.channels-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 0 24px 16px;
}

.channels-stat__label {
  font-size: 12px;
  color: $text-muted;
}

.channels-stat__value {
  margin-top: 8px;
  font-size: 30px;
  font-weight: 700;
  color: $text-primary;
}

.channels-stat__value--compact {
  font-size: 18px;
  line-height: 1.4;
}

.channels-stat__meta {
  margin-top: 8px;
  color: $text-secondary;
  line-height: 1.6;
}

.channels-view__content {
  flex: 1;
  min-height: 0;
  padding: 0 24px 24px;
}

.channels-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.channels-shell__header {
  padding-inline: 0;
  padding-top: 0;
}

.channels-shell__title-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.channels-content {
  flex: 1;
  overflow-y: auto;
  padding-top: 20px;
  position: relative;
}

@media (max-width: 1200px) {
  .channels-view__decision-grid,
  .channels-view__summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .channels-view__content,
  .channels-view__decision-grid,
  .channels-view__summary-grid {
    padding-inline: 12px;
  }

  .channels-shell__header {
    align-items: flex-start;
  }

  .channels-checklist__item {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
