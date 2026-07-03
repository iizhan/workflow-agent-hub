<script setup lang="ts">
import { computed } from 'vue'
import { NButton } from 'naive-ui'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationArtifactsGitState } from '@/types/workbench/application'

const props = defineProps<{
  gitState: ApplicationArtifactsGitState
}>()

const emit = defineEmits<{
  refresh: []
  'open-change': [path: string]
}>()

const { t } = useWorkbenchI18n()

const selectedPreviewHint = computed(() => {
  if (props.gitState.selectedContentMode === 'text') {
    return t('workbench.artifacts.gitPreviewUntrackedHint')
  }
  if (props.gitState.selectedContentMode === 'binary') {
    return t('workbench.artifacts.gitPreviewBinaryHint')
  }
  if (props.gitState.selectedContentMode === 'empty' && props.gitState.selectedPath) {
    return t('workbench.artifacts.gitPreviewEmptyHint')
  }
  return ''
})

function kindLabel(kind: ApplicationArtifactsGitState['selectedKind'] | ApplicationArtifactsGitState['changes'][number]['kind'] | null) {
  if (kind === 'staged') return t('workbench.artifacts.gitKindStaged')
  if (kind === 'modified') return t('workbench.artifacts.gitKindModified')
  if (kind === 'untracked') return t('workbench.artifacts.gitKindUntracked')
  if (kind === 'mixed') return t('workbench.artifacts.gitKindMixed')
  if (kind === 'conflicted') return t('workbench.artifacts.gitKindConflicted')
  return t('workbench.system.na')
}
</script>

<template>
  <article class="artifacts-git-card workbench-panel workbench-panel--soft">
    <div class="artifacts-git-card__header">
      <div>
        <div class="artifacts-git-card__eyebrow workbench-section-title">{{ t('workbench.artifacts.gitEyebrow') }}</div>
        <div class="artifacts-git-card__title">{{ t('workbench.artifacts.gitTitle') }}</div>
        <p class="artifacts-git-card__body">
          {{ gitState.projectName || t('workbench.artifacts.gitNoProjectTitle') }}
          <template v-if="gitState.projectLocalPath"> · {{ gitState.projectLocalPath }}</template>
        </p>
      </div>
      <NButton secondary size="small" :disabled="!gitState.hasProject" @click="emit('refresh')">
        {{ t('workbench.artifacts.gitRefresh') }}
      </NButton>
    </div>

    <div v-if="!gitState.hasProject" class="artifacts-git-card__empty">
      {{ t('workbench.artifacts.gitNoProjectBody') }}
    </div>
    <div v-else-if="!gitState.gitEnabled" class="artifacts-git-card__empty">
      {{ t('workbench.artifacts.gitDisabledBody') }}
    </div>
    <template v-else>
      <div class="artifacts-git-card__summary">
        <div class="artifacts-git-card__metric workbench-kv-card">
          <div class="artifacts-git-card__metric-label">{{ t('workbench.artifacts.gitBranch') }}</div>
          <div class="artifacts-git-card__metric-value">{{ gitState.currentBranch || t('workbench.projects.noBranchDetected') }}</div>
        </div>
        <div class="artifacts-git-card__metric workbench-kv-card">
          <div class="artifacts-git-card__metric-label">{{ t('workbench.artifacts.gitChanges') }}</div>
          <div class="artifacts-git-card__metric-value">
            {{ t('workbench.artifacts.gitCounts', {
              count: gitState.changeCount,
              staged: gitState.stagedCount,
              modified: gitState.modifiedCount,
              untracked: gitState.untrackedCount,
            }) }}
          </div>
        </div>
        <div class="artifacts-git-card__metric workbench-kv-card">
          <div class="artifacts-git-card__metric-label">{{ t('workbench.artifacts.gitSync') }}</div>
          <div class="artifacts-git-card__metric-value">
            {{ t('workbench.artifacts.gitAheadBehind', { ahead: gitState.aheadCount, behind: gitState.behindCount }) }}
          </div>
        </div>
      </div>

      <div class="artifacts-git-card__layout">
        <div class="artifacts-git-card__list workbench-soft-block">
          <div class="artifacts-git-card__panel-title">{{ t('workbench.artifacts.gitChangedFiles') }}</div>
          <div v-if="!gitState.changes.length" class="artifacts-git-card__empty">
            {{ t('workbench.artifacts.gitNoChanges') }}
          </div>
          <button
            v-for="change in gitState.changes"
            :key="change.relativePath"
            type="button"
            class="artifacts-git-card__change"
            :class="{ 'artifacts-git-card__change--selected': gitState.selectedPath === change.relativePath }"
            @click="emit('open-change', change.relativePath)"
          >
            <span class="artifacts-git-card__change-copy">
              <strong>{{ change.displayPath }}</strong>
              <small>{{ kindLabel(change.kind) }}</small>
            </span>
            <span class="artifacts-git-card__change-kind" :data-kind="change.kind">{{ kindLabel(change.kind) }}</span>
          </button>
        </div>

        <div class="artifacts-git-card__preview workbench-soft-block">
          <div class="artifacts-git-card__panel-title">{{ t('workbench.artifacts.gitPreview') }}</div>
          <div v-if="gitState.selectedPath" class="artifacts-git-card__preview-meta">
            <div>{{ gitState.selectedDisplayPath }}</div>
            <div>{{ kindLabel(gitState.selectedKind) }}</div>
          </div>
          <div v-if="!gitState.selectedPath" class="artifacts-git-card__empty">
            {{ t('workbench.artifacts.gitSelectToPreview') }}
          </div>
          <template v-else>
            <p v-if="selectedPreviewHint" class="artifacts-git-card__preview-note">{{ selectedPreviewHint }}</p>
            <p v-if="gitState.selectedTruncated" class="artifacts-git-card__preview-note">
              {{ t('workbench.artifacts.gitPreviewTruncated') }}
            </p>
            <pre
              v-if="gitState.selectedContentMode !== 'binary' && gitState.selectedContent"
              class="artifacts-git-card__preview-content"
            >{{ gitState.selectedContent }}</pre>
            <div
              v-else-if="gitState.selectedContentMode === 'binary'"
              class="artifacts-git-card__empty"
            >
              {{ t('workbench.artifacts.gitPreviewBinaryEmpty') }}
            </div>
            <div
              v-else-if="gitState.selectedContentMode === 'empty'"
              class="artifacts-git-card__empty"
            >
              {{ t('workbench.artifacts.gitPreviewEmpty') }}
            </div>
          </template>
        </div>
      </div>
    </template>
  </article>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.artifacts-git-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.artifacts-git-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.artifacts-git-card__title {
  color: $text-primary;
  font-size: 18px;
  font-weight: 700;
}

