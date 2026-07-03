<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NCollapse, NCollapseItem, NSelect, NSpin } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import KanbanTaskCard from '@/components/hermes/kanban/KanbanTaskCard.vue'
import KanbanTaskDrawer from '@/components/hermes/kanban/KanbanTaskDrawer.vue'
import KanbanCreateForm from '@/components/hermes/kanban/KanbanCreateForm.vue'
import { useKanbanStore } from '@/stores/hermes/kanban'
import type { KanbanTask, KanbanTaskStatus } from '@/api/hermes/kanban'

const router = useRouter()
const { t, locale } = useI18n()
const kanbanStore = useKanbanStore()

const showCreateForm = ref(false)
const selectedTaskId = ref<string | null>(null)
const refreshTimer = ref<ReturnType<typeof setInterval> | null>(null)

const boardStatuses: KanbanTaskStatus[] = ['triage', 'todo', 'ready', 'running', 'blocked', 'done', 'archived']

const tasksByStatus = computed(() => {
  const grouped: Record<string, typeof kanbanStore.tasks> = {}
  for (const status of boardStatuses) {
    grouped[status] = kanbanStore.tasks
      .filter(task => task.status === status)
      .sort((left, right) => right.created_at - left.created_at)
  }
  return grouped
})

const blockedTasks = computed(() => tasksByStatus.value.blocked || [])
const runningTasks = computed(() => tasksByStatus.value.running || [])
const readyTasks = computed(() => tasksByStatus.value.ready || [])
const triageTasks = computed(() => tasksByStatus.value.triage || [])
const doneTasks = computed(() => tasksByStatus.value.done || [])

const selectedTask = computed(() =>
  kanbanStore.tasks.find(task => task.id === selectedTaskId.value) || null,
)

const primaryDecision = computed(() => {
  const blockedTask = blockedTasks.value[0]
  if (blockedTask) {
    return {
      tone: 'warning' as const,
      eyebrow: t('kanban.primaryDecisionBlockedEyebrow'),
      title: t('kanban.primaryDecisionBlockedTitle', { title: blockedTask.title }),
      body: blockedTask.body || t('kanban.primaryDecisionBlockedBody'),
      actionLabel: t('kanban.openSelectedTask'),
      taskId: blockedTask.id,
    }
  }

  const runningTask = runningTasks.value[0]
  if (runningTask) {
    return {
      tone: 'accent' as const,
      eyebrow: t('kanban.primaryDecisionRunningEyebrow'),
      title: t('kanban.primaryDecisionRunningTitle', { title: runningTask.title }),
      body: runningTask.body || t('kanban.primaryDecisionRunningBody'),
      actionLabel: t('kanban.openSelectedTask'),
      taskId: runningTask.id,
    }
  }

  const readyTask = readyTasks.value[0]
  if (readyTask) {
    return {
      tone: 'default' as const,
      eyebrow: t('kanban.primaryDecisionReadyEyebrow'),
      title: t('kanban.primaryDecisionReadyTitle', { title: readyTask.title }),
      body: readyTask.body || t('kanban.primaryDecisionReadyBody'),
      actionLabel: t('kanban.openSelectedTask'),
      taskId: readyTask.id,
    }
  }

  return {
    tone: 'calm' as const,
    eyebrow: t('kanban.primaryDecisionEmptyEyebrow'),
    title: t('kanban.primaryDecisionEmptyTitle'),
    body: t('kanban.primaryDecisionEmptyBody'),
    actionLabel: t('kanban.createTask'),
    taskId: null,
  }
})

const statusFilterOptions = computed(() => [
  { label: t('kanban.allStatuses'), value: '' },
  ...boardStatuses.map(status => ({ label: t(`kanban.columns.${status}`, status), value: status })),
])

const assigneeFilterOptions = computed(() => [
  { label: t('kanban.allAssignees'), value: '' },
  ...kanbanStore.assignees.map(assignee => {
    const total = Object.values(assignee.counts || {}).reduce((sum, count) => sum + count, 0)
    return { label: `${assignee.name} (${total})`, value: assignee.name }
  }),
])

