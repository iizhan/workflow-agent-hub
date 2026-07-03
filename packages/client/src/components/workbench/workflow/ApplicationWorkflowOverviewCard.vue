<script setup lang="ts">
import { computed } from 'vue'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationWorkflowSummary } from '@/types/workbench/application'

const props = defineProps<{
  summary: ApplicationWorkflowSummary
}>()

const { t } = useWorkbenchI18n()
const modeLabel = computed(() => props.summary.mode === 'stage-gated' ? t('workbench.settings.stageGated') : t('workbench.settings.freeform'))
</script>

<template>
  <article class="workflow-card">
    <div class="workflow-card__eyebrow">{{ t('workbench.workflow.overview') }}</div>
    <div class="workflow-card__title">
      {{ summary.workflowName || t('workbench.workflow.unnamedExecutionFlow') }}
    </div>
    <p class="workflow-card__body">
      {{ summary.workflowPrompt || t('workbench.workflow.noFlowBrief') }}
    </p>

    <dl class="workflow-card__meta">
      <div>
        <dt>{{ t('workbench.workflow.flowMode') }}</dt>
        <dd>{{ modeLabel }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.workflow.stages') }}</dt>
        <dd>{{ summary.stageCount }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.workflow.nodes') }}</dt>
        <dd>{{ summary.graphNodeCount }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.workflow.edges') }}</dt>
        <dd>{{ summary.graphEdgeCount }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.workflow.flowOwner') }}</dt>
        <dd>{{ summary.ownerUserName || summary.ownerRoleName || t('workbench.workflow.notConfigured') }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.workflow.outputRoot') }}</dt>
        <dd>{{ summary.artifactRootDir || t('workbench.workflow.notConfigured') }}</dd>
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

.workflow-card__title {
  margin-top: 10px;
  font-size: 22px;
  font-weight: 700;
  color: $text-primary;
}

.workflow-card__body {
  margin-top: 10px;
  color: $text-secondary;
  line-height: 1.6;
}

.workflow-card__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
  margin-top: 18px;
}

.workflow-card__meta dt {
  font-size: 12px;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.workflow-card__meta dd {
  margin-top: 4px;
  color: $text-primary;
  word-break: break-word;
}
</style>