.artifacts-git-card__body {
  margin-top: 8px;
  color: $text-secondary;
  line-height: 1.6;
  word-break: break-word;
}

.artifacts-git-card__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.artifacts-git-card__metric-label {
  font-size: 12px;
  color: $text-muted;
}

.artifacts-git-card__metric-value {
  margin-top: 8px;
  color: $text-primary;
  line-height: 1.6;
}

.artifacts-git-card__layout {
  display: grid;
  grid-template-columns: 0.92fr 1.08fr;
  gap: 16px;
}

.artifacts-git-card__list,
.artifacts-git-card__preview {
  min-height: 360px;
}

.artifacts-git-card__panel-title {
  color: $text-primary;
  font-weight: 700;
  margin-bottom: 12px;
}

.artifacts-git-card__empty {
  color: $text-secondary;
  line-height: 1.7;
}

.artifacts-git-card__change {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  padding: 12px 14px;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: rgba(var(--accent-primary-rgb), 0.03);
  cursor: pointer;
}

.artifacts-git-card__change + .artifacts-git-card__change {
  margin-top: 10px;
}

.artifacts-git-card__change--selected {
  border-color: rgba(var(--accent-primary-rgb), 0.5);
  background: rgba(var(--accent-primary-rgb), 0.08);
}

.artifacts-git-card__change-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.artifacts-git-card__change-copy strong {
  color: $text-primary;
  word-break: break-word;
}

.artifacts-git-card__change-copy small {
  color: $text-muted;
}

.artifacts-git-card__change-kind {
  color: $text-primary;
  font-size: 12px;
  white-space: nowrap;
}

.artifacts-git-card__change-kind[data-kind='conflicted'] {
  color: $error;
}

.artifacts-git-card__change-kind[data-kind='mixed'] {
  color: $warning;
}

.artifacts-git-card__preview-meta {
  margin-bottom: 12px;
  color: $text-secondary;
  line-height: 1.6;
  word-break: break-word;
}

.artifacts-git-card__preview-note {
  margin-bottom: 10px;
  color: $text-muted;
  line-height: 1.6;
}

.artifacts-git-card__preview-content {
  margin: 0;
  padding: 14px;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: rgba($bg-card, 0.75);
  color: $text-primary;
  font-family: $font-code;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 520px;
  overflow: auto;
}

@media (max-width: 1100px) {
  .artifacts-git-card__header {
    flex-direction: column;
  }

  .artifacts-git-card__summary,
  .artifacts-git-card__layout {
    grid-template-columns: 1fr;
  }
}
</style>
