<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useFilesStore, isImageFile, isMarkdownFile, isTextFile } from '@/stores/hermes/files'
import FileTree from '@/components/hermes/files/FileTree.vue'
import FileBreadcrumb from '@/components/hermes/files/FileBreadcrumb.vue'
import FileToolbar from '@/components/hermes/files/FileToolbar.vue'
import FileList from '@/components/hermes/files/FileList.vue'
import FileContextMenu from '@/components/hermes/files/FileContextMenu.vue'
import FileEditor from '@/components/hermes/files/FileEditor.vue'
import FilePreview from '@/components/hermes/files/FilePreview.vue'
import FileUploadModal from '@/components/hermes/files/FileUploadModal.vue'
import FileRenameModal from '@/components/hermes/files/FileRenameModal.vue'
import type { FileEntry } from '@/api/hermes/files'

const router = useRouter()
const { t } = useI18n()
const filesStore = useFilesStore()

const contentShellRef = ref<HTMLDivElement | null>(null)
const contextMenuRef = ref<InstanceType<typeof FileContextMenu> | null>(null)
const showUpload = ref(false)
const showRenameModal = ref(false)
const renameMode = ref<'newFile' | 'newFolder' | 'rename'>('newFile')
const renameEntry = ref<FileEntry | null>(null)

const directoryCount = computed(() =>
  filesStore.entries.filter(entry => entry.isDir).length,
)

const fileCount = computed(() =>
  filesStore.entries.filter(entry => !entry.isDir).length,
)

const previewableCount = computed(() =>
  filesStore.entries.filter(entry =>
    !entry.isDir && (isImageFile(entry.name) || isMarkdownFile(entry.name) || isTextFile(entry.name)),
  ).length,
)

const currentMode = computed(() => {
  if (filesStore.editingFile) return 'editing'
  if (filesStore.previewFile) return 'preview'
  return 'list'
})

const currentModeLabel = computed(() => {
  if (currentMode.value === 'editing') return t('files.modeEditing')
  if (currentMode.value === 'preview') return t('files.modePreview')
  return t('files.modeBrowsing')
})

const currentLocationLabel = computed(() =>
  filesStore.currentPath || t('files.breadcrumbRoot'),
)

type PrimaryDecisionAction = 'focus-workspace' | 'open-applications'

const primaryDecision = computed(() => {
  if (filesStore.hasUnsavedChanges && filesStore.editingFile) {
    return {
      action: 'focus-workspace' as PrimaryDecisionAction,
      tone: 'warning' as const,
      eyebrow: t('files.primaryDecisionUnsavedEyebrow'),
      title: t('files.primaryDecisionUnsavedTitle'),
      body: t('files.primaryDecisionUnsavedBody', { path: filesStore.editingFile.path }),
      actionLabel: t('files.focusWorkspace'),
    }
  }

  if (filesStore.previewFile) {
    return {
      action: 'focus-workspace' as PrimaryDecisionAction,
      tone: 'accent' as const,
      eyebrow: t('files.primaryDecisionPreviewEyebrow'),
      title: t('files.primaryDecisionPreviewTitle'),
      body: t('files.primaryDecisionPreviewBody', { path: filesStore.previewFile.path }),
      actionLabel: t('files.focusWorkspace'),
    }
  }

  if (filesStore.currentPath) {
    return {
      action: 'focus-workspace' as PrimaryDecisionAction,
      tone: 'default' as const,
      eyebrow: t('files.primaryDecisionFolderEyebrow'),
      title: t('files.primaryDecisionFolderTitle'),
      body: t('files.primaryDecisionFolderBody', { path: filesStore.currentPath }),
      actionLabel: t('files.focusWorkspace'),
    }
  }

  if (filesStore.entries.length > 0) {
    return {
      action: 'focus-workspace' as PrimaryDecisionAction,
      tone: 'calm' as const,
      eyebrow: t('files.primaryDecisionWorkspaceEyebrow'),
      title: t('files.primaryDecisionWorkspaceTitle'),
      body: t('files.primaryDecisionWorkspaceBody'),
      actionLabel: t('files.focusWorkspace'),
    }
  }

  return {
    action: 'open-applications' as PrimaryDecisionAction,
    tone: 'calm' as const,
    eyebrow: t('files.primaryDecisionEmptyEyebrow'),
    title: t('files.primaryDecisionEmptyTitle'),
    body: t('files.primaryDecisionEmptyBody'),
    actionLabel: t('files.openApplications'),
  }
})

