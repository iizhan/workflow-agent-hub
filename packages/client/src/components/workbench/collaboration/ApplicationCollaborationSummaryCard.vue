<script setup lang="ts">
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationCollaborationSummary } from '@/types/workbench/application'

defineProps<{
  summary: ApplicationCollaborationSummary
}>()

const { t, statusLabel } = useWorkbenchI18n()
</script>

<template>
  <article class="collab-card workbench-panel workbench-panel--soft">
    <div class="collab-card__eyebrow workbench-section-title">{{ t('workbench.collaboration.summary') }}</div>
    <div class="collab-card__title">{{ summary.roomName }}</div>
    <p class="collab-card__body">
      {{ t('workbench.collaboration.currentRunSummary', { status: statusLabel(summary.runStatus), node: summary.activeNodeTitle || t('workbench.collaboration.noActiveNode') }) }}
    </p>
    <dl class="collab-card__meta">
      <div>
        <dt>{{ t('workbench.collaboration.members') }}</dt>
        <dd>{{ summary.memberCount }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.collaboration.onlineAgents') }}</dt>
        <dd>{{ summary.onlineAgentCount }}/{{ summary.totalAgentCount }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.collaboration.activeRole') }}</dt>
        <dd>{{ summary.activeRoleName || t('workbench.system.na') }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.collaboration.pendingApprovals') }}</dt>
        <dd>{{ summary.pendingApprovalCount }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.collaboration.artifacts') }}</dt>
        <dd>{{ summary.artifactCount }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.collaboration.projectBound') }}</dt>
        <dd>{{ summary.projectBound ? t('workbench.collaboration.yes') : t('workbench.collaboration.no') }}</dd>
      </div>
    </dl>
  </article>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.collab-card {}

.collab-card__eyebrow {}

.collab-card__title {
  margin-top: 10px;
  font-size: 22px;
  font-weight: 700;
  color: $text-primary;
}

.collab-card__body {
  margin-top: 10px;
  color: $text-secondary;
}

.collab-card__meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 16px;
  margin-top: 18px;
}

.collab-card__meta dt {
  font-size: 12px;
  text-transform: uppercase;
  color: $text-muted;
}

.collab-card__meta dd {
  margin-top: 4px;
  color: $text-primary;
}

@media (max-width: 1100px) {
  .collab-card__meta {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
