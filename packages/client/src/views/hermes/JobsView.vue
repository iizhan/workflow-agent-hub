<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NSpin } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import JobsPanel from '@/components/hermes/jobs/JobsPanel.vue'
import JobRunHistory from '@/components/hermes/jobs/JobRunHistory.vue'
import JobFormModal from '@/components/hermes/jobs/JobFormModal.vue'
import { useJobsStore } from '@/stores/hermes/jobs'

const router = useRouter()
const { t, locale } = useI18n()
const jobsStore = useJobsStore()
const showModal = ref(false)
const editingJob = ref<string | null>(null)
const selectedJobId = ref<string | null>(null)

const jobNameMap = computed(() => {
  const map: Record<string, string> = {}
  for (const job of jobsStore.jobs) {
    const id = job.job_id || job.id
    map[id] = job.name
  }
  return map
})

const failedJobs = computed(() =>
  jobsStore.jobs.filter(job => job.last_status === 'failed' || !!job.last_error || !!job.last_delivery_error),
)

const pausedJobs = computed(() =>
  jobsStore.jobs.filter(job => !!job.paused_at || !job.enabled || job.state === 'paused' || job.state === 'disabled'),
)

const activeJobs = computed(() =>
  jobsStore.jobs.filter(job => job.enabled && !job.paused_at && job.state !== 'disabled'),
)

const scheduledJobs = computed(() =>
  activeJobs.value.filter(job => !!job.next_run_at),
)

const neverRunJobs = computed(() =>
  jobsStore.jobs.filter(job => !job.last_run_at),
)

const selectedJob = computed(() =>
  jobsStore.jobs.find(job => (job.job_id || job.id) === selectedJobId.value) || null,
)

const primaryDecision = computed(() => {
  const failedJob = failedJobs.value[0]
  if (failedJob) {
    return {
      tone: 'warning' as const,
      eyebrow: t('jobs.primaryDecisionAttentionEyebrow'),
      title: t('jobs.primaryDecisionAttentionTitle', { name: failedJob.name }),
      body: failedJob.last_error || failedJob.last_delivery_error || t('jobs.primaryDecisionAttentionBody'),
      actionLabel: t('jobs.openSelectedHistory'),
      jobId: failedJob.job_id || failedJob.id,
    }
  }

  const pausedJob = pausedJobs.value[0]
  if (pausedJob) {
    return {
      tone: 'default' as const,
      eyebrow: t('jobs.primaryDecisionPausedEyebrow'),
      title: t('jobs.primaryDecisionPausedTitle', { name: pausedJob.name }),
      body: pausedJob.paused_reason || t('jobs.primaryDecisionPausedBody'),
      actionLabel: t('jobs.reviewSchedule'),
      jobId: pausedJob.job_id || pausedJob.id,
    }
  }

  const upcomingJob = scheduledJobs.value[0]
  if (upcomingJob) {
    return {
      tone: 'accent' as const,
      eyebrow: t('jobs.primaryDecisionUpcomingEyebrow'),
      title: t('jobs.primaryDecisionUpcomingTitle', { name: upcomingJob.name }),
      body: upcomingJob.schedule_display || t('jobs.primaryDecisionUpcomingBody'),
      actionLabel: t('jobs.openSelectedSchedule'),
      jobId: upcomingJob.job_id || upcomingJob.id,
    }
  }

  return {
    tone: 'calm' as const,
    eyebrow: t('jobs.primaryDecisionEmptyEyebrow'),
    title: t('jobs.primaryDecisionEmptyTitle'),
    body: t('jobs.primaryDecisionEmptyBody'),
    actionLabel: t('jobs.createJob'),
    jobId: null,
  }
})

const decisionChecklist = computed(() => [
  { key: 'attention', label: t('jobs.checklistAttention'), count: failedJobs.value.length },
  { key: 'paused', label: t('jobs.checklistPaused'), count: pausedJobs.value.length },
  { key: 'active', label: t('jobs.checklistActive'), count: activeJobs.value.length },
  { key: 'scheduled', label: t('jobs.checklistScheduled'), count: scheduledJobs.value.length },
  { key: 'firstRun', label: t('jobs.checklistFirstRun'), count: neverRunJobs.value.length },
])

