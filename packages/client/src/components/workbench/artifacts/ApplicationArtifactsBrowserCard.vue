<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NInput } from 'naive-ui'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationArtifactEntry, ApplicationArtifactPreview, ApplicationRunHistoryItem } from '@/types/workbench/application'

const props = defineProps<{
  currentPath: string
  entries: ApplicationArtifactEntry[]
  runHistory: ApplicationRunHistoryItem[]
  currentArtifact: ApplicationArtifactPreview | null
}>()

const emit = defineEmits<{
  'open-entry': [path: string, type: 'file' | 'directory']
  'open-parent': []
  'continue-from-artifact': [path: string]
  'open-source-run': [runNumber: number]
  refresh: []
}>()

const { t, locale, statusLabel } = useWorkbenchI18n()
const collapsedGroups = ref<Record<string, boolean>>({})

interface ArtifactEntryGroup {
  key: string
  title: string
  entries: ApplicationArtifactEntry[]
  runSummary: ApplicationRunHistoryItem | null
}

const groupedEntries = computed<ArtifactEntryGroup[]>(() => {
  const groups = new Map<string, ArtifactEntryGroup>()

  function ensureGroup(key: string, title: string, runSummary: ApplicationRunHistoryItem | null = null) {
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title,
        entries: [],
        runSummary,
      })
    }
    return groups.get(key)!
  }

  for (const entry of props.entries) {
    if (entry.type === 'directory') {
      ensureGroup('directories', t('workbench.artifacts.directoryGroup')).entries.push(entry)
      continue
    }

    if (entry.sourceRunNumber) {
      const runSummary = props.runHistory.find(item => item.runNumber === entry.sourceRunNumber) || null
      ensureGroup(
        `run-${entry.sourceRunNumber}`,
        t('workbench.artifacts.runGroup', { number: entry.sourceRunNumber }),
        runSummary,
      ).entries.push(entry)
      continue
    }

    ensureGroup('unlinked', t('workbench.artifacts.unlinkedGroup')).entries.push(entry)
  }

  return Array.from(groups.values())
})

function isGroupCollapsed(key: string) {
  return collapsedGroups.value[key] === true
}

function toggleGroup(key: string) {
  collapsedGroups.value[key] = !collapsedGroups.value[key]
}

function groupStatusLabel(group: ArtifactEntryGroup) {
  if (!group.runSummary) return ''
  if (group.runSummary.status === 'cancelled') return t('workbench.runs.historyStatusCancelled')
  if (group.runSummary.status === 'idle' || group.runSummary.status === 'running' || group.runSummary.status === 'paused' || group.runSummary.status === 'completed' || group.runSummary.status === 'failed') {
    return statusLabel(group.runSummary.status)
  }
  return group.runSummary.status
}

function groupActorLabel(group: ArtifactEntryGroup) {
  return group.runSummary?.latestActorAgentName || ''
}

