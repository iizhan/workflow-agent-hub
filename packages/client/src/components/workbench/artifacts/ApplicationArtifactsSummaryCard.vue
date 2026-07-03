<script setup lang="ts">
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationArtifactsSummary } from '@/types/workbench/application'
import { useWorkbenchI18n as useWorkbenchLabels } from '@/composables/workbench/useWorkbenchI18n'

defineProps<{
  summary: ApplicationArtifactsSummary
}>()

const { t } = useWorkbenchI18n()
const { statusLabel } = useWorkbenchLabels()
</script>

<template>
  <article class="artifact-card">
    <div class="artifact-card__eyebrow">{{ t('workbench.artifacts.outputsOverview') }}</div>
    <div class="artifact-card__title">
      {{ summary.latestRegisteredArtifactTitle || summary.latestArtifactName || t('workbench.artifacts.noOutputSelectedYet') }}
    </div>
    <p class="artifact-card__body">
      {{ t('workbench.artifacts.outputRoot') }}: {{ summary.workflowArtifactRootDir || summary.rootDir || t('workbench.workflow.notConfigured') }}
    </p>
    <dl class="artifact-card__meta">
      <div>
        <dt>{{ t('workbench.artifacts.totalEntries') }}</dt>
        <dd>{{ summary.totalEntries }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.artifacts.files') }}</dt>
        <dd>{{ summary.fileCount }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.artifacts.registeredArtifacts') }}</dt>
        <dd>{{ summary.registeredArtifactCount }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.artifacts.folders') }}</dt>
        <dd>{{ summary.directoryCount }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.artifacts.unlinkedFiles') }}</dt>
        <dd>{{ summary.unlinkedFileCount }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.artifacts.executionStatus') }}</dt>
        <dd>{{ summary.runStatus ? statusLabel(summary.runStatus) : statusLabel('idle') }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.artifacts.activeStage') }}</dt>
        <dd>{{ summary.currentNodeTitle || t('workbench.system.na') }}</dd>
      </div>
      <div>
        <dt>{{ t('workbench.artifacts.currentPath') }}</dt>
        <dd>{{ summary.currentPath || '/' }}</dd>
      </div>
    </dl>
    <p v-if="summary.unlinkedFileCount > 0" class="artifact-card__note">
      {{ t('workbench.artifacts.unlinkedFilesHint', { count: summary.unlinkedFileCount }) }}
    </p>
  </article>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.artifact-card {
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-card;
  padding: 20px;
}

.artifact-card__eyebrow {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $accent-primary;
  font-weight: 700;
}

.artifact-card__title {
  margin-top: 10px;
  font-size: 20px;
  font-weight: 700;
  color: $text-primary;
}

.artifact-card__body {
  margin-top: 10px;
  color: $text-secondary;
}

.artifact-card__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
  margin-top: 18px;
}

.artifact-card__meta dt {
  font-size: 12px;
  text-transform: uppercase;
  color: $text-muted;
}

.artifact-card__meta dd {
  margin-top: 4px;
  color: $text-primary;
  word-break: break-word;
}

.artifact-card__note {
  margin-top: 16px;
  color: $text-secondary;
  line-height: 1.6;
}
</style>
