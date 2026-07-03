<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NAlert, NButton, NSpin, NTag } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import { getApplicationDetail } from '@/api/workbench/applications'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import { useSystemWorkspaceSummary } from '@/composables/workbench/useSystemWorkspaceSummary'
import type { ApplicationDetail } from '@/types/workbench/application'
import {
  buildApplicationDetailRoute,
  buildScopedWorkbenchRoute,
  readWorkbenchApplicationScope,
} from '@/utils/workbench-application-scope'

const route = useRoute()
const router = useRouter()
const system = useSystemWorkspaceSummary()
const sourceApplication = ref<ApplicationDetail | null>(null)
const { t, sectionLabel } = useWorkbenchI18n()

function formatInteger(value: number): string {
  return Intl.NumberFormat().format(value)
}

function formatCost(value: number): string {
  return value > 0 ? `$${value.toFixed(2)}` : '$0.00'
}

function formatRate(value: number | null): string {
  return value == null ? t('workbench.system.na') : `${value.toFixed(1)}%`
}

const gatewayHealthLabel = computed(() =>
  system.appStore.gatewayStatus === 'running' ? t('workbench.system.running') : t('workbench.system.stopped'),
)

const updateBannerVisible = computed(() => system.appStore.updateAvailable)
const applicationContext = computed(() => readWorkbenchApplicationScope(route.query))
const hasApplicationContext = computed(() => !!applicationContext.value.applicationId)
const sourceSectionLabel = computed(() => sectionLabel(applicationContext.value.fromSection))
const sourceApplicationName = computed(() => sourceApplication.value?.name || applicationContext.value.applicationId || t('workbench.system.applicationFallback'))

onMounted(() => {
  system.load().catch(() => {
    // The workspace can still render partial system state if one reused module fails.
  })
})

watch(
  () => applicationContext.value.applicationId,
  async applicationId => {
    sourceApplication.value = null
    if (!applicationId) return
    try {
      sourceApplication.value = await getApplicationDetail(applicationId)
    } catch {
      // Preserve the round-trip banner even if application detail lookup fails.
    }
  },
  { immediate: true },
)

function openReturnToOrigin() {
  if (!applicationContext.value.applicationId) return
  router.push(buildApplicationDetailRoute(applicationContext.value.applicationId, applicationContext.value.fromSection))
}

function openApplicationOverview() {
  if (!applicationContext.value.applicationId) return
  router.push(buildApplicationDetailRoute(applicationContext.value.applicationId, 'overview'))
}

function openSharedResources() {
  if (!applicationContext.value.applicationId) {
    router.push({ name: 'workbench.resources' })
    return
  }
  router.push(buildScopedWorkbenchRoute('workbench.resources', applicationContext.value.applicationId, applicationContext.value.fromSection))
}
</script>

