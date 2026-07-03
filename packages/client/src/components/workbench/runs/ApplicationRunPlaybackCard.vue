<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton } from 'naive-ui'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationRunHistoryItem, ApplicationScenario } from '@/types/workbench/application'

const props = defineProps<{
  scenario: ApplicationScenario
  item: ApplicationRunHistoryItem | null
}>()

const emit = defineEmits<{
  'reuse-context': [item: ApplicationRunHistoryItem]
  'open-artifact': [path: string]
}>()

const { t, locale, statusLabel } = useWorkbenchI18n()
const selectedGitChangePath = ref('')

function playbackStatusLabel(status: ApplicationRunHistoryItem['status']) {
  if (status === 'cancelled') return t('workbench.runs.historyStatusCancelled')
  if (status === 'idle' || status === 'paused' || status === 'running' || status === 'completed' || status === 'failed') {
    return statusLabel(status)
  }
  return status
}

function formatTime(value: number | null) {
  if (!value) return t('workbench.system.na')
  return new Date(value).toLocaleString(locale.value, { hour12: false })
}

function formatExcerptLabel(senderName: string | null, excerpt: string | null) {
  if (!excerpt) return t('workbench.system.na')
  return senderName ? `${senderName} · ${excerpt}` : excerpt
}

function nodeRunStatusLabel(status: ApplicationRunHistoryItem['latestActivityStatus']) {
  if (!status) return t('workbench.system.na')
  if (status === 'waiting_approval' || status === 'rejected' || status === 'pending' || status === 'skipped') {
    return t(`workbench.runs.timelineStatuses.${status}`)
  }
  if (status === 'running' || status === 'completed') {
    return statusLabel(status)
  }
  return status
}

function approvalActionLabel(action: ApplicationRunHistoryItem['latestApprovalAction']) {
  if (action === 'approved') return t('workbench.runs.approvalActionApproved')
  if (action === 'rejected') return t('workbench.runs.approvalActionRejected')
  return t('workbench.system.na')
}

function gitKindLabel(kind: 'staged' | 'modified' | 'untracked' | 'mixed' | 'conflicted') {
  if (kind === 'staged') return t('workbench.artifacts.gitKindStaged')
  if (kind === 'modified') return t('workbench.artifacts.gitKindModified')
  if (kind === 'untracked') return t('workbench.artifacts.gitKindUntracked')
  if (kind === 'mixed') return t('workbench.artifacts.gitKindMixed')
  if (kind === 'conflicted') return t('workbench.artifacts.gitKindConflicted')
  return t('workbench.system.na')
}

const completionRate = computed(() => {
  const item = props.item
  if (!item?.totalNodeRuns) return 0
  return Math.round((item.completedNodeCount / item.totalNodeRuns) * 100)
})

const selectedGitChange = computed(() => {
  const changes = props.item?.projectGitSnapshot?.changes || []
  if (!changes.length) return null
  return changes.find(change => change.relativePath === selectedGitChangePath.value) || changes[0] || null
})

const selectedGitPreviewHint = computed(() => {
  const change = selectedGitChange.value
  if (!change) return ''
  if (change.previewMode === 'text') return t('workbench.runs.projectGitPreviewTextHint')
  if (change.previewMode === 'binary') return t('workbench.runs.projectGitPreviewBinaryHint')
  if (change.previewMode === 'empty') return t('workbench.runs.projectGitPreviewEmptyHint')
  return ''
})

function selectGitChange(path: string) {
  selectedGitChangePath.value = path
}

