<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NSpin } from 'naive-ui'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import { useApplicationsStore } from '@/stores/workbench/applications'
import type { ApplicationSummary } from '@/types/workbench/application'
import { buildApplicationDetailRoute } from '@/utils/workbench-application-scope'
import {
  compareApplications,
  matchesApplicationFocus,
  preferredApplicationSection,
  type ApplicationWorkbenchFocus,
} from '@/utils/workbench-applications'

const router = useRouter()
const applicationsStore = useApplicationsStore()
const { t, statusLabel, statusReasonLabel, sectionLabel } = useWorkbenchI18n()

const prioritizedApplications = computed(() =>
  applicationsStore.applications.slice().sort(compareApplications),
)

function applicationsByFocus(focus: ApplicationWorkbenchFocus) {
  return prioritizedApplications.value.filter(application => matchesApplicationFocus(application, focus))
}

const reviewApplications = computed(() => applicationsByFocus('review'))
const failedApplications = computed(() => applicationsByFocus('failed'))
const runningApplications = computed(() => applicationsByFocus('running'))
const readyApplications = computed(() => applicationsByFocus('ready'))
const setupApplications = computed(() => applicationsByFocus('setup'))

const summaryCards = computed(() => [
  {
    key: 'review',
    tone: 'warning',
    label: t('workbench.workspaceOverview.summaryReview'),
    count: reviewApplications.value.length,
    action: t('workbench.workspaceOverview.openReviewQueue'),
    focus: 'review' as const,
  },
  {
    key: 'running',
    tone: 'info',
    label: t('workbench.workspaceOverview.summaryRunning'),
    count: runningApplications.value.length,
    action: t('workbench.workspaceOverview.openRunningApplications'),
    focus: 'running' as const,
  },
  {
    key: 'failed',
    tone: 'danger',
    label: t('workbench.workspaceOverview.summaryFailed'),
    count: failedApplications.value.length,
    action: t('workbench.workspaceOverview.openFailureQueue'),
    focus: 'failed' as const,
  },
  {
    key: 'ready',
    tone: 'accent',
    label: t('workbench.workspaceOverview.summaryReady'),
    count: readyApplications.value.length,
    action: t('workbench.workspaceOverview.openReadyApplications'),
    focus: 'ready' as const,
  },
])

