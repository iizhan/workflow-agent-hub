<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NInput, NSelect, NSpin } from 'naive-ui'
import ApplicationCard from '@/components/workbench/ApplicationCard.vue'
import ApplicationEmptyState from '@/components/workbench/ApplicationEmptyState.vue'
import ApplicationListItem from '@/components/workbench/ApplicationListItem.vue'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import { useApplicationsStore } from '@/stores/workbench/applications'
import {
  compareApplications,
  matchesApplicationFocus,
  type ApplicationWorkbenchFocus,
} from '@/utils/workbench-applications'

type ApplicationViewMode = 'list' | 'grid'

const router = useRouter()
const route = useRoute()
const applicationsStore = useApplicationsStore()
const { t, scenarioLabel, statusLabel } = useWorkbenchI18n()

const search = ref('')
const scenarioFilter = ref('all')
const statusFilter = ref('all')
const focusFilter = ref<ApplicationWorkbenchFocus>('all')
const viewMode = ref<ApplicationViewMode>('list')

const scenarioOptions = computed(() => [
  { label: t('workbench.scenarios.all'), value: 'all' },
  { label: scenarioLabel('code'), value: 'code' },
  { label: scenarioLabel('document'), value: 'document' },
  { label: scenarioLabel('ppt'), value: 'ppt' },
  { label: scenarioLabel('research'), value: 'research' },
  { label: scenarioLabel('general'), value: 'general' },
])

const statusOptions = computed(() => [
  { label: t('workbench.statuses.all'), value: 'all' },
  { label: statusLabel('draft'), value: 'draft' },
  { label: statusLabel('setup_required'), value: 'setup_required' },
  { label: statusLabel('ready'), value: 'ready' },
  { label: statusLabel('running'), value: 'running' },
  { label: statusLabel('waiting_review'), value: 'waiting_review' },
  { label: statusLabel('failed'), value: 'failed' },
  { label: statusLabel('completed'), value: 'completed' },
])

const focusOptions = computed(() => [
  { label: t('workbench.applications.focusAll'), value: 'all' },
  { label: t('workbench.applications.focusReview'), value: 'review' },
  { label: t('workbench.applications.focusFailed'), value: 'failed' },
  { label: t('workbench.applications.focusRunning'), value: 'running' },
  { label: t('workbench.applications.focusReady'), value: 'ready' },
  { label: t('workbench.applications.focusSetup'), value: 'setup' },
])

const filteredApplications = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return applicationsStore.applications.filter(application => {
    const matchesKeyword =
      !keyword
      || application.name.toLowerCase().includes(keyword)
      || String(application.goalSummary || '').toLowerCase().includes(keyword)
      || String(application.primaryProjectName || '').toLowerCase().includes(keyword)
    const matchesScenario = scenarioFilter.value === 'all' || application.scenario === scenarioFilter.value
    const matchesStatus = statusFilter.value === 'all' || application.status === statusFilter.value
    const matchesFocus = matchesApplicationFocus(application, focusFilter.value)
    return matchesKeyword && matchesScenario && matchesStatus && matchesFocus
  })
})

const prioritizedApplications = computed(() =>
  filteredApplications.value.slice().sort(compareApplications),
)

const collectionStats = computed(() => {
  const list = applicationsStore.applications
  return {
    total: list.length,
    review: list.filter(app => matchesApplicationFocus(app, 'review')).length,
    running: list.filter(app => matchesApplicationFocus(app, 'running')).length,
    ready: list.filter(app => matchesApplicationFocus(app, 'ready')).length,
  }
})

watch(
  () => route.query.focus,
  value => {
    const normalized = String(value || '').trim()
    const allowed = new Set<ApplicationWorkbenchFocus>(['all', 'review', 'failed', 'running', 'ready', 'setup'])
    focusFilter.value = allowed.has(normalized as ApplicationWorkbenchFocus)
      ? (normalized as ApplicationWorkbenchFocus)
      : 'all'
  },
  { immediate: true },
)

function syncFocusRoute(focus: ApplicationWorkbenchFocus) {
  const current = String(route.query.focus || '').trim()
  const next = focus === 'all' ? '' : focus
  if (current === next) return

  const query = { ...route.query }
  if (focus === 'all') {
    delete query.focus
  } else {
    query.focus = focus
  }
  router.replace({ query })
}

watch(focusFilter, value => {
  syncFocusRoute(value)
})

function openCreate() {
  router.push({ name: 'workbench.applicationCreate' })
}

function clearFilters() {
  search.value = ''
  scenarioFilter.value = 'all'
  statusFilter.value = 'all'
  focusFilter.value = 'all'
}

onMounted(async () => {
  await applicationsStore.loadApplications()
})
</script>

