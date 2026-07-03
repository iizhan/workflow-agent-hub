<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { NButton, NSpin, NTag, useMessage } from 'naive-ui'
import { useRouter } from 'vue-router'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import { useApplicationsStore } from '@/stores/workbench/applications'
import type { ApplicationSummary } from '@/types/workbench/application'

const router = useRouter()
const message = useMessage()
const applicationsStore = useApplicationsStore()
const { t, locale, statusLabel, statusReasonLabel, nextActionLabel } = useWorkbenchI18n()

function formatDate(value: number | null): string {
  if (!value) return t('workbench.runs.noRecordedRunYet')
  return new Date(value).toLocaleString(locale.value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusTone(status: ApplicationSummary['status']): 'default' | 'info' | 'warning' | 'error' | 'success' {
  if (status === 'running') return 'info'
  if (status === 'waiting_review') return 'warning'
  if (status === 'failed') return 'error'
  if (status === 'completed') return 'success'
  return 'default'
}

async function loadRunsBoard(showToast = false) {
  try {
    await applicationsStore.loadApplications()
    if (showToast) {
      message.success(t('workbench.runs.refreshSuccess'))
    }
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.runs.refreshFailed')))
  }
}

onMounted(() => {
  loadRunsBoard().catch(() => {
    // Message flow is already handled inside loadRunsBoard.
  })
})

const applicationsWithRuns = computed(() =>
  applicationsStore.applications.filter(app =>
    app.hasActiveRun
    || app.hasPendingReview
    || app.lastRunAt
    || app.status === 'failed'
    || app.status === 'completed',
  ),
)

const activeRuns = computed(() =>
  applicationsWithRuns.value.filter(app => app.status === 'running' || app.hasActiveRun),
)

const approvalsWaiting = computed(() =>
  applicationsWithRuns.value.filter(app => app.status === 'waiting_review' || app.hasPendingReview),
)

const failedRuns = computed(() =>
  applicationsWithRuns.value.filter(app => app.status === 'failed'),
)

const recentCompleted = computed(() =>
  applicationsWithRuns.value.filter(app => app.status === 'completed'),
)

const recentlyTouched = computed(() =>
  applicationsWithRuns.value
    .slice()
    .sort((left, right) => (right.updatedAt || right.lastRunAt || 0) - (left.updatedAt || left.lastRunAt || 0))
    .slice(0, 6),
)

const completedToday = computed(() =>
  recentCompleted.value.filter(app => {
    if (!app.lastRunAt) return false
    const now = new Date()
    const runDate = new Date(app.lastRunAt)
    return now.toDateString() === runDate.toDateString()
  }),
)

const primaryDecision = computed(() => {
  const reviewApp = approvalsWaiting.value[0]
  if (reviewApp) {
    return {
      tone: 'warning' as const,
      eyebrow: t('workbench.runs.primaryDecisionReviewEyebrow'),
      title: t('workbench.runs.primaryDecisionReviewTitle', { name: reviewApp.name }),
      body: statusReasonLabel(reviewApp.statusReason) || t('workbench.runs.primaryDecisionReviewBody'),
      actionLabel: t('workbench.runs.reviewRun'),
      app: reviewApp,
    }
  }

  const failedApp = failedRuns.value[0]
  if (failedApp) {
    return {
      tone: 'error' as const,
      eyebrow: t('workbench.runs.primaryDecisionFailureEyebrow'),
      title: t('workbench.runs.primaryDecisionFailureTitle', { name: failedApp.name }),
      body: statusReasonLabel(failedApp.statusReason) || t('workbench.runs.primaryDecisionFailureBody'),
      actionLabel: t('workbench.runs.inspectFailure'),
      app: failedApp,
    }
  }

  const runningApp = activeRuns.value[0]
  if (runningApp) {
    return {
      tone: 'info' as const,
      eyebrow: t('workbench.runs.primaryDecisionLiveEyebrow'),
      title: t('workbench.runs.primaryDecisionLiveTitle', { name: runningApp.name }),
      body: statusReasonLabel(runningApp.statusReason) || t('workbench.runs.primaryDecisionLiveBody'),
      actionLabel: t('workbench.runs.openCollaboration'),
      app: runningApp,
    }
  }

  return {
    tone: 'calm' as const,
    eyebrow: t('workbench.runs.primaryDecisionCalmEyebrow'),
    title: t('workbench.runs.primaryDecisionCalmTitle'),
    body: t('workbench.runs.primaryDecisionCalmBody'),
    actionLabel: t('workbench.runs.openApplications'),
    app: null,
  }
})

const decisionChecklist = computed(() => [
  {
    key: 'review',
    label: t('workbench.runs.decisionChecklistReview'),
    count: approvalsWaiting.value.length,
  },
  {
    key: 'failures',
    label: t('workbench.runs.decisionChecklistFailures'),
    count: failedRuns.value.length,
  },
  {
    key: 'live',
    label: t('workbench.runs.decisionChecklistLive'),
    count: activeRuns.value.length,
  },
  {
    key: 'completed',
    label: t('workbench.runs.decisionChecklistCompleted'),
    count: completedToday.value.length,
  },
])

function openApplicationRun(app: ApplicationSummary) {
  router.push({
    name: 'workbench.applicationDetail',
    params: { applicationId: app.id },
    query: { section: 'runs' },
  })
}

function openApplicationCollaboration(app: ApplicationSummary) {
  router.push({
    name: 'workbench.applicationDetail',
    params: { applicationId: app.id },
    query: { section: 'collaboration' },
  })
}

function primaryActionLabel(app: ApplicationSummary): string {
  if (app.status === 'running') return t('workbench.runs.openCollaboration')
  if (app.status === 'waiting_review') return t('workbench.runs.reviewRun')
  if (app.status === 'failed') return t('workbench.runs.inspectFailure')
  if (app.status === 'completed') return t('workbench.runs.reviewOutputs')
  return t('workbench.runs.openRunState')
}

function handlePrimaryAction(app: ApplicationSummary) {
  if (app.status === 'running') {
    openApplicationCollaboration(app)
    return
  }
  openApplicationRun(app)
}

function handlePrimaryDecision() {
  if (primaryDecision.value.app) {
    handlePrimaryAction(primaryDecision.value.app)
    return
  }

  router.push({ name: 'workbench.applications' })
}

function laneHint(key: 'live' | 'review' | 'attention' | 'recent'): string {
  const map = {
    live: t('workbench.runs.liveQueueHint'),
    review: t('workbench.runs.reviewQueueHint'),
    attention: t('workbench.runs.attentionHint'),
    recent: t('workbench.runs.recentActivityHint'),
  }

  return map[key]
}

function recommendedAction(app: ApplicationSummary): string {
  return nextActionLabel(app.nextAction) || primaryActionLabel(app)
}
</script>

<template>
  <div class="runs-view workbench-page">
    <section class="workbench-page__hero">
      <div class="workbench-page__hero-copy">
        <div class="workbench-page__eyebrow">{{ t('workbench.runs.heroEyebrow') }}</div>
        <h1 class="workbench-page__title">{{ t('workbench.runs.heroTitle') }}</h1>
        <p class="workbench-page__subtitle">{{ t('workbench.runs.heroSubtitle') }}</p>
      </div>
      <div class="workbench-page__actions">
        <NButton secondary @click="loadRunsBoard(true)">
          {{ t('workbench.runs.refresh') }}
        </NButton>
        <NButton type="primary" @click="router.push({ name: 'workbench.applications' })">
          {{ t('workbench.runs.openApplications') }}
        </NButton>
      </div>
    </section>

    <NSpin :show="applicationsStore.isLoadingList" size="large">
      <section class="runs-view__decision-grid">
        <article class="decision-hero workbench-panel" :class="`decision-hero--${primaryDecision.tone}`">
          <div class="workbench-page__eyebrow">{{ primaryDecision.eyebrow }}</div>
          <h2 class="decision-hero__title">{{ primaryDecision.title }}</h2>
          <p class="decision-hero__body">{{ primaryDecision.body }}</p>
          <div v-if="primaryDecision.app" class="decision-hero__meta">
            <span>{{ primaryDecision.app.workflowName || t('workbench.runs.workflowNotNamedYet') }}</span>
            <span>·</span>
            <span>{{ primaryDecision.app.primaryProjectName || t('workbench.runs.noBoundProject') }}</span>
          </div>
          <div class="decision-hero__actions">
            <NButton type="primary" @click="handlePrimaryDecision()">
              {{ primaryDecision.actionLabel }}
            </NButton>
          </div>
        </article>

        <article class="decision-checklist workbench-panel workbench-panel--soft">
          <div class="workbench-section-title">{{ t('workbench.runs.decisionChecklistEyebrow') }}</div>
          <h2 class="run-lane__title">{{ t('workbench.runs.decisionChecklistTitle') }}</h2>
          <p class="decision-checklist__body">{{ t('workbench.runs.decisionChecklistBody') }}</p>
          <div class="decision-checklist__list">
            <div v-for="item in decisionChecklist" :key="item.key" class="decision-checklist__item">
              <span class="decision-checklist__label">{{ item.label }}</span>
              <span class="decision-checklist__count">{{ item.count }}</span>
            </div>
          </div>
        </article>
      </section>

      <section class="runs-view__summary-grid">
        <article class="run-stat workbench-panel">
          <div class="run-stat__label">{{ t('workbench.runs.activeRuns') }}</div>
          <div class="run-stat__value">{{ activeRuns.length }}</div>
          <div class="run-stat__meta">{{ t('workbench.runs.activeRunsMeta') }}</div>
        </article>

        <article class="run-stat workbench-panel">
          <div class="run-stat__label">{{ t('workbench.runs.awaitingReview') }}</div>
          <div class="run-stat__value">{{ approvalsWaiting.length }}</div>
          <div class="run-stat__meta">{{ t('workbench.runs.awaitingReviewMeta') }}</div>
        </article>

        <article class="run-stat workbench-panel">
          <div class="run-stat__label">{{ t('workbench.runs.failures') }}</div>
          <div class="run-stat__value">{{ failedRuns.length }}</div>
          <div class="run-stat__meta">{{ t('workbench.runs.failuresMeta') }}</div>
        </article>

        <article class="run-stat workbench-panel">
          <div class="run-stat__label">{{ t('workbench.runs.recentlyCompleted') }}</div>
          <div class="run-stat__value">{{ recentCompleted.length }}</div>
          <div class="run-stat__meta">{{ t('workbench.runs.recentlyCompletedMeta') }}</div>
        </article>
      </section>

      <section class="runs-view__board-grid">
        <article class="run-lane workbench-panel workbench-panel--soft">
          <div class="workbench-section-title">{{ t('workbench.runs.liveQueue') }}</div>
          <h2 class="run-lane__title">{{ t('workbench.runs.liveQueueTitle') }}</h2>
          <p class="run-lane__hint">{{ laneHint('live') }}</p>
          <div v-if="!activeRuns.length" class="run-lane__empty">{{ t('workbench.runs.noActiveRuns') }}</div>
          <div v-else class="run-lane__list">
            <article v-for="app in activeRuns" :key="app.id" class="run-item">
              <div class="run-item__header">
                <div>
                  <div class="run-item__title">{{ app.name }}</div>
                  <div class="run-item__meta">{{ app.workflowName || t('workbench.runs.workflowNotNamedYet') }}</div>
                </div>
                <NTag :type="statusTone(app.status)" size="small" round>{{ statusLabel(app.status) }}</NTag>
              </div>
              <p class="run-item__body">{{ statusReasonLabel(app.statusReason) || t('workbench.runs.collaborationBody') }}</p>
              <div class="run-item__focus">
                <span class="run-item__focus-label">{{ t('workbench.runs.recommendedNextStep') }}</span>
                <span class="run-item__focus-value">{{ recommendedAction(app) }}</span>
              </div>
              <dl class="run-item__facts">
                <div><dt>{{ t('workbench.runs.project') }}</dt><dd>{{ app.primaryProjectName || t('workbench.runs.noBoundProject') }}</dd></div>
                <div><dt>{{ t('workbench.runs.roles') }}</dt><dd>{{ app.agentCount }}</dd></div>
                <div><dt>{{ t('workbench.runs.updated') }}</dt><dd>{{ formatDate(app.updatedAt || app.lastRunAt) }}</dd></div>
              </dl>
              <div class="run-item__actions">
                <NButton secondary @click="handlePrimaryAction(app)">{{ primaryActionLabel(app) }}</NButton>
              </div>
            </article>
          </div>
        </article>

        <article class="run-lane workbench-panel workbench-panel--soft">
          <div class="workbench-section-title">{{ t('workbench.runs.reviewQueue') }}</div>
          <h2 class="run-lane__title">{{ t('workbench.runs.reviewQueueTitle') }}</h2>
          <p class="run-lane__hint">{{ laneHint('review') }}</p>
          <div v-if="!approvalsWaiting.length" class="run-lane__empty">{{ t('workbench.runs.noApprovalsWaiting') }}</div>
          <div v-else class="run-lane__list">
            <article v-for="app in approvalsWaiting" :key="app.id" class="run-item">
              <div class="run-item__header">
                <div>
                  <div class="run-item__title">{{ app.name }}</div>
                  <div class="run-item__meta">{{ app.workflowName || t('workbench.runs.workflowNotNamedYet') }}</div>
                </div>
                <NTag :type="statusTone(app.status)" size="small" round>{{ statusLabel(app.status) }}</NTag>
              </div>
              <p class="run-item__body">{{ statusReasonLabel(app.statusReason) || t('workbench.runs.pendingHandoffNeedsApproval') }}</p>
              <div class="run-item__focus run-item__focus--warning">
                <span class="run-item__focus-label">{{ t('workbench.runs.decisionFocus') }}</span>
                <span class="run-item__focus-value">{{ t('workbench.runs.reviewQueueFocus') }}</span>
              </div>
              <dl class="run-item__facts">
                <div><dt>{{ t('workbench.runs.project') }}</dt><dd>{{ app.primaryProjectName || t('workbench.runs.noBoundProject') }}</dd></div>
                <div><dt>{{ t('workbench.runs.lastRun') }}</dt><dd>{{ formatDate(app.lastRunAt) }}</dd></div>
                <div><dt>{{ t('workbench.runs.updated') }}</dt><dd>{{ formatDate(app.updatedAt || app.lastRunAt) }}</dd></div>
              </dl>
              <div class="run-item__actions">
                <NButton secondary @click="handlePrimaryAction(app)">{{ primaryActionLabel(app) }}</NButton>
              </div>
            </article>
          </div>
        </article>
      </section>

      <section class="runs-view__secondary-grid">
        <article class="run-lane workbench-panel workbench-panel--soft">
          <div class="workbench-section-title">{{ t('workbench.runs.attention') }}</div>
          <h2 class="run-lane__title">{{ t('workbench.runs.attentionTitle') }}</h2>
          <p class="run-lane__hint">{{ laneHint('attention') }}</p>
          <div v-if="!failedRuns.length" class="run-lane__empty">{{ t('workbench.runs.noRecentFailures') }}</div>
          <div v-else class="run-lane__list">
            <article v-for="app in failedRuns" :key="app.id" class="run-item run-item--compact">
              <div class="run-item__header">
                <div>
                  <div class="run-item__title">{{ app.name }}</div>
                  <div class="run-item__meta">{{ app.primaryProjectName || t('workbench.runs.noBoundProject') }}</div>
                </div>
                <NTag :type="statusTone(app.status)" size="small" round>{{ statusLabel(app.status) }}</NTag>
              </div>
              <p class="run-item__body">{{ statusReasonLabel(app.statusReason) || t('workbench.runs.recentExecutionFailed') }}</p>
              <div class="run-item__focus run-item__focus--danger">
                <span class="run-item__focus-label">{{ t('workbench.runs.decisionFocus') }}</span>
                <span class="run-item__focus-value">{{ t('workbench.runs.failureFocus') }}</span>
              </div>
              <div class="run-item__actions">
                <NButton secondary @click="handlePrimaryAction(app)">{{ t('workbench.runs.inspectFailure') }}</NButton>
              </div>
            </article>
          </div>
        </article>

        <article class="run-lane workbench-panel workbench-panel--soft">
          <div class="workbench-section-title">{{ t('workbench.runs.recentActivity') }}</div>
          <h2 class="run-lane__title">{{ t('workbench.runs.recentActivityTitle') }}</h2>
          <p class="run-lane__hint">{{ laneHint('recent') }}</p>
          <div v-if="!recentlyTouched.length" class="run-lane__empty">
            {{ t('workbench.runs.noRecordedRuns') }}
          </div>
          <div v-else class="run-lane__list">
            <article v-for="app in recentlyTouched" :key="app.id" class="run-item run-item--compact">
              <div class="run-item__header">
                <div>
                  <div class="run-item__title">{{ app.name }}</div>
                  <div class="run-item__meta">{{ formatDate(app.updatedAt || app.lastRunAt) }}</div>
                </div>
                <NTag :type="statusTone(app.status)" size="small" round>{{ statusLabel(app.status) }}</NTag>
              </div>
              <p class="run-item__body">{{ app.goalSummary || statusReasonLabel(app.statusReason) || t('workbench.runs.runActivityAvailable') }}</p>
              <div class="run-item__focus">
                <span class="run-item__focus-label">{{ t('workbench.runs.recommendedNextStep') }}</span>
                <span class="run-item__focus-value">{{ recommendedAction(app) }}</span>
              </div>
              <div class="run-item__actions">
                <NButton secondary @click="handlePrimaryAction(app)">{{ primaryActionLabel(app) }}</NButton>
              </div>
            </article>
          </div>
        </article>
      </section>
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.runs-view__decision-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.7fr);
  gap: 16px;
  padding: 0 24px 16px;
}