const playbackGuide = computed(() => {
  if (props.scenario === 'code') {
    return {
      title: t('workbench.runs.playbackGuides.codeTitle'),
      body: t('workbench.runs.playbackGuides.codeBody'),
      points: [
        t('workbench.runs.playbackGuides.codePoint1'),
        t('workbench.runs.playbackGuides.codePoint2'),
        t('workbench.runs.playbackGuides.codePoint3'),
      ],
    }
  }
  if (props.scenario === 'document') {
    return {
      title: t('workbench.runs.playbackGuides.documentTitle'),
      body: t('workbench.runs.playbackGuides.documentBody'),
      points: [
        t('workbench.runs.playbackGuides.documentPoint1'),
        t('workbench.runs.playbackGuides.documentPoint2'),
        t('workbench.runs.playbackGuides.documentPoint3'),
      ],
    }
  }
  if (props.scenario === 'ppt') {
    return {
      title: t('workbench.runs.playbackGuides.pptTitle'),
      body: t('workbench.runs.playbackGuides.pptBody'),
      points: [
        t('workbench.runs.playbackGuides.pptPoint1'),
        t('workbench.runs.playbackGuides.pptPoint2'),
        t('workbench.runs.playbackGuides.pptPoint3'),
      ],
    }
  }
  if (props.scenario === 'research') {
    return {
      title: t('workbench.runs.playbackGuides.researchTitle'),
      body: t('workbench.runs.playbackGuides.researchBody'),
      points: [
        t('workbench.runs.playbackGuides.researchPoint1'),
        t('workbench.runs.playbackGuides.researchPoint2'),
        t('workbench.runs.playbackGuides.researchPoint3'),
      ],
    }
  }
  return {
    title: t('workbench.runs.playbackGuides.generalTitle'),
    body: t('workbench.runs.playbackGuides.generalBody'),
    points: [
      t('workbench.runs.playbackGuides.generalPoint1'),
      t('workbench.runs.playbackGuides.generalPoint2'),
      t('workbench.runs.playbackGuides.generalPoint3'),
    ],
  }
})

watch(
  () => props.item?.id,
  () => {
    const firstPath = props.item?.projectGitSnapshot?.changes?.[0]?.relativePath || ''
    selectedGitChangePath.value = firstPath
  },
  { immediate: true },
)
</script>