const primaryDecision = computed(() => {
  const reviewApplication = reviewApplications.value[0]
  if (reviewApplication) {
    return {
      tone: 'warning',
      eyebrow: t('workbench.workspaceOverview.primaryDecisionReviewEyebrow'),
      title: t('workbench.workspaceOverview.primaryDecisionReviewTitle', { name: reviewApplication.name }),
      body: statusReasonLabel(reviewApplication.statusReason) || t('workbench.workspaceOverview.primaryDecisionReviewBody'),
      actionLabel: t('workbench.workspaceOverview.primaryDecisionReviewAction'),
      app: reviewApplication,
      section: preferredApplicationSection(reviewApplication),
    }
  }

  const failedApplication = failedApplications.value[0]
  if (failedApplication) {
    return {
      tone: 'danger',
      eyebrow: t('workbench.workspaceOverview.primaryDecisionFailureEyebrow'),
      title: t('workbench.workspaceOverview.primaryDecisionFailureTitle', { name: failedApplication.name }),
      body: statusReasonLabel(failedApplication.statusReason) || t('workbench.workspaceOverview.primaryDecisionFailureBody'),
      actionLabel: t('workbench.workspaceOverview.primaryDecisionFailureAction'),
      app: failedApplication,
      section: preferredApplicationSection(failedApplication),
    }
  }

  const runningApplication = runningApplications.value[0]
  if (runningApplication) {
    return {
      tone: 'info',
      eyebrow: t('workbench.workspaceOverview.primaryDecisionRunningEyebrow'),
      title: t('workbench.workspaceOverview.primaryDecisionRunningTitle', { name: runningApplication.name }),
      body: statusReasonLabel(runningApplication.statusReason) || t('workbench.workspaceOverview.primaryDecisionRunningBody'),
      actionLabel: t('workbench.workspaceOverview.primaryDecisionRunningAction'),
      app: runningApplication,
      section: preferredApplicationSection(runningApplication),
    }
  }

  const readyApplication = readyApplications.value[0]
  if (readyApplication) {
    return {
      tone: 'accent',
      eyebrow: t('workbench.workspaceOverview.primaryDecisionReadyEyebrow'),
      title: t('workbench.workspaceOverview.primaryDecisionReadyTitle', { name: readyApplication.name }),
      body: statusReasonLabel(readyApplication.statusReason) || t('workbench.workspaceOverview.primaryDecisionReadyBody'),
      actionLabel: t('workbench.workspaceOverview.primaryDecisionReadyAction'),
      app: readyApplication,
      section: preferredApplicationSection(readyApplication),
    }
  }

  const setupApplication = setupApplications.value[0]
  if (setupApplication) {
    return {
      tone: 'default',
      eyebrow: t('workbench.workspaceOverview.primaryDecisionSetupEyebrow'),
      title: t('workbench.workspaceOverview.primaryDecisionSetupTitle', { name: setupApplication.name }),
      body: statusReasonLabel(setupApplication.statusReason) || t('workbench.workspaceOverview.primaryDecisionSetupBody'),
      actionLabel: t('workbench.workspaceOverview.primaryDecisionSetupAction'),
      app: setupApplication,
      section: preferredApplicationSection(setupApplication),
    }
  }

  return {
    tone: 'calm',
    eyebrow: t('workbench.workspaceOverview.primaryDecisionEmptyEyebrow'),
    title: t('workbench.workspaceOverview.primaryDecisionEmptyTitle'),
    body: t('workbench.workspaceOverview.primaryDecisionEmptyBody'),
    actionLabel: t('workbench.applications.createApplication'),
    app: null,
    section: 'overview',
  }
})

const activeApplications = computed(() =>
  prioritizedApplications.value.filter(application => application.status !== 'completed').length,
)
const completedApplications = computed(() =>
  prioritizedApplications.value.filter(application => application.status === 'completed').length,
)
const recentApplications = computed(() => prioritizedApplications.value.slice(0, 4))

function openCreate() {
  router.push({ name: 'workbench.applicationCreate' })
}

function openOverviewAction(application: ApplicationSummary) {
  router.push(buildApplicationDetailRoute(application.id, preferredApplicationSection(application)))
}

function handlePrimaryDecision() {
  if (primaryDecision.value.app) {
    openOverviewAction(primaryDecision.value.app)
    return
  }
  openCreate()
}

function openApplicationsWithFocus(focus: ApplicationWorkbenchFocus) {
  router.push({
    name: 'workbench.applications',
    query: focus === 'all' ? undefined : { focus },
  })
}

onMounted(async () => {
  await applicationsStore.loadApplications()
})
</script>