const decisionChecklist = computed(() => [
  { key: 'dirs', label: t('files.checklistDirectories'), count: directoryCount.value },
  { key: 'files', label: t('files.checklistFiles'), count: fileCount.value },
  { key: 'previewable', label: t('files.checklistPreviewable'), count: previewableCount.value },
  { key: 'editing', label: t('files.checklistEditing'), count: filesStore.editingFile ? 1 : 0 },
  { key: 'unsaved', label: t('files.checklistUnsaved'), count: filesStore.hasUnsavedChanges ? 1 : 0 },
])

function handleContextMenu(event: MouseEvent, entry: FileEntry) {
  contextMenuRef.value?.show(event, entry)
}

function handleShowNewFile() {
  renameMode.value = 'newFile'
  renameEntry.value = null
  showRenameModal.value = true
}

function handleShowNewFolder() {
  renameMode.value = 'newFolder'
  renameEntry.value = null
  showRenameModal.value = true
}

function handleRename(entry: FileEntry) {
  renameMode.value = 'rename'
  renameEntry.value = entry
  showRenameModal.value = true
}

function handlePrimaryDecision() {
  if (primaryDecision.value.action === 'open-applications') {
    router.push({ name: 'workbench.applications' })
    return
  }
  contentShellRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(() => {
  filesStore.fetchEntries('')
})
</script>

<template>
  <div class="files-page workbench-page">
    <section class="workbench-page__hero">
      <div class="workbench-page__hero-copy">
        <div class="workbench-page__eyebrow">{{ t('files.heroEyebrow') }}</div>
        <h1 class="workbench-page__title">{{ t('files.heroTitle') }}</h1>
        <p class="workbench-page__subtitle">{{ t('files.heroSubtitle') }}</p>
      </div>
      <div class="workbench-page__actions">
        <NButton secondary @click="router.push({ name: 'workbench.resources' })">
          {{ t('files.openResources') }}
        </NButton>
        <NButton type="primary" @click="router.push({ name: 'workbench.applications' })">
          {{ t('files.openApplications') }}
        </NButton>
      </div>
    </section>

    <section class="files-page__decision-grid">
      <article class="files-guide workbench-panel" :class="`files-guide--${primaryDecision.tone}`">
        <div class="workbench-section-title">{{ primaryDecision.eyebrow }}</div>
        <h2 class="files-guide__title">{{ primaryDecision.title }}</h2>
        <p class="files-guide__body">{{ primaryDecision.body }}</p>
        <div class="files-guide__points">
          <div class="files-guide__point">{{ t('files.guidePoint1') }}</div>
          <div class="files-guide__point">{{ t('files.guidePoint2') }}</div>
          <div class="files-guide__point">{{ t('files.guidePoint3') }}</div>
        </div>
        <div class="files-guide__actions">
          <NButton type="primary" @click="handlePrimaryDecision()">
            {{ primaryDecision.actionLabel }}
          </NButton>
          <NButton quaternary @click="router.push({ name: 'workbench.runs' })">
            {{ t('files.openRuns') }}
          </NButton>
        </div>
      </article>

      <article class="files-checklist workbench-panel workbench-panel--soft">
        <div class="workbench-section-title">{{ t('files.checklistEyebrow') }}</div>
        <h2 class="files-checklist__title">{{ t('files.checklistTitle') }}</h2>
        <p class="files-checklist__body">{{ t('files.checklistBody') }}</p>
        <div class="files-checklist__list">
          <div v-for="item in decisionChecklist" :key="item.key" class="files-checklist__item">
            <span class="files-checklist__label">{{ item.label }}</span>
            <span class="files-checklist__count">{{ item.count }}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="files-page__summary-grid">
      <article class="files-stat workbench-panel">
        <div class="files-stat__label">{{ t('files.summaryLocation') }}</div>
        <div class="files-stat__value files-stat__value--path">{{ currentLocationLabel }}</div>
        <div class="files-stat__meta">{{ t('files.summaryLocationMeta') }}</div>
      </article>

      <article class="files-stat workbench-panel">
        <div class="files-stat__label">{{ t('files.summaryMode') }}</div>
        <div class="files-stat__value">{{ currentModeLabel }}</div>
        <div class="files-stat__meta">{{ t('files.summaryModeMeta') }}</div>
      </article>

      <article class="files-stat workbench-panel">
        <div class="files-stat__label">{{ t('files.summaryEntries') }}</div>
        <div class="files-stat__value">{{ filesStore.entries.length }}</div>
        <div class="files-stat__meta">{{ t('files.summaryEntriesMeta') }}</div>
      </article>

      <article class="files-stat workbench-panel">
        <div class="files-stat__label">{{ t('files.summaryEditing') }}</div>
        <div class="files-stat__value">{{ filesStore.editingFile ? t('files.editingActive') : t('files.editingInactive') }}</div>
        <div class="files-stat__meta">
          {{
            filesStore.editingFile
              ? filesStore.editingFile.path
              : t('files.summaryEditingMeta')
          }}
        </div>
      </article>
    </section>

    <section class="files-page__content">
      <div ref="contentShellRef" class="files-shell workbench-panel workbench-panel--soft">
        <header class="page-header files-shell__header">
          <div class="files-shell__title-group">
            <h2 class="header-title">{{ t('files.title') }}</h2>
            <p class="files-shell__subtitle">{{ t('files.panelSubtitle') }}</p>
          </div>
        </header>

        <div class="files-view">
          <div class="files-tree-panel">
            <FileTree />
          </div>
          <div class="files-main-panel">
            <FileToolbar
              @show-new-file="handleShowNewFile"
              @show-new-folder="handleShowNewFolder"
              @show-upload="showUpload = true"
            />
            <FileBreadcrumb />
            <div class="files-content">
              <FileEditor v-if="filesStore.editingFile" />
              <FilePreview v-else-if="filesStore.previewFile" />
              <FileList v-else @contextmenu-entry="handleContextMenu" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <FileContextMenu ref="contextMenuRef" @rename="handleRename" />
    <FileUploadModal v-model:show="showUpload" />
    <FileRenameModal v-model:show="showRenameModal" :mode="renameMode" :entry="renameEntry" />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.files-page {
  min-height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
}

.files-page__decision-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 16px;
  padding: 0 24px 16px;
}

