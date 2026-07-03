<script setup lang="ts">
import { computed, toRef } from 'vue'
import { NButton, NSpin, useMessage } from 'naive-ui'
import ApplicationAgentCard from './ApplicationAgentCard.vue'
import ApplicationAgentFormModal from './ApplicationAgentFormModal.vue'
import ApplicationAgentOverviewCard from './ApplicationAgentOverviewCard.vue'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import { useApplicationAgentWorkspace } from '@/composables/workbench/useApplicationAgentWorkspace'
import type { ApplicationDetail } from '@/types/workbench/application'

const props = defineProps<{
  application: ApplicationDetail
}>()

const message = useMessage()
const applicationId = toRef(() => props.application.id)
const workspace = useApplicationAgentWorkspace(applicationId)
const { t } = useWorkbenchI18n()

const modalTitle = computed(() =>
  workspace.editingAgentId.value ? t('workbench.agents.editRole') : t('workbench.agents.configureRole'),
)

async function handleCreate() {
  try {
    await workspace.openCreate()
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.agents.prepareRoleFormFailed')))
  }
}

async function handleEdit(agentId: string) {
  try {
    await workspace.openEdit(agentId)
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.agents.openRoleEditorFailed')))
  }
}

async function handleRemove(agentId: string) {
  try {
    await workspace.removeAgent(agentId)
    message.success(t('workbench.agents.roleRemoved'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.agents.removeRoleFailed')))
  }
}

async function handleSubmit() {
  try {
    await workspace.submitForm()
    message.success(t('workbench.agents.roleSaved'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.agents.saveRoleFailed')))
  }
}

async function handleSaveDefaults() {
  try {
    await workspace.saveLiveTeamAsBaseline()
    message.success(t('workbench.agents.baselineSaved'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.agents.saveBaselineFailed')))
  }
}

async function handleApplyDefaults() {
  try {
    await workspace.restoreSavedBaselineToLiveTeam()
    message.success(t('workbench.agents.baselineRestoredToTeam'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.agents.restoreBaselineFailed')))
  }
}
</script>

<template>
  <div class="agents-workspace">
    <NSpin :show="workspace.isLoading.value || workspace.isSaving.value">
      <div class="agents-workspace__header">
        <ApplicationAgentOverviewCard :summary="workspace.summary.value" />

        <article class="agent-actions-card workbench-panel workbench-panel--soft">
          <div class="agent-actions-card__eyebrow workbench-section-title">{{ t('workbench.agents.roleActions') }}</div>
          <p class="agent-actions-card__body">
            {{ t('workbench.agents.roleActionsBody') }}
          </p>
          <div class="agent-actions-card__buttons">
            <NButton type="primary" @click="handleCreate">{{ t('workbench.agents.addRole') }}</NButton>
            <NButton secondary @click="handleSaveDefaults">{{ t('workbench.agents.saveCurrentTeamAsBaseline') }}</NButton>
            <NButton secondary @click="handleApplyDefaults">{{ t('workbench.agents.restoreBaselineToTeam') }}</NButton>
          </div>
          <p class="agent-actions-card__hint">
            {{ t('workbench.agents.baselineActionHint') }}
          </p>
        </article>
      </div>

      <section class="agents-grid">
        <ApplicationAgentCard
          v-for="agent in workspace.agents.value"
          :key="agent.id"
          :agent="agent"
          @edit="handleEdit"
          @remove="handleRemove"
        />
        <article v-if="!workspace.agents.value.length" class="agent-empty-card workbench-empty-state">
          <h3>{{ t('workbench.agents.emptyTitle') }}</h3>
          <p>{{ t('workbench.agents.emptyBody') }}</p>
          <NButton type="primary" @click="handleCreate">{{ t('workbench.agents.addFirstRole') }}</NButton>
        </article>
      </section>
    </NSpin>

    <ApplicationAgentFormModal
      :show="workspace.showFormModal.value"
      :title="modalTitle"
      :selected-profile="workspace.selectedProfile.value"
      :selected-model-provider="workspace.selectedModelProvider.value"
      :agent-name="workspace.agentName.value"
      :agent-description="workspace.agentDescription.value"
      :agent-avatar="workspace.agentAvatar.value"
      :agent-system-prompt="workspace.agentSystemPrompt.value"
      :agent-model="workspace.agentModel.value"
      :agent-temperature="workspace.agentTemperature.value"
      :profile-options="workspace.profileOptions.value"
      :model-provider-options="workspace.modelProviderOptions.value"
      :selected-model-options="workspace.selectedModelOptions.value"
      :saving="workspace.isSaving.value"
      @update:show="$event ? (workspace.showFormModal.value = true) : workspace.closeForm()"
      @update:selected-profile="workspace.selectedProfile.value = $event"
      @update:selected-model-provider="workspace.selectedModelProvider.value = $event"
      @update:agent-name="workspace.agentName.value = $event"
      @update:agent-description="workspace.agentDescription.value = $event"
      @update:agent-avatar="workspace.agentAvatar.value = $event"
      @update:agent-system-prompt="workspace.agentSystemPrompt.value = $event"
      @update:agent-model="workspace.agentModel.value = $event"
      @update:agent-temperature="workspace.agentTemperature.value = $event"
      @submit="handleSubmit"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.agents-workspace {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.agents-workspace__header {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 16px;
}

.agent-actions-card {
}

.agent-actions-card__eyebrow {
}

.agent-actions-card__body {
  margin-top: 12px;
  color: $text-secondary;
  line-height: 1.5;
}

.agent-actions-card__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.agent-actions-card__hint {
  margin-top: 12px;
  color: $text-muted;
  line-height: 1.6;
}

.agents-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.agent-empty-card {
  color: $text-secondary;
}

.agent-empty-card p {
  margin-top: 10px;
}

.agent-empty-card :deep(button) {
  margin-top: 18px;
}

@media (max-width: 1100px) {
  .agents-workspace__header,
  .agents-grid {
    grid-template-columns: 1fr;
  }
}
</style>
