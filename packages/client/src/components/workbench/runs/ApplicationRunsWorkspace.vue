<script setup lang="ts">
import { computed, toRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NSpin, useMessage } from 'naive-ui'
import ApplicationRunHistoryCard from './ApplicationRunHistoryCard.vue'
import ApplicationRunPlaybackCard from './ApplicationRunPlaybackCard.vue'
import ApplicationRunSummaryCard from './ApplicationRunSummaryCard.vue'
import ApplicationRunTimelineCard from './ApplicationRunTimelineCard.vue'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import { useApplicationRunsWorkspace } from '@/composables/workbench/useApplicationRunsWorkspace'
import type { ApplicationDetail } from '@/types/workbench/application'

const props = defineProps<{
  application: ApplicationDetail
}>()

const route = useRoute()
const router = useRouter()
const message = useMessage()
const applicationId = toRef(() => props.application.id)
const workspace = useApplicationRunsWorkspace(applicationId)
const { t } = useWorkbenchI18n()

const scenarioRunGuide = computed(() => {
  if (props.application.scenario === 'code') {
    return {
      title: t('workbench.runs.guides.codeTitle'),
      body: t('workbench.runs.guides.codeBody'),
      points: [
        t('workbench.runs.guides.codePoint1'),
        t('workbench.runs.guides.codePoint2'),
        t('workbench.runs.guides.codePoint3'),
      ],
    }
  }
  if (props.application.scenario === 'document') {
    return {
      title: t('workbench.runs.guides.documentTitle'),
      body: t('workbench.runs.guides.documentBody'),
      points: [
        t('workbench.runs.guides.documentPoint1'),
        t('workbench.runs.guides.documentPoint2'),
        t('workbench.runs.guides.documentPoint3'),
      ],
    }
  }
  if (props.application.scenario === 'ppt') {
    return {
      title: t('workbench.runs.guides.pptTitle'),
      body: t('workbench.runs.guides.pptBody'),
      points: [
        t('workbench.runs.guides.pptPoint1'),
        t('workbench.runs.guides.pptPoint2'),
        t('workbench.runs.guides.pptPoint3'),
      ],
    }
  }
  if (props.application.scenario === 'research') {
    return {
      title: t('workbench.runs.guides.researchTitle'),
      body: t('workbench.runs.guides.researchBody'),
      points: [
        t('workbench.runs.guides.researchPoint1'),
        t('workbench.runs.guides.researchPoint2'),
        t('workbench.runs.guides.researchPoint3'),
      ],
    }
  }
  return {
    title: t('workbench.runs.guides.generalTitle'),
    body: t('workbench.runs.guides.generalBody'),
    points: [
      t('workbench.runs.guides.generalPoint1'),
      t('workbench.runs.guides.generalPoint2'),
      t('workbench.runs.guides.generalPoint3'),
    ],
  }
})

