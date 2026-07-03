<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NButton, NSelect, NSpin, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { fetchLogFiles, fetchLogs, type LogEntry } from '@/api/hermes/logs'

const { t } = useI18n()
const message = useMessage()
const route = useRoute()
const router = useRouter()

const logFiles = ref<{ name: string; size: string; modified: string }[]>([])
const selectedLog = ref('agent')
const entries = ref<LogEntry[]>([])
const loading = ref(false)
const lineCount = ref(100)
const levelFilter = ref<string>('')
const searchQuery = ref('')

const logOptions = computed(() =>
  logFiles.value.map(file => ({ label: `${file.name} (${file.size})`, value: file.name })),
)

const levelOptions = computed(() => [
  { label: t('logs.all'), value: '' },
  { label: 'ERROR', value: 'ERROR' },
  { label: 'WARNING', value: 'WARNING' },
  { label: 'INFO', value: 'INFO' },
  { label: 'DEBUG', value: 'DEBUG' },
])

const lineOptions = [
  { label: '50', value: 50 },
  { label: '100', value: 100 },
  { label: '200', value: 200 },
  { label: '500', value: 500 },
]

const filteredEntries = computed(() => {
  if (!searchQuery.value) return entries.value
  const query = searchQuery.value.toLowerCase()
  return entries.value.filter(entry =>
    entry.message.toLowerCase().includes(query)
    || entry.logger.toLowerCase().includes(query)
    || entry.raw.toLowerCase().includes(query),
  )
})

const errorCount = computed(() =>
  entries.value.filter(entry => entry.level === 'ERROR').length,
)

const warningCount = computed(() =>
  entries.value.filter(entry => entry.level === 'WARNING').length,
)

const visibleCount = computed(() => filteredEntries.value.length)

const selectedLogMeta = computed(() =>
  logFiles.value.find(item => item.name === selectedLog.value) || null,
)

function levelClass(level: string): string {
  switch (level) {
    case 'ERROR':
      return 'level-error'
    case 'WARNING':
      return 'level-warning'
    case 'DEBUG':
      return 'level-debug'
    default:
      return 'level-info'
  }
}

function formatTime(ts: string): string {
  const match = ts.match(/\d{2}:\d{2}:\d{2}/)
  return match ? match[0] : ts
}

function parseAccessLog(msg: string) {
  const match = msg.match(/"(\w+)\s+(\S+)\s+HTTP\/[^"]+"\s+(\d+)/)
  if (match) {
    return { method: match[1], path: match[2], status: match[3] }
  }
  return null
}

async function loadLogs() {
  loading.value = true
  try {
    const data = await fetchLogs(selectedLog.value, {
      lines: lineCount.value,
      level: levelFilter.value || undefined,
    })
    entries.value = data.filter((entry): entry is LogEntry => entry !== null)
  } catch (error: any) {
    message.error(error.message)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  logFiles.value = await fetchLogFiles()
  const requestedLog = typeof route.query.log === 'string' ? route.query.log : ''
  if (requestedLog && logFiles.value.some(item => item.name === requestedLog)) {
    selectedLog.value = requestedLog
  }
  const requestedQuery = typeof route.query.q === 'string' ? route.query.q : ''
  if (requestedQuery) {
    searchQuery.value = requestedQuery
  }
  await loadLogs()
})
</script>

