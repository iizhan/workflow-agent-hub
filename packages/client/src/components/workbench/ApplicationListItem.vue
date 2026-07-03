<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationSummary } from '@/types/workbench/application'
import { buildApplicationDetailRoute } from '@/utils/workbench-application-scope'
import { preferredApplicationSection } from '@/utils/workbench-applications'

const props = defineProps<{
  application: ApplicationSummary
}>()

const router = useRouter()
const { t, locale, scenarioLabel, statusLabel, statusReasonLabel, nextActionLabel, sectionLabel } = useWorkbenchI18n()

const destinationSection = computed(() => preferredApplicationSection(props.application))
const destinationLabel = computed(() =>
  t('workbench.card.openFirstSection', { section: sectionLabel(destinationSection.value) }),
)
const updatedLabel = computed(() => {
  if (!props.application.updatedAt) return t('workbench.card.notUpdatedYet')
  return new Date(props.application.updatedAt).toLocaleString(locale.value, { hour12: false })
})
const stateTone = computed(() => {
  if (props.application.hasPendingReview || props.application.status === 'waiting_review') return 'warning'
  if (props.application.status === 'failed') return 'danger'
  if (props.application.hasActiveRun || props.application.status === 'running') return 'info'
  if (props.application.status === 'ready') return 'accent'
  return 'default'
})
const stateLabel = computed(() => {
  if (props.application.hasPendingReview || props.application.status === 'waiting_review') {
    return t('workbench.card.priorityReviewEyebrow')
  }
  if (props.application.status === 'failed') return t('workbench.card.priorityFailureEyebrow')
  if (props.application.hasActiveRun || props.application.status === 'running') {
    return t('workbench.card.priorityRunningEyebrow')
  }
  if (props.application.status === 'ready') return t('workbench.card.priorityReadyEyebrow')
  return t('workbench.card.prioritySetupEyebrow')
})

function openApplication() {
  router.push(buildApplicationDetailRoute(props.application.id, destinationSection.value))
}
</script>

<template>
  <button
    class="application-list-item workbench-card workbench-card--interactive"
    :class="`application-list-item--${stateTone}`"
    type="button"
    @click="openApplication"
  >
    <div class="application-list-item__main">
      <div class="application-list-item__title-row">
        <div class="application-list-item__title-group">
          <div class="application-list-item__title">{{ application.name }}</div>
          <div class="application-list-item__subtitle">
            {{ application.goalSummary || statusReasonLabel(application.statusReason) || t('workbench.card.goalSummaryPending') }}
          </div>
        </div>
        <div class="application-list-item__chips">
          <span class="application-list-item__signal">{{ stateLabel }}</span>
          <span class="workbench-pill">{{ scenarioLabel(application.scenario) }}</span>
          <span class="workbench-status-pill" :class="`workbench-status-pill--${application.status}`">
            {{ statusLabel(application.status) }}
          </span>
        </div>
      </div>

      <div class="application-list-item__meta">
        <span>{{ t('workbench.card.project') }}: {{ application.primaryProjectName || t('workbench.card.notConnected') }}</span>
        <span>{{ t('workbench.card.agents') }}: {{ application.agentCount }}</span>
        <span>{{ t('workbench.card.lastUpdated') }}: {{ updatedLabel }}</span>
      </div>
    </div>

    <div class="application-list-item__side">
      <div class="application-list-item__destination">{{ destinationLabel }}</div>
      <div v-if="application.nextAction" class="application-list-item__next-action">
        {{ nextActionLabel(application.nextAction) }}
      </div>
      <span class="application-list-item__arrow">›</span>
    </div>
  </button>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.application-list-item {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px;
  align-items: center;
  text-align: left;
  padding: 18px 20px;
  background:
    radial-gradient(circle at top right, rgba(var(--accent-primary-rgb), 0.05), transparent 24%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.9), $bg-card);
}

.application-list-item--warning {
  border-color: rgba(183, 121, 31, 0.28);
}

.application-list-item--danger {
  border-color: rgba(178, 75, 66, 0.28);
}

.application-list-item--info {
  border-color: rgba(var(--accent-primary-rgb), 0.24);
}

.application-list-item--accent {
  border-color: rgba(var(--accent-primary-rgb), 0.32);
}

.application-list-item__title-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.application-list-item__title-group {
  min-width: 0;
}

.application-list-item__title {
  font-size: 18px;
  font-weight: 700;
  color: $text-primary;
}

.application-list-item__subtitle {
  margin-top: 6px;
  color: $text-secondary;
  line-height: 1.55;
}

.application-list-item__chips {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.application-list-item__signal {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: $text-primary;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.application-list-item__meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 14px;
  color: $text-muted;
  font-size: 13px;
}

.application-list-item__side {
  min-width: 180px;
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: 8px;
}

.application-list-item__destination {
  color: $text-primary;
  font-weight: 700;
}

.application-list-item__next-action {
  color: $text-secondary;
  font-size: 13px;
  line-height: 1.5;
  text-align: right;
}

.application-list-item__arrow {
  font-size: 26px;
  line-height: 1;
  color: $text-muted;
}

@media (max-width: 980px) {
  .application-list-item {
    grid-template-columns: 1fr;
  }

  .application-list-item__title-row,
  .application-list-item__side {
    align-items: flex-start;
  }

  .application-list-item__chips,
  .application-list-item__next-action {
    justify-content: flex-start;
    text-align: left;
  }
}

@media (max-width: 720px) {
  .application-list-item__title-row {
    flex-direction: column;
  }
}
</style>
