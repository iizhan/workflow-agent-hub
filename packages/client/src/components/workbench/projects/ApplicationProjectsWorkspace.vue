<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { NButton, NInput, NModal, NSelect, NSpin, useMessage } from 'naive-ui'
import FolderPicker from '@/components/hermes/chat/FolderPicker.vue'
import ApplicationProjectExplorerCard from './ApplicationProjectExplorerCard.vue'
import ApplicationProjectReadinessCard from './ApplicationProjectReadinessCard.vue'
import ApplicationProjectSummaryCard from './ApplicationProjectSummaryCard.vue'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import { useApplicationProjectWorkspace } from '@/composables/workbench/useApplicationProjectWorkspace'
import type { ApplicationDetail } from '@/types/workbench/application'

const props = defineProps<{
  application: ApplicationDetail
}>()

const message = useMessage()
const applicationId = toRef(() => props.application.id)
const workspace = useApplicationProjectWorkspace(applicationId)
const { t } = useWorkbenchI18n()
const showLocalFolderPicker = ref(false)

const hasProject = computed(() => !!workspace.currentProject.value.projectId)

function inferNameFromPath(path: string): string {
  const normalized = path.trim().replace(/[\\/]+$/, '')
  if (!normalized) return ''
  const segments = normalized.split(/[\\/]/).filter(Boolean)
  return segments[segments.length - 1] || ''
}

function applyLocalProjectPath(path: string | null) {
  const normalized = String(path || '').trim()
  if (!normalized) return
  workspace.localProjectPath.value = normalized
  if (!workspace.localProjectName.value.trim()) {
    workspace.localProjectName.value = inferNameFromPath(normalized)
  }
  showLocalFolderPicker.value = false
}

async function handleBindExisting() {
  try {
    await workspace.bindExistingProject()
    message.success(t('workbench.projects.contextProjectConnected'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.projects.connectContextProjectFailed')))
  }
}

async function handleBindLocal() {
  try {
    await workspace.bindLocalProject()
    message.success(t('workbench.projects.localContextProjectConnected'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.projects.connectLocalContextProjectFailed')))
  }
}

async function handleOpenEntry(path: string, type: 'file' | 'directory') {
  try {
    await workspace.openProjectPath(path, type)
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.projects.openProjectPathFailed')))
  }
}

async function handleOpenParent() {
  try {
    await workspace.openProjectParent()
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.projects.openParentDirectoryFailed')))
  }
}

async function handleRefreshGit() {
  try {
    await workspace.refreshGitSummary()
    message.success(t('workbench.projects.gitContextRefreshed'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.projects.refreshGitContextFailed')))
  }
}
</script>

<template>
  <div class="projects-workspace">
    <NSpin :show="workspace.isLoading.value || workspace.isBinding.value">
      <section class="projects-workspace__grid">
        <ApplicationProjectSummaryCard :project="workspace.currentProject.value" />
        <ApplicationProjectReadinessCard :readiness="workspace.readiness.value" />
      </section>

      <section class="projects-workspace__bind">
        <article class="bind-card workbench-panel workbench-panel--soft">
          <div class="bind-card__eyebrow workbench-section-title">{{ t('workbench.projects.reuseExistingProjectContext') }}</div>
          <NSelect
            v-model:value="workspace.selectedExistingProjectId.value"
            :options="workspace.availableProjectOptions.value"
            clearable
            filterable
            :placeholder="t('workbench.projects.choosePreviouslyConnectedProject')"
          />
          <div class="bind-card__actions">
            <NButton secondary :disabled="!workspace.selectedExistingProjectId.value" @click="handleBindExisting">
              {{ t('workbench.projects.connectProjectContext') }}
            </NButton>
          </div>
        </article>

        <article class="bind-card workbench-panel workbench-panel--soft">
          <div class="bind-card__eyebrow workbench-section-title">{{ t('workbench.projects.attachLocalProjectContext') }}</div>
          <div class="bind-card__fields">
            <div class="bind-card__path-row">
              <NInput v-model:value="workspace.localProjectPath.value" :placeholder="t('workbench.projects.localProjectPathPlaceholder')" />
              <NButton secondary @click="showLocalFolderPicker = true">
                {{ t('workbench.projects.browseWorkspaceFolders') }}
              </NButton>
            </div>
            <p class="bind-card__hint">{{ t('workbench.projects.localProjectPickerHint') }}</p>
            <NInput v-model:value="workspace.localProjectName.value" :placeholder="t('workbench.projects.optionalWorkspaceNamePlaceholder')" />
            <NInput
              v-model:value="workspace.localProjectDescription.value"
              type="textarea"
              :placeholder="t('workbench.projects.optionalContextSummaryPlaceholder')"
            />
          </div>
          <div class="bind-card__actions">
            <NButton type="primary" :disabled="!workspace.localProjectPath.value.trim()" @click="handleBindLocal">
              {{ t('workbench.projects.connectLocalContext') }}
            </NButton>
          </div>
        </article>
      </section>

      <ApplicationProjectExplorerCard
        :explorer="workspace.explorer.value"
        :has-project="hasProject"
        @open-entry="handleOpenEntry"
        @open-parent="handleOpenParent"
        @refresh-git="handleRefreshGit"
      />
    </NSpin>

    <NModal v-model:show="showLocalFolderPicker" preset="card" :title="t('workbench.projects.selectLocalProjectDirectory')" style="width: 760px; max-width: calc(100vw - 32px);">
      <FolderPicker v-model="workspace.localProjectPath.value" />
      <template #footer>
        <div class="bind-card__modal-footer">
          <NButton @click="showLocalFolderPicker = false">{{ t('common.cancel') }}</NButton>
          <NButton type="primary" :disabled="!workspace.localProjectPath.value.trim()" @click="applyLocalProjectPath(workspace.localProjectPath.value)">
            {{ t('workbench.projects.useSelectedDirectory') }}
          </NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.projects-workspace {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.projects-workspace__grid,
.projects-workspace__bind {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.bind-card {
}

.bind-card__eyebrow {
}

.bind-card__fields {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.bind-card__path-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.bind-card__hint {
  margin: 0;
  color: $text-muted;
  font-size: 13px;
  line-height: 1.6;
}

.bind-card__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.bind-card__modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 1100px) {
  .projects-workspace__grid,
  .projects-workspace__bind {
    grid-template-columns: 1fr;
  }

  .bind-card__path-row {
    grid-template-columns: 1fr;
  }
}
</style>