<template>
  <div class="logs-view workbench-page">
    <section class="workbench-page__hero">
      <div class="workbench-page__hero-copy">
        <div class="workbench-page__eyebrow">{{ t('logs.heroEyebrow') }}</div>
        <h1 class="workbench-page__title">{{ t('logs.heroTitle') }}</h1>
        <p class="workbench-page__subtitle">{{ t('logs.heroSubtitle') }}</p>
      </div>
      <div class="workbench-page__actions">
        <NButton secondary @click="router.push({ name: 'hermes.gateways' })">
          {{ t('logs.openGateways') }}
        </NButton>
        <NButton type="primary" @click="router.push({ name: 'workbench.system' })">
          {{ t('logs.openSystemControl') }}
        </NButton>
      </div>
    </section>

    <section class="logs-view__decision-grid">
      <article class="logs-guide workbench-panel">
        <div class="workbench-section-title">{{ t('logs.guideEyebrow') }}</div>
        <h2 class="logs-guide__title">{{ t('logs.guideTitle') }}</h2>
        <p class="logs-guide__body">{{ t('logs.guideBody') }}</p>
        <div class="logs-guide__points">
          <div class="logs-guide__point">{{ t('logs.guidePoint1') }}</div>
          <div class="logs-guide__point">{{ t('logs.guidePoint2') }}</div>
          <div class="logs-guide__point">{{ t('logs.guidePoint3') }}</div>
        </div>
      </article>

      <article class="logs-checklist workbench-panel workbench-panel--soft">
        <div class="workbench-section-title">{{ t('logs.checklistEyebrow') }}</div>
        <h2 class="logs-checklist__title">{{ t('logs.checklistTitle') }}</h2>
        <p class="logs-checklist__body">{{ t('logs.checklistBody') }}</p>
        <div class="logs-checklist__list">
          <div class="logs-checklist__item">
            <span class="logs-checklist__label">{{ t('logs.selectedLog') }}</span>
            <span class="logs-checklist__value">{{ selectedLog }}</span>
          </div>
          <div class="logs-checklist__item">
            <span class="logs-checklist__label">{{ t('logs.visibleEntries') }}</span>
            <span class="logs-checklist__value">{{ visibleCount }}</span>
          </div>
          <div class="logs-checklist__item">
            <span class="logs-checklist__label">{{ t('logs.errorEntries') }}</span>
            <span class="logs-checklist__value">{{ errorCount }}</span>
          </div>
          <div class="logs-checklist__item">
            <span class="logs-checklist__label">{{ t('logs.warningEntries') }}</span>
            <span class="logs-checklist__value">{{ warningCount }}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="logs-view__summary-grid">
      <article class="logs-stat workbench-panel">
        <div class="logs-stat__label">{{ t('logs.selectedLog') }}</div>
        <div class="logs-stat__value">{{ selectedLog }}</div>
        <div class="logs-stat__meta">
          {{ selectedLogMeta?.modified || t('logs.logMetaUnavailable') }}
        </div>
      </article>

      <article class="logs-stat workbench-panel">
        <div class="logs-stat__label">{{ t('logs.visibleEntries') }}</div>
        <div class="logs-stat__value">{{ visibleCount }}</div>
        <div class="logs-stat__meta">{{ t('logs.visibleEntriesMeta') }}</div>
      </article>

      <article class="logs-stat workbench-panel">
        <div class="logs-stat__label">{{ t('logs.errorEntries') }}</div>
        <div class="logs-stat__value">{{ errorCount }}</div>
        <div class="logs-stat__meta">{{ t('logs.errorEntriesMeta') }}</div>
      </article>

      <article class="logs-stat workbench-panel">
        <div class="logs-stat__label">{{ t('logs.warningEntries') }}</div>
        <div class="logs-stat__value">{{ warningCount }}</div>
        <div class="logs-stat__meta">{{ t('logs.warningEntriesMeta') }}</div>
      </article>
    </section>

    <section class="logs-view__content">
      <div class="logs-shell workbench-panel workbench-panel--soft">
        <header class="page-header logs-shell__header">
          <div class="logs-shell__title-group">
            <h2 class="header-title">{{ t('logs.title') }}</h2>
            <p class="logs-shell__subtitle">{{ t('logs.panelSubtitle') }}</p>
          </div>
          <div class="header-actions">
            <NSelect
              v-model:value="selectedLog"
              :options="logOptions"
              size="small"
              class="input-md"
              @update:value="loadLogs"
            />
            <NSelect
              :value="levelFilter"
              :options="levelOptions"
              size="small"
              class="input-sm"
              @update:value="(value: string) => { levelFilter = value; loadLogs() }"
            />
            <NSelect
              :value="lineCount"
              :options="lineOptions"
              size="small"
              class="input-sm"
              @update:value="(value: number) => { lineCount = value; loadLogs() }"
            />
            <input
              v-model="searchQuery"
              class="search-input"
              :placeholder="t('logs.searchPlaceholder')"
            />
            <NButton size="small" :loading="loading" @click="loadLogs">{{ t('logs.refresh') }}</NButton>
          </div>
        </header>

        <div class="logs-body">
          <NSpin :show="loading">
            <div v-if="filteredEntries.length === 0 && !loading" class="logs-empty">
              <div class="logs-empty__title">{{ t('logs.noEntries') }}</div>
              <p class="logs-empty__body">{{ t('logs.noEntriesBody') }}</p>
            </div>
            <div class="log-list">
              <div
                v-for="(entry, idx) in filteredEntries"
                :key="idx"
                class="log-entry"
                :class="levelClass(entry.level)"
              >
                <span class="log-time">{{ formatTime(entry.timestamp) }}</span>
                <span class="log-level" :class="levelClass(entry.level)">{{ entry.level }}</span>
                <span class="log-logger">{{ entry.logger }}</span>
                <template v-if="parseAccessLog(entry.message)">
                  <span class="access-method">{{ parseAccessLog(entry.message)!.method }}</span>
                  <span class="access-path">{{ parseAccessLog(entry.message)!.path }}</span>
                  <span class="access-status" :class="'status-' + (parseAccessLog(entry.message)!.status?.[0] || 'x')">
                    {{ parseAccessLog(entry.message)!.status }}
                  </span>
                </template>
                <span v-else class="log-message">{{ entry.message }}</span>
              </div>
            </div>
          </NSpin>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.logs-view {
  min-height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
}