<template>
  <div class="overview-view workbench-page">
    <section class="overview-view__hero workbench-page__hero">
      <div class="workbench-page__hero-copy">
        <div class="workbench-page__eyebrow">{{ t('workbench.workspaceOverview.heroEyebrow') }}</div>
        <h1 class="workbench-page__title">{{ t('workbench.workspaceOverview.heroTitle') }}</h1>
        <p class="workbench-page__subtitle">{{ t('workbench.workspaceOverview.heroSubtitle') }}</p>
      </div>
      <div class="workbench-page__actions">
        <NButton type="primary" size="large" @click="openCreate">{{ t('workbench.applications.createApplication') }}</NButton>
        <NButton secondary size="large" @click="openApplicationsWithFocus('all')">
          {{ t('workbench.workspaceOverview.openApplicationsHub') }}
        </NButton>
      </div>
    </section>

    <NSpin :show="applicationsStore.isLoadingList">
      <section class="overview-view__summary-grid">
        <button
          v-for="card in summaryCards"
          :key="card.key"
          class="overview-summary-card workbench-panel workbench-card--interactive"
          :class="`overview-summary-card--${card.tone}`"
          type="button"
          @click="openApplicationsWithFocus(card.focus)"
        >
          <div class="overview-summary-card__label">{{ card.label }}</div>
          <div class="overview-summary-card__value">{{ card.count }}</div>
          <div class="overview-summary-card__action">{{ card.action }}</div>
        </button>
      </section>

      <section class="overview-view__decision-grid">
        <article class="overview-decision workbench-panel" :class="`overview-decision--${primaryDecision.tone}`">
          <div class="workbench-page__eyebrow">{{ primaryDecision.eyebrow }}</div>
          <h2 class="overview-decision__title">{{ primaryDecision.title }}</h2>
          <p class="overview-decision__body">{{ primaryDecision.body }}</p>
          <div v-if="primaryDecision.app" class="overview-decision__meta">
            <span>{{ statusLabel(primaryDecision.app.status) }}</span>
            <span>·</span>
            <span>{{ primaryDecision.app.primaryProjectName || t('workbench.card.notConnected') }}</span>
            <span>·</span>
            <span>{{ t('workbench.card.openFirstSection', { section: sectionLabel(primaryDecision.section) }) }}</span>
          </div>
          <div class="overview-decision__actions">
            <NButton type="primary" @click="handlePrimaryDecision()">
              {{ primaryDecision.actionLabel }}
            </NButton>
          </div>
        </article>

        <article class="overview-queue workbench-panel workbench-panel--soft">
          <div class="workbench-section-title">{{ t('workbench.workspaceOverview.queueEyebrow') }}</div>
          <h2 class="overview-queue__title">{{ t('workbench.workspaceOverview.queueTitle') }}</h2>
          <p class="overview-queue__body">{{ t('workbench.workspaceOverview.queueBody') }}</p>
          <div class="overview-queue__list">
            <button
              v-for="card in summaryCards"
              :key="`${card.key}-queue`"
              class="overview-queue__item"
              type="button"
              @click="openApplicationsWithFocus(card.focus)"
            >
              <span class="overview-queue__item-label">{{ card.label }}</span>
              <span class="overview-queue__item-count">{{ card.count }}</span>
            </button>
          </div>
        </article>
      </section>

      <section class="overview-view__workspace-grid">
        <article class="overview-workspace-card workbench-panel">
          <div class="workbench-section-title">{{ t('workbench.workspaceOverview.workspaceEyebrow') }}</div>
          <h2 class="overview-workspace-card__title">{{ t('workbench.workspaceOverview.workspaceTitle') }}</h2>
          <p class="overview-workspace-card__body">{{ t('workbench.workspaceOverview.workspaceBody') }}</p>
          <div class="overview-workspace-card__stats">
            <div class="workbench-kv-card">
              <div class="overview-workspace-card__stat-label">{{ t('workbench.workspaceOverview.activeApplications') }}</div>
              <div class="overview-workspace-card__stat-value">{{ activeApplications }}</div>
            </div>
            <div class="workbench-kv-card">
              <div class="overview-workspace-card__stat-label">{{ t('workbench.workspaceOverview.completedApplications') }}</div>
              <div class="overview-workspace-card__stat-value">{{ completedApplications }}</div>
            </div>
            <div class="workbench-kv-card">
              <div class="overview-workspace-card__stat-label">{{ t('workbench.workspaceOverview.totalApplications') }}</div>
              <div class="overview-workspace-card__stat-value">{{ prioritizedApplications.length }}</div>
            </div>
          </div>
        </article>

        <article class="overview-recent-card workbench-panel workbench-panel--soft">
          <div class="workbench-section-title">{{ t('workbench.workspaceOverview.recentEyebrow') }}</div>
          <h2 class="overview-recent-card__title">{{ t('workbench.workspaceOverview.recentTitle') }}</h2>
          <p class="overview-recent-card__body">{{ t('workbench.workspaceOverview.recentBody') }}</p>
          <div v-if="recentApplications.length" class="overview-recent-card__list">
            <button
              v-for="application in recentApplications"
              :key="application.id"
              class="overview-recent-card__item"
              type="button"
              @click="openOverviewAction(application)"
            >
              <div class="overview-recent-card__item-main">
                <span class="overview-recent-card__item-name">{{ application.name }}</span>
                <span class="overview-recent-card__item-reason">
                  {{ statusReasonLabel(application.statusReason) || t('workbench.card.openToContinue') }}
                </span>
              </div>
              <span class="overview-recent-card__item-arrow">›</span>
            </button>
          </div>
          <div v-else class="overview-recent-card__empty">{{ t('workbench.workspaceOverview.recentEmpty') }}</div>
        </article>
      </section>
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.overview-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 20px 24px 0;
}