function formatGroupTime(value: number | null) {
  if (!value) return ''
  return new Date(value).toLocaleString(locale.value, {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function groupHandledAtLabel(group: ArtifactEntryGroup) {
  return formatGroupTime(group.runSummary?.latestActivityAt || null)
}
</script>

<template>
  <article class="artifact-browser-card">
    <div class="artifact-browser-card__header">
      <div>
        <div class="artifact-browser-card__eyebrow">{{ t('workbench.artifacts.outputsBrowser') }}</div>
        <div class="artifact-browser-card__path">{{ currentPath || '/' }}</div>
      </div>
      <div class="artifact-browser-card__actions">
        <NButton secondary :disabled="!currentPath" @click="emit('open-parent')">{{ t('workbench.artifacts.openParent') }}</NButton>
        <NButton secondary @click="emit('refresh')">{{ t('workbench.artifacts.refreshOutputs') }}</NButton>
      </div>
    </div>

    <div class="artifact-browser-card__layout">
      <div class="artifact-browser-card__list">
        <div v-if="entries.length === 0" class="artifact-browser-card__empty">
          {{ t('workbench.artifacts.noOutputsAvailable') }}
        </div>
        <div v-for="group in groupedEntries" :key="group.key" class="artifact-entry-group">
          <button type="button" class="artifact-entry-group__header" @click="toggleGroup(group.key)">
            <span class="artifact-entry-group__copy">
              <span class="artifact-entry-group__title">
                {{ group.title }}
              </span>
              <span class="artifact-entry-group__meta">
                {{ t('workbench.artifacts.groupCount', { count: group.entries.length }) }}
                <template v-if="groupActorLabel(group)">
                  · {{ t('workbench.artifacts.groupLatestActor', { actor: groupActorLabel(group) }) }}
                </template>
                <template v-if="groupHandledAtLabel(group)">
                  · {{ t('workbench.artifacts.groupLatestHandledAt', { time: groupHandledAtLabel(group) }) }}
                </template>
              </span>
            </span>
            <span class="artifact-entry-group__status">
              <span v-if="group.runSummary" class="artifact-entry-group__pill">
                {{ groupStatusLabel(group) }}
              </span>
              <span v-if="group.runSummary?.pendingApprovalCount" class="artifact-entry-group__pill artifact-entry-group__pill--warning">
                {{ t('workbench.artifacts.groupPendingApproval', { count: group.runSummary.pendingApprovalCount }) }}
              </span>
              <span v-if="group.runSummary?.rejectedNodeCount" class="artifact-entry-group__pill artifact-entry-group__pill--danger">
                {{ t('workbench.artifacts.groupRejected', { count: group.runSummary.rejectedNodeCount }) }}
              </span>
              <span class="artifact-entry-group__toggle">
                {{ isGroupCollapsed(group.key) ? t('common.expand') : t('common.collapse') }}
              </span>
            </span>
          </button>
          <div v-if="!isGroupCollapsed(group.key)" class="artifact-entry-group__items">
            <button
              v-for="entry in group.entries"
              :key="entry.relativePath || entry.name"
              class="artifact-entry"
              :class="{ 'artifact-entry--selected': currentArtifact?.relativePath === entry.relativePath }"
              @click="emit('open-entry', entry.relativePath, entry.type)"
            >
              <span class="artifact-entry__icon">{{ entry.type === 'directory' ? t('workbench.artifacts.dirShort') : t('workbench.artifacts.fileShort') }}</span>
              <span class="artifact-entry__copy">
                <strong>{{ entry.name }}</strong>
                <small>{{ entry.type === 'directory' ? t('workbench.artifacts.folder') : t('workbench.artifacts.fileSize', { size: entry.size }) }}</small>
                <small v-if="entry.sourceRunNumber" class="artifact-entry__meta">
                  {{ t('workbench.artifacts.sourceRunBadge', { number: entry.sourceRunNumber }) }}
                </small>
              </span>
            </button>
          </div>
        </div>
      </div>

      <div class="artifact-browser-card__preview">
        <div class="artifact-browser-card__preview-header">
          <div class="artifact-browser-card__preview-title">
            {{ currentArtifact?.fileName || t('workbench.artifacts.noOutputSelected') }}
          </div>
          <div class="artifact-browser-card__preview-actions">
            <NButton
              v-if="currentArtifact?.sourceRunNumber"
              secondary
              size="small"
              @click="emit('open-source-run', currentArtifact.sourceRunNumber)"
            >
              {{ t('workbench.artifacts.openSourceRun', { number: currentArtifact.sourceRunNumber }) }}
            </NButton>
            <NButton
              v-if="currentArtifact"
              secondary
              size="small"
              @click="emit('continue-from-artifact', currentArtifact.relativePath)"
            >
              {{ t('workbench.artifacts.prepareNextRunFromOutput') }}
            </NButton>
          </div>
        </div>
        <p v-if="currentArtifact" class="artifact-browser-card__preview-note">
          {{ t('workbench.artifacts.prepareNextRunHint') }}
        </p>
        <div v-if="!currentArtifact" class="artifact-browser-card__empty">
          {{ t('workbench.artifacts.selectOutputToPreview') }}
        </div>
        <NInput
          v-else
          :value="currentArtifact.content"
          type="textarea"
          :rows="24"
          readonly
        />
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.artifact-browser-card {
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-card;
  padding: 20px;
}

.artifact-browser-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.artifact-browser-card__eyebrow {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $accent-primary;
  font-weight: 700;
}

.artifact-browser-card__path {
  margin-top: 8px;
  color: $text-secondary;
  word-break: break-word;
}

.artifact-browser-card__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.artifact-browser-card__layout {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: 16px;
  margin-top: 18px;
}

.artifact-browser-card__list,
.artifact-browser-card__preview {
  border: 1px solid $border-light;
  border-radius: $radius-md;
  padding: 14px;
  min-height: 420px;
  background: rgba(var(--accent-primary-rgb), 0.02);
}

.artifact-browser-card__preview-title {
  color: $text-primary;
  font-weight: 700;
}

.artifact-browser-card__preview-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.artifact-browser-card__preview-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.artifact-browser-card__empty {
  color: $text-muted;
  line-height: 1.6;
}

.artifact-browser-card__preview-note {
  margin-bottom: 12px;
  color: $text-muted;
  line-height: 1.6;
}

.artifact-entry-group + .artifact-entry-group {
  margin-top: 16px;
}

.artifact-entry-group__header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
  cursor: pointer;
}

.artifact-entry-group__copy,
.artifact-entry-group__status {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.artifact-entry-group__title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $text-muted;
  font-weight: 700;
}

.artifact-entry-group__meta {
  font-size: 12px;
  color: $text-muted;
}

.artifact-entry-group__pill {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  border-radius: 999px;
  padding: 0 10px;
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: $text-primary;
  font-size: 12px;
  font-weight: 700;
}

.artifact-entry-group__pill--warning {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.artifact-entry-group__pill--danger {
  background: rgba(220, 38, 38, 0.12);
  color: #b91c1c;
}

.artifact-entry-group__toggle {
  font-size: 12px;
  color: $text-muted;
}

.artifact-entry-group__items {
  margin-top: 10px;
}

.artifact-entry {
  width: 100%;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-card;
  padding: 12px;
  text-align: left;
  cursor: pointer;
}

.artifact-entry--selected {
  border-color: rgba(var(--accent-primary-rgb), 0.42);
  background: rgba(var(--accent-primary-rgb), 0.08);
  box-shadow: 0 0 0 1px rgba(var(--accent-primary-rgb), 0.08);
}

.artifact-entry + .artifact-entry {
  margin-top: 10px;
}

.artifact-entry__icon {
  width: 42px;
  height: 28px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: $text-primary;
  font-size: 11px;
  font-weight: 700;
}

.artifact-entry__copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: $text-secondary;
}

.artifact-entry__meta {
  color: $accent-primary;
  font-weight: 600;
}

.artifact-entry__copy strong {
  color: $text-primary;
}

@media (max-width: 1100px) {
  .artifact-browser-card__header,
  .artifact-browser-card__layout {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
}
</style>