<template>
  <article class="run-playback-card">
    <div class="run-playback-card__header">
      <div>
        <div class="run-playback-card__eyebrow">{{ t('workbench.runs.runPlayback') }}</div>
        <div class="run-playback-card__title">
          {{ item ? t('workbench.runs.runRoundLabel', { number: item.runNumber }) : t('workbench.runs.noRunPlaybackSelected') }}
        </div>
      </div>
      <NButton
        v-if="item && (item.kickoffSummary || item.kickoffArtifactPath)"
        secondary
        @click="emit('reuse-context', item)"
      >
        {{ t('workbench.runs.prepareNextRunFromPlayback') }}
      </NButton>
    </div>

    <div v-if="!item" class="run-playback-card__empty">
      <div class="run-playback-card__empty-title">{{ playbackGuide.title }}</div>
      <p class="run-playback-card__empty-body">{{ playbackGuide.body }}</p>
      <div class="run-playback-card__empty-points">
        <div v-for="point in playbackGuide.points" :key="point" class="run-playback-card__empty-point">
          {{ point }}
        </div>
      </div>
    </div>

    <template v-else>
      <div class="run-playback-card__highlights">
        <div class="run-playback-pill">
          {{ playbackStatusLabel(item.status) }}
        </div>
        <div class="run-playback-pill">
          {{ t('workbench.runs.playbackProgress', {
            completed: item.completedNodeCount,
            total: item.totalNodeRuns,
            rate: completionRate,
          }) }}
        </div>
        <div v-if="item.pendingApprovalCount" class="run-playback-pill run-playback-pill--warning">
          {{ t('workbench.runs.pendingApprovalsBadge', { count: item.pendingApprovalCount }) }}
        </div>
        <div v-if="item.rejectedNodeCount" class="run-playback-pill run-playback-pill--danger">
          {{ t('workbench.runs.rejectedStagesBadge', { count: item.rejectedNodeCount }) }}
        </div>
      </div>

      <p class="run-playback-card__body">
        {{ t('workbench.runs.playbackMetaSummary', {
          status: playbackStatusLabel(item.status),
          node: item.currentNodeTitle || t('workbench.runs.noActiveExecutionStage'),
        }) }}
      </p>

      <p
        v-if="item.kickoffSummary || item.kickoffArtifactPath"
        class="run-playback-card__reuse-note"
      >
        {{ t('workbench.runs.prepareNextRunFromPlaybackHint') }}
      </p>

      <dl class="run-playback-card__meta">
        <div>
          <dt>{{ t('workbench.runs.startedAt') }}</dt>
          <dd>{{ formatTime(item.startedAt) }}</dd>
        </div>
        <div>
          <dt>{{ t('workbench.runs.lastUpdated') }}</dt>
          <dd>{{ formatTime(item.updatedAt) }}</dd>
        </div>
        <div>
          <dt>{{ t('workbench.runs.latestHandledAtLabel') }}</dt>
          <dd>{{ formatTime(item.latestActivityAt) }}</dd>
        </div>
        <div>
          <dt>{{ t('workbench.runs.endedAt') }}</dt>
          <dd>{{ formatTime(item.endedAt) }}</dd>
        </div>
        <div>
          <dt>{{ t('workbench.runs.pendingApprovals') }}</dt>
          <dd>{{ item.pendingApprovalCount }}</dd>
        </div>
        <div>
          <dt>{{ t('workbench.runs.completedStages') }}</dt>
          <dd>{{ item.completedNodeCount }}</dd>
        </div>
        <div>
          <dt>{{ t('workbench.runs.rejectedStages') }}</dt>
          <dd>{{ item.rejectedNodeCount }}</dd>
        </div>
        <div>
          <dt>{{ t('workbench.runs.totalStageRuns') }}</dt>
          <dd>{{ item.totalNodeRuns }}</dd>
        </div>
      </dl>

      <div
        v-if="item.latestActorAgentName || item.latestActivityNodeTitle || item.latestPendingApprovalNodeTitle || item.latestRejectedNodeTitle || item.latestCompletedNodeTitle"
        class="run-playback-card__context"
      >
        <div class="run-playback-card__section-title">{{ t('workbench.runs.keyActivityTitle') }}</div>
        <div class="run-playback-card__activity-grid">
          <div v-if="item.latestActorAgentName">
            <dt>{{ t('workbench.runs.latestActorLabel') }}</dt>
            <dd>{{ item.latestActorAgentName }}</dd>
          </div>
          <div v-if="item.latestActivityNodeTitle">
            <dt>{{ t('workbench.runs.latestActivityLabel') }}</dt>
            <dd>
              {{ item.latestActivityNodeTitle }}
              <span v-if="item.latestActivityStatus">· {{ nodeRunStatusLabel(item.latestActivityStatus) }}</span>
            </dd>
          </div>
          <div v-if="item.latestPendingApprovalNodeTitle">
            <dt>{{ t('workbench.runs.pendingApprovalNodeLabel') }}</dt>
            <dd>{{ item.latestPendingApprovalNodeTitle }}</dd>
          </div>
          <div v-if="item.latestRejectedNodeTitle">
            <dt>{{ t('workbench.runs.latestRejectedNodeLabel') }}</dt>
            <dd>{{ item.latestRejectedNodeTitle }}</dd>
          </div>
          <div v-if="item.latestCompletedNodeTitle">
            <dt>{{ t('workbench.runs.latestCompletedNodeLabel') }}</dt>
            <dd>{{ item.latestCompletedNodeTitle }}</dd>
          </div>
        </div>
      </div>

      <div
        v-if="item.latestActivityAt || item.latestSystemNoticeExcerpt || item.latestMessageExcerpt"
        class="run-playback-card__context"
      >
        <div class="run-playback-card__section-title">{{ t('workbench.runs.signalExcerptsTitle') }}</div>
        <div class="run-playback-card__activity-grid">
          <div v-if="item.latestActivityAt">
            <dt>{{ t('workbench.runs.latestHandledAtLabel') }}</dt>
            <dd>{{ formatTime(item.latestActivityAt) }}</dd>
          </div>
          <div v-if="item.latestSystemNoticeExcerpt" class="run-playback-card__grid-span-2">
            <dt>{{ t('workbench.runs.latestSystemNoticeLabel') }}</dt>
            <dd>{{ item.latestSystemNoticeExcerpt }}</dd>
          </div>
          <div v-if="item.latestMessageExcerpt" class="run-playback-card__grid-span-2">
            <dt>{{ t('workbench.runs.latestMessageExcerptLabel') }}</dt>
            <dd>{{ formatExcerptLabel(item.latestMessageSenderName, item.latestMessageExcerpt) }}</dd>
          </div>
        </div>
      </div>

      <div
        v-if="item.latestApprovalActorName || item.latestApprovalAction || item.latestApprovalStageTitle || item.latestApprovalReason"
        class="run-playback-card__context"
      >
        <div class="run-playback-card__section-title">{{ t('workbench.runs.approvalTrailTitle') }}</div>
        <div class="run-playback-card__activity-grid">
          <div v-if="item.latestApprovalActorName">
            <dt>{{ t('workbench.runs.latestApprovalActorLabel') }}</dt>
            <dd>{{ item.latestApprovalActorName }}</dd>
          </div>
          <div v-if="item.latestApprovalAction">
            <dt>{{ t('workbench.runs.latestApprovalActionLabel') }}</dt>
            <dd>{{ approvalActionLabel(item.latestApprovalAction) }}</dd>
          </div>
          <div v-if="item.latestApprovalStageTitle">
            <dt>{{ t('workbench.runs.latestApprovalStageLabel') }}</dt>
            <dd>{{ item.latestApprovalStageTitle }}</dd>
          </div>
          <div v-if="item.latestApprovalReason">
            <dt>{{ t('workbench.runs.latestApprovalReasonLabel') }}</dt>
            <dd>{{ item.latestApprovalReason }}</dd>
          </div>
        </div>
      </div>

      <div v-if="item.kickoffSummary || item.kickoffArtifactPath || item.latestArtifactPath" class="run-playback-card__context">
        <div class="run-playback-card__section-title">{{ t('workbench.runs.currentRunContext') }}</div>
        <p v-if="item.kickoffSummary" class="run-playback-card__section-body">
          {{ t('workbench.runs.currentRunBrief', { summary: item.kickoffSummary }) }}
        </p>
        <p v-if="item.kickoffArtifactPath" class="run-playback-card__section-body">
          {{ t('workbench.runs.currentRunArtifact', { path: item.kickoffArtifactPath }) }}
        </p>
        <div v-if="item.kickoffArtifactPath" class="run-playback-card__actions">
          <NButton secondary size="small" @click="emit('open-artifact', item.kickoffArtifactPath)">
            {{ t('workbench.runs.openKickoffArtifact') }}
          </NButton>
        </div>
        <p v-if="item.latestArtifactPath" class="run-playback-card__section-body">
          {{ t('workbench.runs.latestArtifactTitle', {
            title: item.latestArtifactTitle || t('workbench.system.na'),
            path: item.latestArtifactPath,
          }) }}
        </p>
        <div v-if="item.latestArtifactPath" class="run-playback-card__actions">
          <NButton secondary size="small" @click="emit('open-artifact', item.latestArtifactPath)">
            {{ t('workbench.runs.openLatestArtifact') }}
          </NButton>
        </div>
      </div>

      <div
        v-if="item.projectGitSnapshot && (item.projectGitSnapshot.touchedFileCount || item.projectGitSnapshot.changeCount || item.projectGitSnapshot.projectName)"
        class="run-playback-card__context"
      >
        <div class="run-playback-card__section-title">{{ t('workbench.runs.projectGitSnapshotTitle') }}</div>
        <div class="run-playback-card__activity-grid">
          <div v-if="item.projectGitSnapshot.projectName">
            <dt>{{ t('workbench.runs.projectGitProjectLabel') }}</dt>
            <dd>{{ item.projectGitSnapshot.projectName }}</dd>
          </div>
          <div v-if="item.projectGitSnapshot.branch">
            <dt>{{ t('workbench.runs.projectGitBranchLabel') }}</dt>
            <dd>{{ item.projectGitSnapshot.branch }}</dd>
          </div>
          <div v-if="item.projectGitSnapshot.trackedAt">
            <dt>{{ t('workbench.runs.projectGitTrackedAtLabel') }}</dt>
            <dd>{{ formatTime(item.projectGitSnapshot.trackedAt) }}</dd>
          </div>
          <div>
            <dt>{{ t('workbench.runs.projectGitCountsLabel') }}</dt>
            <dd>
              {{ t('workbench.runs.projectGitCounts', {
                count: item.projectGitSnapshot.changeCount,
                staged: item.projectGitSnapshot.stagedCount,
                modified: item.projectGitSnapshot.modifiedCount,
                untracked: item.projectGitSnapshot.untrackedCount,
              }) }}
            </dd>
          </div>
          <div>
            <dt>{{ t('workbench.runs.projectGitSyncLabel') }}</dt>
            <dd>
              {{ t('workbench.runs.projectGitAheadBehind', {
                ahead: item.projectGitSnapshot.aheadCount,
                behind: item.projectGitSnapshot.behindCount,
              }) }}
            </dd>
          </div>
          <div>
            <dt>{{ t('workbench.runs.projectGitTouchedLabel') }}</dt>
            <dd>{{ t('workbench.runs.projectGitTouchedCount', { count: item.projectGitSnapshot.touchedFileCount }) }}</dd>
          </div>
        </div>

        <div v-if="item.projectGitSnapshot.touchedFiles.length" class="run-playback-card__file-block">
          <div class="run-playback-card__subsection-title">{{ t('workbench.runs.projectTouchedFilesTitle') }}</div>
          <div class="run-playback-card__tag-list">
            <span v-for="path in item.projectGitSnapshot.touchedFiles" :key="path" class="run-playback-card__tag">
              {{ path }}
            </span>
          </div>
        </div>

        <div v-if="item.projectGitSnapshot.changes.length" class="run-playback-card__file-block">
          <div class="run-playback-card__subsection-title">{{ t('workbench.runs.projectGitChangesTitle') }}</div>
          <div class="run-playback-card__change-list">
            <button
              v-for="change in item.projectGitSnapshot.changes"
              :key="`${change.relativePath}:${change.kind}`"
              type="button"
              class="run-playback-card__change-chip"
              :class="{ 'run-playback-card__change-chip--selected': selectedGitChange?.relativePath === change.relativePath }"
              @click="selectGitChange(change.relativePath)"
            >
              {{ change.displayPath }} · {{ gitKindLabel(change.kind) }}
            </button>
          </div>
        </div>

        <div v-if="selectedGitChange" class="run-playback-card__file-block">
          <div class="run-playback-card__subsection-title">{{ t('workbench.runs.projectGitPreviewTitle') }}</div>
          <p class="run-playback-card__section-body">
            {{ selectedGitChange.displayPath }} · {{ gitKindLabel(selectedGitChange.kind) }}
          </p>
          <p v-if="selectedGitPreviewHint" class="run-playback-card__preview-note">
            {{ selectedGitPreviewHint }}
          </p>
          <p v-if="selectedGitChange.previewTruncated" class="run-playback-card__preview-note">
            {{ t('workbench.runs.projectGitPreviewTruncated') }}
          </p>
          <pre
            v-if="selectedGitChange.previewMode !== 'binary' && selectedGitChange.previewContent"
            class="run-playback-card__preview-content"
          >{{ selectedGitChange.previewContent }}</pre>
          <div
            v-else-if="selectedGitChange.previewMode === 'binary'"
            class="run-playback-card__empty"
          >
            {{ t('workbench.runs.projectGitPreviewBinaryEmpty') }}
          </div>
          <div
            v-else-if="selectedGitChange.previewMode === 'empty'"
            class="run-playback-card__empty"
          >
            {{ t('workbench.runs.projectGitPreviewEmpty') }}
          </div>
        </div>
      </div>
    </template>
  </article>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.run-playback-card {
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-card;
  padding: 20px;
}

