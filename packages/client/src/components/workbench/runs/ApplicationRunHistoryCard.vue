<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationRunHistoryItem } from '@/types/workbench/application'

const props = defineProps<{
  items: ApplicationRunHistoryItem[]
  selectedRunNumber: number | null
}>()

const emit = defineEmits<{
  'select-run': [runNumber: number]
}>()

type RunHistoryFilter = 'all' | 'project-change' | 'artifact-only'

const { t, locale, statusLabel } = useWorkbenchI18n()
const route = useRoute()
const router = useRouter()
const activeFilter = ref<RunHistoryFilter>('all')

function filterStorageKey() {
  const applicationId = String(route.params.applicationId || '').trim()
  return `hermes:workbench:run-history-filter:${applicationId || 'global'}`
}

function isRunHistoryFilter(value: string): value is RunHistoryFilter {
  return value === 'all' || value === 'project-change' || value === 'artifact-only'
}

function hydrateFilter() {
  const routeFilter = String(route.query.runFilter || '').trim()
  if (isRunHistoryFilter(routeFilter)) {
    activeFilter.value = routeFilter
    return
  }

  try {
    const saved = localStorage.getItem(filterStorageKey()) || ''
    if (isRunHistoryFilter(saved)) {
      activeFilter.value = saved
    }
  } catch {
    // Ignore storage failures and keep the default filter.
  }
}

function setActiveFilter(filter: RunHistoryFilter) {
  activeFilter.value = filter
  try {
    localStorage.setItem(filterStorageKey(), filter)
  } catch {
    // Ignore storage failures and keep the in-memory filter.
  }

  const nextQuery = {
    ...route.query,
    runFilter: filter === 'all' ? undefined : filter,
  }

  router.replace({
    query: nextQuery,
  }).catch(() => {
    // Ignore navigation duplication and keep local state.
  })
}

hydrateFilter()

watch(
  () => [route.params.applicationId, route.query.runFilter] as const,
  () => {
    hydrateFilter()
  },
)

function historyStatusLabel(status: ApplicationRunHistoryItem['status']) {
  if (status === 'cancelled') return t('workbench.runs.historyStatusCancelled')
  if (status === 'idle' || status === 'paused' || status === 'running' || status === 'completed' || status === 'failed') {
    return statusLabel(status)
  }
  return status
}

function runChangeSignals(item: ApplicationRunHistoryItem) {
  const signals: Array<{ key: string; label: string; tone: 'accent' | 'success' | 'warning' }> = []
  const snapshot = item.projectGitSnapshot
  const touchedFileCount = snapshot?.touchedFileCount || 0
  const gitChangeCount = snapshot?.changeCount || 0

  if (touchedFileCount > 0) {
    signals.push({
      key: 'project-change',
      label: t('workbench.runs.historySignalProjectChange', { count: touchedFileCount }),
      tone: 'success',
    })
  } else if (gitChangeCount > 0) {
    signals.push({
      key: 'git-change',
      label: t('workbench.runs.historySignalGitChange', { count: gitChangeCount }),
      tone: 'warning',
    })
  }

  if (item.latestArtifactPath && touchedFileCount === 0) {
    signals.push({
      key: 'artifact-only',
      label: t('workbench.runs.historySignalArtifactOnly'),
      tone: 'accent',
    })
  }

  return signals
}

function matchesFilter(item: ApplicationRunHistoryItem) {
  const snapshot = item.projectGitSnapshot
  const touchedFileCount = snapshot?.touchedFileCount || 0
  const hasProjectChange = touchedFileCount > 0
  const hasArtifactOnly = !!item.latestArtifactPath && !hasProjectChange

  if (activeFilter.value === 'project-change') return hasProjectChange
  if (activeFilter.value === 'artifact-only') return hasArtifactOnly
  return true
}

const filterOptions = computed(() => ([
  { key: 'all', label: t('workbench.runs.historyFilterAll') },
  { key: 'project-change', label: t('workbench.runs.historyFilterProjectChange') },
  { key: 'artifact-only', label: t('workbench.runs.historyFilterArtifactOnly') },
] as const))

const filteredItems = computed(() => props.items.filter(matchesFilter))
</script>

