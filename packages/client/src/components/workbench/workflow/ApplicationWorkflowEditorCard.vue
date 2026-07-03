<script setup lang="ts">
import { NButton, NInput, NSpin } from 'naive-ui'
import LogicFlowWorkflowEditor from '@/components/hermes/group-chat/LogicFlowWorkflowEditor.vue'
import type { WorkflowRoomConfig } from '@/api/hermes/group-chat'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationWorkflowRoleAlignment } from '@/types/workbench/application'

defineProps<{
  workflowName: string
  workflowPrompt: string
  workflowConfig: WorkflowRoomConfig
  roleAlignment: ApplicationWorkflowRoleAlignment
  saving: boolean
}>()

const emit = defineEmits<{
  'update:workflowName': [value: string]
  'update:workflowPrompt': [value: string]
  'update:workflowConfig': [value: WorkflowRoomConfig]
  save: []
  refresh: []
}>()

const { t } = useWorkbenchI18n()
</script>

<template>
  <article class="workflow-editor-card">
    <NSpin :show="saving">
      <div class="workflow-editor-card__header">
        <div>
          <div class="workflow-editor-card__eyebrow">{{ t('workbench.workflow.flowEditor') }}</div>
          <h3>{{ t('workbench.workflow.flowEditorTitle') }}</h3>
        </div>
        <div class="workflow-editor-card__actions">
          <NButton secondary @click="emit('refresh')">{{ t('workbench.workflow.refreshRuntimeState') }}</NButton>
          <NButton type="primary" @click="emit('save')">{{ t('workbench.workflow.saveFlow') }}</NButton>
        </div>
      </div>

      <div class="workflow-editor-card__fields">
        <NInput
          :value="workflowName"
          :placeholder="t('workbench.workflow.executionFlowNamePlaceholder')"
          @update:value="emit('update:workflowName', $event)"
        />
        <NInput
          :value="workflowPrompt"
          type="textarea"
          :placeholder="t('workbench.workflow.executionFlowPromptPlaceholder')"
          @update:value="emit('update:workflowPrompt', $event)"
        />
      </div>

      <div v-if="roleAlignment.missingRoles.length" class="workflow-editor-card__warning">
        {{ t('workbench.workflow.missingFlowRoles', { roles: roleAlignment.missingRoles.join('、') }) }}
      </div>

      <LogicFlowWorkflowEditor
        :model-value="workflowConfig"
        :agents="[]"
        @update:model-value="emit('update:workflowConfig', $event)"
      />
    </NSpin>
  </article>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.workflow-editor-card {
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-card;
  padding: 20px;
}

.workflow-editor-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.workflow-editor-card__eyebrow {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $accent-primary;
  font-weight: 700;
}

.workflow-editor-card__header h3 {
  margin-top: 10px;
  color: $text-primary;
}

.workflow-editor-card__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.workflow-editor-card__fields {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.workflow-editor-card__warning {
  margin-top: 14px;
  color: $warning;
  font-weight: 600;
}

:deep(.workflow-editor-shell) {
  margin-top: 18px;
}

@media (max-width: 1100px) {
  .workflow-editor-card__header {
    flex-direction: column;
  }
}
</style>