.run-playback-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.run-playback-card__eyebrow {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $accent-primary;
  font-weight: 700;
}

.run-playback-card__title {
  margin-top: 10px;
  font-size: 20px;
  font-weight: 700;
  color: $text-primary;
}

.run-playback-card__body,
.run-playback-card__empty,
.run-playback-card__section-body {
  color: $text-secondary;
  line-height: 1.6;
}

.run-playback-card__reuse-note {
  margin-top: 10px;
  color: $text-muted;
  line-height: 1.6;
}

.run-playback-card__empty-title {
  color: $text-primary;
  font-weight: 700;
}

.run-playback-card__empty-body {
  margin-top: 10px;
}

.run-playback-card__empty-points {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.run-playback-card__subsection-title {
  margin-top: 14px;
  color: $text-primary;
  font-weight: 700;
}

.run-playback-card__file-block + .run-playback-card__file-block {
  margin-top: 12px;
}

.run-playback-card__tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.run-playback-card__change-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.run-playback-card__tag {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid $border-light;
  background: rgba(var(--accent-primary-rgb), 0.05);
  color: $text-secondary;
  line-height: 1.5;
  word-break: break-word;
}

.run-playback-card__change-chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid $border-light;
  background: rgba(var(--accent-primary-rgb), 0.05);
  color: $text-secondary;
  line-height: 1.5;
  cursor: pointer;
}