function formatDate(value: string | null): string {
  if (!value) return t('jobs.notScheduledYet')
  return new Date(value).toLocaleString(locale.value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(() => {
  jobsStore.fetchJobs()
})

function openCreateModal() {
  editingJob.value = null
  showModal.value = true
}

function openEditModal(jobId: string) {
  editingJob.value = jobId
  showModal.value = true
}

function handleModalClose() {
  showModal.value = false
  editingJob.value = null
}

async function handleSave() {
  await jobsStore.fetchJobs()
  handleModalClose()
}

function handleSelectJob(jobId: string | null) {
  selectedJobId.value = selectedJobId.value === jobId ? null : jobId
}

function handlePrimaryDecision() {
  if (primaryDecision.value.jobId) {
    handleSelectJob(primaryDecision.value.jobId)
    return
  }
  openCreateModal()
}
</script>

<template>
  <div class="jobs-view workbench-page">
    <section class="workbench-page__hero">
      <div class="workbench-page__hero-copy">
        <div class="workbench-page__eyebrow">{{ t('jobs.heroEyebrow') }}</div>
        <h1 class="workbench-page__title">{{ t('jobs.heroTitle') }}</h1>
        <p class="workbench-page__subtitle">{{ t('jobs.heroSubtitle') }}</p>
      </div>
      <div class="workbench-page__actions">
        <NButton secondary @click="router.push({ name: 'workbench.runs' })">
          {{ t('jobs.openRuns') }}
        </NButton>
        <NButton type="primary" @click="openCreateModal">
          {{ t('jobs.createJob') }}
        </NButton>
      </div>
    </section>

    <section class="jobs-view__decision-grid">
      <article class="jobs-guide workbench-panel" :class="`jobs-guide--${primaryDecision.tone}`">
        <div class="workbench-section-title">{{ primaryDecision.eyebrow }}</div>
        <h2 class="jobs-guide__title">{{ primaryDecision.title }}</h2>
        <p class="jobs-guide__body">{{ primaryDecision.body }}</p>
        <div class="jobs-guide__points">
          <div class="jobs-guide__point">{{ t('jobs.guidePoint1') }}</div>
          <div class="jobs-guide__point">{{ t('jobs.guidePoint2') }}</div>
          <div class="jobs-guide__point">{{ t('jobs.guidePoint3') }}</div>
        </div>
        <div class="jobs-guide__actions">
          <NButton type="primary" @click="handlePrimaryDecision()">
            {{ primaryDecision.actionLabel }}
          </NButton>
          <NButton quaternary @click="router.push({ name: 'workbench.applications' })">
            {{ t('jobs.openApplications') }}
          </NButton>
        </div>
      </article>

      <article class="jobs-checklist workbench-panel workbench-panel--soft">
        <div class="workbench-section-title">{{ t('jobs.checklistEyebrow') }}</div>
        <h2 class="jobs-checklist__title">{{ t('jobs.checklistTitle') }}</h2>
        <p class="jobs-checklist__body">{{ t('jobs.checklistBody') }}</p>
        <div class="jobs-checklist__list">
          <div v-for="item in decisionChecklist" :key="item.key" class="jobs-checklist__item">
            <span class="jobs-checklist__label">{{ item.label }}</span>
            <span class="jobs-checklist__count">{{ item.count }}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="jobs-view__summary-grid">
      <article class="jobs-stat workbench-panel">
        <div class="jobs-stat__label">{{ t('jobs.summaryTotal') }}</div>
        <div class="jobs-stat__value">{{ jobsStore.jobs.length }}</div>
        <div class="jobs-stat__meta">{{ t('jobs.summaryTotalMeta') }}</div>
      </article>

      <article class="jobs-stat workbench-panel">
        <div class="jobs-stat__label">{{ t('jobs.summaryScheduled') }}</div>
        <div class="jobs-stat__value">{{ scheduledJobs.length }}</div>
        <div class="jobs-stat__meta">{{ t('jobs.summaryScheduledMeta') }}</div>
      </article>

      <article class="jobs-stat workbench-panel">
        <div class="jobs-stat__label">{{ t('jobs.summaryAttention') }}</div>
        <div class="jobs-stat__value">{{ failedJobs.length }}</div>
        <div class="jobs-stat__meta">{{ t('jobs.summaryAttentionMeta') }}</div>
      </article>

      <article class="jobs-stat workbench-panel">
        <div class="jobs-stat__label">{{ t('jobs.summarySelected') }}</div>
        <div class="jobs-stat__value">
          {{ selectedJob ? formatDate(selectedJob.next_run_at) : t('jobs.noSelectionShort') }}
        </div>
        <div class="jobs-stat__meta">
          {{
            selectedJob
              ? t('jobs.selectedMeta', {
                name: selectedJob.name,
                lastRun: formatDate(selectedJob.last_run_at),
              })
              : t('jobs.summarySelectedMeta')
          }}
        </div>
      </article>
    </section>

    <section class="jobs-view__content">
      <div class="jobs-shell workbench-panel workbench-panel--soft">
        <header class="page-header jobs-shell__header">
          <div class="jobs-shell__title-group">
            <h2 class="header-title">{{ t('jobs.title') }}</h2>
            <p class="jobs-shell__subtitle">{{ t('jobs.panelSubtitle') }}</p>
          </div>
        </header>

        <div class="jobs-split">
          <div class="jobs-top">
            <NSpin :show="jobsStore.loading && jobsStore.jobs.length === 0">
              <JobsPanel
                :selected-job-id="selectedJobId"
                @edit="openEditModal"
                @select="handleSelectJob"
              />
            </NSpin>
          </div>

          <div class="splitter" />

          <div class="jobs-bottom">
            <JobRunHistory
              :selected-job-id="selectedJobId"
              :job-name-map="jobNameMap"
            />
          </div>
        </div>
      </div>
    </section>

    <JobFormModal
      v-if="showModal"
      :job-id="editingJob"
      @close="handleModalClose"
      @saved="handleSave"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.jobs-view {
  min-height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
}

.jobs-view__decision-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 16px;
  padding: 0 24px 16px;
}

.jobs-guide {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.jobs-guide--warning {
  background:
    linear-gradient(135deg, rgba(178, 75, 66, 0.08), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.jobs-guide--accent {
  background:
    linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.09), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.jobs-guide__title,
.jobs-checklist__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  color: $text-primary;
}

.jobs-guide__body,
.jobs-checklist__body,
.jobs-shell__subtitle {
  color: $text-secondary;
  line-height: 1.7;
}

.jobs-guide__points,
.jobs-checklist__list {
  display: grid;
  gap: 10px;
}

.jobs-guide__point,
.jobs-checklist__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: rgba(255, 255, 255, 0.82);
}

.jobs-guide__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: auto;
}

.jobs-checklist__label,
.jobs-stat__label {
  color: $text-secondary;
}

.jobs-checklist__count,
.jobs-stat__value {
  font-size: 28px;
  font-weight: 700;
  color: $text-primary;
}

.jobs-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 0 24px 16px;
}

.jobs-stat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 142px;
}

.jobs-stat__meta {
  color: $text-muted;
  line-height: 1.6;
}

.jobs-view__content {
  padding: 0 24px 24px;
}

.jobs-shell {
  padding: 0;
  overflow: hidden;
}

.jobs-shell__header {
  padding: 18px 20px;
}

.jobs-shell__title-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.jobs-split {
  display: flex;
  flex-direction: column;
  min-height: 720px;
}

.jobs-top {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  min-height: 220px;
}

.splitter {
  height: 1px;
  background: $border-light;
  flex-shrink: 0;
}

.jobs-bottom {
  flex: 1;
  min-height: 220px;
  overflow: hidden;
}

@media (max-width: 1100px) {
  .jobs-view__decision-grid,
  .jobs-view__summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: $breakpoint-mobile) {
  .jobs-view__decision-grid,
  .jobs-view__summary-grid,
  .jobs-view__content {
    padding-left: 12px;
    padding-right: 12px;
  }

  .jobs-checklist__count,
  .jobs-stat__value {
    font-size: 22px;
  }

  .jobs-split {
    min-height: 640px;
  }
}
</style>