.overview-summary-card {
  text-align: left;
  padding: 18px;
  background:
    radial-gradient(circle at top right, rgba(var(--accent-primary-rgb), 0.06), transparent 26%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.9));
}

.overview-summary-card--warning {
  border-color: rgba(183, 121, 31, 0.28);
}

.overview-summary-card--danger {
  border-color: rgba(178, 75, 66, 0.28);
}

.overview-summary-card--info {
  border-color: rgba(var(--accent-primary-rgb), 0.24);
}

.overview-summary-card--accent {
  border-color: rgba(var(--accent-primary-rgb), 0.32);
}

.overview-summary-card__label {
  color: $text-secondary;
  font-weight: 600;
}

.overview-summary-card__value {
  margin-top: 14px;
  font-size: 36px;
  font-weight: 800;
  color: $text-primary;
  line-height: 1;
}

.overview-summary-card__action {
  margin-top: 10px;
  color: $text-muted;
  font-size: 13px;
}

.overview-view__decision-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
  gap: 16px;
  padding: 20px 24px 0;
}

.overview-decision {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 220px;
  background:
    linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.09), rgba(255, 255, 255, 0.94)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.9));
}

.overview-decision--warning {
  background:
    linear-gradient(135deg, rgba(183, 121, 31, 0.12), rgba(255, 255, 255, 0.94)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.9));
}

.overview-decision--danger {
  background:
    linear-gradient(135deg, rgba(178, 75, 66, 0.12), rgba(255, 255, 255, 0.94)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.9));
}

.overview-decision__title,
.overview-queue__title,
.overview-workspace-card__title,
.overview-recent-card__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  color: $text-primary;
}

.overview-decision__body,
.overview-queue__body,
.overview-workspace-card__body,
.overview-recent-card__body {
  color: $text-secondary;
  line-height: 1.7;
}

.overview-decision__meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  color: $text-muted;
  font-size: 13px;
}

.overview-decision__actions {
  margin-top: auto;
}

.overview-queue {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.overview-queue__list {
  display: grid;
  gap: 10px;
}

.overview-queue__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid $border-color;
  color: $text-primary;
  cursor: pointer;
}

.overview-queue__item-label {
  font-weight: 600;
  text-align: left;
}

.overview-queue__item-count {
  min-width: 34px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: $text-primary;
  font-weight: 700;
  text-align: center;
}

.overview-view__workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
  gap: 16px;
  padding: 20px 24px 32px;
}

.overview-workspace-card__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.overview-workspace-card__stat-label {
  color: $text-muted;
  font-size: 12px;
}

.overview-workspace-card__stat-value {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 800;
  color: $text-primary;
}

.overview-recent-card__list {
  display: grid;
  gap: 10px;
}

.overview-recent-card__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid $border-color;
  background: rgba(255, 255, 255, 0.78);
  cursor: pointer;
  text-align: left;
}

.overview-recent-card__item-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.overview-recent-card__item-name {
  color: $text-primary;
  font-weight: 700;
}

.overview-recent-card__item-reason,
.overview-recent-card__empty {
  color: $text-secondary;
  line-height: 1.6;
}

.overview-recent-card__item-arrow {
  color: $text-muted;
  font-size: 22px;
}

@media (max-width: 1180px) {
  .overview-view__summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .overview-view__decision-grid,
  .overview-view__workspace-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .overview-view__summary-grid,
  .overview-workspace-card__stats {
    grid-template-columns: 1fr;
  }
}
</style>
