<script setup lang="ts">
import { toRef } from 'vue'
import { NSpin, useMessage } from 'naive-ui'
import ApplicationWorkflowEditorCard from './ApplicationWorkflowEditorCard.vue'
import ApplicationWorkflowOverviewCard from './ApplicationWorkflowOverviewCard.vue'
import ApplicationWorkflowRunCard from './ApplicationWorkflowRunCard.vue'
import ApplicationWorkflowTemplateCard from './ApplicationWorkflowTemplateCard.vue'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import { useApplicationWorkflowWorkspace } from '@/composables/workbench/useApplicationWorkflowWorkspace'
import type { ApplicationDetail } from '@/types/workbench/application'

const props = defineProps<{
  application: ApplicationDetail
}>()

const message = useMessage()
const applicationId = toRef(() => props.application.id)
const workspace = useApplicationWorkflowWorkspace(applicationId)
const { t } = useWorkbenchI18n()

async function handleApplyTemplate(syncAgents: boolean) {
  try {
    await workspace.applyTemplate(workspace.selectedTemplateId.value, syncAgents)
    message.success(syncAgents ? t('workbench.workflow.flowDraftLoadedAndRolesAdded') : t('workbench.workflow.flowDraftLoaded'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.workflow.applyFlowTemplateFailed')))
  }
}

async function handleSaveWorkflow() {
  try {
    await workspace.saveWorkflow()
    message.success(t('workbench.workflow.executionFlowSaved'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.workflow.saveExecutionFlowFailed')))
  }
}

async function handleRefreshRuntime() {
  try {
    await workspace.refreshRuntime()
    message.success(t('workbench.workflow.runtimeStateRefreshed'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.workflow.refreshRuntimeStateFailed')))
  }
}
</script>

<template>
  <div class="workflow-workspace">
    <NSpin :show="workspace.isLoading.value || workspace.isApplyingTemplate.value || workspace.isSaving.value">
      <section class="workflow-workspace__top">
        <ApplicationWorkflowOverviewCard :summary="workspace.workflowSummary.value" />
        <ApplicationWorkflowRunCard :run="workspace.workflowRun.value" />
      </section>

      <section class="workflow-workspace__template">
        <ApplicationWorkflowTemplateCard
          v-model="workspace.selectedTemplateId.value"
          :options="workspace.templateOptions.value"
          :selected-template="workspace.selectedTemplate.value
            ? {
                id: workspace.selectedTemplate.value.id,
                name: workspace.selectedTemplate.value.name,
                description: workspace.selectedTemplate.value.description || null,
                agentCount: workspace.selectedTemplate.value.agents?.length || 0,
                tagCount: workspace.selectedTemplate.value.tags?.length || 0,
                sourceType: workspace.selectedTemplate.value.sourceType || 'unknown',
                updatedAt: workspace.selectedTemplate.value.updatedAt || null,
              }
            : null"
          :role-alignment="workspace.roleAlignment.value"
          :applying="workspace.isApplyingTemplate.value"
          @apply="handleApplyTemplate"
        />
      </section>

      <ApplicationWorkflowEditorCard
        :workflow-name="workspace.workflowName.value"
        :workflow-prompt="workspace.workflowPrompt.value"
        :workflow-config="workspace.workflowConfigDraft.value"
        :role-alignment="workspace.roleAlignment.value"
        :saving="workspace.isSaving.value"
        @update:workflow-name="workspace.workflowName.value = $event"
        @update:workflow-prompt="workspace.workflowPrompt.value = $event"
        @update:workflow-config="workspace.workflowConfigDraft.value = $event"
        @save="handleSaveWorkflow"
        @refresh="handleRefreshRuntime"
      />
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.workflow-workspace {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.workflow-workspace__top {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 16px;
}

@media (max-width: 1100px) {
  .workflow-workspace__top {
    grid-template-columns: 1fr;
  }
}
</style>