.runs-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 0 24px;
}

.decision-hero {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 220px;
  background:
    linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.09), rgba(255, 255, 255, 0.92)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.88));
}

.decision-hero--warning {
  background:
    linear-gradient(135deg, rgba(183, 121, 31, 0.12), rgba(255, 255, 255, 0.92)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.88));
}

.decision-hero--error {
  background:
    linear-gradient(135deg, rgba(178, 75, 66, 0.12), rgba(255, 255, 255, 0.92)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.88));
}

.decision-hero__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  color: $text-primary;
}

.decision-hero__body,
.decision-checklist__body,
.run-lane__hint {
  color: $text-secondary;
  line-height: 1.7;
}

.decision-hero__meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  color: $text-muted;
  font-size: 13px;
}

.decision-hero__actions {
  margin-top: auto;
}

.decision-checklist {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.decision-checklist__list {
  display: grid;
  gap: 10px;
}

.decision-checklist__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid $border-color;
}

.decision-checklist__label {
  color: $text-primary;
  font-weight: 600;
}

.decision-checklist__count {
  min-width: 34px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: $text-primary;
  font-weight: 700;
  text-align: center;
}

.runs-view__board-grid,
.runs-view__secondary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  padding: 16px 24px 0;
}

.runs-view__secondary-grid {
  padding-bottom: 24px;
}

