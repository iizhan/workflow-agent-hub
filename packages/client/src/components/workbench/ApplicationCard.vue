<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationSummary } from '@/types/workbench/application'
import { buildApplicationDetailRoute } from '@/utils/workbench-application-scope'

const props = defineProps<{
  application: ApplicationSummary
}>()

const router = useRouter()
const { t, locale, scenarioLabel, statusLabel, statusReasonLabel, nextActionLabel, sectionLabel } = useWorkbenchI18n()

const statusClass = computed(() => `workbench-status-pill--${props.application.status}`)
const priorityTone = computed(() => {
  if (props.application.hasPendingReview || props.application.status === 'waiting_review') return 'warning'
  if (props.application.status === 'failed') return 'danger'
  if (props.application.hasActiveRun || props.application.status === 'running') return 'info'
  if (props.application.status === 'ready') return 'accent'
  return 'default'
})
const priorityClass = computed(() => `application-card--${priorityTone.value}`)
const updatedLabel = computed(() => {
  if (!props.application.updatedAt) return t('workbench.card.notUpdatedYet')
  return new Date(props.application.updatedAt).toLocaleString(locale.value, { hour12: false })
})
const runStateLabel = computed(() => {
  if (props.application.hasPendingReview) return t('workbench.card.awaitingReview')
  if (props.application.hasActiveRun) return t('workbench.card.runInProgress')
  if (props.application.workflowEnabled) return t('workbench.card.flowReady')
  return t('workbench.card.flowNotReady')
})

const destinationSection = computed(() => {
  if (props.application.nextAction?.targetSection) return props.application.nextAction.targetSection
  if (props.application.hasActiveRun || props.application.status === 'running') return 'collaboration'
  if (
    props.application.hasPendingReview
    || props.application.status === 'waiting_review'
    || props.application.status === 'failed'
    || props.application.status === 'ready'
  ) return 'runs'
  if (props.application.status === 'completed') return 'artifacts'
  return 'overview'
})

const priorityEyebrow = computed(() => {
  if (props.application.hasPendingReview || props.application.status === 'waiting_review') {
    return t('workbench.card.priorityReviewEyebrow')
  }
  if (props.application.status === 'failed') {
    return t('workbench.card.priorityFailureEyebrow')
  }
  if (props.application.hasActiveRun || props.application.status === 'running') {
    return t('workbench.card.priorityRunningEyebrow')
  }
  if (props.application.status === 'ready') {
    return t('workbench.card.priorityReadyEyebrow')
  }
  return t('workbench.card.prioritySetupEyebrow')
})

const priorityTitle = computed(() => {
  if (props.application.hasPendingReview || props.application.status === 'waiting_review') {
    return t('workbench.card.priorityReviewTitle')
  }
  if (props.application.status === 'failed') {
    return t('workbench.card.priorityFailureTitle')
  }
  if (props.application.hasActiveRun || props.application.status === 'running') {
    return t('workbench.card.priorityRunningTitle')
  }
  if (props.application.status === 'ready') {
    return t('workbench.card.priorityReadyTitle')
  }
  return t('workbench.card.prioritySetupTitle')
})

const priorityBody = computed(() => {
  return statusReasonLabel(props.application.statusReason)
    || nextActionLabel(props.application.nextAction)
    || t('workbench.card.openToContinue')
})

const destinationLabel = computed(() =>
  t('workbench.card.openFirstSection', { section: sectionLabel(destinationSection.value) }),
)

function openApplication() {
  router.push(buildApplicationDetailRoute(props.application.id, destinationSection.value))
}
</script>

