<script setup lang="ts">
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationWorkflowRunSummary } from '@/types/workbench/application'

defineProps<{
  run: ApplicationWorkflowRunSummary
}>()

const { t, statusLabel } = useWorkbenchI18n()
</script>

<template>
  <article class="workflow-card">
    <div class="workflow-card__eyebrow">{{ t('workbench.workflow.executionState') }}</div>
    <div class="workflow-run__headline">
      <span class="workflow-run__badge" :data-status="run.status">{{ statusLabel(run.status) }}</span>
      <strong>{{ run.currentNodeTitle || t('workbench.workflow.noActiveStage') }}</strong>
    </div>
    <p class="workflow-run__body">
      {{ t('workbench.workflow.activeRolePendingSummary', { role: run.currentNodeRoleName || t('workbench.system.na'), count: run.pendingApprovalCount }) }}
    </p>
    <dl class="workflow-run__stats">
      <div>
        <dt>{{ t('workbench.workflow.completedStages') }}</dt>
        <dd>{{ run.completedNodeCount }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.workflow.totalStageRuns') }}</dt>
        <dd>{{ run.totalNodeRuns }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.workflow.startedAt') }}</dt>
        <dd>{{ run.startedAt ? new Date(run.startedAt).toLocaleString() : t('workbench.system.na') }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.workflow.lastUpdated') }}</dt>
        <dd>{{ run.updatedAt ? new Date(run.updatedAt).toLocaleString() : t('workbench.system.na') }}</dd>
      </div>
    </dl>
  </article>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.workflow-card {
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-card;
  padding: 20px;
}

.workflow-card__eyebrow {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $accent-primary;
  font-weight: 700;
}

.workflow-run__headline {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  color: $text-primary;
}

.workflow-run__badge {
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  background: rgba(var(--accent-primary-rgb), 0.08);
}

.workflow-run__badge[data-status='running'] {
  background: rgba(var(--accent-info-rgb), 0.16);
}

.workflow-run__badge[data-status='failed'] {
  background: rgba(var(--error-rgb), 0.16);
}

.workflow-run__badge[data-status='completed'] {
  background: rgba(var(--success-rgb), 0.16);
}

.workflow-run__body {
  margin-top: 10px;
  color: $text-secondary;
}

.workflow-run__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
  margin-top: 18px;
}

.workflow-run__stats dt {
  font-size: 12px;
  color: $text-muted;
  text-transform: uppercase;
}

.workflow-run__stats dd {
  margin-top: 4px;
  color: $text-primary;
  word-break: break-word;
}
</style>
