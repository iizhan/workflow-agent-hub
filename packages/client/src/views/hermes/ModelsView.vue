<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import ModelManagementPanel from '@/components/hermes/models/ModelManagementPanel.vue'
import { useModelsStore } from '@/stores/hermes/models'
import { useAppStore } from '@/stores/hermes/app'

const router = useRouter()
const { t } = useI18n()
const modelsStore = useModelsStore()
const appStore = useAppStore()
const modelsShellRef = ref<HTMLDivElement | null>(null)

const totalProviders = computed(() => modelsStore.providers.length)
const totalModels = computed(() =>
  modelsStore.providers.reduce((sum, provider) => sum + provider.models.length, 0),
)

const disabledProviders = computed(() =>
  modelsStore.providers.filter(provider => provider.user_disabled).length,
)

const disabledModels = computed(() =>
  modelsStore.providers.reduce(
    (sum, provider) => sum + provider.models.filter(model => provider.model_meta?.[model]?.user_disabled).length,
    0,
  ),
)

const builtinProviders = computed(() =>
  modelsStore.providers.filter(provider => provider.builtin).length,
)

const customProviders = computed(() =>
  modelsStore.providers.filter(provider => !provider.builtin && provider.provider.startsWith('custom:')).length,
)

const currentDefaultLabel = computed(() =>
  appStore.selectedModel || t('models.noDefaultModel'),
)

const currentDefaultProvider = computed(() =>
  modelsStore.providers.find(provider => provider.provider === appStore.selectedProvider)
  || modelsStore.providers.find(provider => provider.models.includes(appStore.selectedModel)),
)

type ModelsPrimaryAction = 'focus-models' | 'open-gateways'

const primaryDecision = computed(() => {
  if (disabledProviders.value > 0) {
    return {
      action: 'focus-models' as ModelsPrimaryAction,
      tone: 'warning' as const,
      eyebrow: t('models.primaryDecisionDisabledEyebrow'),
      title: t('models.primaryDecisionDisabledTitle', { count: disabledProviders.value }),
      body: t('models.primaryDecisionDisabledBody'),
      actionLabel: t('models.focusModels'),
    }
  }

  if (currentDefaultProvider.value && appStore.selectedModel) {
    return {
      action: 'focus-models' as ModelsPrimaryAction,
      tone: 'accent' as const,
      eyebrow: t('models.primaryDecisionDefaultEyebrow'),
      title: t('models.primaryDecisionDefaultTitle', { model: appStore.selectedModel }),
      body: t('models.primaryDecisionDefaultBody', { provider: currentDefaultProvider.value.label }),
      actionLabel: t('models.focusModels'),
    }
  }

  if (totalProviders.value > 0) {
    return {
      action: 'focus-models' as ModelsPrimaryAction,
      tone: 'calm' as const,
      eyebrow: t('models.primaryDecisionReviewEyebrow'),
      title: t('models.primaryDecisionReviewTitle'),
      body: t('models.primaryDecisionReviewBody'),
      actionLabel: t('models.focusModels'),
    }
  }

  return {
    action: 'open-gateways' as ModelsPrimaryAction,
    tone: 'calm' as const,
    eyebrow: t('models.primaryDecisionEmptyEyebrow'),
    title: t('models.primaryDecisionEmptyTitle'),
    body: t('models.primaryDecisionEmptyBody'),
    actionLabel: t('models.openGateways'),
  }
})

const decisionChecklist = computed(() => [
  { key: 'providers', label: t('models.checklistProviders'), count: totalProviders.value },
  { key: 'models', label: t('models.checklistModels'), count: totalModels.value },
  { key: 'disabledProviders', label: t('models.checklistDisabledProviders'), count: disabledProviders.value },
  { key: 'disabledModels', label: t('models.checklistDisabledModels'), count: disabledModels.value },
  { key: 'customProviders', label: t('models.checklistCustomProviders'), count: customProviders.value },
])

