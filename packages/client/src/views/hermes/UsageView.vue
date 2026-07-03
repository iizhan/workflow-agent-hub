<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import DailyTrend from '@/components/hermes/usage/DailyTrend.vue'
import ModelBreakdown from '@/components/hermes/usage/ModelBreakdown.vue'
import StatCards from '@/components/hermes/usage/StatCards.vue'
import { useUsageStore } from '@/stores/hermes/usage'

const { t } = useI18n()
const router = useRouter()
const usageStore = useUsageStore()

const periodDays = computed(() => usageStore.stats?.period_days ?? 30)
const activeModels = computed(() => usageStore.modelUsage.length)
const cacheHitRateLabel = computed(() =>
  usageStore.cacheHitRate !== null ? `${usageStore.cacheHitRate.toFixed(1)}%` : '--',
)
const topModelLabel = computed(() =>
  usageStore.modelUsage[0]?.model || t('usage.noTopModel'),
)

onMounted(() => {
  usageStore.loadSessions()
})
</script>

<template>
  <div class="usage-view workbench-page">
    <section class="workbench-page__hero">
      <div class="workbench-page__hero-copy">
        <div class="workbench-page__eyebrow">{{ t('usage.heroEyebrow') }}</div>
        <h1 class="workbench-page__title">{{ t('usage.heroTitle') }}</h1>
        <p class="workbench-page__subtitle">{{ t('usage.heroSubtitle') }}</p>
      </div>
      <div class="workbench-page__actions">
        <NButton secondary @click="router.push({ name: 'workbench.runs' })">
          {{ t('usage.openRuns') }}
        </NButton>
        <NButton type="primary" @click="router.push({ name: 'workbench.system' })">
          {{ t('usage.openSystemControl') }}
        </NButton>
      </div>
    </section>

    <section class="usage-view__decision-grid">
      <article class="usage-guide workbench-panel">
        <div class="workbench-section-title">{{ t('usage.guideEyebrow') }}</div>
        <h2 class="usage-guide__title">{{ t('usage.guideTitle') }}</h2>
        <p class="usage-guide__body">{{ t('usage.guideBody') }}</p>
        <div class="usage-guide__points">
          <div class="usage-guide__point">{{ t('usage.guidePoint1') }}</div>
          <div class="usage-guide__point">{{ t('usage.guidePoint2') }}</div>
          <div class="usage-guide__point">{{ t('usage.guidePoint3') }}</div>
        </div>
      </article>

      <article class="usage-checklist workbench-panel workbench-panel--soft">
        <div class="workbench-section-title">{{ t('usage.checklistEyebrow') }}</div>
        <h2 class="usage-checklist__title">{{ t('usage.checklistTitle') }}</h2>
        <p class="usage-checklist__body">{{ t('usage.checklistBody') }}</p>
        <div class="usage-checklist__list">
          <div class="usage-checklist__item">
            <span class="usage-checklist__label">{{ t('usage.periodWindow') }}</span>
            <span class="usage-checklist__value">{{ t('usage.periodWindowValue', { days: periodDays }) }}</span>
          </div>
          <div class="usage-checklist__item">
            <span class="usage-checklist__label">{{ t('usage.activeModelsLabel') }}</span>
            <span class="usage-checklist__value">{{ activeModels }}</span>
          </div>
          <div class="usage-checklist__item">
            <span class="usage-checklist__label">{{ t('usage.cacheHitRate') }}</span>
            <span class="usage-checklist__value">{{ cacheHitRateLabel }}</span>
          </div>
          <div class="usage-checklist__item">
            <span class="usage-checklist__label">{{ t('usage.topModelLabel') }}</span>
            <span class="usage-checklist__value usage-checklist__value--wide">{{ topModelLabel }}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="usage-view__summary-grid">
      <article class="usage-stat workbench-panel">
        <div class="usage-stat__label">{{ t('usage.periodWindow') }}</div>
        <div class="usage-stat__value">{{ periodDays }}</div>
        <div class="usage-stat__meta">{{ t('usage.periodWindowMeta') }}</div>
      </article>

      <article class="usage-stat workbench-panel">
        <div class="usage-stat__label">{{ t('usage.totalSessions') }}</div>
        <div class="usage-stat__value">{{ usageStore.totalSessions }}</div>
        <div class="usage-stat__meta">{{ t('usage.sessionMeta') }}</div>
      </article>

      <article class="usage-stat workbench-panel">
        <div class="usage-stat__label">{{ t('usage.cacheHitRate') }}</div>
        <div class="usage-stat__value">{{ cacheHitRateLabel }}</div>
        <div class="usage-stat__meta">{{ t('usage.cacheMeta') }}</div>
      </article>

      <article class="usage-stat workbench-panel">
        <div class="usage-stat__label">{{ t('usage.topModelLabel') }}</div>
        <div class="usage-stat__value usage-stat__value--compact">{{ topModelLabel }}</div>
        <div class="usage-stat__meta">{{ t('usage.topModelMeta') }}</div>
      </article>
    </section>

    <section class="usage-view__content">
      <div class="usage-shell workbench-panel workbench-panel--soft">
        <header class="page-header usage-shell__header">
          <div class="usage-shell__title-group">
            <h2 class="header-title">{{ t('usage.title') }}</h2>
            <p class="usage-shell__subtitle">{{ t('usage.panelSubtitle') }}</p>
          </div>
          <NButton size="small" :loading="usageStore.isLoading" @click="usageStore.loadSessions()">
            {{ t('usage.refresh') }}
          </NButton>
        </header>

        <div class="usage-content">
          <div v-if="usageStore.isLoading && !usageStore.hasData" class="usage-loading">
            {{ t('common.loading') }}
          </div>

          <template v-else-if="usageStore.hasData">
            <StatCards />
            <ModelBreakdown />
            <DailyTrend />
          </template>

          <div v-else class="usage-empty">
            <div class="usage-empty__title">{{ t('usage.noData') }}</div>
            <p class="usage-empty__body">{{ t('usage.noDataBody') }}</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.usage-view {
  min-height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
}