<template>
  <article class="run-history-card">
    <div class="run-history-card__header">
      <div class="run-history-card__eyebrow">{{ t('workbench.runs.runHistory') }}</div>
      <div class="run-history-card__filters">
        <button
          v-for="option in filterOptions"
          :key="option.key"
          type="button"
          class="run-history-card__filter"
          :class="{ 'run-history-card__filter--active': activeFilter === option.key }"
          @click="setActiveFilter(option.key)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
    <div v-if="!items.length" class="run-history-card__empty">
      <div class="run-history-card__empty-title">{{ t('workbench.runs.noRunHistory') }}</div>
      <p class="run-history-card__empty-body">{{ t('workbench.runs.noRunHistoryBody') }}</p>
    </div>
    <div v-else-if="!filteredItems.length" class="run-history-card__empty">
      <div class="run-history-card__empty-title">{{ t('workbench.runs.noFilteredRunHistory') }}</div>
      <p class="run-history-card__empty-body">{{ t('workbench.runs.noFilteredRunHistoryBody') }}</p>
    </div>
    <div v-else class="run-history-card__list">
      <button
        v-for="item in filteredItems"
        :key="item.id"
        type="button"
        class="run-history-item"
        :class="{ 'run-history-item--selected': item.runNumber === selectedRunNumber }"
        @click="emit('select-run', item.runNumber)"
      >
        <div class="run-history-item__header">
          <div class="run-history-item__title">
            {{ t('workbench.runs.runRoundLabel', { number: item.runNumber }) }}
          </div>
          <div class="run-history-item__status">{{ historyStatusLabel(item.status) }}</div>
        </div>
        <p v-if="item.currentNodeTitle" class="run-history-item__body">
          {{ item.currentNodeTitle }}
        </p>
        <p v-if="item.kickoffSummary" class="run-history-item__body">
          {{ item.kickoffSummary }}
        </p>
        <div v-if="runChangeSignals(item).length" class="run-history-item__signals">
          <span
            v-for="signal in runChangeSignals(item)"
            :key="signal.key"
            class="run-history-item__signal"
            :data-tone="signal.tone"
          >
            {{ signal.label }}
          </span>
        </div>
        <p v-if="item.kickoffArtifactPath" class="run-history-item__meta">
          {{ t('workbench.runs.currentRunArtifact', { path: item.kickoffArtifactPath }) }}
        </p>
        <p v-if="item.latestArtifactPath" class="run-history-item__meta">
          {{ t('workbench.runs.latestRunArtifact', { path: item.latestArtifactPath }) }}
        </p>
        <p
          v-if="item.projectGitSnapshot && (item.projectGitSnapshot.touchedFileCount || item.projectGitSnapshot.changeCount)"
          class="run-history-item__meta"
        >
          {{ t('workbench.runs.projectGitHistoryMeta', {
            touched: item.projectGitSnapshot.touchedFileCount,
            changes: item.projectGitSnapshot.changeCount,
            branch: item.projectGitSnapshot.branch || t('workbench.projects.noBranchDetected'),
          }) }}
        </p>
        <p class="run-history-item__meta">
          {{ t('workbench.runs.historyMeta', {
            started: item.startedAt ? new Date(item.startedAt).toLocaleString(locale, { hour12: false }) : t('workbench.system.na'),
            updated: item.updatedAt ? new Date(item.updatedAt).toLocaleString(locale, { hour12: false }) : t('workbench.system.na'),
          }) }}
        </p>
      </button>
    </div>
  </article>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.run-history-card {
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-card;
  padding: 20px;
}

.run-history-card__eyebrow {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $accent-primary;
  font-weight: 700;
}

.run-history-card__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.run-history-card__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.run-history-card__filter {
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid $border-light;
  background: rgba(var(--accent-primary-rgb), 0.03);
  color: $text-secondary;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.run-history-card__filter--active {
  border-color: rgba(var(--accent-primary-rgb), 0.42);
  background: rgba(var(--accent-primary-rgb), 0.12);
  color: $text-primary;
}

.run-history-card__empty {
  margin-top: 16px;
  color: $text-muted;
}

.run-history-card__empty-title {
  color: $text-primary;
  font-weight: 700;
}

.run-history-card__empty-body {
  margin-top: 8px;
  color: $text-secondary;
  line-height: 1.7;
}

.run-history-card__list {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.run-history-item {
  width: 100%;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: rgba(var(--accent-primary-rgb), 0.02);
  padding: 14px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
}

.run-history-item:hover {
  border-color: rgba(var(--accent-primary-rgb), 0.28);
  background: rgba(var(--accent-primary-rgb), 0.05);
  transform: translateY(-1px);
}

.run-history-item--selected {
  border-color: rgba(var(--accent-primary-rgb), 0.42);
  background: rgba(var(--accent-primary-rgb), 0.08);
  box-shadow: 0 0 0 1px rgba(var(--accent-primary-rgb), 0.08);
}

.run-history-item__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.run-history-item__title {
  font-weight: 700;
  color: $text-primary;
}

.run-history-item__status {
  font-size: 12px;
  font-weight: 700;
  color: $text-secondary;
}

.run-history-item__body,
.run-history-item__meta {
  margin-top: 8px;
  color: $text-secondary;
  line-height: 1.6;
}

.run-history-item__signals {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.run-history-item__signal {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid $border-light;
  background: rgba(var(--accent-primary-rgb), 0.06);
  color: $text-primary;
  font-size: 12px;
  font-weight: 700;
}

.run-history-item__signal[data-tone='success'] {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
}

.run-history-item__signal[data-tone='warning'] {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}
</style>
