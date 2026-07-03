<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NInput } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import SkillList from '@/components/hermes/skills/SkillList.vue'
import SkillDetail from '@/components/hermes/skills/SkillDetail.vue'
import { fetchSkills, type SkillCategory, type SkillInfo, type SkillSource } from '@/api/hermes/skills'

type SourceFilter = SkillSource | 'modified'

const router = useRouter()
const { t } = useI18n()

const categories = ref<SkillCategory[]>([])
const archived = ref<SkillInfo[]>([])
const loading = ref(false)
const selectedCategory = ref('')
const selectedSkill = ref('')
const searchQuery = ref('')
const showSidebar = ref(true)
const sourceFilter = ref<SourceFilter | null>(null)
let mobileQuery: MediaQueryList | null = null

const allActiveSkills = computed(() =>
  categories.value.flatMap(category =>
    category.skills.map(skill => ({ category: category.name, skill })),
  ),
)

const allSkillsIncludingArchive = computed(() => [
  ...allActiveSkills.value,
  ...archived.value.map(skill => ({ category: '.archive', skill })),
])

const selectedSkillData = computed(() => {
  if (!selectedCategory.value || !selectedSkill.value) return null
  return allSkillsIncludingArchive.value.find(item =>
    item.category === selectedCategory.value && item.skill.name === selectedSkill.value,
  )?.skill ?? null
})

const totalSkills = computed(() => allSkillsIncludingArchive.value.length)

const enabledSkills = computed(() =>
  allActiveSkills.value.filter(item => item.skill.enabled !== false).length,
)

const modifiedSkills = computed(() =>
  allSkillsIncludingArchive.value.filter(item => item.skill.modified).length,
)

const pinnedSkills = computed(() =>
  allSkillsIncludingArchive.value.filter(item => item.skill.pinned).length,
)

const disabledSkills = computed(() =>
  allActiveSkills.value.filter(item => item.skill.enabled === false).length,
)

const primaryDecision = computed(() => {
  const modifiedSkill = allActiveSkills.value.find(item => item.skill.modified)
  if (modifiedSkill) {
    return {
      tone: 'warning' as const,
      eyebrow: t('skills.primaryDecisionModifiedEyebrow'),
      title: t('skills.primaryDecisionModifiedTitle', { name: modifiedSkill.skill.name }),
      body: modifiedSkill.skill.description || t('skills.primaryDecisionModifiedBody'),
      actionLabel: t('skills.openSelectedSkill'),
      category: modifiedSkill.category,
      skill: modifiedSkill.skill.name,
    }
  }

  const pinnedSkill = allActiveSkills.value.find(item => item.skill.pinned)
  if (pinnedSkill) {
    return {
      tone: 'accent' as const,
      eyebrow: t('skills.primaryDecisionPinnedEyebrow'),
      title: t('skills.primaryDecisionPinnedTitle', { name: pinnedSkill.skill.name }),
      body: pinnedSkill.skill.description || t('skills.primaryDecisionPinnedBody'),
      actionLabel: t('skills.openSelectedSkill'),
      category: pinnedSkill.category,
      skill: pinnedSkill.skill.name,
    }
  }

  const disabledSkill = allActiveSkills.value.find(item => item.skill.enabled === false)
  if (disabledSkill) {
    return {
      tone: 'default' as const,
      eyebrow: t('skills.primaryDecisionDisabledEyebrow'),
      title: t('skills.primaryDecisionDisabledTitle', { name: disabledSkill.skill.name }),
      body: disabledSkill.skill.description || t('skills.primaryDecisionDisabledBody'),
      actionLabel: t('skills.openSelectedSkill'),
      category: disabledSkill.category,
      skill: disabledSkill.skill.name,
    }
  }

  const firstSkill = allActiveSkills.value[0]
  if (firstSkill) {
    return {
      tone: 'calm' as const,
      eyebrow: t('skills.primaryDecisionReviewEyebrow'),
      title: t('skills.primaryDecisionReviewTitle', { name: firstSkill.skill.name }),
      body: firstSkill.skill.description || t('skills.primaryDecisionReviewBody'),
      actionLabel: t('skills.openSelectedSkill'),
      category: firstSkill.category,
      skill: firstSkill.skill.name,
    }
  }

  return {
    tone: 'calm' as const,
    eyebrow: t('skills.primaryDecisionEmptyEyebrow'),
    title: t('skills.primaryDecisionEmptyTitle'),
    body: t('skills.primaryDecisionEmptyBody'),
    actionLabel: t('skills.openApplications'),
    category: '',
    skill: '',
  }
})