<template>
  <div class="system-view workbench-page">
    <section class="workbench-page__hero">
      <div class="workbench-page__hero-copy">
        <div class="workbench-page__eyebrow">{{ t('workbench.system.heroEyebrow') }}</div>
        <h1 class="workbench-page__title">{{ t('workbench.system.heroTitle') }}</h1>
        <p class="workbench-page__subtitle">{{ t('workbench.system.heroSubtitle') }}</p>
      </div>
      <div class="workbench-page__actions">
        <NButton secondary @click="system.load()">
          {{ t('workbench.system.refresh') }}
        </NButton>
        <NButton type="primary" @click="router.push({ name: 'hermes.gateways' })">
          {{ t('workbench.system.openGateways') }}
        </NButton>
      </div>
    </section>

    <section v-if="hasApplicationContext" class="system-view__context">
      <article class="context-banner workbench-panel workbench-panel--soft">
        <div class="context-banner__copy">
          <div class="workbench-section-title">{{ t('workbench.system.openedFromApplication') }}</div>
          <h2 class="context-banner__title">{{ sourceApplicationName }}</h2>
          <p class="context-banner__body">
            {{ t('workbench.system.enteredFromSection', { section: sourceSectionLabel }) }}
          </p>
        </div>
        <div class="context-banner__actions">
          <NButton type="primary" @click="openReturnToOrigin">
            {{ t('workbench.system.returnToSection', { section: sourceSectionLabel }) }}
          </NButton>
          <NButton secondary @click="openApplicationOverview">
            {{ t('workbench.system.openApplicationOverview') }}
          </NButton>
        </div>
      </article>
    </section>

    <NSpin :show="system.loading.value" size="large">
      <section v-if="updateBannerVisible" class="system-view__banner">
        <NAlert type="info">
          {{ t('workbench.system.newerBuildAvailable') }}
        </NAlert>
      </section>

      <section class="system-view__summary-grid">
        <article class="system-stat workbench-panel">
          <div class="system-stat__label">{{ t('workbench.system.gatewayRuntime') }}</div>
          <div class="system-stat__value">{{ gatewayHealthLabel }}</div>
          <div class="system-stat__meta">
            {{ t('workbench.system.gatewaysRunningMeta', { running: system.runningGateways.value.length, total: system.gatewayStore.gateways.length }) }}
          </div>
        </article>

        <article class="system-stat workbench-panel">
          <div class="system-stat__label">{{ t('workbench.system.enabledProviders') }}</div>
          <div class="system-stat__value">{{ system.enabledProviders.value.length }}</div>
          <div class="system-stat__meta">{{ t('workbench.system.enabledModelsMeta', { count: system.enabledModelCount.value }) }}</div>
        </article>

        <article class="system-stat workbench-panel">
          <div class="system-stat__label">{{ t('workbench.system.activeProfile') }}</div>
          <div class="system-stat__value">{{ system.activeProfileName.value }}</div>
          <div class="system-stat__meta">{{ system.activeDefaultModelLabel.value }}</div>
        </article>

        <article class="system-stat workbench-panel">
          <div class="system-stat__label">{{ t('workbench.system.daySessions') }}</div>
          <div class="system-stat__value">{{ formatInteger(system.usageSummary.value.sessions) }}</div>
          <div class="system-stat__meta">
            {{ t('workbench.system.tokensMeta', { tokens: formatInteger(system.usageSummary.value.totalTokens), rate: formatRate(system.usageSummary.value.cacheHitRate) }) }}
          </div>
        </article>
      </section>

      <section class="system-view__main-grid">
        <article class="system-card workbench-panel workbench-panel--soft">
          <div class="workbench-section-title">{{ t('workbench.system.runtime') }}</div>
          <h2 class="system-card__title">{{ t('workbench.system.runtimeTitle') }}</h2>
          <div class="system-card__items">
            <div class="system-card__item">
              <span class="system-card__label">{{ t('workbench.system.gatewayStatus') }}</span>
              <span class="system-card__value">{{ gatewayHealthLabel }}</span>
            </div>
            <div class="system-card__item">
              <span class="system-card__label">{{ t('workbench.system.runningGateways') }}</span>
              <span class="system-card__value">{{ system.runningGateways.value.length }}</span>
            </div>
            <div class="system-card__item">
              <span class="system-card__label">{{ t('workbench.system.gatewaysWithErrors') }}</span>
              <span class="system-card__value">{{ system.failingGateways.value.length }}</span>
            </div>
            <div class="system-card__item">
              <span class="system-card__label">{{ t('workbench.system.nodeRuntime') }}</span>
              <span class="system-card__value">{{ system.appStore.nodeVersion || t('workbench.system.unavailable') }}</span>
            </div>
            <div class="system-card__item">
              <span class="system-card__label">{{ t('workbench.system.workbenchVersion') }}</span>
              <span class="system-card__value">{{ system.appStore.serverVersion }}</span>
            </div>
          </div>
          <div class="system-card__actions">
            <NButton secondary @click="router.push({ name: 'hermes.gateways' })">{{ t('workbench.system.manageGateways') }}</NButton>
            <NButton secondary @click="router.push({ name: 'hermes.logs' })">{{ t('workbench.system.openLogs') }}</NButton>
          </div>
        </article>

        <article class="system-card workbench-panel workbench-panel--soft">
          <div class="workbench-section-title">{{ t('workbench.system.modelFleet') }}</div>
          <h2 class="system-card__title">{{ t('workbench.system.modelFleetTitle') }}</h2>
          <div class="system-card__tag-row">
            <NTag size="small" round>{{ system.modelsStore.builtinProviders.length }} {{ t('workbench.system.builtin') }}</NTag>
            <NTag size="small" round>{{ system.modelsStore.customProviders.length }} {{ t('workbench.system.custom') }}</NTag>
          </div>
          <div class="system-card__items">
            <div class="system-card__item">
              <span class="system-card__label">{{ t('workbench.system.enabledProviders') }}</span>
              <span class="system-card__value">{{ system.enabledProviders.value.length }}</span>
            </div>
            <div class="system-card__item">
              <span class="system-card__label">{{ t('workbench.system.enabledModels') }}</span>
              <span class="system-card__value">{{ system.enabledModelCount.value }}</span>
            </div>
            <div class="system-card__item">
              <span class="system-card__label">{{ t('workbench.system.defaultRuntimeModel') }}</span>
              <span class="system-card__value">{{ system.activeDefaultModelLabel.value }}</span>
            </div>
          </div>
          <p class="system-card__body">
            {{ t('workbench.system.modelFleetBody') }}
          </p>
          <div class="system-card__actions">
            <NButton secondary @click="router.push({ name: 'hermes.models' })">{{ t('workbench.system.openModels') }}</NButton>
          </div>
        </article>

        <article class="system-card workbench-panel workbench-panel--soft">
          <div class="workbench-section-title">{{ t('workbench.system.profiles') }}</div>
          <h2 class="system-card__title">{{ t('workbench.system.profilesTitle') }}</h2>
          <div class="system-card__items">
            <div class="system-card__item">
              <span class="system-card__label">{{ t('workbench.system.profilesCount') }}</span>
              <span class="system-card__value">{{ system.profilesStore.profiles.length }}</span>
            </div>
            <div class="system-card__item">
              <span class="system-card__label">{{ t('workbench.system.activeProfile') }}</span>
              <span class="system-card__value">{{ system.activeProfileName.value }}</span>
            </div>
            <div class="system-card__item">
              <span class="system-card__label">{{ t('workbench.system.activeProvider') }}</span>
              <span class="system-card__value">{{ system.activeProfileDetail.value?.provider || t('workbench.system.unavailable') }}</span>
            </div>
            <div class="system-card__item">
              <span class="system-card__label">{{ t('workbench.system.profileSkills') }}</span>
              <span class="system-card__value">{{ system.activeProfileDetail.value?.skills ?? t('workbench.system.unavailable') }}</span>
            </div>
          </div>
          <div class="system-card__actions">
            <NButton secondary @click="router.push({ name: 'hermes.profiles' })">{{ t('workbench.system.openProfiles') }}</NButton>
            <NButton secondary @click="openSharedResources()">{{ t('workbench.system.openSharedResources') }}</NButton>
          </div>
        </article>

        <article class="system-card workbench-panel workbench-panel--soft">
          <div class="workbench-section-title">{{ t('workbench.system.telemetry') }}</div>
          <h2 class="system-card__title">{{ t('workbench.system.telemetryTitle') }}</h2>
          <div class="system-card__items">
            <div class="system-card__item">
              <span class="system-card__label">{{ t('workbench.system.daySessions') }}</span>
              <span class="system-card__value">{{ formatInteger(system.usageSummary.value.sessions) }}</span>
            </div>
            <div class="system-card__item">
              <span class="system-card__label">{{ t('workbench.system.totalTokens') }}</span>
              <span class="system-card__value">{{ formatInteger(system.usageSummary.value.totalTokens) }}</span>
            </div>
            <div class="system-card__item">
              <span class="system-card__label">{{ t('workbench.system.estimatedCost') }}</span>
              <span class="system-card__value">{{ formatCost(system.usageSummary.value.estimatedCost) }}</span>
            </div>
            <div class="system-card__item">
              <span class="system-card__label">{{ t('workbench.system.cacheHitRate') }}</span>
              <span class="system-card__value">{{ formatRate(system.usageSummary.value.cacheHitRate) }}</span>
            </div>
          </div>
          <div class="system-card__actions">
            <NButton secondary @click="router.push({ name: 'hermes.usage' })">{{ t('workbench.system.openUsage') }}</NButton>
            <NButton secondary @click="router.push({ name: 'hermes.logs' })">{{ t('workbench.system.openLogs') }}</NButton>
          </div>
        </article>

        <article class="system-card workbench-panel workbench-panel--soft">
          <div class="workbench-section-title">{{ t('workbench.system.channels') }}</div>
          <h2 class="system-card__title">{{ t('workbench.system.channelsTitle') }}</h2>
          <p class="system-card__body">
            {{ t('workbench.system.channelsBody') }}
          </p>
          <div class="system-card__actions">
            <NButton secondary @click="router.push({ name: 'hermes.channels' })">{{ t('workbench.system.openChannels') }}</NButton>
            <NButton secondary @click="router.push({ name: 'hermes.settings' })">{{ t('workbench.system.openSettings') }}</NButton>
          </div>
        </article>
      </section>
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.system-view__banner {
  padding: 0 24px;
}

