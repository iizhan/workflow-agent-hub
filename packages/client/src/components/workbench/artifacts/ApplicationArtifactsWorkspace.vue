<script setup lang="ts">
import { computed, toRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NSpin, useMessage } from 'naive-ui'
import ApplicationArtifactsBrowserCard from './ApplicationArtifactsBrowserCard.vue'
import ApplicationArtifactsGitCard from './ApplicationArtifactsGitCard.vue'
import ApplicationArtifactsSummaryCard from './ApplicationArtifactsSummaryCard.vue'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import { useApplicationArtifactsWorkspace } from '@/composables/workbench/useApplicationArtifactsWorkspace'
import type { ApplicationDetail } from '@/types/workbench/application'

const props = defineProps<{
  application: ApplicationDetail
}>()

const message = useMessage()
const route = useRoute()
const router = useRouter()
const applicationId = toRef(() => props.application.id)
const workspace = useApplicationArtifactsWorkspace(applicationId)
const { t } = useWorkbenchI18n()

const scenarioArtifactGuide = computed(() => {
  if (props.application.scenario === 'code') {
    return {
      title: t('workbench.artifacts.guides.codeTitle'),
      body: t('workbench.artifacts.guides.codeBody'),
      points: [
        t('workbench.artifacts.guides.codePoint1'),
        t('workbench.artifacts.guides.codePoint2'),
        t('workbench.artifacts.guides.codePoint3'),
      ],
    }
  }
  if (props.application.scenario === 'document') {
    return {
      title: t('workbench.artifacts.guides.documentTitle'),
      body: t('workbench.artifacts.guides.documentBody'),
      points: [
        t('workbench.artifacts.guides.documentPoint1'),
        t('workbench.artifacts.guides.documentPoint2'),
        t('workbench.artifacts.guides.documentPoint3'),
      ],
    }
  }
  if (props.application.scenario === 'ppt') {
    return {
      title: t('workbench.artifacts.guides.pptTitle'),
      body: t('workbench.artifacts.guides.pptBody'),
      points: [
        t('workbench.artifacts.guides.pptPoint1'),
        t('workbench.artifacts.guides.pptPoint2'),
        t('workbench.artifacts.guides.pptPoint3'),
      ],
    }
  }
  if (props.application.scenario === 'research') {
    return {
      title: t('workbench.artifacts.guides.researchTitle'),
      body: t('workbench.artifacts.guides.researchBody'),
      points: [
        t('workbench.artifacts.guides.researchPoint1'),
        t('workbench.artifacts.guides.researchPoint2'),
        t('workbench.artifacts.guides.researchPoint3'),
      ],
    }
  }
  return {
    title: t('workbench.artifacts.guides.generalTitle'),
    body: t('workbench.artifacts.guides.generalBody'),
    points: [
      t('workbench.artifacts.guides.generalPoint1'),
      t('workbench.artifacts.guides.generalPoint2'),
      t('workbench.artifacts.guides.generalPoint3'),
    ],
  }
})

async function handleOpenEntry(path: string, type: 'file' | 'directory') {
  try {
    await workspace.openArtifactPath(path, type)
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.artifacts.openOutputPathFailed')))
  }
}

async function handleOpenParent() {
  try {
    await workspace.openArtifactParent()
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.artifacts.openParentDirectoryFailed')))
  }
}

async function handleRefresh() {
  try {
    await workspace.refreshArtifacts()
    message.success(t('workbench.artifacts.outputsRefreshed'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.artifacts.refreshOutputsFailed')))
  }
}

async function handleRefreshGit() {
  try {
    await workspace.refreshGitChanges()
    message.success(t('workbench.artifacts.gitRefreshed'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.artifacts.gitRefreshFailed')))
  }
}

async function handleOpenGitChange(path: string) {
  try {
    await workspace.openGitChange(path)
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.artifacts.gitOpenDiffFailed')))
  }
}

function handleContinueFromArtifact(path: string) {
  if (!applicationId.value) return
  message.success(t('workbench.artifacts.nextRunPrepared'))
  router.replace({
    name: 'workbench.applicationDetail',
    params: { applicationId: applicationId.value },
    query: {
      section: 'runs',
      artifactPath: path,
    },
  })
}

function handleOpenSourceRun(runNumber: number) {
  if (!applicationId.value) return
  router.replace({
    name: 'workbench.applicationDetail',
    params: { applicationId: applicationId.value },
    query: {
      section: 'runs',
      runNumber: String(runNumber),
      runFilter: 'artifact-only',
    },
  })
}

watch(
  () => [route.query.artifactPath, route.query.runNumber, route.query.runFilter] as const,
  ([value, runNumberValue, runFilterValue]) => {
    const artifactPath = String(value || '').trim()
    if (!artifactPath) return
    const runNumber = String(runNumberValue || '').trim()
    const runFilter = String(runFilterValue || '').trim()

    workspace.openArtifactFile(artifactPath).catch((err: any) => {
      message.error(String(err?.message || t('workbench.artifacts.openOutputPathFailed')))
    }).finally(() => {
      router.replace({
        name: 'workbench.applicationDetail',
        params: { applicationId: applicationId.value },
        query: {
          section: 'artifacts',
          runNumber: runNumber || undefined,
          runFilter: runFilter || undefined,
        },
      })
    })
  },
  { immediate: true },
)
</script>

<template>
  <div class="artifacts-workspace">
    <NSpin :show="workspace.isLoading.value">
      <article class="artifacts-guide-card workbench-panel workbench-panel--soft">
        <div class="artifacts-guide-card__eyebrow workbench-section-title">{{ t('workbench.artifacts.guideEyebrow') }}</div>
        <div class="artifacts-guide-card__title">{{ scenarioArtifactGuide.title }}</div>
        <p class="artifacts-guide-card__body">{{ scenarioArtifactGuide.body }}</p>
        <div class="artifacts-guide-card__points">
          <div v-for="point in scenarioArtifactGuide.points" :key="point" class="artifacts-guide-card__point">
            {{ point }}
          </div>
        </div>
      </article>

      <ApplicationArtifactsSummaryCard :summary="workspace.summary.value" />
      <ApplicationArtifactsGitCard
        :git-state="workspace.gitState.value"
        @refresh="handleRefreshGit"
        @open-change="handleOpenGitChange"
      />
      <ApplicationArtifactsBrowserCard
        :current-path="workspace.summary.value.currentPath"
        :entries="workspace.artifactEntries.value"
        :run-history="workspace.runHistory.value"
        :current-artifact="workspace.currentArtifact.value"
        @open-entry="handleOpenEntry"
        @open-parent="handleOpenParent"
        @continue-from-artifact="handleContinueFromArtifact"
        @open-source-run="handleOpenSourceRun"
        @refresh="handleRefresh"
      />
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.artifacts-workspace {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.artifacts-guide-card__title {
  color: $text-primary;
  font-size: 18px;
  font-weight: 700;
}

.artifacts-guide-card__body {
  margin-top: 10px;
  color: $text-secondary;
  line-height: 1.7;
}

.artifacts-guide-card__points {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.artifacts-guide-card__point {
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: rgba(var(--accent-primary-rgb), 0.04);
  color: $text-primary;
  padding: 16px;
  line-height: 1.6;
}

@media (max-width: 1100px) {
  .artifacts-guide-card__points {
    grid-template-columns: 1fr;
  }
}
</style>