.usage-view__decision-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
  gap: 16px;
  padding: 0 24px 16px;
}

.usage-guide {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 220px;
  background:
    linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.09), rgba(255, 255, 255, 0.92)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.9));
}

.usage-guide__title,
.usage-checklist__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  color: $text-primary;
}

.usage-guide__body,
.usage-checklist__body,
.usage-shell__subtitle {
  color: $text-secondary;
  line-height: 1.7;
}

.usage-guide__points,
.usage-checklist__list {
  display: grid;
  gap: 10px;
}

.usage-guide__point,
.usage-checklist__item {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid $border-color;
  background: rgba(255, 255, 255, 0.72);
}

.usage-checklist {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.usage-checklist__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.usage-checklist__label {
  color: $text-primary;
  font-weight: 600;
}

.usage-checklist__value {
  min-width: 34px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: $text-primary;
  font-weight: 700;
  text-align: center;
}

.usage-checklist__value--wide {
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.usage-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 0 24px 16px;
}

.usage-stat__label {
  font-size: 12px;
  color: $text-muted;
}

.usage-stat__value {
  margin-top: 8px;
  font-size: 30px;
  font-weight: 700;
  color: $text-primary;
}

.usage-stat__value--compact {
  font-size: 18px;
  line-height: 1.4;
}

.usage-stat__meta {
  margin-top: 8px;
  color: $text-secondary;
  line-height: 1.6;
}

.usage-view__content {
  flex: 1;
  min-height: 0;
  padding: 0 24px 24px;
}

.usage-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.usage-shell__header {
  padding-inline: 0;
  padding-top: 0;
}

.usage-shell__title-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.usage-content {
  flex: 1;
  overflow-y: auto;
  padding-top: 20px;
  max-width: 960px;
  margin: 0 auto;
  width: 100%;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.usage-loading,
.usage-empty {
  text-align: center;
  padding: 60px 0;
  color: $text-muted;
  font-size: 14px;
}

.usage-empty {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

.usage-empty__title {
  color: $text-primary;
  font-size: 16px;
  font-weight: 700;
}

.usage-empty__body {
  max-width: 560px;
  color: $text-muted;
  line-height: 1.7;
}

@media (max-width: 1200px) {
  .usage-view__decision-grid,
  .usage-view__summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .usage-view__content,
  .usage-view__decision-grid,
  .usage-view__summary-grid {
    padding-inline: 12px;
  }

  .usage-shell__header {
    align-items: flex-start;
  }

  .usage-checklist__item {
    align-items: flex-start;
    flex-direction: column;
  }

  .usage-checklist__value--wide {
    max-width: 100%;
  }
}
</style>
