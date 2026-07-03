<script setup lang="ts">
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationRunNode } from '@/types/workbench/application'

defineProps<{
  nodes: ApplicationRunNode[]
}>()

const { t, locale, statusLabel } = useWorkbenchI18n()

function timelineStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: t('workbench.runs.timelineStatuses.pending'),
    running: statusLabel('running'),
    completed: statusLabel('completed'),
    waiting_approval: t('workbench.runs.timelineStatuses.waiting_approval'),
    rejected: t('workbench.runs.timelineStatuses.rejected'),
    skipped: t('workbench.runs.timelineStatuses.skipped'),
  }

  return map[status] || status
}
</script>

<template>
  <article class="timeline-card">
    <div class="timeline-card__eyebrow">{{ t('workbench.runs.executionTimeline') }}</div>
    <div v-if="!nodes.length" class="timeline-card__empty">
      {{ t('workbench.runs.noExecutionStages') }}
    </div>
    <div v-else class="timeline-list">
      <div v-for="node in nodes" :key="node.id" class="timeline-item">
        <div class="timeline-item__status" :data-status="node.status">{{ timelineStatusLabel(node.status) }}</div>
        <div class="timeline-item__content">
          <div class="timeline-item__title">{{ node.nodeId }}</div>
          <div class="timeline-item__meta">
            {{ t('workbench.runs.timelineMeta', {
              operator: node.actorAgentName || t('workbench.system.na'),
              updated: node.updatedAt ? new Date(node.updatedAt).toLocaleString(locale, { hour12: false }) : t('workbench.system.na'),
            }) }}
          </div>
          <div v-if="node.artifactIds.length" class="timeline-item__artifacts">
            {{ t('workbench.runs.timelineOutputs', { outputs: node.artifactIds.join(', ') }) }}
          </div>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.timeline-card {
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-card;
  padding: 20px;
}

.timeline-card__eyebrow {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $accent-primary;
  font-weight: 700;
}

.timeline-card__empty {
  margin-top: 16px;
  color: $text-muted;
}

.timeline-list {
  margin-top: 16px;
  display: grid;
  gap: 12px;
}

.timeline-item {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 14px;
  padding: 14px;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: rgba(var(--accent-primary-rgb), 0.02);
}

.timeline-item__status {
  border-radius: 999px;
  padding: 6px 10px;
  align-self: start;
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: $text-primary;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  text-align: center;
}

.timeline-item__status[data-status='completed'] {
  background: rgba(var(--success-rgb), 0.16);
}

.timeline-item__status[data-status='rejected'] {
  background: rgba(var(--error-rgb), 0.16);
}

.timeline-item__status[data-status='waiting_approval'] {
  background: rgba(var(--warning-rgb), 0.16);
}

.timeline-item__title {
  font-weight: 700;
  color: $text-primary;
}

.timeline-item__meta,
.timeline-item__artifacts {
  margin-top: 6px;
  color: $text-secondary;
  line-height: 1.5;
}

@media (max-width: 900px) {
  .timeline-item {
    grid-template-columns: 1fr;
  }
}
</style>
