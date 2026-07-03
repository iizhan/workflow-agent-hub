<script setup lang="ts">
import { NButton, NPopconfirm } from 'naive-ui'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationAgentSummary } from '@/types/workbench/application'

defineProps<{
  agent: ApplicationAgentSummary
}>()

const emit = defineEmits<{
  edit: [agentId: string]
  remove: [agentId: string]
}>()

const { t } = useWorkbenchI18n()
</script>

<template>
  <article class="agent-card">
    <div class="agent-card__header">
      <div>
        <h3 class="agent-card__title">{{ agent.name }}</h3>
        <div class="agent-card__meta">
          <span class="agent-card__pill">{{ agent.profile }}</span>
          <span v-if="agent.invited" class="agent-card__pill agent-card__pill--active">{{ t('workbench.agents.activated') }}</span>
          <span v-if="agent.systemPromptEnabled" class="agent-card__pill">{{ t('workbench.agents.customRolePrompt') }}</span>
        </div>
      </div>
      <div class="agent-card__actions">
        <NButton size="small" secondary @click="emit('edit', agent.id)">{{ t('workbench.agents.editRole') }}</NButton>
        <NPopconfirm @positive-click="emit('remove', agent.id)">
          <template #trigger>
            <NButton size="small" secondary type="error">{{ t('common.delete') }}</NButton>
          </template>
          {{ t('workbench.agents.removeRoleConfirm') }}
        </NPopconfirm>
      </div>
    </div>

    <p class="agent-card__description">
      {{ agent.description || t('workbench.agents.noRoleBrief') }}
    </p>

    <dl class="agent-card__details">
      <div>
        <dt>{{ t('workbench.agents.model') }}</dt>
        <dd>{{ agent.model || t('workbench.agents.defaultModelRouting') }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.agents.temperature') }}</dt>
        <dd>{{ agent.temperature ?? t('workbench.agents.defaultValue') }}</dd>
      </div>
    </dl>
  </article>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.agent-card {
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-card;
  padding: 20px;
}

.agent-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.agent-card__title {
  font-size: 18px;
  font-weight: 700;
  color: $text-primary;
}

.agent-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.agent-card__pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: $accent-primary;
  font-size: 12px;
  font-weight: 600;
}

.agent-card__pill--active {
  background: rgba(47, 125, 74, 0.12);
  color: #2f7d4a;
}

.agent-card__actions {
  display: flex;
  gap: 8px;
}

.agent-card__description {
  margin-top: 14px;
  color: $text-secondary;
  line-height: 1.5;
}

.agent-card__details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.agent-card__details dt {
  font-size: 12px;
  color: $text-muted;
}

.agent-card__details dd {
  margin-top: 4px;
  color: $text-primary;
  font-weight: 600;
}

@media (max-width: 900px) {
  .agent-card__header {
    flex-direction: column;
  }

  .agent-card__details {
    grid-template-columns: 1fr;
  }
}
</style>
