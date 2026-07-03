<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NSelect } from 'naive-ui'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type {
  ApplicationWorkflowRoleAlignment,
  ApplicationWorkflowTemplateSummary,
} from '@/types/workbench/application'

const props = defineProps<{
  modelValue: string | null
  options: Array<{ label: string; value: string }>
  selectedTemplate: ApplicationWorkflowTemplateSummary | null
  roleAlignment: ApplicationWorkflowRoleAlignment
  applying: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  apply: [syncAgents: boolean]
}>()

const hasMissingRoles = computed(() => props.roleAlignment.missingRoles.length > 0)
const { t } = useWorkbenchI18n()
</script>

<template>
  <article class="workflow-card">
    <div class="workflow-card__eyebrow">{{ t('workbench.workflow.flowTemplates') }}</div>
    <NSelect
      :value="modelValue"
      :options="options"
      clearable
      filterable
      :placeholder="t('workbench.workflow.chooseTemplatePlaceholder')"
      @update:value="emit('update:modelValue', $event)"
    />

    <div v-if="selectedTemplate" class="workflow-template__meta">
      <div class="workflow-template__title">{{ selectedTemplate.name }}</div>
      <div class="workflow-template__desc">
        {{ selectedTemplate.description || t('workbench.workflow.noTemplateBrief') }}
      </div>
      <div class="workflow-template__stats">
        {{ t('workbench.workflow.templateStats', { agents: selectedTemplate.agentCount, tags: selectedTemplate.tagCount, source: selectedTemplate.sourceType }) }}
      </div>
      <div v-if="hasMissingRoles" class="workflow-template__warning">
        {{ t('workbench.workflow.missingRolesAfterApply', { roles: roleAlignment.missingRoles.join('、') }) }}
      </div>
    </div>

    <div class="workflow-template__actions">
      <NButton secondary :disabled="!modelValue" :loading="applying" @click="emit('apply', false)">
        {{ t('workbench.workflow.loadFlowDraftOnly') }}
      </NButton>
      <NButton type="primary" :disabled="!modelValue" :loading="applying" @click="emit('apply', true)">
        {{ t('workbench.workflow.loadDraftAndAddRoles') }}
      </NButton>
    </div>
    <p v-if="selectedTemplate" class="workflow-template__hint">
      {{ t('workbench.workflow.templateApplyBoundaryHint') }}
    </p>
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
  margin-bottom: 14px;
}

.workflow-template__meta {
  margin-top: 14px;
}

.workflow-template__title {
  font-size: 16px;
  font-weight: 700;
  color: $text-primary;
}

.workflow-template__desc,
.workflow-template__stats {
  margin-top: 8px;
  color: $text-secondary;
  line-height: 1.5;
}

.workflow-template__warning {
  margin-top: 10px;
  color: $warning;
}

.workflow-template__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.workflow-template__hint {
  margin-top: 12px;
  color: $text-muted;
  line-height: 1.6;
}
</style>