<template>
  <button class="application-card workbench-card workbench-card--interactive" :class="priorityClass" type="button" @click="openApplication">
    <div class="application-card__priority">
      <span class="application-card__priority-eyebrow">{{ priorityEyebrow }}</span>
      <div class="application-card__priority-title">{{ priorityTitle }}</div>
      <p class="application-card__priority-body">{{ priorityBody }}</p>
    </div>

    <div class="application-card__top">
      <div class="application-card__title-wrap">
        <div class="application-card__title">{{ application.name }}</div>
        <div class="application-card__meta">
          <span class="workbench-pill">{{ scenarioLabel(application.scenario) }}</span>
          <span class="workbench-status-pill" :class="statusClass">{{ statusLabel(application.status) }}</span>
        </div>
      </div>
      <span class="application-card__arrow">›</span>
    </div>

    <p class="application-card__summary">
      {{ application.goalSummary || t('workbench.card.goalSummaryPending') }}
    </p>

    <div class="application-card__stats">
      <div class="application-card__stat">
        <span class="application-card__label">{{ t('workbench.card.project') }}</span>
        <span class="application-card__value">{{ application.primaryProjectName || t('workbench.card.notConnected') }}</span>
      </div>
      <div class="application-card__stat">
        <span class="application-card__label">{{ t('workbench.card.agents') }}</span>
        <span class="application-card__value">{{ application.agentCount }}</span>
      </div>
      <div class="application-card__stat">
        <span class="application-card__label">{{ t('workbench.card.runState') }}</span>
        <span class="application-card__value">{{ runStateLabel }}</span>
      </div>
      <div class="application-card__stat">
        <span class="application-card__label">{{ t('workbench.card.lastUpdated') }}</span>
        <span class="application-card__value">{{ updatedLabel }}</span>
      </div>
    </div>

    <div v-if="application.nextAction" class="application-card__next-action">
      <span class="application-card__next-action-label">{{ t('workbench.card.nextAction') }}</span>
      <span class="application-card__next-action-value">{{ nextActionLabel(application.nextAction) }}</span>
    </div>

    <div class="application-card__footer">
      <div class="application-card__footer-main">
        <span class="application-card__reason">{{ statusReasonLabel(application.statusReason) || t('workbench.card.openToContinue') }}</span>
        <span class="application-card__destination">{{ destinationLabel }}</span>
      </div>
    </div>
  </button>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.application-card {
  width: 100%;
  text-align: left;
  background:
    radial-gradient(circle at top right, rgba(var(--accent-primary-rgb), 0.06), transparent 28%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.9), $bg-card);
  padding: 20px;
  cursor: pointer;
}

.application-card--warning {
  border-color: rgba(183, 121, 31, 0.3);
}

.application-card--danger {
  border-color: rgba(178, 75, 66, 0.3);
}

.application-card--info {
  border-color: rgba(var(--accent-primary-rgb), 0.28);
}

.application-card--accent {
  border-color: rgba(var(--accent-primary-rgb), 0.34);
}

.application-card__priority {
  padding: 14px 14px 12px;
  border-radius: $radius-md;
  background: rgba(var(--accent-primary-rgb), 0.05);
  border: 1px solid rgba(var(--accent-primary-rgb), 0.09);
}

.application-card--warning .application-card__priority {
  background: rgba(183, 121, 31, 0.07);
  border-color: rgba(183, 121, 31, 0.14);
}

.application-card--danger .application-card__priority {
  background: rgba(178, 75, 66, 0.07);
  border-color: rgba(178, 75, 66, 0.14);
}

.application-card__priority-eyebrow {
  display: inline-flex;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: $accent-primary;
}

.application-card--warning .application-card__priority-eyebrow {
  color: $warning;
}

.application-card--danger .application-card__priority-eyebrow {
  color: $error;
}

.application-card__priority-title {
  margin-top: 6px;
  font-size: 16px;
  font-weight: 700;
  color: $text-primary;
}

.application-card__priority-body {
  margin-top: 6px;
  color: $text-secondary;
  line-height: 1.6;
}

.application-card__top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: 16px;
}

.application-card__title {
  font-size: 20px;
  font-weight: 700;
  color: $text-primary;
}

.application-card__meta {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.application-card__arrow {
  font-size: 24px;
  line-height: 1;
  color: $text-muted;
}

.application-card__summary {
  margin-top: 14px;
  color: $text-secondary;
  min-height: 44px;
  line-height: 1.6;
}

.application-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.application-card__stat {
  padding: 12px;
  border-radius: $radius-md;
  background: var(--workbench-card-soft-bg);
}

.application-card__label {
  display: block;
  font-size: 12px;
  color: $text-muted;
}

.application-card__value {
  display: block;
  margin-top: 4px;
  font-weight: 600;
  color: $text-primary;
}

.application-card__footer {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid $border-color;
}

.application-card__footer-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.application-card__next-action {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: $radius-md;
  background: rgba(var(--accent-primary-rgb), 0.05);
}

.application-card__next-action-label {
  color: $text-muted;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.application-card__next-action-value {
  color: $text-primary;
  font-weight: 700;
  line-height: 1.5;
}

.application-card__reason {
  color: $text-secondary;
  font-size: 13px;
  line-height: 1.5;
}

.application-card__destination {
  color: $text-muted;
  font-size: 12px;
  font-weight: 600;
}

.workbench-status-pill,
.workbench-pill {
  text-transform: capitalize;
}
</style>
