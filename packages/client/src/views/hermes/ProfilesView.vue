<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NButton, NSpin } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import ProfileCreateModal from '@/components/hermes/profiles/ProfileCreateModal.vue'
import ProfileImportModal from '@/components/hermes/profiles/ProfileImportModal.vue'
import ProfileRenameModal from '@/components/hermes/profiles/ProfileRenameModal.vue'
import ProfilesPanel from '@/components/hermes/profiles/ProfilesPanel.vue'
import { useProfilesStore } from '@/stores/hermes/profiles'

const { t } = useI18n()
const router = useRouter()
const profilesStore = useProfilesStore()

const showCreateModal = ref(false)
const showImportModal = ref(false)
const renamingProfile = ref<string | null>(null)
const profilesShellRef = ref<HTMLDivElement | null>(null)

const activeProfile = computed(() =>
  profilesStore.activeProfile
  || profilesStore.profiles.find(profile => profile.name === profilesStore.activeProfileName)
  || null,
)

const activeProfileName = computed(() =>
  activeProfile.value?.name || t('profiles.noActiveProfile'),
)

const profileCount = computed(() => profilesStore.profiles.length)

const configuredGatewayCount = computed(() =>
  profilesStore.profiles.filter(profile => String(profile.gateway || '').trim()).length,
)

const activeModelLabel = computed(() =>
  activeProfile.value?.model || t('profiles.noActiveModel'),
)

type ProfilesPrimaryAction = 'focus-profiles' | 'open-gateways' | 'create-profile' | 'open-applications'

const primaryDecision = computed(() => {
  if (profileCount.value === 0) {
    return {
      action: 'create-profile' as ProfilesPrimaryAction,
      tone: 'calm' as const,
      eyebrow: t('profiles.primaryDecisionEmptyEyebrow'),
      title: t('profiles.primaryDecisionEmptyTitle'),
      body: t('profiles.primaryDecisionEmptyBody'),
      actionLabel: t('profiles.create'),
    }
  }

  if (!activeProfile.value) {
    return {
      action: 'focus-profiles' as ProfilesPrimaryAction,
      tone: 'warning' as const,
      eyebrow: t('profiles.primaryDecisionInactiveEyebrow'),
      title: t('profiles.primaryDecisionInactiveTitle'),
      body: t('profiles.primaryDecisionInactiveBody'),
      actionLabel: t('profiles.focusProfiles'),
    }
  }

  if (!String(activeProfile.value.gateway || '').trim()) {
    return {
      action: 'open-gateways' as ProfilesPrimaryAction,
      tone: 'warning' as const,
      eyebrow: t('profiles.primaryDecisionGatewayEyebrow'),
      title: t('profiles.primaryDecisionGatewayTitle', { profile: activeProfile.value.name }),
      body: t('profiles.primaryDecisionGatewayBody'),
      actionLabel: t('profiles.openGateways'),
    }
  }

  return {
    action: 'focus-profiles' as ProfilesPrimaryAction,
    tone: 'accent' as const,
    eyebrow: t('profiles.primaryDecisionActiveEyebrow'),
    title: t('profiles.primaryDecisionActiveTitle', { profile: activeProfile.value.name }),
    body: t('profiles.primaryDecisionActiveBody', {
      gateway: activeProfile.value.gateway,
      model: activeModelLabel.value,
    }),
    actionLabel: t('profiles.focusProfiles'),
  }
})

const decisionChecklist = computed(() => [
  { key: 'active', label: t('profiles.activeProfileLabel'), value: activeProfileName.value },
  { key: 'total', label: t('profiles.totalProfilesLabel'), value: String(profileCount.value) },
  { key: 'gateway', label: t('profiles.activeGatewayLabel'), value: activeProfile.value?.gateway || t('profiles.noActiveGateway') },
  { key: 'model', label: t('profiles.activeModelLabel'), value: activeModelLabel.value },
])

onMounted(() => {
  profilesStore.fetchProfiles()
})