function handlePrimaryDecision() {
  if (primaryDecision.value.action === 'open-gateways') {
    router.push({ name: 'hermes.gateways' })
    return
  }
  modelsShellRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(() => {
  void modelsStore.fetchProviders()
  void appStore.loadModels()
})
</script>

<template>
  <div class="models-view workbench-page">
    <section class="workbench-page__hero">
      <div class="workbench-page__hero-copy">
        <div class="workbench-page__eyebrow">{{ t('models.heroEyebrow') }}</div>
        <h1 class="workbench-page__title">{{ t('models.heroTitle') }}</h1>
        <p class="workbench-page__subtitle">{{ t('models.heroSubtitle') }}</p>
      </div>
      <div class="workbench-page__actions">
        <NButton secondary @click="router.push({ name: 'hermes.gateways' })">
          {{ t('models.openGateways') }}
        </NButton>
        <NButton type="primary" @click="router.push({ name: 'workbench.applications' })">
          {{ t('models.openApplications') }}
        </NButton>
      </div>
    </section>

    <section class="models-view__decision-grid">
      <article class="models-guide workbench-panel" :class="`models-guide--${primaryDecision.tone}`">
        <div class="workbench-section-title">{{ primaryDecision.eyebrow }}</div>
        <h2 class="models-guide__title">{{ primaryDecision.title }}</h2>
        <p class="models-guide__body">{{ primaryDecision.body }}</p>
        <div class="models-guide__points">
          <div class="models-guide__point">{{ t('models.guidePoint1') }}</div>
          <div class="models-guide__point">{{ t('models.guidePoint2') }}</div>
          <div class="models-guide__point">{{ t('models.guidePoint3') }}</div>
        </div>
        <div class="models-guide__actions">
          <NButton type="primary" @click="handlePrimaryDecision()">
            {{ primaryDecision.actionLabel }}
          </NButton>
          <NButton quaternary @click="router.push({ name: 'workbench.runs' })">
            {{ t('models.openRuns') }}
          </NButton>
        </div>
      </article>

      <article class="models-checklist workbench-panel workbench-panel--soft">
        <div class="workbench-section-title">{{ t('models.checklistEyebrow') }}</div>
        <h2 class="models-checklist__title">{{ t('models.checklistTitle') }}</h2>
        <p class="models-checklist__body">{{ t('models.checklistBody') }}</p>
        <div class="models-checklist__list">
          <div v-for="item in decisionChecklist" :key="item.key" class="models-checklist__item">
            <span class="models-checklist__label">{{ item.label }}</span>
            <span class="models-checklist__count">{{ item.count }}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="models-view__summary-grid">
      <article class="models-stat workbench-panel">
        <div class="models-stat__label">{{ t('models.summaryDefaultModel') }}</div>
        <div class="models-stat__value models-stat__value--path">{{ currentDefaultLabel }}</div>
        <div class="models-stat__meta">{{ t('models.summaryDefaultModelMeta') }}</div>
      </article>

      <article class="models-stat workbench-panel">
        <div class="models-stat__label">{{ t('models.summaryDefaultProvider') }}</div>
        <div class="models-stat__value">{{ currentDefaultProvider?.label || t('models.noDefaultProvider') }}</div>
        <div class="models-stat__meta">{{ t('models.summaryDefaultProviderMeta') }}</div>
      </article>

      <article class="models-stat workbench-panel">
        <div class="models-stat__label">{{ t('models.summaryBuiltinProviders') }}</div>
        <div class="models-stat__value">{{ builtinProviders }}</div>
        <div class="models-stat__meta">{{ t('models.summaryBuiltinProvidersMeta') }}</div>
      </article>

      <article class="models-stat workbench-panel">
        <div class="models-stat__label">{{ t('models.summaryCustomProviders') }}</div>
        <div class="models-stat__value">{{ customProviders }}</div>
        <div class="models-stat__meta">{{ t('models.summaryCustomProvidersMeta') }}</div>
      </article>
    </section>

    <section class="models-view__content">
      <div ref="modelsShellRef" class="models-shell workbench-panel workbench-panel--soft">
        <header class="page-header models-shell__header">
          <div class="models-shell__title-group">
            <h2 class="header-title">{{ t('models.title') }}</h2>
            <p class="models-shell__subtitle">{{ t('models.panelSubtitle') }}</p>
          </div>
        </header>

        <div class="models-view__panel-content">
          <ModelManagementPanel :show-header="false" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.models-view {
  min-height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.models-view__decision-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 16px;
  padding: 0 24px 16px;
}

.models-guide {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.models-guide--warning {
  background:
    linear-gradient(135deg, rgba(178, 75, 66, 0.08), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.models-guide--accent {
  background:
    linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.09), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.models-guide__title,
.models-checklist__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  color: $text-primary;
}

.models-guide__body,
.models-checklist__body,
.models-shell__subtitle {
  color: $text-secondary;
  line-height: 1.7;
}

.models-guide__points,
.models-checklist__list {
  display: grid;
  gap: 10px;
}

.models-guide__point,
.models-checklist__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: rgba(255, 255, 255, 0.82);
}

.models-guide__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: auto;
}

.models-checklist__label,
.models-stat__label {
  color: $text-secondary;
}

.models-checklist__count,
.models-stat__value {
  font-size: 28px;
  font-weight: 700;
  color: $text-primary;
}

.models-stat__value--path {
  font-size: 20px;
  word-break: break-all;
}

.models-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 0 24px 16px;
}

.models-stat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 142px;
}

.models-stat__meta {
  color: $text-muted;
  line-height: 1.6;
  word-break: break-word;
}

.models-view__content {
  flex: 1;
  min-height: 0;
  padding: 0 24px 24px;
}

.models-shell {
  padding: 0;
  overflow: hidden;
}

.models-shell__header {
  padding: 18px 20px;
}

.models-shell__title-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.models-view__panel-content {
  min-height: 0;
}

@media (max-width: 1100px) {
  .models-view__decision-grid,
  .models-view__summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: $breakpoint-mobile) {
  .models-view__decision-grid,
  .models-view__summary-grid,
  .models-view__content {
    padding-left: 12px;
    padding-right: 12px;
  }

  .models-shell__header {
    padding: 16px 12px 12px;
  }

  .models-checklist__count,
  .models-stat__value {
    font-size: 22px;
  }
}
</style>