.logs-view__decision-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
  gap: 16px;
  padding: 0 24px 16px;
}

.logs-guide {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 220px;
  background:
    linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.09), rgba(255, 255, 255, 0.92)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.9));
}

.logs-guide__title,
.logs-checklist__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  color: $text-primary;
}

.logs-guide__body,
.logs-checklist__body,
.logs-shell__subtitle {
  color: $text-secondary;
  line-height: 1.7;
}

.logs-guide__points,
.logs-checklist__list {
  display: grid;
  gap: 10px;
}

.logs-guide__point,
.logs-checklist__item {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid $border-color;
  background: rgba(255, 255, 255, 0.72);
}

.logs-checklist {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.logs-checklist__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.logs-checklist__label {
  color: $text-primary;
  font-weight: 600;
}

.logs-checklist__value {
  min-width: 34px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: $text-primary;
  font-weight: 700;
  text-align: center;
}

.logs-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 0 24px 16px;
}

.logs-stat__label {
  font-size: 12px;
  color: $text-muted;
}

.logs-stat__value {
  margin-top: 8px;
  font-size: 30px;
  font-weight: 700;
  color: $text-primary;
}

.logs-stat__meta {
  margin-top: 8px;
  color: $text-secondary;
  line-height: 1.6;
}

.logs-view__content {
  flex: 1;
  min-height: 0;
  padding: 0 24px 24px;
}

.logs-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.logs-shell__header {
  gap: 12px;
  flex-wrap: wrap;
  padding-inline: 0;
  padding-top: 0;
}

.logs-shell__title-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.search-input {
  padding: 4px 10px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $bg-input;
  color: $text-primary;
  font-size: 13px;
  outline: none;
  width: 160px;
  transition: border-color $transition-fast;

  &:focus {
    border-color: $accent-primary;
  }

  &::placeholder {
    color: $text-muted;
  }
}

.logs-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.logs-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 100%;
  padding: 40px 20px;
  text-align: center;
}

.logs-empty__title {
  color: $text-primary;
  font-size: 16px;
  font-weight: 700;
}

.logs-empty__body {
  max-width: 520px;
  color: $text-muted;
  font-size: 13px;
  line-height: 1.7;
}

.log-list {
  padding: 4px 0;
}

.log-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-family: $font-code;
  font-size: 12px;
  line-height: 1.6;
  border-left: 2px solid transparent;

  &:hover {
    background-color: rgba(var(--accent-primary-rgb), 0.03);
  }

  &.level-error {
    border-left-color: $error;

    .log-message {
      color: $error;
    }
  }

  &.level-warning {
    border-left-color: $warning;

    .log-message {
      color: $warning;
    }
  }
}

.log-time {
  color: $text-muted;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.log-level {
  flex-shrink: 0;
  min-width: 42px;
  padding: 0 4px;
  border-radius: 2px;
  font-size: 10px;
  font-weight: 600;
  text-align: center;

  &.level-error {
    background: rgba(var(--error-rgb), 0.12);
    color: $error;
  }

  &.level-warning {
    background: rgba(var(--warning-rgb), 0.12);
    color: $warning;
  }

  &.level-debug {
    background: rgba(var(--accent-primary-rgb), 0.06);
    color: $text-muted;
  }

  &.level-info {
    background: rgba(var(--accent-primary-rgb), 0.06);
    color: $text-muted;
  }
}

.log-logger {
  max-width: 160px;
  overflow: hidden;
  color: $text-muted;
  flex-shrink: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-message {
  min-width: 0;
  color: $text-secondary;
  overflow: visible;
  white-space: normal;
  word-break: break-word;
}

.access-method {
  color: $accent-primary;
  flex-shrink: 0;
  font-weight: 700;
}

.access-path {
  min-width: 0;
  color: $accent-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.access-status {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;

  &.status-2 {
    color: $success;
  }

  &.status-3 {
    color: $warning;
  }

  &.status-4,
  &.status-5 {
    color: $error;
  }
}

@media (max-width: 1200px) {
  .logs-view__decision-grid,
  .logs-view__summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .logs-view__content,
  .logs-view__decision-grid,
  .logs-view__summary-grid {
    padding-inline: 12px;
  }

  .logs-shell__header {
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
  }

  .log-entry {
    flex-wrap: wrap;
  }
}
</style>
