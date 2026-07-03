<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import MarkdownRenderer from '@/components/hermes/chat/MarkdownRenderer.vue'
import { fetchMemory, saveMemory, type MemoryData } from '@/api/hermes/skills'

const router = useRouter()
const { t, locale } = useI18n()
const message = useMessage()
const loading = ref(false)
const data = ref<MemoryData | null>(null)
const editingSection = ref<'memory' | 'user' | 'soul' | null>(null)
const editContent = ref('')
const saving = ref(false)

onMounted(loadMemory)

async function loadMemory() {
  loading.value = true
  try {
    data.value = await fetchMemory()
  } catch (err: any) {
    console.error('Failed to load memory:', err)
    message.error(t('memory.loadFailed'))
  } finally {
    loading.value = false
  }
}

function startEdit(section: 'memory' | 'user' | 'soul') {
  editingSection.value = section
  editContent.value = data.value?.[section] || ''
}

function cancelEdit() {
  editingSection.value = null
  editContent.value = ''
}

async function handleSave() {
  if (!editingSection.value) return
  saving.value = true
  try {
    await saveMemory(editingSection.value, editContent.value)
    await loadMemory()
    editingSection.value = null
    editContent.value = ''
    message.success(t('common.saved'))
  } catch (err: any) {
    message.error(`${t('common.saveFailed')}: ${err.message}`)
  } finally {
    saving.value = false
  }
}