.run-playback-card__change-chip--selected {
  border-color: rgba(var(--accent-primary-rgb), 0.45);
  background: rgba(var(--accent-primary-rgb), 0.12);
  color: $text-primary;
}

.run-playback-card__preview-note {
  margin-top: 8px;
  color: $text-muted;
  line-height: 1.6;
}

.run-playback-card__preview-content {
  margin-top: 10px;
  padding: 14px;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: rgba(var(--accent-primary-rgb), 0.03);
  color: $text-primary;
  font-family: $font-code;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 420px;
  overflow: auto;
}

.run-playback-card__empty-point {
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: rgba(var(--accent-primary-rgb), 0.04);
  color: $text-primary;
  line-height: 1.55;
  padding: 12px 14px;
}

.run-playback-card__highlights {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.run-playback-pill {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  border-radius: 999px;
  padding: 0 12px;
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: $text-primary;
  font-size: 12px;
  font-weight: 700;
}

.run-playback-pill--warning {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.run-playback-pill--danger {
  background: rgba(220, 38, 38, 0.12);
  color: #b91c1c;
}

.run-playback-card__body,
.run-playback-card__empty,
.run-playback-card__meta,
.run-playback-card__context {
  margin-top: 16px;
}

.run-playback-card__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
}

.run-playback-card__meta dt {
  font-size: 12px;
  text-transform: uppercase;
  color: $text-muted;
}

.run-playback-card__meta dd {
  margin-top: 4px;
  color: $text-primary;
}

.run-playback-card__activity-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
  margin-top: 12px;
}

.run-playback-card__activity-grid dt {
  font-size: 12px;
  text-transform: uppercase;
  color: $text-muted;
}

.run-playback-card__activity-grid dd {
  margin-top: 4px;
  color: $text-primary;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.run-playback-card__grid-span-2 {
  grid-column: 1 / -1;
}

.run-playback-card__context {
  border-top: 1px solid $border-light;
  padding-top: 16px;
}

.run-playback-card__actions {
  margin-top: 10px;
}

.run-playback-card__section-title {
  font-weight: 700;
  color: $text-primary;
}

.run-playback-card__section-body + .run-playback-card__section-body {
  margin-top: 8px;
}

@media (max-width: 1100px) {
  .run-playback-card__header {
    flex-direction: column;
  }

  .run-playback-card__activity-grid {
    grid-template-columns: 1fr;
  }
}
</style>
