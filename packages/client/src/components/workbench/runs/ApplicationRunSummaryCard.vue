<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NInput, NSelect } from 'naive-ui'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationRunArtifactOption, ApplicationRunSummary } from '@/types/workbench/application'

const props = defineProps<{
  summary: ApplicationRunSummary
  rejectReason: string
  launchBrief: string
  launchArtifactPath: string
  artifactOptions: ApplicationRunArtifactOption[]
  submitting: boolean
}>()

const emit = defineEmits<{
  'update:rejectReason': [value: string]
  'update:launchBrief': [value: string]
  'update:launchArtifactPath': [value: string]
  refresh: []
  start: []
  approve: []
  reject: []
  cancel: []
}>()

const { t, statusLabel } = useWorkbenchI18n()

const launchActionHint = computed(() => {
  if (props.summary.startActionKind === 'next_run') return t('workbench.runs.startNextRunHint')
  if (props.summary.startActionKind === 'retry_failed_run') return t('workbench.runs.retryRunHint')
  return t('workbench.runs.startFirstRunHint')
})
</script>

<template>
  <article class="run-card">
    <div class="run-card__header">
      <div>
        <div class="run-card__eyebrow">{{ t('workbench.runs.executionSummary') }}</div>
        <div class="run-card__title">{{ summary.currentNodeTitle || t('workbench.runs.noActiveExecutionStage') }}</div>
      </div>
      <div class="run-card__actions">
        <NButton secondary @click="emit('refresh')">{{ t('workbench.runs.refreshState') }}</NButton>
        <NButton
          v-if="summary.canStartNewRun"
          type="primary"
          :loading="submitting"
          @click="emit('start')"
        >
          {{ summary.startActionLabel }}
        </NButton>
        <NButton
          v-if="summary.canCurrentUserCancel"
          secondary
          :loading="submitting"
          @click="emit('cancel')"
        >
          {{ t('workbench.runs.stopLiveRun') }}
        </NButton>
      </div>
    </div>

    <p class="run-card__body">
      {{ t('workbench.runs.runMetaSummary', {
        status: statusLabel(summary.status),
        role: summary.currentNodeRoleName || t('workbench.system.na'),
        count: summary.pendingApprovalCount,
      }) }}
    </p>

    <div v-if="summary.runNumber === null" class="run-card__onboarding workbench-panel workbench-panel--soft">
      <div class="run-card__approval-title">{{ t('workbench.runs.firstRunTitle') }}</div>
      <p class="run-card__approval-body">
        {{ t('workbench.runs.firstRunBody') }}
      </p>
      <ul class="run-card__onboarding-list">
        <li>{{ t('workbench.runs.firstRunPoint1') }}</li>
        <li>{{ t('workbench.runs.firstRunPoint2') }}</li>
        <li>{{ t('workbench.runs.firstRunPoint3') }}</li>
      </ul>
    </div>

    <dl class="run-card__meta">
      <div>
        <dt>{{ t('workbench.runs.startedAt') }}</dt>
        <dd>{{ summary.startedAt ? new Date(summary.startedAt).toLocaleString() : t('workbench.system.na') }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.runs.lastUpdated') }}</dt>
        <dd>{{ summary.updatedAt ? new Date(summary.updatedAt).toLocaleString() : t('workbench.system.na') }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.runs.completedStages') }}</dt>
        <dd>{{ summary.completedNodeCount }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.runs.rejectedStages') }}</dt>
        <dd>{{ summary.rejectedNodeCount }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.runs.totalStageRuns') }}</dt>
        <dd>{{ summary.totalNodeRuns }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.runs.approvalOwner') }}</dt>
        <dd>{{ summary.approvalOwnerName || t('workbench.runs.notSpecified') }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.runs.runRound') }}</dt>
        <dd>{{ summary.runNumber || t('workbench.runs.notStartedYet') }}</dd>
      </div>
    </dl>

    <div v-if="summary.kickoffSummary || summary.kickoffArtifactPath" class="run-card__context">
      <div class="run-card__approval-title">{{ t('workbench.runs.currentRunContext') }}</div>
      <p v-if="summary.kickoffSummary" class="run-card__approval-body">
        {{ t('workbench.runs.currentRunBrief', { summary: summary.kickoffSummary }) }}
      </p>
      <p v-if="summary.kickoffArtifactPath" class="run-card__approval-body">
        {{ t('workbench.runs.currentRunArtifact', { path: summary.kickoffArtifactPath }) }}
      </p>
    </div>

    <div v-if="summary.canStartNewRun" class="run-card__launch">
      <div class="run-card__approval-title">{{ t('workbench.runs.runBrief') }}</div>
      <p class="run-card__approval-body">
        {{ t('workbench.runs.runBriefBody') }}
      </p>
      <p class="run-card__approval-body run-card__approval-body--accent">
        {{ launchActionHint }}
      </p>
      <NInput
        :value="launchBrief"
        type="textarea"
        :placeholder="t('workbench.runs.runBriefPlaceholder')"
        @update:value="emit('update:launchBrief', $event)"
      />
      <NSelect
        class="run-card__artifact-select"
        clearable
        :value="launchArtifactPath"
        :options="artifactOptions"
        :placeholder="t('workbench.runs.continueFromArtifactPlaceholder')"
        @update:value="emit('update:launchArtifactPath', String($event || ''))"
      />
    </div>

    <div v-if="summary.approvalRequired" class="run-card__approval">
      <div class="run-card__approval-title">{{ t('workbench.runs.approvalNeeded') }}</div>
      <p class="run-card__approval-body">
        {{ t('workbench.runs.approvalNeededBody') }}
      </p>
      <NInput
        :value="rejectReason"
        type="textarea"
        :placeholder="t('workbench.runs.rejectionReasonPlaceholder')"
        @update:value="emit('update:rejectReason', $event)"
      />
      <div class="run-card__approval-actions">
        <NButton
          secondary
          :disabled="!summary.canCurrentUserApprove"
          :loading="submitting"
          @click="emit('approve')"
        >
          {{ t('workbench.runs.approveStage') }}
        </NButton>
        <NButton
          type="warning"
          :disabled="!summary.canCurrentUserApprove || !rejectReason.trim()"
          :loading="submitting"
          @click="emit('reject')"
        >
          {{ t('workbench.runs.rejectStage') }}
        </NButton>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.run-card {
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-card;
  padding: 20px;
}

.run-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.run-card__eyebrow {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $accent-primary;
  font-weight: 700;
}

.run-card__title {
  margin-top: 10px;
  font-size: 20px;
  font-weight: 700;
  color: $text-primary;
}

.run-card__actions,
.run-card__approval-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.run-card__body {
  margin-top: 12px;
  color: $text-secondary;
}

.run-card__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
  margin-top: 18px;
}

.run-card__meta dt {
  font-size: 12px;
  text-transform: uppercase;
  color: $text-muted;
}

.run-card__meta dd {
  margin-top: 4px;
  color: $text-primary;
}

.run-card__approval {
  margin-top: 20px;
  border-top: 1px solid $border-light;
  padding-top: 18px;
}

.run-card__launch {
  margin-top: 20px;
  border-top: 1px solid $border-light;
  padding-top: 18px;
}

.run-card__onboarding {
  margin-top: 20px;
  border-top: 1px solid $border-light;
  padding-top: 18px;
}

.run-card__context {
  margin-top: 20px;
  border-top: 1px solid $border-light;
  padding-top: 18px;
}

.run-card__approval-title {
  font-weight: 700;
  color: $text-primary;
}

.run-card__approval-body {
  margin-top: 8px;
  margin-bottom: 12px;
  color: $text-secondary;
}

.run-card__onboarding-list {
  margin: 0;
  padding-left: 18px;
  color: $text-secondary;
  line-height: 1.7;
}

.run-card__artifact-select {
  margin-top: 12px;
}

@media (max-width: 1100px) {
  .run-card__header {
    flex-direction: column;
  }
}
</style>