.files-guide {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.files-guide--warning {
  background:
    linear-gradient(135deg, rgba(178, 75, 66, 0.08), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.files-guide--accent {
  background:
    linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.09), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.files-guide__title,
.files-checklist__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  color: $text-primary;
}

.files-guide__body,
.files-checklist__body,
.files-shell__subtitle {
  color: $text-secondary;
  line-height: 1.7;
}

.files-guide__points,
.files-checklist__list {
  display: grid;
  gap: 10px;
}

.files-guide__point,
.files-checklist__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: rgba(255, 255, 255, 0.82);
}

.files-guide__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: auto;
}

.files-checklist__label,
.files-stat__label {
  color: $text-secondary;
}

.files-checklist__count,
.files-stat__value {
  font-size: 28px;
  font-weight: 700;
  color: $text-primary;
}

.files-stat__value--path {
  font-size: 20px;
  word-break: break-all;
}

.files-page__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 0 24px 16px;
}

.files-stat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 142px;
}

.files-stat__meta {
  color: $text-muted;
  line-height: 1.6;
  word-break: break-word;
}

.files-page__content {
  flex: 1;
  min-height: 0;
  padding: 0 24px 24px;
}

.files-shell {
  padding: 0;
  overflow: hidden;
}

.files-shell__header {
  padding: 18px 20px;
}

.files-shell__title-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.files-view {
  display: flex;
  min-height: 720px;
  overflow: hidden;
  flex: 1;
}

.files-tree-panel {
  width: 240px;
  min-width: 180px;
  max-width: 400px;
  border-right: 1px solid $border-color;
  overflow-y: auto;
  flex-shrink: 0;
}

.files-main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.files-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

@media (max-width: 1100px) {
  .files-page__decision-grid,
  .files-page__summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: $breakpoint-mobile) {
  .files-page__decision-grid,
  .files-page__summary-grid,
  .files-page__content {
    padding-left: 12px;
    padding-right: 12px;
  }

  .files-shell__header {
    padding: 16px 12px 12px;
  }

  .files-checklist__count,
  .files-stat__value {
    font-size: 22px;
  }

  .files-view {
    flex-direction: column;
    min-height: 640px;
  }

  .files-tree-panel {
    width: 100%;
    max-width: none;
    height: 200px;
    border-right: none;
    border-bottom: 1px solid $border-color;
  }
}
</style>