const decisionChecklist = computed(() => [
  { key: 'modified', label: t('skills.checklistModified'), count: modifiedSkills.value },
  { key: 'pinned', label: t('skills.checklistPinned'), count: pinnedSkills.value },
  { key: 'disabled', label: t('skills.checklistDisabled'), count: disabledSkills.value },
  { key: 'archived', label: t('skills.checklistArchived'), count: archived.value.length },
  { key: 'categories', label: t('skills.checklistCategories'), count: categories.value.length },
])

const sourceSummary = computed(() => ({
  builtin: allSkillsIncludingArchive.value.filter(item => (item.skill.source || 'local') === 'builtin').length,
  hub: allSkillsIncludingArchive.value.filter(item => (item.skill.source || 'local') === 'hub').length,
  local: allSkillsIncludingArchive.value.filter(item => (item.skill.source || 'local') === 'local').length,
}))

function ensureSelection() {
  const exists = allSkillsIncludingArchive.value.some(item =>
    item.category === selectedCategory.value && item.skill.name === selectedSkill.value,
  )
  if (exists) return

  if (primaryDecision.value.category && primaryDecision.value.skill) {
    selectedCategory.value = primaryDecision.value.category
    selectedSkill.value = primaryDecision.value.skill
    return
  }

  const firstSkill = allSkillsIncludingArchive.value[0]
  if (firstSkill) {
    selectedCategory.value = firstSkill.category
    selectedSkill.value = firstSkill.skill.name
  }
}

function handleMobileChange(e: MediaQueryListEvent | MediaQueryList) {
  showSidebar.value = !e.matches
}

onMounted(() => {
  mobileQuery = window.matchMedia('(max-width: 768px)')
  handleMobileChange(mobileQuery)
  mobileQuery.addEventListener('change', handleMobileChange)
  loadSkills()
})

onUnmounted(() => {
  mobileQuery?.removeEventListener('change', handleMobileChange)
})

async function loadSkills() {
  loading.value = true
  try {
    const data = await fetchSkills()
    categories.value = data.categories
    archived.value = data.archived
    ensureSelection()
  } catch (err) {
    console.error('Failed to load skills:', err)
  } finally {
    loading.value = false
  }
}

function toggleFilter(filter: SourceFilter) {
  sourceFilter.value = sourceFilter.value === filter ? null : filter
}

function handleSelect(category: string, skill: string) {
  selectedCategory.value = category
  selectedSkill.value = skill
  if (window.innerWidth <= 768) {
    showSidebar.value = false
  }
}

function handlePinToggled(name: string, pinned: boolean) {
  const skillRecord = allSkillsIncludingArchive.value.find(item => item.skill.name === name)
  if (skillRecord) {
    skillRecord.skill.pinned = pinned
  }
}

function handlePrimaryDecision() {
  if (primaryDecision.value.category && primaryDecision.value.skill) {
    handleSelect(primaryDecision.value.category, primaryDecision.value.skill)
    return
  }
  router.push({ name: 'workbench.applications' })
}
</script>