<template>
  <div class="applications-view workbench-page">
    <section class="applications-hero workbench-page__hero">
      <div class="applications-hero__copy workbench-page__hero-copy">
        <div class="applications-hero__eyebrow workbench-page__eyebrow">{{ t('workbench.applications.heroEyebrow') }}</div>
        <h1 class="applications-view__title workbench-page__title">{{ t('workbench.applications.heroTitle') }}</h1>
        <p class="applications-view__subtitle workbench-page__subtitle">
          {{ t('workbench.applications.heroSubtitle') }}
        </p>
      </div>
      <div class="applications-hero__actions workbench-page__actions">
        <NButton type="primary" size="large" @click="openCreate">{{ t('workbench.applications.createApplication') }}</NButton>
      </div>
    </section>

    <section class="applications-view__summary-strip">
      <button class="applications-summary-card workbench-panel workbench-card--interactive" type="button" @click="focusFilter = 'review'">
        <span class="applications-summary-card__label">{{ t('workbench.applications.focusReview') }}</span>
        <span class="applications-summary-card__value">{{ collectionStats.review }}</span>
      </button>
      <button class="applications-summary-card workbench-panel workbench-card--interactive" type="button" @click="focusFilter = 'running'">
        <span class="applications-summary-card__label">{{ t('workbench.applications.focusRunning') }}</span>
        <span class="applications-summary-card__value">{{ collectionStats.running }}</span>
      </button>
      <button class="applications-summary-card workbench-panel workbench-card--interactive" type="button" @click="focusFilter = 'ready'">
        <span class="applications-summary-card__label">{{ t('workbench.applications.focusReady') }}</span>
        <span class="applications-summary-card__value">{{ collectionStats.ready }}</span>
      </button>
      <div class="applications-summary-card applications-summary-card--static workbench-panel">
        <span class="applications-summary-card__label">{{ t('workbench.applications.totalApplications') }}</span>
        <span class="applications-summary-card__value">{{ collectionStats.total }}</span>
      </div>
    </section>

    <section class="applications-view__toolbar">
      <div class="applications-view__filters">
        <NInput v-model:value="search" :placeholder="t('workbench.applications.searchPlaceholder')" clearable />
        <NSelect v-model:value="focusFilter" :options="focusOptions" />
        <NSelect v-model:value="scenarioFilter" :options="scenarioOptions" />
        <NSelect v-model:value="statusFilter" :options="statusOptions" />
      </div>
      <div class="applications-view__display-switch">
        <button
          class="applications-view__display-btn"
          :class="{ active: viewMode === 'list' }"
          type="button"
          @click="viewMode = 'list'"
        >
          {{ t('workbench.applications.viewList') }}
        </button>
        <button
          class="applications-view__display-btn"
          :class="{ active: viewMode === 'grid' }"
          type="button"
          @click="viewMode = 'grid'"
        >
          {{ t('workbench.applications.viewGrid') }}
        </button>
      </div>
    </section>

    <NSpin :show="applicationsStore.isLoadingList">
      <section v-if="!applicationsStore.applications.length" class="applications-view__empty">
        <ApplicationEmptyState />
      </section>

      <section v-else-if="!filteredApplications.length" class="applications-view__empty-state">
        <div class="applications-view__empty-card workbench-card">
          <h2>{{ t('workbench.applications.emptyFilteredTitle') }}</h2>
          <p>{{ t('workbench.applications.emptyFilteredBody') }}</p>
          <NButton tertiary @click="clearFilters()">{{ t('workbench.applications.clearFilters') }}</NButton>
        </div>
      </section>

      <template v-else>
        <section v-if="viewMode === 'list'" class="applications-view__list">
          <ApplicationListItem
            v-for="application in prioritizedApplications"
            :key="application.id"
            :application="application"
          />
        </section>

        <section v-else class="applications-view__grid">
          <ApplicationCard
            v-for="application in prioritizedApplications"
            :key="application.id"
            :application="application"
          />
        </section>
      </template>
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.applications-view__title {
  max-width: 780px;
}

.applications-view__summary-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 16px 24px 0;
}

.applications-summary-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
  cursor: pointer;
}

.applications-summary-card--static {
  cursor: default;
}

.applications-summary-card__label {
  color: $text-secondary;
  font-size: 13px;
  font-weight: 600;
}

.applications-summary-card__value {
  color: $text-primary;
  font-size: 30px;
  font-weight: 800;
  line-height: 1;
}

.applications-view__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 24px 0;
}

.applications-view__filters {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) repeat(3, minmax(180px, 0.7fr));
  gap: 12px;
  flex: 1;
}

.applications-view__display-switch {
  display: inline-flex;
  padding: 4px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid $border-color;
}

.applications-view__display-btn {
  border: 0;
  background: transparent;
  color: $text-secondary;
  padding: 10px 14px;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
}

.applications-view__display-btn.active {
  background: rgba(var(--accent-primary-rgb), 0.1);
  color: $text-primary;
}

.applications-view__list,
.applications-view__grid {
  padding: 20px 24px 32px;
}

.applications-view__list {
  display: grid;
  gap: 12px;
}

.applications-view__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.applications-view__empty,
.applications-view__empty-state {
  padding: 24px;
}

.applications-view__empty-card {
  padding: 28px;
}

.applications-view__empty-card p {
  margin-top: 10px;
  color: $text-secondary;
}

@media (max-width: 1280px) {
  .applications-view__summary-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .applications-view__toolbar {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 1100px) {
  .applications-view__filters,
  .applications-view__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .applications-view__summary-strip {
    grid-template-columns: 1fr;
  }
}
</style>
