<script setup lang="ts">
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationAgentWorkspaceSummary } from '@/types/workbench/application'

defineProps<{
  summary: ApplicationAgentWorkspaceSummary
}>()

const { t } = useWorkbenchI18n()
</script>

<template>
  <article class="agent-overview-card workbench-panel workbench-panel--soft">
    <div class="agent-overview-card__eyebrow workbench-section-title">{{ t('workbench.agents.overview') }}</div>
    <div class="agent-overview-card__stats">
      <div class="agent-overview-stat workbench-kv-card">
        <span class="agent-overview-stat__label">{{ t('workbench.agents.totalRoles') }}</span>
        <span class="agent-overview-stat__value">{{ summary.total }}</span>
      </div>
      <div class="agent-overview-stat workbench-kv-card">
        <span class="agent-overview-stat__label">{{ t('workbench.agents.invited') }}</span>
        <span class="agent-overview-stat__value">{{ summary.invitedCount }}</span>
      </div>
    </div>

    <div class="agent-overview-card__section">
      <div class="agent-overview-card__label">{{ t('workbench.agents.namedRoles') }}</div>
      <div class="agent-role-list">
        <span v-for="role in summary.namedRoles" :key="role" class="agent-role-pill">{{ role }}</span>
        <span v-if="!summary.namedRoles.length" class="agent-role-empty">{{ t('workbench.agents.noNamedRoles') }}</span>
      </div>
    </div>

    <div class="agent-overview-card__section">
      <div class="agent-overview-card__label">{{ t('workbench.agents.executionFlowMissingRoles') }}</div>
      <div class="agent-role-list">
        <span
          v-for="role in summary.workflowMissingRoles"
          :key="role"
          class="agent-role-pill agent-role-pill--warning"
        >
          {{ role }}
        </span>
        <span v-if="!summary.workflowMissingRoles.length" class="agent-role-empty">{{ t('workbench.agents.roleCoverageComplete') }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.agent-overview-card {}

.agent-overview-card__eyebrow {}

.agent-overview-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.agent-overview-stat {}

.agent-overview-stat__label {
  display: block;
  font-size: 12px;
  color: $text-muted;
}

.agent-overview-stat__value {
  display: block;
  margin-top: 6px;
  font-size: 22px;
  font-weight: 700;
  color: $text-primary;
}

.agent-overview-card__section {
  margin-top: 18px;
}

.agent-overview-card__label {
  font-size: 12px;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.agent-role-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.agent-role-pill {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: $accent-primary;
  font-size: 12px;
  font-weight: 600;
}

.agent-role-pill--warning {
  background: rgba(183, 121, 31, 0.14);
  color: #9a6b18;
}

.agent-role-empty {
  color: $text-secondary;
  font-size: 13px;
}
</style>