<template>
  <div class="skills-view workbench-page">
    <section class="workbench-page__hero">
      <div class="workbench-page__hero-copy">
        <div class="workbench-page__eyebrow">{{ t('skills.heroEyebrow') }}</div>
        <h1 class="workbench-page__title">{{ t('skills.heroTitle') }}</h1>
        <p class="workbench-page__subtitle">{{ t('skills.heroSubtitle') }}</p>
      </div>
      <div class="workbench-page__actions">
        <NButton secondary @click="router.push({ name: 'workbench.applications' })">
          {{ t('skills.openApplications') }}
        </NButton>
        <NButton type="primary" @click="router.push({ name: 'hermes.groupChat' })">
          {{ t('skills.openAgents') }}
        </NButton>
      </div>
    </section>

    <section class="skills-view__decision-grid">
      <article class="skills-guide workbench-panel" :class="`skills-guide--${primaryDecision.tone}`">
        <div class="workbench-section-title">{{ primaryDecision.eyebrow }}</div>
        <h2 class="skills-guide__title">{{ primaryDecision.title }}</h2>
        <p class="skills-guide__body">{{ primaryDecision.body }}</p>
        <div class="skills-guide__points">
          <div class="skills-guide__point">{{ t('skills.guidePoint1') }}</div>
          <div class="skills-guide__point">{{ t('skills.guidePoint2') }}</div>
          <div class="skills-guide__point">{{ t('skills.guidePoint3') }}</div>
        </div>
        <div class="skills-guide__actions">
          <NButton type="primary" @click="handlePrimaryDecision()">
            {{ primaryDecision.actionLabel }}
          </NButton>
          <NButton quaternary @click="router.push({ name: 'workbench.runs' })">
            {{ t('skills.openRuns') }}
          </NButton>
        </div>
      </article>

      <article class="skills-checklist workbench-panel workbench-panel--soft">
        <div class="workbench-section-title">{{ t('skills.checklistEyebrow') }}</div>
        <h2 class="skills-checklist__title">{{ t('skills.checklistTitle') }}</h2>
        <p class="skills-checklist__body">{{ t('skills.checklistBody') }}</p>
        <div class="skills-checklist__list">
          <div v-for="item in decisionChecklist" :key="item.key" class="skills-checklist__item">
            <span class="skills-checklist__label">{{ item.label }}</span>
            <span class="skills-checklist__count">{{ item.count }}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="skills-view__summary-grid">
      <article class="skills-stat workbench-panel">
        <div class="skills-stat__label">{{ t('skills.summaryTotal') }}</div>
        <div class="skills-stat__value">{{ totalSkills }}</div>
        <div class="skills-stat__meta">{{ t('skills.summaryTotalMeta') }}</div>
      </article>

      <article class="skills-stat workbench-panel">
        <div class="skills-stat__label">{{ t('skills.summaryEnabled') }}</div>
        <div class="skills-stat__value">{{ enabledSkills }}</div>
        <div class="skills-stat__meta">{{ t('skills.summaryEnabledMeta') }}</div>
      </article>

      <article class="skills-stat workbench-panel">
        <div class="skills-stat__label">{{ t('skills.summaryCoverage') }}</div>
        <div class="skills-stat__value">{{ sourceSummary.builtin }}/{{ sourceSummary.hub }}/{{ sourceSummary.local }}</div>
        <div class="skills-stat__meta">{{ t('skills.summaryCoverageMeta') }}</div>
      </article>

      <article class="skills-stat workbench-panel">
        <div class="skills-stat__label">{{ t('skills.summarySelected') }}</div>
        <div class="skills-stat__value">{{ selectedSkillData?.name || t('skills.noSelectionShort') }}</div>
        <div class="skills-stat__meta">
          {{
            selectedSkillData
              ? t('skills.selectedMeta', {
                source: t(`skills.source.${selectedSkillData.source || 'local'}`),
                state: selectedSkillData.enabled === false ? t('common.disabled') : t('common.enabled'),
              })
              : t('skills.summarySelectedMeta')
          }}
        </div>
      </article>
    </section>

    <section class="skills-view__content">
      <div class="skills-shell workbench-panel workbench-panel--soft">
        <header class="page-header skills-shell__header">
          <div class="skills-shell__title-group">
            <div class="skills-shell__title-row">
              <h2 class="header-title">{{ t('skills.title') }}</h2>
              <button v-if="!showSidebar" class="sidebar-toggle" @click="showSidebar = true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
            </div>
            <p class="skills-shell__subtitle">{{ t('skills.panelSubtitle') }}</p>
          </div>

          <div class="skills-shell__toolbar">
            <div class="source-legend">
              <button class="legend-item" :class="{ active: sourceFilter === 'builtin' }" @click="toggleFilter('builtin')">
                <span class="legend-dot dot-builtin" />{{ t('skills.source.builtin') }}
              </button>
              <button class="legend-item" :class="{ active: sourceFilter === 'hub' }" @click="toggleFilter('hub')">
                <span class="legend-dot dot-hub" />{{ t('skills.source.hub') }}
              </button>
              <button class="legend-item" :class="{ active: sourceFilter === 'local' }" @click="toggleFilter('local')">
                <span class="legend-dot dot-local" />{{ t('skills.source.local') }}
              </button>
              <button class="legend-item" :class="{ active: sourceFilter === 'modified' }" @click="toggleFilter('modified')">
                <span class="modified-icon">✎</span>{{ t('skills.modified') }}
              </button>
            </div>
            <NInput
              v-model:value="searchQuery"
              :placeholder="t('skills.searchPlaceholder')"
              size="small"
              clearable
              class="skills-shell__search"
            />
          </div>
        </header>

        <div class="skills-content">
          <div v-if="loading && categories.length === 0" class="skills-loading">{{ t('common.loading') }}</div>
          <div v-else class="skills-layout">
            <div class="mobile-backdrop" :class="{ active: showSidebar }" @click="showSidebar = false" />
            <div v-if="showSidebar" class="skills-sidebar">
              <SkillList
                :categories="categories"
                :archived="archived"
                :selected-skill="selectedCategory && selectedSkill ? `${selectedCategory}/${selectedSkill}` : null"
                :search-query="searchQuery"
                :source-filter="sourceFilter"
                @select="handleSelect"
              />
            </div>
            <div class="skills-main">
              <SkillDetail
                v-if="selectedCategory && selectedSkill"
                :category="selectedCategory"
                :skill="selectedSkill"
                :skill-name="selectedSkillData?.name || selectedSkill"
                :patch-count="selectedSkillData?.patchCount"
                :use-count="selectedSkillData?.useCount"
                :view-count="selectedSkillData?.viewCount"
                :pinned="selectedSkillData?.pinned"
                @pin-toggled="handlePinToggled"
              />
              <div v-else class="empty-detail workbench-empty-state">
                <div class="empty-detail__title">{{ t('skills.emptyTitle') }}</div>
                <p class="empty-detail__body">{{ t('skills.emptyBody') }}</p>
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