const filterStatusValue = computed({
  get: () => kanbanStore.filterStatus || '',
  set: (value: string) => kanbanStore.setFilter('status', value || null),
})

const filterAssigneeValue = computed({
  get: () => kanbanStore.filterAssignee || '',
  set: (value: string) => kanbanStore.setFilter('assignee', value || null),
})

const decisionChecklist = computed(() => [
  { key: 'blocked', label: t('kanban.checklistBlocked'), count: blockedTasks.value.length },
  { key: 'running', label: t('kanban.checklistRunning'), count: runningTasks.value.length },
  { key: 'ready', label: t('kanban.checklistReady'), count: readyTasks.value.length },
  { key: 'triage', label: t('kanban.checklistTriage'), count: triageTasks.value.length },
  { key: 'done', label: t('kanban.checklistDone'), count: doneTasks.value.length },
])

function formatTime(timestamp: number | null): string {
  if (!timestamp) return t('kanban.notRecordedYet')
  return new Date(timestamp).toLocaleString(locale.value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(async () => {
  await kanbanStore.refreshAll()
  refreshTimer.value = setInterval(() => {
    if (document.visibilityState === 'visible') {
      void Promise.all([kanbanStore.fetchTasks(true), kanbanStore.fetchStats()])
    }
  }, 15000)
})

onUnmounted(() => {
  if (refreshTimer.value) clearInterval(refreshTimer.value)
})

function handleTaskClick(taskId: string) {
  selectedTaskId.value = taskId
}

function handleDrawerClose() {
  selectedTaskId.value = null
}

async function handleDrawerUpdated() {
  await Promise.all([kanbanStore.fetchTasks(), kanbanStore.fetchStats()])
}

async function handleApplyFilter() {
  await kanbanStore.fetchTasks()
}

async function handleTaskCreated() {
  await Promise.all([kanbanStore.fetchTasks(), kanbanStore.fetchStats()])
}

function handlePrimaryDecision() {
  if (primaryDecision.value.taskId) {
    handleTaskClick(primaryDecision.value.taskId)
    return
  }
  showCreateForm.value = true
}

function selectedTaskMeta(task: KanbanTask): string {
  const assignee = task.assignee || t('kanban.unassigned')
  return t('kanban.selectedMeta', {
    assignee,
    createdAt: formatTime(task.created_at),
  })
}
</script>

<template>
  <div class="kanban-view workbench-page">
    <section class="workbench-page__hero">
      <div class="workbench-page__hero-copy">
        <div class="workbench-page__eyebrow">{{ t('kanban.heroEyebrow') }}</div>
        <h1 class="workbench-page__title">{{ t('kanban.heroTitle') }}</h1>
        <p class="workbench-page__subtitle">{{ t('kanban.heroSubtitle') }}</p>
      </div>
      <div class="workbench-page__actions">
        <NButton secondary @click="router.push({ name: 'workbench.applications' })">
          {{ t('kanban.openApplications') }}
        </NButton>
        <NButton type="primary" @click="showCreateForm = true">
          {{ t('kanban.createTask') }}
        </NButton>
      </div>
    </section>

    <section class="kanban-view__decision-grid">
      <article class="kanban-guide workbench-panel" :class="`kanban-guide--${primaryDecision.tone}`">
        <div class="workbench-section-title">{{ primaryDecision.eyebrow }}</div>
        <h2 class="kanban-guide__title">{{ primaryDecision.title }}</h2>
        <p class="kanban-guide__body">{{ primaryDecision.body }}</p>
        <div class="kanban-guide__points">
          <div class="kanban-guide__point">{{ t('kanban.guidePoint1') }}</div>
          <div class="kanban-guide__point">{{ t('kanban.guidePoint2') }}</div>
          <div class="kanban-guide__point">{{ t('kanban.guidePoint3') }}</div>
        </div>
        <div class="kanban-guide__actions">
          <NButton type="primary" @click="handlePrimaryDecision()">
            {{ primaryDecision.actionLabel }}
          </NButton>
          <NButton quaternary @click="router.push({ name: 'workbench.runs' })">
            {{ t('kanban.openRuns') }}
          </NButton>
        </div>
      </article>

      <article class="kanban-checklist workbench-panel workbench-panel--soft">
        <div class="workbench-section-title">{{ t('kanban.checklistEyebrow') }}</div>
        <h2 class="kanban-checklist__title">{{ t('kanban.checklistTitle') }}</h2>
        <p class="kanban-checklist__body">{{ t('kanban.checklistBody') }}</p>
        <div class="kanban-checklist__list">
          <div v-for="item in decisionChecklist" :key="item.key" class="kanban-checklist__item">
            <span class="kanban-checklist__label">{{ item.label }}</span>
            <span class="kanban-checklist__count">{{ item.count }}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="kanban-view__summary-grid">
      <article class="kanban-stat workbench-panel">
        <div class="kanban-stat__label">{{ t('kanban.summaryTotal') }}</div>
        <div class="kanban-stat__value">{{ kanbanStore.stats?.total ?? kanbanStore.tasks.length }}</div>
        <div class="kanban-stat__meta">{{ t('kanban.summaryTotalMeta') }}</div>
      </article>

      <article class="kanban-stat workbench-panel">
        <div class="kanban-stat__label">{{ t('kanban.summaryAssignees') }}</div>
        <div class="kanban-stat__value">{{ kanbanStore.assignees.length }}</div>
        <div class="kanban-stat__meta">{{ t('kanban.summaryAssigneesMeta') }}</div>
      </article>

      <article class="kanban-stat workbench-panel">
        <div class="kanban-stat__label">{{ t('kanban.summaryAttention') }}</div>
        <div class="kanban-stat__value">{{ blockedTasks.length + triageTasks.length }}</div>
        <div class="kanban-stat__meta">{{ t('kanban.summaryAttentionMeta') }}</div>
      </article>

      <article class="kanban-stat workbench-panel">
        <div class="kanban-stat__label">{{ t('kanban.summarySelected') }}</div>
        <div class="kanban-stat__value">
          {{ selectedTask ? t(`kanban.columns.${selectedTask.status}`, selectedTask.status) : t('kanban.noSelectionShort') }}
        </div>
        <div class="kanban-stat__meta">
          {{ selectedTask ? selectedTaskMeta(selectedTask) : t('kanban.summarySelectedMeta') }}
        </div>
      </article>
    </section>

    <section class="kanban-view__content">
      <div class="kanban-shell workbench-panel workbench-panel--soft">
        <header class="page-header kanban-shell__header">
          <div class="kanban-shell__title-group">
            <h2 class="header-title">{{ t('kanban.title') }}</h2>
            <p class="kanban-shell__subtitle">{{ t('kanban.panelSubtitle') }}</p>
          </div>
          <div class="header-actions">
            <NSelect
              v-model:value="filterStatusValue"
              :options="statusFilterOptions"
              size="small"
              style="width: 150px;"
              @update:value="handleApplyFilter"
            />
            <NSelect
              v-model:value="filterAssigneeValue"
              :options="assigneeFilterOptions"
              size="small"
              style="width: 180px;"
              @update:value="handleApplyFilter"
            />
            <NButton size="small" @click="router.push({ name: 'workbench.resources' })">
              {{ t('kanban.openArtifacts') }}
            </NButton>
          </div>
        </header>

        <div v-if="kanbanStore.stats" class="stats-bar">
          <div v-for="status in boardStatuses" :key="status" class="stat-chip" :class="status">
            <span class="stat-count">{{ kanbanStore.stats.by_status[status] || 0 }}</span>
            <span class="stat-label">{{ t(`kanban.columns.${status}`, status) }}</span>
          </div>
          <div class="stat-chip total">
            <span class="stat-count">{{ kanbanStore.stats.total }}</span>
            <span class="stat-label">{{ t('kanban.stats.total') }}</span>
          </div>
        </div>

        <NSpin :show="kanbanStore.loading && kanbanStore.tasks.length === 0">
          <div class="kanban-board">
            <NCollapse>
              <NCollapseItem
                v-for="status in boardStatuses"
                :key="status"
                :title="`${t(`kanban.columns.${status}`, status)} (${tasksByStatus[status].length})`"
                :name="status"
              >
                <div class="task-list">
                  <KanbanTaskCard
                    v-for="task in tasksByStatus[status]"
                    :key="task.id"
                    :task="task"
                    @click="handleTaskClick(task.id)"
                  />
                  <div v-if="tasksByStatus[status].length === 0" class="column-empty">
                    {{ t('kanban.noTasks') }}
                  </div>
                </div>
              </NCollapseItem>
            </NCollapse>
          </div>
        </NSpin>
      </div>
    </section>

    <KanbanTaskDrawer
      :task-id="selectedTaskId"
      @close="handleDrawerClose"
      @updated="handleDrawerUpdated"
    />

    <KanbanCreateForm
      v-if="showCreateForm"
      @close="showCreateForm = false"
      @created="handleTaskCreated"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.kanban-view {
  min-height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
}

.kanban-view__decision-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 16px;
  padding: 0 24px 16px;
}

.kanban-guide {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.kanban-guide--warning {
  background:
    linear-gradient(135deg, rgba(178, 75, 66, 0.08), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.kanban-guide--accent {
  background:
    linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.09), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.kanban-guide__title,
.kanban-checklist__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  color: $text-primary;
}

.kanban-guide__body,
.kanban-checklist__body,
.kanban-shell__subtitle {
  color: $text-secondary;
  line-height: 1.7;
}

.kanban-guide__points,
.kanban-checklist__list {
  display: grid;
  gap: 10px;
}

.kanban-guide__point,
.kanban-checklist__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: rgba(255, 255, 255, 0.82);
}

.kanban-guide__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: auto;
}

.kanban-checklist__label,
.kanban-stat__label {
  color: $text-secondary;
}

.kanban-checklist__count,
.kanban-stat__value {
  font-size: 28px;
  font-weight: 700;
  color: $text-primary;
}

.kanban-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 0 24px 16px;
}