.system-view__context {
  padding: 0 24px;
}

.system-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 16px 24px 0;
}

.system-view__main-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  padding: 16px 24px 24px;
}

.context-banner {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.context-banner__copy {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.context-banner__title {
  color: $text-primary;
  font-size: 22px;
  line-height: 1.2;
}

.context-banner__body {
  max-width: 760px;
  color: $text-secondary;
  line-height: 1.7;
}

.context-banner__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-start;
}

.system-stat {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 150px;
}

.system-stat__label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $text-muted;
}

.system-stat__value {
  font-size: 28px;
  line-height: 1.1;
  color: $text-primary;
}

.system-stat__meta {
  color: $text-secondary;
  line-height: 1.6;
}

.system-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.system-card__title {
  font-size: 18px;
  line-height: 1.3;
  color: $text-primary;
}

.system-card__tag-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.system-card__items {
  display: grid;
  gap: 12px;
}

.system-card__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid $border-color;
  background: rgba(255, 255, 255, 0.64);
}

.system-card__label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $text-muted;
}

.system-card__value {
  color: $text-primary;
  line-height: 1.6;
}

.system-card__body {
  color: $text-secondary;
  line-height: 1.7;
}

.system-card__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: auto;
}

@media (max-width: 1180px) {
  .context-banner {
    flex-direction: column;
  }

  .system-view__summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .system-view__main-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .system-view__banner,
  .system-view__context,
  .system-view__summary-grid {
    padding-left: 16px;
    padding-right: 16px;
  }

  .system-view__summary-grid {
    grid-template-columns: 1fr;
  }

  .system-view__main-grid {
    padding: 16px 16px 24px;
  }
}
</style>