.skills-view {
  min-height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
}

.skills-view__decision-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 16px;
  padding: 0 24px 16px;
}

.skills-guide {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.skills-guide--warning {
  background:
    linear-gradient(135deg, rgba(178, 75, 66, 0.08), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.skills-guide--accent {
  background:
    linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.09), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.skills-guide__title,
.skills-checklist__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  color: $text-primary;
}

.skills-guide__body,
.skills-checklist__body,
.skills-shell__subtitle {
  color: $text-secondary;
  line-height: 1.7;
}

.skills-guide__points,
.skills-checklist__list {
  display: grid;
  gap: 10px;
}

.skills-guide__point,
.skills-checklist__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: rgba(255, 255, 255, 0.82);
}

.skills-guide__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: auto;
}

.skills-checklist__label,
.skills-stat__label {
  color: $text-secondary;
}

.skills-checklist__count,
.skills-stat__value {
  font-size: 28px;
  font-weight: 700;
  color: $text-primary;
}

.skills-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 0 24px 16px;
}

.skills-stat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 142px;
}

.skills-stat__meta {
  color: $text-muted;
  line-height: 1.6;
}

.skills-view__content {
  padding: 0 24px 24px;
}

.skills-shell {
  padding: 0;
  overflow: hidden;
}

.skills-shell__header {
  padding: 18px 20px;
  gap: 14px;
}

.skills-shell__title-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skills-shell__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.skills-shell__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.skills-shell__search {
  width: 180px;
}

.sidebar-toggle {
  display: none;
  border: none;
  background: none;
  cursor: pointer;
  color: $text-secondary;
  padding: 4px;
  border-radius: $radius-sm;

  &:hover {
    background: rgba(var(--accent-primary-rgb), 0.06);
  }
}

.source-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  flex-wrap: wrap;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: $text-muted;
  white-space: nowrap;
  padding: 2px 6px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: none;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    color: $text-secondary;
    background: rgba(var(--accent-primary-rgb), 0.04);
  }

  &.active {
    color: $text-primary;
    border-color: $border-color;
    background: rgba(var(--accent-primary-rgb), 0.08);
  }
}

.legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-dot.dot-builtin { background: #888; }
.legend-dot.dot-hub { background: #4a90d9; }
.legend-dot.dot-local { background: #66bb6a; }

.modified-icon {
  font-size: 11px;
  color: $warning;
  opacity: 0.7;
}

.skills-content {
  min-height: 720px;
  overflow: hidden;
}

.skills-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 13px;
  color: $text-muted;
}

.skills-layout {
  display: flex;
  height: 100%;
  position: relative;
}

.skills-sidebar {
  width: 280px;
  border-right: 1px solid $border-color;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.skills-main {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  min-width: 0;
}

.empty-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.empty-detail__title {
  font-size: 18px;
  font-weight: 600;
  color: $text-primary;
}

.empty-detail__body {
  margin-top: 8px;
  line-height: 1.7;
}

.mobile-backdrop {
  display: none;
}

@media (max-width: 1100px) {
  .skills-view__decision-grid,
  .skills-view__summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: $breakpoint-mobile) {
  .skills-view__decision-grid,
  .skills-view__summary-grid,
  .skills-view__content {
    padding-left: 12px;
    padding-right: 12px;
  }

  .skills-shell__header {
    padding: 16px 12px 12px;
  }

  .sidebar-toggle {
    display: flex;
  }

  .source-legend {
    display: none;
  }

  .skills-shell__search {
    width: 100%;
  }

  .skills-checklist__count,
  .skills-stat__value {
    font-size: 22px;
  }

  .skills-sidebar {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    z-index: 10;
    background: $bg-card;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  }

  .mobile-backdrop {
    display: block;
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 9;
    opacity: 0;
    pointer-events: none;
    transition: opacity $transition-fast;

    &.active {
      opacity: 1;
      pointer-events: auto;
    }
  }
}
</style>