function formatTime(ts: number | null): string {
  if (!ts) return t('memory.notRecordedYet')
  return new Date(ts).toLocaleString(locale.value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const memoryEmpty = computed(() => !data.value?.memory?.trim())
const userEmpty = computed(() => !data.value?.user?.trim())
const soulEmpty = computed(() => !data.value?.soul?.trim())

const displayMemory = computed(() => (data.value?.memory || '').replace(/§/g, '\n\n'))
const displayUser = computed(() => (data.value?.user || '').replace(/§/g, '\n\n'))
const displaySoul = computed(() => (data.value?.soul || '').replace(/§/g, '\n\n'))

const filledSections = computed(() =>
  [memoryEmpty.value, userEmpty.value, soulEmpty.value].filter(empty => !empty).length,
)

const latestUpdatedAt = computed(() => {
  const timestamps = [
    data.value?.memory_mtime ?? 0,
    data.value?.user_mtime ?? 0,
    data.value?.soul_mtime ?? 0,
  ].filter(Boolean)
  return timestamps.length ? Math.max(...timestamps) : null
})

const primaryDecision = computed(() => {
  if (userEmpty.value) {
    return {
      tone: 'accent' as const,
      eyebrow: t('memory.primaryDecisionProfileEyebrow'),
      title: t('memory.primaryDecisionProfileTitle'),
      body: t('memory.primaryDecisionProfileBody'),
      actionLabel: t('memory.fillUserProfile'),
      action: () => startEdit('user'),
    }
  }

  if (soulEmpty.value) {
    return {
      tone: 'default' as const,
      eyebrow: t('memory.primaryDecisionSoulEyebrow'),
      title: t('memory.primaryDecisionSoulTitle'),
      body: t('memory.primaryDecisionSoulBody'),
      actionLabel: t('memory.fillSoul'),
      action: () => startEdit('soul'),
    }
  }

  if (memoryEmpty.value) {
    return {
      tone: 'default' as const,
      eyebrow: t('memory.primaryDecisionNotesEyebrow'),
      title: t('memory.primaryDecisionNotesTitle'),
      body: t('memory.primaryDecisionNotesBody'),
      actionLabel: t('memory.captureNotes'),
      action: () => startEdit('memory'),
    }
  }

  return {
    tone: 'calm' as const,
    eyebrow: t('memory.primaryDecisionReviewEyebrow'),
    title: t('memory.primaryDecisionReviewTitle'),
    body: t('memory.primaryDecisionReviewBody'),
    actionLabel: t('memory.openChatValidation'),
    action: () => router.push({ name: 'hermes.chat' }),
  }
})

const decisionChecklist = computed(() => [
  { key: 'notes', label: t('memory.checklistNotes'), count: memoryEmpty.value ? 0 : 1 },
  { key: 'profile', label: t('memory.checklistProfile'), count: userEmpty.value ? 0 : 1 },
  { key: 'soul', label: t('memory.checklistSoul'), count: soulEmpty.value ? 0 : 1 },
  { key: 'impact', label: t('memory.checklistImpact'), count: filledSections.value },
  { key: 'updated', label: t('memory.checklistUpdated'), count: latestUpdatedAt.value ? 1 : 0 },
])
</script>

<template>
  <div class="memory-view workbench-page">
    <section class="workbench-page__hero">
      <div class="workbench-page__hero-copy">
        <div class="workbench-page__eyebrow">{{ t('memory.heroEyebrow') }}</div>
        <h1 class="workbench-page__title">{{ t('memory.heroTitle') }}</h1>
        <p class="workbench-page__subtitle">{{ t('memory.heroSubtitle') }}</p>
      </div>
      <div class="workbench-page__actions">
        <NButton secondary @click="router.push({ name: 'workbench.applications' })">
          {{ t('memory.openApplications') }}
        </NButton>
        <NButton type="primary" @click="loadMemory">
          {{ t('memory.refresh') }}
        </NButton>
      </div>
    </section>

    <section class="memory-view__decision-grid">
      <article class="memory-guide workbench-panel" :class="`memory-guide--${primaryDecision.tone}`">
        <div class="workbench-section-title">{{ primaryDecision.eyebrow }}</div>
        <h2 class="memory-guide__title">{{ primaryDecision.title }}</h2>
        <p class="memory-guide__body">{{ primaryDecision.body }}</p>
        <div class="memory-guide__points">
          <div class="memory-guide__point">{{ t('memory.guidePoint1') }}</div>
          <div class="memory-guide__point">{{ t('memory.guidePoint2') }}</div>
          <div class="memory-guide__point">{{ t('memory.guidePoint3') }}</div>
        </div>
        <div class="memory-guide__actions">
          <NButton type="primary" @click="primaryDecision.action()">
            {{ primaryDecision.actionLabel }}
          </NButton>
          <NButton quaternary @click="router.push({ name: 'hermes.groupChat' })">
            {{ t('memory.openAgents') }}
          </NButton>
        </div>
      </article>

      <article class="memory-checklist workbench-panel workbench-panel--soft">
        <div class="workbench-section-title">{{ t('memory.checklistEyebrow') }}</div>
        <h2 class="memory-checklist__title">{{ t('memory.checklistTitle') }}</h2>
        <p class="memory-checklist__body">{{ t('memory.checklistBody') }}</p>
        <div class="memory-checklist__list">
          <div v-for="item in decisionChecklist" :key="item.key" class="memory-checklist__item">
            <span class="memory-checklist__label">{{ item.label }}</span>
            <span class="memory-checklist__count">{{ item.count }}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="memory-view__summary-grid">
      <article class="memory-stat workbench-panel">
        <div class="memory-stat__label">{{ t('memory.summaryCoverage') }}</div>
        <div class="memory-stat__value">{{ filledSections }}/3</div>
        <div class="memory-stat__meta">{{ t('memory.summaryCoverageMeta') }}</div>
      </article>

      <article class="memory-stat workbench-panel">
        <div class="memory-stat__label">{{ t('memory.summaryLatestUpdate') }}</div>
        <div class="memory-stat__value">{{ formatTime(latestUpdatedAt) }}</div>
        <div class="memory-stat__meta">{{ t('memory.summaryLatestUpdateMeta') }}</div>
      </article>

      <article class="memory-stat workbench-panel">
        <div class="memory-stat__label">{{ t('memory.summaryNextValidation') }}</div>
        <div class="memory-stat__value">{{ filledSections === 3 ? t('memory.readyToValidate') : t('memory.needsMoreContext') }}</div>
        <div class="memory-stat__meta">{{ t('memory.summaryNextValidationMeta') }}</div>
      </article>

      <article class="memory-stat workbench-panel">
        <div class="memory-stat__label">{{ t('memory.summaryScope') }}</div>
        <div class="memory-stat__value">{{ t('memory.sharedScopeShort') }}</div>
        <div class="memory-stat__meta">{{ t('memory.summaryScopeMeta') }}</div>
      </article>
    </section>

    <section class="memory-view__content">
      <div class="memory-shell workbench-panel workbench-panel--soft">
        <header class="page-header memory-shell__header">
          <div class="memory-shell__title-group">
            <h2 class="header-title">{{ t('memory.title') }}</h2>
            <p class="memory-shell__subtitle">{{ t('memory.panelSubtitle') }}</p>
          </div>
          <div class="header-actions">
            <NButton size="small" @click="router.push({ name: 'hermes.chat' })">
              {{ t('memory.openChatValidation') }}
            </NButton>
            <NButton size="small" @click="router.push({ name: 'workbench.runs' })">
              {{ t('memory.openRuns') }}
            </NButton>
          </div>
        </header>

        <div class="memory-content">
          <div v-if="loading && !data" class="memory-loading">{{ t('common.loading') }}</div>
          <div v-else class="memory-sections">
            <div class="memory-section">
              <div class="section-header">
                <div class="section-title-row">
                  <span class="section-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </span>
                  <span class="section-title">{{ t('memory.myNotes') }}</span>
                  <span v-if="data?.memory_mtime" class="section-mtime">{{ formatTime(data.memory_mtime) }}</span>
                </div>
                <NButton v-if="editingSection !== 'memory'" size="tiny" quaternary @click="startEdit('memory')">
                  {{ t('common.edit') }}
                </NButton>
              </div>

              <div v-if="editingSection !== 'memory'" class="section-body">
                <MarkdownRenderer v-if="!memoryEmpty" :content="displayMemory" />
                <p v-else class="empty-text">{{ t('memory.noNotes') }}</p>
              </div>

              <div v-else class="section-edit">
                <textarea
                  v-model="editContent"
                  class="edit-textarea"
                  :placeholder="t('memory.notesPlaceholder')"
                  spellcheck="false"
                ></textarea>
                <div class="edit-actions">
                  <NButton size="small" @click="cancelEdit">{{ t('common.cancel') }}</NButton>
                  <NButton size="small" type="primary" :loading="saving" @click="handleSave">{{ t('common.save') }}</NButton>
                </div>
              </div>
            </div>

            <div class="memory-section">
              <div class="section-header">
                <div class="section-title-row">
                  <span class="section-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <span class="section-title">{{ t('memory.userProfile') }}</span>
                  <span v-if="data?.user_mtime" class="section-mtime">{{ formatTime(data.user_mtime) }}</span>
                </div>
                <NButton v-if="editingSection !== 'user'" size="tiny" quaternary @click="startEdit('user')">
                  {{ t('common.edit') }}
                </NButton>
              </div>

              <div v-if="editingSection !== 'user'" class="section-body">
                <MarkdownRenderer v-if="!userEmpty" :content="displayUser" />
                <p v-else class="empty-text">{{ t('memory.noProfile') }}</p>
              </div>

              <div v-else class="section-edit">
                <textarea
                  v-model="editContent"
                  class="edit-textarea"
                  :placeholder="t('memory.profilePlaceholder')"
                  spellcheck="false"
                ></textarea>
                <div class="edit-actions">
                  <NButton size="small" @click="cancelEdit">{{ t('common.cancel') }}</NButton>
                  <NButton size="small" type="primary" :loading="saving" @click="handleSave">{{ t('common.save') }}</NButton>
                </div>
              </div>
            </div>

            <div class="memory-section">
              <div class="section-header">
                <div class="section-title-row">
                  <span class="section-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                      <line x1="9" y1="9" x2="9.01" y2="9" />
                      <line x1="15" y1="9" x2="15.01" y2="9" />
                    </svg>
                  </span>
                  <span class="section-title">{{ t('memory.soul') }}</span>
                  <span v-if="data?.soul_mtime" class="section-mtime">{{ formatTime(data.soul_mtime) }}</span>
                </div>
                <NButton v-if="editingSection !== 'soul'" size="tiny" quaternary @click="startEdit('soul')">
                  {{ t('common.edit') }}
                </NButton>
              </div>

              <div v-if="editingSection !== 'soul'" class="section-body">
                <MarkdownRenderer v-if="!soulEmpty" :content="displaySoul" />
                <p v-else class="empty-text">{{ t('memory.noSoul') }}</p>
              </div>

              <div v-else class="section-edit">
                <textarea
                  v-model="editContent"
                  class="edit-textarea"
                  :placeholder="t('memory.soulPlaceholder')"
                  spellcheck="false"
                ></textarea>
                <div class="edit-actions">
                  <NButton size="small" @click="cancelEdit">{{ t('common.cancel') }}</NButton>
                  <NButton size="small" type="primary" :loading="saving" @click="handleSave">{{ t('common.save') }}</NButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.memory-view {
  min-height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
}

.memory-view__decision-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 16px;
  padding: 0 24px 16px;
}

.memory-guide {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.memory-guide--accent {
  background:
    linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.09), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.memory-guide__title,
.memory-checklist__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  color: $text-primary;
}

.memory-guide__body,
.memory-checklist__body,
.memory-shell__subtitle {
  color: $text-secondary;
  line-height: 1.7;
}

.memory-guide__points,
.memory-checklist__list {
  display: grid;
  gap: 10px;
}

.memory-guide__point,
.memory-checklist__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: rgba(255, 255, 255, 0.82);
}