function handlePrimaryDecision() {
  if (primaryDecision.value.action === 'open-gateways') {
    router.push({ name: 'hermes.gateways' })
    return
  }
  if (primaryDecision.value.action === 'create-profile') {
    showCreateModal.value = true
    return
  }
  if (primaryDecision.value.action === 'open-applications') {
    router.push({ name: 'workbench.applications' })
    return
  }
  profilesShellRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function handleCreated() {
  showCreateModal.value = false
}

function handleRenamed() {
  renamingProfile.value = null
}

function handleImported() {
  showImportModal.value = false
}
</script>

<template>
  <div class="profiles-view workbench-page">
    <section class="workbench-page__hero">
      <div class="workbench-page__hero-copy">
        <div class="workbench-page__eyebrow">{{ t('profiles.heroEyebrow') }}</div>
        <h1 class="workbench-page__title">{{ t('profiles.heroTitle') }}</h1>
        <p class="workbench-page__subtitle">{{ t('profiles.heroSubtitle') }}</p>
      </div>
      <div class="workbench-page__actions">
        <NButton secondary @click="router.push({ name: 'hermes.gateways' })">
          {{ t('profiles.openGateways') }}
        </NButton>
        <NButton type="primary" @click="router.push({ name: 'workbench.resources' })">
          {{ t('profiles.openSharedResources') }}
        </NButton>
      </div>
    </section>

    <section class="profiles-view__decision-grid">
      <article class="profiles-guide workbench-panel" :class="`profiles-guide--${primaryDecision.tone}`">
        <div class="workbench-section-title">{{ primaryDecision.eyebrow }}</div>
        <h2 class="profiles-guide__title">{{ primaryDecision.title }}</h2>
        <p class="profiles-guide__body">{{ primaryDecision.body }}</p>
        <div class="profiles-guide__points">
          <div class="profiles-guide__point">{{ t('profiles.guidePoint1') }}</div>
          <div class="profiles-guide__point">{{ t('profiles.guidePoint2') }}</div>
          <div class="profiles-guide__point">{{ t('profiles.guidePoint3') }}</div>
        </div>
        <div class="profiles-guide__actions">
          <NButton type="primary" @click="handlePrimaryDecision()">
            {{ primaryDecision.actionLabel }}
          </NButton>
          <NButton quaternary @click="router.push({ name: 'workbench.applications' })">
            {{ t('profiles.openApplications') }}
          </NButton>
        </div>
      </article>

      <article class="profiles-checklist workbench-panel workbench-panel--soft">
        <div class="workbench-section-title">{{ t('profiles.checklistEyebrow') }}</div>
        <h2 class="profiles-checklist__title">{{ t('profiles.checklistTitle') }}</h2>
        <p class="profiles-checklist__body">{{ t('profiles.checklistBody') }}</p>
        <div class="profiles-checklist__list">
          <div v-for="item in decisionChecklist" :key="item.key" class="profiles-checklist__item">
            <span class="profiles-checklist__label">{{ item.label }}</span>
            <span class="profiles-checklist__value profiles-checklist__value--wide">{{ item.value }}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="profiles-view__summary-grid">
      <article class="profiles-stat workbench-panel">
        <div class="profiles-stat__label">{{ t('profiles.totalProfilesLabel') }}</div>
        <div class="profiles-stat__value">{{ profileCount }}</div>
        <div class="profiles-stat__meta">{{ t('profiles.totalProfilesMeta') }}</div>
      </article>

      <article class="profiles-stat workbench-panel">
        <div class="profiles-stat__label">{{ t('profiles.activeProfileLabel') }}</div>
        <div class="profiles-stat__value profiles-stat__value--compact">{{ activeProfileName }}</div>
        <div class="profiles-stat__meta">{{ t('profiles.activeProfileMeta') }}</div>
      </article>

      <article class="profiles-stat workbench-panel">
        <div class="profiles-stat__label">{{ t('profiles.activeGatewayLabel') }}</div>
        <div class="profiles-stat__value profiles-stat__value--compact">{{ activeProfile?.gateway || t('profiles.noActiveGateway') }}</div>
        <div class="profiles-stat__meta">{{ t('profiles.activeGatewayMeta') }}</div>
      </article>

      <article class="profiles-stat workbench-panel">
        <div class="profiles-stat__label">{{ t('profiles.gatewayCoverageLabel') }}</div>
        <div class="profiles-stat__value">{{ configuredGatewayCount }}</div>
        <div class="profiles-stat__meta">{{ t('profiles.gatewayCoverageMeta') }}</div>
      </article>
    </section>

    <section class="profiles-view__content">
      <div ref="profilesShellRef" class="profiles-shell workbench-panel workbench-panel--soft">
        <header class="page-header profiles-shell__header">
          <div class="profiles-shell__title-group">
            <h2 class="header-title">{{ t('profiles.title') }}</h2>
            <p class="profiles-shell__subtitle">{{ t('profiles.panelSubtitle') }}</p>
          </div>
          <div class="header-actions">
            <NButton size="small" @click="showImportModal = true">
              {{ t('profiles.import') }}
            </NButton>
            <NButton type="primary" size="small" @click="showCreateModal = true">
              {{ t('profiles.create') }}
            </NButton>
          </div>
        </header>

        <div class="profiles-content">
          <NSpin :show="profilesStore.loading && profilesStore.profiles.length === 0">
            <ProfilesPanel @rename="renamingProfile = $event" />
          </NSpin>
        </div>
      </div>
    </section>

    <ProfileCreateModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @saved="handleCreated"
    />
    <ProfileRenameModal
      v-if="renamingProfile"
      :profile-name="renamingProfile"
      @close="renamingProfile = null"
      @saved="handleRenamed"
    />
    <ProfileImportModal
      v-if="showImportModal"
      @close="showImportModal = false"
      @saved="handleImported"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.profiles-view {
  min-height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
}

.profiles-view__decision-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
  gap: 16px;
  padding: 0 24px 16px;
}