.run-stat {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 150px;
}

.run-stat__label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $text-muted;
}

.run-stat__value {
  font-size: 28px;
  line-height: 1.1;
  color: $text-primary;
}

.run-stat__meta {
  color: $text-secondary;
  line-height: 1.6;
}

.run-lane {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.run-lane__title {
  font-size: 18px;
  line-height: 1.3;
  color: $text-primary;
}

.run-lane__hint {
  margin: -4px 0 4px;
}

.run-lane__empty {
  padding: 20px;
  border-radius: 14px;
  border: 1px dashed $border-color;
  color: $text-secondary;
  background: rgba(255, 255, 255, 0.42);
}

.run-lane__list {
  display: grid;
  gap: 14px;
}

.run-item {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid $border-color;
  background: rgba(255, 255, 255, 0.72);
}

.run-item--compact {
  min-height: 0;
}

.run-item__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.run-item__title {
  font-size: 16px;
  font-weight: 700;
  color: $text-primary;
}

.run-item__meta {
  margin-top: 6px;
  color: $text-muted;
  line-height: 1.5;
}

.run-item__body {
  color: $text-secondary;
  line-height: 1.7;
}

.run-item__focus {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(var(--accent-primary-rgb), 0.05);
}

.run-item__focus--warning {
  background: rgba(183, 121, 31, 0.08);
}

.run-item__focus--danger {
  background: rgba(178, 75, 66, 0.08);
}

.run-item__focus-label {
  color: $text-muted;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.run-item__focus-value {
  color: $text-primary;
  font-weight: 700;
  line-height: 1.5;
}

.run-item__facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.run-item__facts dt {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $text-muted;
}

.run-item__facts dd {
  margin-top: 6px;
  color: $text-primary;
}

.run-item__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

@media (max-width: 1180px) {
  .runs-view__decision-grid,
  .runs-view__summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .runs-view__board-grid,
  .runs-view__secondary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .runs-view__decision-grid,
  .runs-view__summary-grid {
    grid-template-columns: 1fr;
    padding: 0 16px;
  }

  .runs-view__board-grid,
  .runs-view__secondary-grid {
    padding-left: 16px;
    padding-right: 16px;
  }

  .run-item__header,
  .run-item__facts {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
}
</style>