.memory-guide__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: auto;
}

.memory-checklist__label,
.memory-stat__label {
  color: $text-secondary;
}

.memory-checklist__count,
.memory-stat__value {
  font-size: 28px;
  font-weight: 700;
  color: $text-primary;
}

.memory-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 0 24px 16px;
}

.memory-stat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 142px;
}

.memory-stat__meta {
  color: $text-muted;
  line-height: 1.6;
}

.memory-view__content {
  padding: 0 24px 24px;
}

.memory-shell {
  padding: 0;
  overflow: hidden;
}

.memory-shell__header {
  padding: 18px 20px;
}

.memory-shell__title-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.memory-content {
  overflow: hidden;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.memory-loading {
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: $text-muted;
}

.memory-sections {
  display: flex;
  gap: 16px;
  min-height: 0;
}

.memory-section {
  flex: 1;
  min-height: 520px;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.72);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: $bg-secondary;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-icon {
  color: $text-secondary;
  display: flex;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
}

.section-mtime {
  font-size: 11px;
  color: $text-muted;
}

.section-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  min-height: 0;
}

.empty-text {
  color: $text-muted;
  font-style: italic;
  font-size: 13px;
}

.section-edit {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  min-height: 0;
}

.edit-textarea {
  flex: 1;
  width: 100%;
  min-height: 0;
  padding: 12px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $bg-input;
  color: $text-primary;
  font-family: $font-code;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
  outline: none;

  &:focus {
    border-color: $accent-primary;
  }
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}

@media (max-width: 1100px) {
  .memory-view__decision-grid,
  .memory-view__summary-grid,
  .memory-sections {
    grid-template-columns: 1fr;
  }

  .memory-sections {
    flex-direction: column;
  }
}

@media (max-width: $breakpoint-mobile) {
  .memory-view__decision-grid,
  .memory-view__summary-grid,
  .memory-view__content {
    padding-left: 12px;
    padding-right: 12px;
  }

  .memory-shell__header {
    padding: 16px 12px 12px;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .memory-content {
    padding: 12px;
  }

  .memory-checklist__count,
  .memory-stat__value {
    font-size: 22px;
  }

  .memory-section {
    min-height: 420px;
  }
}
</style>
