<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, NSpin, NTag } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import { getApplicationDetail } from '@/api/workbench/applications'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import { useResourceBaselineSummary } from '@/composables/workbench/useResourceBaselineSummary'
import type { ApplicationDetail } from '@/types/workbench/application'
import {
  buildApplicationDetailRoute,
  buildScopedWorkbenchRoute,
  readWorkbenchApplicationScope,
} from '@/utils/workbench-application-scope'

const route = useRoute()
const router = useRouter()
const resourceBaseline = useResourceBaselineSummary()
const sourceApplication = ref<ApplicationDetail | null>(null)
const { t, locale, sectionLabel } = useWorkbenchI18n()

const applicationContext = computed(() => readWorkbenchApplicationScope(route.query))
const hasApplicationContext = computed(() => !!applicationContext.value.applicationId)
const sourceSectionLabel = computed(() => sectionLabel(applicationContext.value.fromSection))
const sourceApplicationName = computed(() => sourceApplication.value?.name || applicationContext.value.applicationId || t('workbench.resources.applicationFallback'))

const latestMemoryLabel = computed(() => {
  const ts = resourceBaseline.memorySummary.value.latestUpdatedAt
  if (!ts) return t('workbench.resources.noSharedMemoryUpdates')
  return new Date(ts).toLocaleString(locale.value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

onMounted(() => {
  resourceBaseline.load().catch(() => {
    // Keep the workspace shell visible even if one of the reused resource endpoints fails.
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
      // Keep the banner usable with the raw id when the application snapshot cannot be resolved.
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

function openSystemWorkspace() {
  if (!applicationContext.value.applicationId) {
    router.push({ name: 'workbench.system' })
    return
  }
  router.push(buildScopedWorkbenchRoute('workbench.system', applicationContext.value.applicationId, applicationContext.value.fromSection))
}
</script>

<template>
  <div class="resources-view workbench-page">
    <section class="workbench-page__hero">
      <div class="workbench-page__hero-copy">
        <div class="workbench-page__eyebrow">{{ t('workbench.resources.heroEyebrow') }}</div>
        <h1 class="workbench-page__title">{{ t('workbench.resources.heroTitle') }}</h1>
        <p class="workbench-page__subtitle">
          {{ t('workbench.resources.heroSubtitle') }}
        </p>
      </div>
      <div class="workbench-page__actions">
        <NButton secondary @click="resourceBaseline.load()">
          {{ t('workbench.resources.refresh') }}
        </NButton>
        <NButton type="primary" @click="router.push({ name: 'hermes.skills' })">
          {{ t('workbench.resources.openSkillsLibrary') }}
        </NButton>
      </div>
    </section>

    <section v-if="hasApplicationContext" class="resources-view__context">
      <article class="context-banner workbench-panel workbench-panel--soft">
        <div class="context-banner__copy">
          <div class="workbench-section-title">{{ t('workbench.resources.openedFromApplication') }}</div>
          <h2 class="context-banner__title">{{ sourceApplicationName }}</h2>
          <p class="context-banner__body">
            {{ t('workbench.resources.enteredFromSection', { section: sourceSectionLabel }) }}
          </p>
        </div>
        <div class="context-banner__actions">
          <NButton type="primary" @click="openReturnToOrigin">
            {{ t('workbench.resources.returnToSection', { section: sourceSectionLabel }) }}
          </NButton>
          <NButton secondary @click="openApplicationOverview">
            {{ t('workbench.resources.openApplicationOverview') }}
          </NButton>
        </div>
      </article>
    </section>

    <NSpin :show="resourceBaseline.loading.value" size="large">
      <section class="resources-view__summary-grid">
        <article class="resource-stat workbench-panel">
          <div class="resource-stat__label">{{ t('workbench.resources.activeProfile') }}</div>
          <div class="resource-stat__value">{{ resourceBaseline.activeProfileName.value }}</div>
          <div class="resource-stat__meta">
            {{ resourceBaseline.activeProfileDetail.value?.gateway || t('workbench.resources.gatewayDetailLoads') }}
          </div>
        </article>

        <article class="resource-stat workbench-panel">
          <div class="resource-stat__label">{{ t('workbench.resources.defaultRuntimeModel') }}</div>
          <div class="resource-stat__value">{{ resourceBaseline.defaultModelLabel.value }}</div>
          <div class="resource-stat__meta">{{ t('workbench.resources.sharedModelFallback') }}</div>
        </article>

        <article class="resource-stat workbench-panel">
          <div class="resource-stat__label">{{ t('workbench.resources.enabledSkills') }}</div>
          <div class="resource-stat__value">{{ resourceBaseline.skillsSummary.value.enabled }}</div>
          <div class="resource-stat__meta">
            {{ resourceBaseline.skillsSummary.value.pinned }} pinned,
            {{ resourceBaseline.skillsSummary.value.modified }} modified,
            {{ resourceBaseline.skillsSummary.value.local }} local
          </div>
        </article>

        <article class="resource-stat workbench-panel">
          <div class="resource-stat__label">{{ t('workbench.resources.configuredMemorySurfaces') }}</div>
          <div class="resource-stat__value">{{ resourceBaseline.memorySummary.value.configuredSections }}</div>
          <div class="resource-stat__meta">{{ latestMemoryLabel }}</div>
        </article>
      </section>

      <section class="resources-view__main-grid">
        <article class="resource-card workbench-panel workbench-panel--soft">
          <div class="workbench-section-title">{{ t('workbench.resources.profileBaseline') }}</div>
          <h2 class="resource-card__title">{{ t('workbench.resources.profileBaselineTitle') }}</h2>
          <div class="resource-card__items">
            <div class="resource-card__item">
              <span class="resource-card__label">{{ t('workbench.resources.profile') }}</span>
              <span class="resource-card__value">{{ resourceBaseline.activeProfileName.value }}</span>
            </div>
            <div class="resource-card__item">
              <span class="resource-card__label">{{ t('workbench.resources.provider') }}</span>
              <span class="resource-card__value">{{ resourceBaseline.activeProfileDetail.value?.provider || t('workbench.resources.notResolvedYet') }}</span>
            </div>
            <div class="resource-card__item">
              <span class="resource-card__label">{{ t('workbench.resources.gateway') }}</span>
              <span class="resource-card__value">{{ resourceBaseline.activeProfileDetail.value?.gateway || t('workbench.resources.notResolvedYet') }}</span>
            </div>
            <div class="resource-card__item">
              <span class="resource-card__label">{{ t('workbench.resources.pinnedModel') }}</span>
              <span class="resource-card__value">{{ resourceBaseline.activeProfileDetail.value?.model || resourceBaseline.defaultModelLabel.value }}</span>
            </div>
            <div class="resource-card__item">
              <span class="resource-card__label">{{ t('workbench.resources.profilePath') }}</span>
              <span class="resource-card__value resource-card__value--code">{{ resourceBaseline.activeProfileDetail.value?.path || t('workbench.resources.profilePathUnavailable') }}</span>
            </div>
          </div>
          <div class="resource-card__actions">
            <NButton secondary @click="router.push({ name: 'hermes.profiles' })">
              {{ t('workbench.settings.openProfiles') }}
            </NButton>
            <NButton secondary @click="openSystemWorkspace()">
              {{ t('workbench.resources.openSystemWorkspace') }}
            </NButton>
          </div>
        </article>

        <article class="resource-card workbench-panel workbench-panel--soft">
          <div class="workbench-section-title">{{ t('workbench.resources.skillsLibrary') }}</div>
          <h2 class="resource-card__title">{{ t('workbench.resources.skillsTitle') }}</h2>
          <div class="resource-card__tag-row">
            <NTag size="small" round>{{ resourceBaseline.skillsSummary.value.builtin }} {{ t('workbench.resources.builtin') }}</NTag>
            <NTag size="small" round>{{ resourceBaseline.skillsSummary.value.hub }} {{ t('workbench.resources.hub') }}</NTag>
            <NTag size="small" round>{{ resourceBaseline.skillsSummary.value.local }} {{ t('workbench.resources.local') }}</NTag>
          </div>
          <div class="resource-card__items">
            <div class="resource-card__item">
              <span class="resource-card__label">{{ t('workbench.resources.availableSkills') }}</span>
              <span class="resource-card__value">{{ resourceBaseline.skillsSummary.value.total }}</span>
            </div>
            <div class="resource-card__item">
              <span class="resource-card__label">{{ t('workbench.resources.enabledSkills') }}</span>
              <span class="resource-card__value">{{ resourceBaseline.skillsSummary.value.enabled }}</span>
            </div>
            <div class="resource-card__item">
              <span class="resource-card__label">{{ t('workbench.resources.pinnedShortcuts') }}</span>
              <span class="resource-card__value">{{ resourceBaseline.skillsSummary.value.pinned }}</span>
            </div>
            <div class="resource-card__item">
              <span class="resource-card__label">{{ t('workbench.resources.modifiedSkills') }}</span>
              <span class="resource-card__value">{{ resourceBaseline.skillsSummary.value.modified }}</span>
            </div>
          </div>
          <p class="resource-card__body">
            {{ t('workbench.resources.skillsBody') }}
          </p>
          <div class="resource-card__actions">
            <NButton secondary @click="router.push({ name: 'hermes.skills' })">
              {{ t('workbench.resources.openSkills') }}
            </NButton>
          </div>
        </article>

        <article class="resource-card workbench-panel workbench-panel--soft">
          <div class="workbench-section-title">{{ t('workbench.resources.memorySurfaces') }}</div>
          <h2 class="resource-card__title">{{ t('workbench.resources.memorySurfacesTitle') }}</h2>
          <div class="resource-card__items">
            <div class="resource-card__item">
              <span class="resource-card__label">{{ t('workbench.resources.notesMemory') }}</span>
              <span class="resource-card__value">{{ t('workbench.resources.charCount', { count: resourceBaseline.memorySummary.value.sectionLengths.memory }) }}</span>
            </div>
            <div class="resource-card__item">
              <span class="resource-card__label">{{ t('workbench.resources.userProfile') }}</span>
              <span class="resource-card__value">{{ t('workbench.resources.charCount', { count: resourceBaseline.memorySummary.value.sectionLengths.user }) }}</span>
            </div>
            <div class="resource-card__item">
              <span class="resource-card__label">{{ t('workbench.resources.soulMemory') }}</span>
              <span class="resource-card__value">{{ t('workbench.resources.charCount', { count: resourceBaseline.memorySummary.value.sectionLengths.soul }) }}</span>
            </div>
            <div class="resource-card__item">
              <span class="resource-card__label">{{ t('workbench.resources.latestUpdate') }}</span>
              <span class="resource-card__value">{{ latestMemoryLabel }}</span>
            </div>
          </div>
          <p class="resource-card__body">
            {{ t('workbench.resources.memoryBody') }}
          </p>
          <div class="resource-card__actions">
            <NButton secondary @click="router.push({ name: 'hermes.memory' })">
              {{ t('workbench.resources.openMemory') }}
            </NButton>
          </div>
        </article>
      </section>
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.resources-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 0 24px;
}

.resources-view__context {
  padding: 0 24px;
}

.resources-view__main-grid {
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

.resource-stat {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 150px;
}

.resource-stat__label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $text-muted;
}

.resource-stat__value {
  font-size: 28px;
  line-height: 1.1;
  color: $text-primary;
}

.resource-stat__meta {
  color: $text-secondary;
  line-height: 1.6;
}

.resource-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 100%;
}

.resource-card__title {
  font-size: 18px;
  line-height: 1.3;
  color: $text-primary;
}

.resource-card__tag-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.resource-card__items {
  display: grid;
  gap: 12px;
}

.resource-card__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid $border-color;
  background: rgba(255, 255, 255, 0.64);
}

.resource-card__label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $text-muted;
}

.resource-card__value {
  color: $text-primary;
  line-height: 1.6;
}

.resource-card__value--code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  word-break: break-all;
}

.resource-card__body {
  color: $text-secondary;
  line-height: 1.7;
}

.resource-card__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: auto;
}

@media (max-width: 1180px) {
  .context-banner {
    flex-direction: column;
  }

  .resources-view__summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .resources-view__main-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .resources-view__summary-grid {
    grid-template-columns: 1fr;
    padding: 0 16px;
  }

  .resources-view__main-grid {
    padding: 16px 16px 24px;
  }
}
</style>