.kanban-stat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 142px;
}

.kanban-stat__meta {
  color: $text-muted;
  line-height: 1.6;
}

.kanban-view__content {
  padding: 0 24px 24px;
}

.kanban-shell {
  padding: 0;
  overflow: hidden;
}

.kanban-shell__header {
  padding: 18px 20px;
}

.kanban-shell__title-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stats-bar {
  display: flex;
  gap: 8px;
  padding: 0 20px 14px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  border: 1px solid $border-light;

  &.triage,
  &.todo,
  &.ready {
    border-left: 3px solid $text-muted;
  }

  &.running {
    border-left: 3px solid $accent-primary;
  }

  &.blocked {
    border-left: 3px solid $error;
  }

  &.done {
    border-left: 3px solid $success;
  }

  &.archived {
    border-left: 3px solid $border-color;
  }

  &.total {
    border-left: 3px solid $text-primary;
  }
}

.stat-count {
  font-weight: 600;
  color: $text-primary;
}

.stat-label {
  color: $text-muted;
}

.kanban-board {
  padding: 0 20px 20px;
  min-height: 0;
  overflow-y: auto;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.column-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  font-size: 12px;
  color: $text-muted;
}

@media (max-width: 1100px) {
  .kanban-view__decision-grid,
  .kanban-view__summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: $breakpoint-mobile) {
  .kanban-view__decision-grid,
  .kanban-view__summary-grid,
  .kanban-view__content {
    padding-left: 12px;
    padding-right: 12px;
  }

  .kanban-shell__header {
    padding: 16px 12px 12px;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .header-actions {
    flex-wrap: wrap;
    width: 100%;
  }

  .kanban-checklist__count,
  .kanban-stat__value {
    font-size: 22px;
  }

  .stats-bar,
  .kanban-board {
    padding-left: 12px;
    padding-right: 12px;
  }
}
</style>
