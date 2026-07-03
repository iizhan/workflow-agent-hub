<script setup lang="ts">
import { NButton } from 'naive-ui'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationProjectExplorerState } from '@/types/workbench/application'

defineProps<{
  explorer: ApplicationProjectExplorerState
  hasProject: boolean
}>()

const emit = defineEmits<{
  openEntry: [path: string, type: 'file' | 'directory']
  openParent: []
  refreshGit: []
}>()

const { t } = useWorkbenchI18n()
</script>

<template>
  <article class="explorer-card workbench-panel workbench-panel--soft">
    <div class="explorer-card__header">
      <div>
        <div class="explorer-card__eyebrow workbench-section-title">{{ t('workbench.projects.workspaceExplorerAndGit') }}</div>
        <div class="explorer-card__path">{{ explorer.currentPath || '/' }}</div>
      </div>
      <div class="explorer-card__actions">
        <NButton size="small" secondary :disabled="!explorer.currentPath" @click="emit('openParent')">{{ t('workbench.projects.openParent') }}</NButton>
        <NButton size="small" secondary :disabled="!hasProject" @click="emit('refreshGit')">{{ t('workbench.projects.refreshGitContext') }}</NButton>
      </div>
    </div>

    <div class="explorer-grid">
      <div class="explorer-panel workbench-soft-block">
        <div class="explorer-panel__title">{{ t('workbench.projects.workspaceFiles') }}</div>
        <div v-if="!hasProject" class="explorer-empty">{{ t('workbench.projects.connectProjectToBrowse') }}</div>
        <div v-else-if="!explorer.entries.length" class="explorer-empty">{{ t('workbench.projects.noWorkspaceFilesLoaded') }}</div>
        <button
          v-for="entry in explorer.entries"
          :key="entry.path"
          type="button"
          class="explorer-entry"
          @click="emit('openEntry', entry.path, entry.type)"
        >
          <div class="explorer-entry__name">{{ entry.name }}</div>
          <div class="explorer-entry__meta">{{ entry.type === 'directory' ? t('workbench.projects.folder') : t('workbench.projects.fileSize', { size: entry.size }) }}</div>
        </button>
      </div>

      <div class="explorer-panel workbench-soft-block">
        <div class="explorer-panel__title">{{ t('workbench.projects.preview') }}</div>
        <div v-if="explorer.currentFile" class="explorer-preview">
          <div class="explorer-preview__path">{{ explorer.currentFile.relativePath }}</div>
          <pre class="explorer-preview__content">{{ explorer.currentFile.content }}</pre>
        </div>
        <div v-else class="explorer-empty">{{ t('workbench.projects.selectFileToPreview') }}</div>
      </div>
    </div>

    <div class="git-grid">
      <div class="git-card workbench-kv-card">
        <div class="git-card__label">{{ t('workbench.projects.gitSummary') }}</div>
        <div class="git-card__value">
          <template v-if="explorer.gitStatus">
            {{ explorer.gitStatus.currentBranch || t('workbench.projects.noBranchDetected') }} ·
            {{ t('workbench.projects.gitCounts', {
              staged: explorer.gitStatus.staged.length,
              modified: explorer.gitStatus.modified.length,
              untracked: explorer.gitStatus.untracked.length,
            }) }}
          </template>
          <template v-else>
            {{ t('workbench.projects.gitSummaryUnavailable') }}
          </template>
        </div>
      </div>

      <div class="git-card workbench-kv-card">
        <div class="git-card__label">{{ t('workbench.projects.localBranches') }}</div>
        <div class="git-card__value">
          {{ explorer.gitBranches?.localBranches.join(', ') || t('workbench.projects.branchesUnavailable') }}
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.explorer-card {}

.explorer-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.explorer-card__eyebrow {}

.explorer-card__path {
  margin-top: 8px;
  color: $text-secondary;
  font-family: $font-code;
  font-size: 12px;
}

.explorer-card__actions {
  display: flex;
  gap: 8px;
}

.explorer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.explorer-panel {
  min-height: 280px;
  overflow: hidden;
}

.explorer-panel__title {
  padding: 12px 14px;
  border-bottom: 1px solid $border-light;
  font-weight: 600;
  color: $text-primary;
}

.explorer-empty {
  padding: 18px 14px;
  color: $text-secondary;
}

.explorer-entry {
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  border-top: 1px solid $border-light;
  padding: 12px 14px;
  cursor: pointer;
}

.explorer-entry__name {
  color: $text-primary;
  font-weight: 500;
}

.explorer-entry__meta {
  margin-top: 4px;
  color: $text-muted;
  font-size: 12px;
}

.explorer-preview__path {
  padding: 12px 14px 0;
  color: $text-muted;
  font-size: 12px;
  font-family: $font-code;
}

.explorer-preview__content {
  margin: 0;
  padding: 12px 14px 14px;
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
  color: $text-primary;
  font-family: $font-code;
  font-size: 12px;
}

.git-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.git-card {}

.git-card__label {
  font-size: 12px;
  color: $text-muted;
}

.git-card__value {
  margin-top: 8px;
  color: $text-primary;
  line-height: 1.5;
}

@media (max-width: 1100px) {
  .explorer-grid,
  .git-grid {
    grid-template-columns: 1fr;
  }

  .explorer-card__header {
    flex-direction: column;
  }
}
</style>