async function handleRefresh() {
  try {
    await workspace.refreshRuns()
    message.success(t('workbench.runs.executionStateRefreshed'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.runs.refreshExecutionStateFailed')))
  }
}

async function handleApprove() {
  try {
    await workspace.approveRun()
    message.success(t('workbench.runs.executionStageApproved'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.runs.approveExecutionStageFailed')))
  }
}

async function handleReject() {
  try {
    await workspace.rejectRun()
    message.success(t('workbench.runs.executionStageRejected'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.runs.rejectExecutionStageFailed')))
  }
}

async function handleStart() {
  const startActionKind = workspace.runSummary.value.startActionKind
  try {
    await workspace.startRun()
    message.success(
      startActionKind === 'next_run'
        ? t('workbench.runs.nextRunStarted')
        : startActionKind === 'retry_failed_run'
          ? t('workbench.runs.failedRunRestarted')
          : t('workbench.runs.firstRunStarted'),
    )
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.runs.startExecutionFailed')))
  }
}

async function handleCancel() {
  try {
    await workspace.cancelRun()
    message.success(t('workbench.runs.liveRunStopped'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.runs.stopExecutionFailed')))
  }
}

function handleSelectRun(runNumber: number) {
  workspace.selectRun(runNumber)
}

function handleReuseContext() {
  const item = workspace.selectedRunDetail.value
  if (!item) return
  workspace.reuseRunContext(item)
  message.success(t('workbench.runs.nextRunPreparedFromPlayback'))
}

function handleOpenArtifact(path: string) {
  if (!applicationId.value || !path) return
  router.replace({
    name: 'workbench.applicationDetail',
    params: { applicationId: applicationId.value },
    query: {
      section: 'artifacts',
      artifactPath: path,
      runNumber: workspace.selectedRunDetail.value?.runNumber
        ? String(workspace.selectedRunDetail.value.runNumber)
        : undefined,
      runFilter: String(route.query.runFilter || '').trim() || undefined,
    },
  })
}

watch(
  () => [route.query.artifactPath, route.query.runNumber, route.query.runFilter] as const,
  ([artifactValue, runValue, runFilterValue]) => {
    const artifactPath = String(artifactValue || '').trim()
    const parsedRunNumber = Number.parseInt(String(runValue || ''), 10)
    const runFilter = String(runFilterValue || '').trim()
    const hasRunNumber = Number.isFinite(parsedRunNumber) && parsedRunNumber > 0
    if (!artifactPath && !hasRunNumber) return

    if (artifactPath) {
      workspace.launchArtifactPath.value = artifactPath
    }
    if (hasRunNumber) {
      workspace.selectRun(parsedRunNumber)
    }

    router.replace({
      name: 'workbench.applicationDetail',
      params: { applicationId: props.application.id },
      query: {
        section: 'runs',
        runNumber: hasRunNumber ? String(parsedRunNumber) : undefined,
        runFilter: runFilter || undefined,
      },
    })
  },
  { immediate: true },
)
</script>

<template>
  <div class="runs-workspace">
    <NSpin :show="workspace.isLoading.value || workspace.isSubmitting.value">
      <article class="runs-guide-card workbench-panel workbench-panel--soft">
        <div class="runs-guide-card__eyebrow workbench-section-title">{{ t('workbench.runs.guideEyebrow') }}</div>
        <div class="runs-guide-card__title">{{ scenarioRunGuide.title }}</div>
        <p class="runs-guide-card__body">{{ scenarioRunGuide.body }}</p>
        <div class="runs-guide-card__points">
          <div v-for="point in scenarioRunGuide.points" :key="point" class="runs-guide-card__point">
            {{ point }}
          </div>
        </div>
      </article>

      <ApplicationRunSummaryCard
        :summary="workspace.runSummary.value"
        :reject-reason="workspace.rejectReason.value"
        :launch-brief="workspace.launchBrief.value"
        :launch-artifact-path="workspace.launchArtifactPath.value"
        :artifact-options="workspace.artifactOptions.value"
        :submitting="workspace.isSubmitting.value"
        @update:reject-reason="workspace.rejectReason.value = $event"
        @update:launch-brief="workspace.launchBrief.value = $event"
        @update:launch-artifact-path="workspace.launchArtifactPath.value = $event"
        @refresh="handleRefresh"
        @start="handleStart"
        @approve="handleApprove"
        @reject="handleReject"
        @cancel="handleCancel"
      />
      <ApplicationRunTimelineCard :nodes="workspace.runNodes.value" />
      <ApplicationRunHistoryCard
        :items="workspace.runHistory.value"
        :selected-run-number="workspace.selectedRunNumber.value"
        @select-run="handleSelectRun"
      />
      <ApplicationRunPlaybackCard
        :scenario="application.scenario"
        :item="workspace.selectedRunDetail.value"
        @reuse-context="handleReuseContext"
        @open-artifact="handleOpenArtifact"
      />
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.runs-workspace {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.runs-guide-card__title {
  color: $text-primary;
  font-size: 18px;
  font-weight: 700;
}

.runs-guide-card__body {
  margin-top: 10px;
  color: $text-secondary;
  line-height: 1.7;
}

.runs-guide-card__points {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.runs-guide-card__point {
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: rgba(var(--accent-primary-rgb), 0.04);
  color: $text-primary;
  padding: 16px;
  line-height: 1.6;
}

@media (max-width: 1100px) {
  .runs-guide-card__points {
    grid-template-columns: 1fr;
  }
}
</style>