.profiles-guide {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 220px;
}

.profiles-guide--accent {
  background:
    linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.09), rgba(255, 255, 255, 0.92)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.9));
}

.profiles-guide--warning {
  background:
    linear-gradient(135deg, rgba(178, 75, 66, 0.08), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.profiles-guide__title,
.profiles-checklist__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  color: $text-primary;
}

.profiles-guide__body,
.profiles-checklist__body,
.profiles-shell__subtitle {
  color: $text-secondary;
  line-height: 1.7;
}

.profiles-guide__points,
.profiles-checklist__list {
  display: grid;
  gap: 10px;
}

.profiles-guide__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 4px;
}

.profiles-guide__point,
.profiles-checklist__item {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid $border-color;
  background: rgba(255, 255, 255, 0.72);
}

.profiles-checklist {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.profiles-checklist__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.profiles-checklist__label {
  color: $text-primary;
  font-weight: 600;
}

.profiles-checklist__value {
  min-width: 34px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: $text-primary;
  font-weight: 700;
  text-align: center;
}

.profiles-checklist__value--wide {
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profiles-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 0 24px 16px;
}

.profiles-stat__label {
  font-size: 12px;
  color: $text-muted;
}

.profiles-stat__value {
  margin-top: 8px;
  font-size: 30px;
  font-weight: 700;
  color: $text-primary;
}

.profiles-stat__value--compact {
  font-size: 18px;
  line-height: 1.4;
}

.profiles-stat__meta {
  margin-top: 8px;
  color: $text-secondary;
  line-height: 1.6;
}

.profiles-view__content {
  flex: 1;
  min-height: 0;
  padding: 0 24px 24px;
}

.profiles-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.profiles-shell__header {
  padding-inline: 0;
  padding-top: 0;
}

.profiles-shell__title-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.profiles-content {
  flex: 1;
  overflow-y: auto;
  padding-top: 20px;
}

@media (max-width: 1200px) {
  .profiles-view__decision-grid,
  .profiles-view__summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .profiles-view__content,
  .profiles-view__decision-grid,
  .profiles-view__summary-grid {
    padding-inline: 12px;
  }

  .profiles-shell__header {
    align-items: flex-start;
  }

  .profiles-checklist__item {
    align-items: flex-start;
    flex-direction: column;
  }

  .profiles-checklist__value--wide {
    max-width: 100%;
  }
}
</style>
