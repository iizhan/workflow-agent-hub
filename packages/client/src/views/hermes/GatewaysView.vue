<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NSpin, NButton, NTag, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/hermes/app'
import { useGatewayStore } from '@/stores/hermes/gateways'
import { useProfilesStore } from '@/stores/hermes/profiles'
import ProfileCreateModal from '@/components/hermes/profiles/ProfileCreateModal.vue'
import ModelManagementPanel from '@/components/hermes/models/ModelManagementPanel.vue'
import { listAgents, listRooms, type RoomAgent } from '@/api/hermes/group-chat'
import type { GatewayStatus } from '@/api/hermes/gateways'

const { t } = useI18n()
const message = useMessage()
const router = useRouter()
const appStore = useAppStore()
const gatewayStore = useGatewayStore()
const profilesStore = useProfilesStore()

interface AgentGatewayBinding {
  roomId: string
  roomName: string
  roomActive: boolean
  agent: RoomAgent
}

const bindingsLoading = ref(false)
const agentBindings = ref<AgentGatewayBinding[]>([])
const pendingGatewayAction = ref<Record<string, 'start' | 'stop'>>({})
const backendServiceReachable = ref(true)
const showCreateProfileModal = ref(false)
const selectedGatewayProfile = ref('')
const activeTab = ref<'gateways' | 'models' | 'relations'>('gateways')
const gatewaysShellRef = ref<HTMLDivElement | null>(null)

const activeProfileName = computed(() => {
  return profilesStore.activeProfileName || profilesStore.activeProfile?.name || ''
})

const activeGateway = computed(() => {
  return gatewayForProfile(activeProfileName.value)
})

const activeRoomBindingGroup = computed(() => {
  return groupedAgentBindings.value.find(group => group.roomActive) || null
})

const backendServiceHealthy = computed(() => backendServiceReachable.value)
const aiGatewayCount = computed(() => gatewayStore.gateways.length)
const runningGatewayCount = computed(() => gatewayStore.gateways.filter(gateway => gateway.running).length)
const failedGatewayCount = computed(() => gatewayStore.gateways.filter(gateway => gateway.lastError && !gateway.running).length)
const profileDetailMap = computed(() => profilesStore.detailMap)
const sortedGateways = computed(() => {
  return [...gatewayStore.gateways].sort((a, b) => {
    const activeA = a.profile === activeProfileName.value ? 1 : 0
    const activeB = b.profile === activeProfileName.value ? 1 : 0
    if (activeA !== activeB) return activeB - activeA
    const runningA = a.running ? 1 : 0
    const runningB = b.running ? 1 : 0
    if (runningA !== runningB) return runningB - runningA
    return a.profile.localeCompare(b.profile)
  })
})
const selectedGateway = computed(() => {
  return sortedGateways.value.find(gateway => gateway.profile === selectedGatewayProfile.value) || sortedGateways.value[0] || null
})

const agentProfileNames = computed(() => {
  return Array.from(new Set(agentBindings.value.map(binding => binding.agent.profile).filter(Boolean)))
})

const activeRoomCount = computed(() =>
  groupedAgentBindings.value.filter(group => group.roomActive).length,
)

const activeGatewayLabel = computed(() =>
  gatewayLabel(activeGateway.value),
)

const summaryBackendLabel = computed(() =>
  backendServiceHealthy.value ? t('gateways.backendServiceRunning') : t('gateways.backendServiceStopped'),
)

type GatewaysPrimaryAction = 'focus-gateways' | 'logs' | 'profiles'

const primaryDecision = computed(() => {
  if (selectedGateway.value?.lastError && !selectedGateway.value.running) {
    return {
      action: 'logs' as GatewaysPrimaryAction,
      tone: 'warning' as const,
      eyebrow: t('gateways.primaryDecisionFailureEyebrow'),
      title: t('gateways.primaryDecisionFailureTitle', { profile: selectedGateway.value.profile }),
      body: t('gateways.primaryDecisionFailureBody'),
      actionLabel: t('gateways.openFailureLogs'),
    }
  }

  if (activeGateway.value?.running && activeProfileName.value) {
    return {
      action: 'focus-gateways' as GatewaysPrimaryAction,
      tone: 'accent' as const,
      eyebrow: t('gateways.primaryDecisionActiveEyebrow'),
      title: t('gateways.primaryDecisionActiveTitle', { profile: activeProfileName.value }),
      body: t('gateways.primaryDecisionActiveBody', { gateway: activeGatewayLabel.value }),
      actionLabel: t('gateways.focusGateways'),
    }
  }

  if (aiGatewayCount.value > 0) {
    return {
      action: 'focus-gateways' as GatewaysPrimaryAction,
      tone: 'default' as const,
      eyebrow: t('gateways.primaryDecisionReviewEyebrow'),
      title: t('gateways.primaryDecisionReviewTitle'),
      body: t('gateways.primaryDecisionReviewBody'),
      actionLabel: t('gateways.focusGateways'),
    }
  }

  return {
    action: 'profiles' as GatewaysPrimaryAction,
    tone: 'calm' as const,
    eyebrow: t('gateways.primaryDecisionEmptyEyebrow'),
    title: t('gateways.primaryDecisionEmptyTitle'),
    body: t('gateways.primaryDecisionEmptyBody'),
    actionLabel: t('gateways.manageProfiles'),
  }
})

const decisionChecklist = computed(() => [
  { key: 'gateways', label: t('gateways.checklistGateways'), count: aiGatewayCount.value },
  { key: 'running', label: t('gateways.checklistRunning'), count: runningGatewayCount.value },
  { key: 'failed', label: t('gateways.checklistFailed'), count: failedGatewayCount.value },
  { key: 'profiles', label: t('gateways.checklistProfiles'), count: agentProfileNames.value.length },
  { key: 'rooms', label: t('gateways.checklistRooms'), count: activeRoomCount.value },
])

const activeAgentCountByProfile = computed(() => {
  return agentBindings.value.reduce<Record<string, number>>((acc, binding) => {
    const profile = binding.agent.profile
    if (!profile) return acc
    acc[profile] = (acc[profile] || 0) + 1
    return acc
  }, {})
})

const groupedAgentBindings = computed(() => {
  const groups = new Map<string, { roomId: string; roomName: string; roomActive: boolean; bindings: AgentGatewayBinding[] }>()
  for (const binding of agentBindings.value) {
    const group = groups.get(binding.roomId) || {
      roomId: binding.roomId,
      roomName: binding.roomName,
      roomActive: binding.roomActive,
      bindings: [],
    }
    group.roomActive = binding.roomActive
    group.bindings.push(binding)
    groups.set(binding.roomId, group)
  }
  return Array.from(groups.values())
})

onMounted(async () => {
  await refreshPageData()
})

async function handleToggle(name: string, running: boolean) {
  const action: 'start' | 'stop' = running ? 'stop' : 'start'
  pendingGatewayAction.value = {
    ...pendingGatewayAction.value,
    [name]: action,
  }
  const loadingMsg = message.loading(
    action === 'start'
      ? t('gateways.startingHint', { profile: name })
      : t('gateways.stoppingHint', { profile: name }),
    { duration: 0 },
  )
  try {
    if (running) {
      await gatewayStore.stop(name)
      loadingMsg.destroy()
      message.success(`${t('gateways.stopped')}: ${name}`)
    } else {
      await gatewayStore.start(name)
      loadingMsg.destroy()
      message.success(`${t('gateways.started')}: ${name}`)
    }
  } catch (err: any) {
    loadingMsg.destroy()
    message.error(`${t(action === 'start' ? 'gateways.startFailed' : 'gateways.stopFailed')}: ${err.message}`)
  } finally {
    const next = { ...pendingGatewayAction.value }
    delete next[name]
    pendingGatewayAction.value = next
    await gatewayStore.fetchStatus()
  }
}

async function handleRefresh() {
  await refreshPageData()
}

async function refreshPageData() {
  const results = await Promise.allSettled([
    appStore.checkConnection(),
    gatewayStore.fetchStatus(),
    profilesStore.fetchProfiles(),
    loadAgentBindings(),
  ])
  backendServiceReachable.value = results.some(result => result.status === 'fulfilled')
  await Promise.allSettled(gatewayStore.gateways.map(gateway => profilesStore.fetchProfileDetail(gateway.profile)))
}

function handlePrimaryDecision() {
  if (primaryDecision.value.action === 'logs') {
    openGatewayLogs(selectedGateway.value || undefined)
    return
  }
  if (primaryDecision.value.action === 'profiles') {
    openProfiles()
    return
  }
  gatewaysShellRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function loadAgentBindings() {
  bindingsLoading.value = true
  try {
    const res = await listRooms()
    const details = await Promise.allSettled(res.rooms.map(async (room) => ({
      room,
      ...(await listAgents(room.id)),
    })))
    agentBindings.value = details.flatMap((result) => {
      if (result.status !== 'fulfilled') return []
      const { room, agents } = result.value
      return agents.map(agent => ({
        roomId: room.id,
        roomName: room.name,
        roomActive: !!room.isActive,
        agent,
      }))
    })
  } catch (error) {
    agentBindings.value = []
    throw error
  } finally {
    bindingsLoading.value = false
  }
}

function gatewayForProfile(profile?: string): GatewayStatus | undefined {
  if (!profile) return undefined
  return gatewayStore.gateways.find(gateway => gateway.profile === profile)
}

function gatewayLabel(gateway?: GatewayStatus) {
  if (!gateway) return t('gateways.unavailableGateway')
  return `${gateway.host}:${gateway.port}`
}

function gatewayStatusType(gateway?: GatewayStatus) {
  return gateway?.running ? 'success' : 'default'
}

function gatewayLogName(gateway?: GatewayStatus) {
  return gateway?.lastError ? 'gateway' : 'webui'
}

function openGatewayLogs(gateway?: GatewayStatus) {
  const log = gatewayLogName(gateway)
  router.push({ name: 'hermes.logs', query: { log, q: gateway?.profile || '' } })
}

function gatewayFailureText(gateway?: GatewayStatus) {
  if (!gateway?.lastError) return ''
  return gateway.lastError
}

function gatewayActionLoading(profile: string) {
  return pendingGatewayAction.value[profile]
}

function gatewayStatusLabel(gateway: GatewayStatus) {
  const action = gatewayActionLoading(gateway.profile)
  if (action === 'start') return t('gateways.starting')
  if (action === 'stop') return t('gateways.stopping')
  return gateway.running ? t('gateways.running') : t('gateways.stopped')
}

function gatewayStatusTagType(gateway: GatewayStatus) {
  const action = gatewayActionLoading(gateway.profile)
  if (action === 'start') return 'info'
  if (action === 'stop') return 'warning'
  return gateway.running ? 'success' : 'default'
}

function gatewayActionLabel(gateway: GatewayStatus) {
  const action = gatewayActionLoading(gateway.profile)
  if (action === 'start') return t('gateways.starting')
  if (action === 'stop') return t('gateways.stopping')
  return gateway.running ? t('common.stop') : t('common.start')
}

function roomBindingHint(room: { roomActive: boolean; bindings: AgentGatewayBinding[] }) {
  return room.roomActive
    ? t('gateways.activeRoomHint', { count: room.bindings.length })
    : t('gateways.standbyRoomHint')
}

function openProfiles() {
  router.push({ name: 'hermes.profiles' })
}

function gatewayModelLabel(gateway?: GatewayStatus) {
  if (!gateway) return t('gateways.unavailableModel')
  const detail = profileDetailMap.value[gateway.profile]
  return detail?.model || t('gateways.unavailableModel')
}

function gatewayProviderLabel(gateway?: GatewayStatus) {
  if (!gateway) return ''
  const detail = profileDetailMap.value[gateway.profile]
  return detail?.provider || ''
}

function handleGatewayCreated() {
  showCreateProfileModal.value = false
  void refreshPageData()
}

function selectGateway(profile: string) {
  selectedGatewayProfile.value = profile
}

watch(sortedGateways, (gateways) => {
  if (gateways.length === 0) {
    selectedGatewayProfile.value = ''
    return
  }
  if (!gateways.some(gateway => gateway.profile === selectedGatewayProfile.value)) {
    selectedGatewayProfile.value = activeProfileName.value && gateways.some(gateway => gateway.profile === activeProfileName.value)
      ? activeProfileName.value
      : gateways[0].profile
  }
}, { immediate: true })
</script>

<template>
  <div class="gateways-view workbench-page">
    <section class="workbench-page__hero">
      <div class="workbench-page__hero-copy">
        <div class="workbench-page__eyebrow">{{ t('gateways.heroEyebrow') }}</div>
        <h1 class="workbench-page__title">{{ t('gateways.heroTitle') }}</h1>
        <p class="workbench-page__subtitle">{{ t('gateways.heroSubtitle') }}</p>
      </div>
      <div class="workbench-page__actions">
        <NButton secondary @click="router.push({ name: 'hermes.models' })">
          {{ t('gateways.openModels') }}
        </NButton>
        <NButton size="small" :title="t('gateways.refreshStatusHint')" @click="handleRefresh">
          {{ t('gateways.refreshStatus') }}
        </NButton>
      </div>
    </section>

    <section class="gateways-view__decision-grid">
      <article class="gateways-guide workbench-panel" :class="`gateways-guide--${primaryDecision.tone}`">
        <div class="workbench-section-title">{{ primaryDecision.eyebrow }}</div>
        <h2 class="gateways-guide__title">{{ primaryDecision.title }}</h2>
        <p class="gateways-guide__body">{{ primaryDecision.body }}</p>
        <div class="gateways-guide__points">
          <div class="gateways-guide__point">{{ t('gateways.guidePoint1') }}</div>
          <div class="gateways-guide__point">{{ t('gateways.guidePoint2') }}</div>
          <div class="gateways-guide__point">{{ t('gateways.guidePoint3') }}</div>
        </div>
        <div class="gateways-guide__actions">
          <NButton type="primary" @click="handlePrimaryDecision()">
            {{ primaryDecision.actionLabel }}
          </NButton>
          <NButton quaternary @click="router.push({ name: 'workbench.runs' })">
            {{ t('gateways.openRuns') }}
          </NButton>
        </div>
      </article>

      <article class="gateways-checklist workbench-panel workbench-panel--soft">
        <div class="workbench-section-title">{{ t('gateways.checklistEyebrow') }}</div>
        <h2 class="gateways-checklist__title">{{ t('gateways.checklistTitle') }}</h2>
        <p class="gateways-checklist__body">{{ t('gateways.checklistBody') }}</p>
        <div class="gateways-checklist__list">
          <div v-for="item in decisionChecklist" :key="item.key" class="gateways-checklist__item">
            <span class="gateways-checklist__label">{{ item.label }}</span>
            <span class="gateways-checklist__count">{{ item.count }}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="gateways-view__summary-grid">
      <article class="gateways-stat workbench-panel">
        <div class="gateways-stat__label">{{ t('gateways.summaryActiveProfile') }}</div>
        <div class="gateways-stat__value">{{ activeProfileName || t('gateways.noActiveProfile') }}</div>
        <div class="gateways-stat__meta">{{ t('gateways.summaryActiveProfileMeta') }}</div>
      </article>

      <article class="gateways-stat workbench-panel">
        <div class="gateways-stat__label">{{ t('gateways.summaryActiveGateway') }}</div>
        <div class="gateways-stat__value gateways-stat__value--path">{{ activeGatewayLabel }}</div>
        <div class="gateways-stat__meta">{{ t('gateways.summaryActiveGatewayMeta') }}</div>
      </article>

      <article class="gateways-stat workbench-panel">
        <div class="gateways-stat__label">{{ t('gateways.summaryAgentProfiles') }}</div>
        <div class="gateways-stat__value">{{ agentProfileNames.length }}</div>
        <div class="gateways-stat__meta">{{ t('gateways.summaryAgentProfilesMeta') }}</div>
      </article>

      <article class="gateways-stat workbench-panel">
        <div class="gateways-stat__label">{{ t('gateways.summaryBackend') }}</div>
        <div class="gateways-stat__value">{{ summaryBackendLabel }}</div>
        <div class="gateways-stat__meta">{{ t('gateways.summaryBackendMeta') }}</div>
      </article>
    </section>

    <section class="gateways-view__content">
      <div ref="gatewaysShellRef" class="gateways-shell workbench-panel workbench-panel--soft">
        <header class="page-header gateways-shell__header">
          <div class="gateways-shell__title-group">
            <h2 class="header-title">{{ t('gateways.title') }}</h2>
            <p class="gateways-shell__subtitle">{{ t('gateways.panelSubtitle') }}</p>
          </div>
        </header>

        <div class="gateways-content">
          <NSpin :show="gatewayStore.loading || profilesStore.loading || bindingsLoading" size="large">
        <div class="section-note section-note--top">
          <div class="section-note__title">{{ t('gateways.aiListTitle') }}</div>
          <div class="section-note__body">{{ t('gateways.aiListBody') }}</div>
          <div class="section-note__actions">
            <NTag size="small" round type="info">{{ t('gateways.aiGatewayCount', { count: aiGatewayCount }) }}</NTag>
            <NButton size="small" secondary @click="showCreateProfileModal = true">
              {{ t('gateways.createGateway') }}
            </NButton>
          </div>
        </div>

        <div class="management-tabs" role="tablist">
          <button
            class="management-tab"
            :class="{ active: activeTab === 'gateways' }"
            type="button"
            @click="activeTab = 'gateways'"
          >
            <span class="management-tab__title">{{ t('gateways.tabs.gateways') }}</span>
            <span class="management-tab__desc">{{ t('gateways.tabHints.gateways') }}</span>
          </button>
          <button
            class="management-tab"
            :class="{ active: activeTab === 'models' }"
            type="button"
            @click="activeTab = 'models'"
          >
            <span class="management-tab__title">{{ t('gateways.tabs.models') }}</span>
            <span class="management-tab__desc">{{ t('gateways.tabHints.models') }}</span>
          </button>
          <button
            class="management-tab"
            :class="{ active: activeTab === 'relations' }"
            type="button"
            @click="activeTab = 'relations'"
          >
            <span class="management-tab__title">{{ t('gateways.tabs.relations') }}</span>
            <span class="management-tab__desc">{{ t('gateways.tabHints.relations') }}</span>
          </button>
        </div>

        <section v-show="activeTab === 'gateways'" class="boundary-section">
              <div class="section-heading section-heading--actions">
                <div>
                  <h3>{{ t('gateways.aiSectionTitle') }}</h3>
                  <span>{{ t('gateways.aiSectionHint') }}</span>
                </div>
                <div class="section-heading__actions">
                  <NButton size="small" type="primary" @click="showCreateProfileModal = true">
                    {{ t('gateways.createGateway') }}
                  </NButton>
                </div>
              </div>

              <div v-if="gatewayStore.gateways.length === 0" class="empty-state">
                <div>{{ t('gateways.noAiGateways') }}</div>
                <NButton size="small" secondary @click="showCreateProfileModal = true">
                  {{ t('gateways.createGateway') }}
                </NButton>
              </div>

              <div v-else class="gateway-layout">
                <div class="gateway-list">
                  <button
                    v-for="gw in sortedGateways"
                    :key="gw.profile"
                    class="gateway-list-item"
                    :class="{ active: selectedGateway?.profile === gw.profile }"
                    @click="selectGateway(gw.profile)"
                  >
                    <div class="gateway-list-item__header">
                      <div class="gateway-name">{{ gw.profile }}</div>
                      <NTag v-if="gw.profile === activeProfileName" type="info" size="small" round>
                        {{ t('gateways.activeProfileBadge') }}
                      </NTag>
                      <NTag v-if="selectedGateway?.profile === gw.profile" type="success" size="small" round>
                        {{ t('gateways.selectedGatewayBadge') }}
                      </NTag>
                    </div>
                    <div class="gateway-meta">
                      <span class="meta-item">{{ gw.host }}:{{ gw.port }}</span>
                      <span v-if="gw.pid" class="meta-item">PID: {{ gw.pid }}</span>
                    </div>
                    <div class="gateway-meta gateway-meta--model">
                      <span class="meta-item">{{ t('gateways.boundModel') }}: {{ gatewayModelLabel(gw) }}</span>
                    </div>
                    <div class="gateway-serving">
                      <NTag size="small" round type="info">{{ t('gateways.aiGatewayBadge') }}</NTag>
                      <NTag :type="gatewayStatusTagType(gw)" size="small" round>{{ gatewayStatusLabel(gw) }}</NTag>
                    </div>
                  </button>
                </div>

                <div v-if="selectedGateway" class="gateway-detail">
                  <div class="gateway-detail__header">
                    <div>
                      <div class="gateway-detail__title">{{ selectedGateway.profile }}</div>
                      <div class="gateway-detail__subtitle">
                        {{ t('gateways.boundModel') }}: {{ gatewayModelLabel(selectedGateway) }}
                        <span v-if="gatewayProviderLabel(selectedGateway)"> · {{ t('gateways.boundProvider') }}: {{ gatewayProviderLabel(selectedGateway) }}</span>
                      </div>
                    </div>
                    <NTag :type="gatewayStatusTagType(selectedGateway)" size="small" round>
                      {{ gatewayStatusLabel(selectedGateway) }}
                    </NTag>
                  </div>

                  <div class="gateway-detail__meta">
                    <div class="summary-card summary-card--compact">
                      <span class="summary-label">{{ t('gateways.boundGateway') }}</span>
                      <strong class="summary-value">{{ gatewayLabel(selectedGateway) }}</strong>
                    </div>
                    <div class="summary-card summary-card--compact">
                      <span class="summary-label">{{ t('gateways.groupAgentsUsingLabel') }}</span>
                      <strong class="summary-value">{{ activeAgentCountByProfile[selectedGateway.profile] || 0 }}</strong>
                    </div>
                  </div>

                  <div v-if="selectedGateway.lastError && !selectedGateway.running" class="gateway-error">
                    <span class="gateway-error-label">{{ t('gateways.lastFailure') }}</span>
                    <span class="gateway-error-text">{{ gatewayFailureText(selectedGateway) }}</span>
                    <span class="gateway-error-hint">{{ t('gateways.failureLogHint') }}</span>
                  </div>

                  <div v-if="gatewayActionLoading(selectedGateway.profile) === 'start'" class="gateway-error gateway-pending">
                    <span class="gateway-error-label">{{ t('gateways.starting') }}</span>
                    <span class="gateway-error-text">{{ t('gateways.startingBody') }}</span>
                  </div>

                  <div class="gateway-detail__note">
                    {{ t('gateways.gatewayRelationHint') }}
                  </div>

                  <div class="gateway-detail__note gateway-detail__note--strong">
                    <strong>{{ t('gateways.selectedGatewayEffectTitle') }}</strong>
                    <span>{{ t('gateways.selectedGatewayEffectBody') }}</span>
                  </div>

                  <div class="gateway-detail__actions">
                    <NButton secondary @click="openGatewayLogs(selectedGateway)">
                      {{ t('gateways.viewLogs') }}
                    </NButton>
                    <NButton
                      :type="selectedGateway.running ? 'warning' : 'primary'"
                      :loading="!!gatewayActionLoading(selectedGateway.profile)"
                      :disabled="!!gatewayActionLoading(selectedGateway.profile)"
                      @click="handleToggle(selectedGateway.profile, selectedGateway.running)"
                    >
                      {{ gatewayActionLabel(selectedGateway) }}
                    </NButton>
                  </div>
                </div>
              </div>
        </section>

        <section v-show="activeTab === 'models'" class="tab-section">
          <div class="tab-pane-note">
            {{ t('gateways.modelsTabHint') }}
          </div>
          <ModelManagementPanel />
        </section>

        <section v-show="activeTab === 'relations'" class="boundary-section">
              <div class="relation-actions">
                <NButton size="small" secondary @click="openProfiles">
                  {{ t('gateways.manageProfiles') }}
                </NButton>
              </div>
              <section class="routing-summary">
                <div class="summary-card">
                  <span class="summary-label">{{ t('gateways.activeProfile') }}</span>
                  <strong class="summary-value">{{ activeProfileName || t('gateways.noActiveProfile') }}</strong>
                  <span class="summary-meta">{{ t('gateways.currentProfileHint') }}</span>
                </div>

                <div class="summary-card">
                  <span class="summary-label">{{ t('gateways.singleChatGateway') }}</span>
                  <strong class="summary-value">{{ gatewayLabel(activeGateway) }}</strong>
                  <span class="summary-meta">
                    {{ t('gateways.gatewayForProfile', { profile: activeProfileName || '-' }) }}
                  </span>
                </div>

                <div class="summary-card">
                  <span class="summary-label">{{ t('gateways.groupAgentBindings') }}</span>
                  <strong class="summary-value">{{ agentBindings.length }}</strong>
                  <span class="summary-meta">
                    {{ t('gateways.groupAgentBindingsSummary', { count: agentProfileNames.length }) }}
                  </span>
                </div>

                <div class="summary-card">
                  <span class="summary-label">{{ t('gateways.activeRoom') }}</span>
                  <strong class="summary-value">{{ activeRoomBindingGroup?.roomName || t('gateways.noActiveRoom') }}</strong>
                  <span class="summary-meta">
                    {{
                      activeRoomBindingGroup
                        ? t('gateways.activeRoomSummary', { count: activeRoomBindingGroup.bindings.length })
                        : t('gateways.activeRoomEmptyHint')
                    }}
                  </span>
                </div>
              </section>

              <section class="agent-bindings">
                <div class="section-heading">
                  <h3>{{ t('gateways.groupAgentBindings') }}</h3>
                  <span>{{ t('gateways.groupAgentBindingsHint') }}</span>
                </div>

                <div v-if="agentBindings.length === 0" class="empty-state compact">
                  {{ t('gateways.noGroupAgents') }}
                </div>

                <div v-else class="room-binding-list">
                  <div v-for="room in groupedAgentBindings" :key="room.roomId" class="room-binding-card">
                    <div class="room-binding-title-row">
                      <div>
                        <div class="room-binding-title">{{ room.roomName }}</div>
                        <div class="room-binding-hint">{{ roomBindingHint(room) }}</div>
                      </div>
                      <NTag :type="room.roomActive ? 'success' : 'default'" size="small" round>
                        {{ room.roomActive ? t('gateways.activeRoomBadge') : t('gateways.standbyRoomBadge') }}
                      </NTag>
                    </div>
                    <div class="binding-table">
                      <div class="binding-row binding-head">
                        <span>{{ t('gateways.agent') }}</span>
                        <span>{{ t('gateways.profile') }}</span>
                        <span>{{ t('gateways.boundGateway') }}</span>
                        <span>{{ t('gateways.status') }}</span>
                      </div>
                      <div v-for="binding in room.bindings" :key="binding.agent.id" class="binding-row">
                        <span class="agent-name">{{ binding.agent.name }}</span>
                        <span>{{ binding.agent.profile }}</span>
                        <span>{{ gatewayLabel(gatewayForProfile(binding.agent.profile)) }}</span>
                        <span>
                          <NTag :type="gatewayStatusType(gatewayForProfile(binding.agent.profile))" size="small" round>
                            {{ gatewayForProfile(binding.agent.profile)?.running ? t('gateways.running') : t('gateways.stopped') }}
                          </NTag>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section class="boundary-section">
                <div class="section-heading">
                  <h3>{{ t('gateways.backendSectionTitle') }}</h3>
                  <span>{{ t('gateways.backendSectionHint') }}</span>
                </div>

                <div class="backend-service-grid">
                  <div class="summary-card">
                    <span class="summary-label">{{ t('gateways.backendServiceTitle') }}</span>
                    <strong class="summary-value">
                      {{ backendServiceHealthy ? t('gateways.backendServiceRunning') : t('gateways.backendServiceStopped') }}
                    </strong>
                    <span class="summary-meta">{{ t('gateways.backendServiceSubtitle') }}</span>
                  </div>

                  <div class="summary-card summary-card--boundary">
                    <span class="summary-label">{{ t('gateways.backendBoundaryTitle') }}</span>
                    <strong class="summary-value">{{ t('gateways.backendBoundaryBody') }}</strong>
                    <span class="summary-meta">{{ t('gateways.backendBoundaryHint') }}</span>
                    <div class="backend-service-actions">
                      <NButton size="small" secondary @click="router.push({ name: 'hermes.settings' })">
                        {{ t('sidebar.settings') }}
                      </NButton>
                      <NButton size="small" secondary @click="router.push({ name: 'hermes.logs' })">
                        {{ t('gateways.viewLogs') }}
                      </NButton>
                    </div>
                  </div>
                </div>
              </section>
        </section>
          </NSpin>
        </div>
      </div>
    </section>

    <ProfileCreateModal
      v-if="showCreateProfileModal"
      @close="showCreateProfileModal = false"
      @saved="handleGatewayCreated"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.gateways-view {
  min-height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
}

.gateways-view__decision-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 16px;
  padding: 0 24px 16px;
}

.gateways-guide {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.gateways-guide--warning {
  background:
    linear-gradient(135deg, rgba(178, 75, 66, 0.08), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.gateways-guide--accent {
  background:
    linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.09), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.gateways-guide__title,
.gateways-checklist__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  color: $text-primary;
}

.gateways-guide__body,
.gateways-checklist__body,
.gateways-shell__subtitle {
  color: $text-secondary;
  line-height: 1.7;
}

.gateways-guide__points,
.gateways-checklist__list {
  display: grid;
  gap: 10px;
}

.gateways-guide__point,
.gateways-checklist__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: rgba(255, 255, 255, 0.82);
}

.gateways-guide__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: auto;
}

.gateways-checklist__label,
.gateways-stat__label {
  color: $text-secondary;
}

.gateways-checklist__count,
.gateways-stat__value {
  font-size: 28px;
  font-weight: 700;
  color: $text-primary;
}

.gateways-stat__value--path {
  font-size: 20px;
  word-break: break-all;
}

.gateways-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 0 24px 16px;
}

.gateways-stat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 142px;
}

.gateways-stat__meta {
  color: $text-muted;
  line-height: 1.6;
  word-break: break-word;
}

.gateways-view__content {
  flex: 1;
  min-height: 0;
  padding: 0 24px 24px;
}

.gateways-shell {
  padding: 0;
  overflow: hidden;
}

.gateways-shell__header {
  padding: 18px 20px;
}

.gateways-shell__title-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gateways-content {
  overflow-y: auto;
  padding: 20px;
}

.management-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 14px 0 16px;
}

.management-tab {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-height: 70px;
  padding: 12px 14px;
  text-align: left;
  background: $bg-card;
  color: $text-secondary;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  cursor: pointer;
  transition: border-color $transition-fast, box-shadow $transition-fast, transform $transition-fast;

  &:hover {
    border-color: rgba(var(--accent-primary-rgb), 0.28);
  }

  &.active {
    color: $text-primary;
    border-color: rgba(var(--accent-primary-rgb), 0.58);
    box-shadow: 0 0 0 1px rgba(var(--accent-primary-rgb), 0.16), 0 10px 24px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }
}

.management-tab__title {
  font-size: 14px;
  font-weight: 700;
}

.management-tab__desc {
  font-size: 12px;
  color: $text-muted;
  line-height: 1.4;
}

.tab-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.relation-actions {
  display: flex;
  justify-content: flex-end;
}

.routing-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.boundary-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-note {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid rgba(var(--accent-primary-rgb), 0.12);
  background: linear-gradient(180deg, rgba(var(--accent-primary-rgb), 0.06), rgba(var(--accent-primary-rgb), 0.02));
  border-radius: $radius-md;
}

.section-note__title {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
}

.section-note__body {
  font-size: 12px;
  color: $text-secondary;
  line-height: 1.6;
}

.section-note__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.section-heading--actions {
  align-items: center;

  h3 {
    margin: 0;
  }
}

.section-heading__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tab-pane-note {
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: $radius-md;
  background: rgba(var(--accent-primary-rgb), 0.06);
  color: $text-secondary;
  font-size: 12px;
  line-height: 1.6;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 14px 16px;
  background-color: $bg-card;
  border: 1px solid $border-color;
  border-radius: $radius-md;
}

.summary-card--compact {
  padding: 12px 14px;
}

.summary-label,
.summary-meta {
  font-size: 12px;
  color: $text-muted;
}

.summary-card--boundary {
  gap: 8px;
}

.backend-service-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}

.backend-service-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

.summary-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 18px;
  line-height: 1.25;
  color: $text-primary;
}

.empty-state {
  text-align: center;
  color: $text-muted;
  padding: 40px 0;

  &.compact {
    padding: 24px 0;
  }
}

.gateway-layout {
  display: grid;
  grid-template-columns: minmax(300px, 0.9fr) minmax(360px, 1.1fr);
  gap: 12px;
}

.gateway-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gateway-list-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 14px 16px;
  text-align: left;
  background-color: $bg-card;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  transition: border-color $transition-fast, box-shadow $transition-fast, transform $transition-fast;
  cursor: pointer;

  &:hover {
    border-color: rgba(var(--accent-primary-rgb), 0.28);
  }

  &.active {
    border-color: rgba(var(--accent-primary-rgb), 0.52);
    box-shadow: 0 0 0 1px rgba(var(--accent-primary-rgb), 0.16);
    transform: translateY(-1px);
  }
}

.gateway-list-item__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  :deep(.n-tag) {
    flex-shrink: 0;
  }
}

.gateway-name {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
}

.gateway-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.gateway-meta--model {
  margin-top: 6px;
}

.meta-item {
  font-size: 12px;
  color: $text-muted;
}

.gateway-serving {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.gateway-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background-color: $bg-card;
  border: 1px solid $border-color;
  border-radius: $radius-md;
}

.gateway-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.gateway-detail__title {
  font-size: 15px;
  font-weight: 600;
  color: $text-primary;
}

.gateway-detail__subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: $text-muted;
  line-height: 1.5;
}

.gateway-detail__meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.gateway-detail__note {
  padding: 12px 14px;
  border-radius: $radius-sm;
  background: rgba(var(--accent-primary-rgb), 0.06);
  color: $text-secondary;
  font-size: 12px;
  line-height: 1.6;
}

.gateway-detail__note--strong {
  display: flex;
  flex-direction: column;
  gap: 4px;

  strong {
    color: $text-primary;
    font-size: 12px;
  }
}

.gateway-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.gateway-error {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: $radius-sm;
  background: rgba(var(--warning-rgb), 0.08);
  border: 1px solid rgba(var(--warning-rgb), 0.2);
}

.gateway-error-label {
  font-size: 11px;
  color: $text-muted;
}

.gateway-error-text {
  font-size: 12px;
  color: $text-primary;
  line-height: 1.5;
  word-break: break-word;
}

.gateway-error-hint {
  font-size: 11px;
  color: $text-muted;
}

.gateway-pending {
  background: rgba(var(--info-rgb), 0.08);
  border-color: rgba(var(--info-rgb), 0.2);
}

.gateway-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.agent-bindings {
  margin-top: 20px;
}

.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;

  h3 {
    font-size: 14px;
    font-weight: 600;
    color: $text-primary;
  }

  span {
    font-size: 12px;
    color: $text-muted;
  }
}

.room-binding-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.room-binding-card {
  padding: 16px;
  background-color: $bg-card;
  border: 1px solid $border-color;
  border-radius: $radius-md;
}

.room-binding-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.room-binding-title {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
}

.room-binding-hint {
  margin-top: 4px;
  font-size: 12px;
  color: $text-muted;
}

.binding-table {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.binding-row {
  display: grid;
  grid-template-columns: minmax(120px, 1.1fr) minmax(100px, 0.9fr) minmax(150px, 1fr) 90px;
  gap: 12px;
  align-items: center;
  min-height: 34px;
  font-size: 12px;
  color: $text-secondary;

  > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.binding-head {
  color: $text-muted;
  border-bottom: 1px solid $border-light;
}

.agent-name {
  font-weight: 600;
  color: $text-primary;
}

@media (max-width: 760px) {
  .gateways-view__decision-grid,
  .gateways-view__summary-grid,
  .gateways-view__content {
    padding-left: 12px;
    padding-right: 12px;
  }

  .gateways-shell__header {
    padding: 16px 12px 12px;
  }

  .gateways-content {
    padding: 12px;
  }

  .gateways-checklist__count,
  .gateways-stat__value {
    font-size: 22px;
  }

  .routing-summary {
    grid-template-columns: 1fr;
  }

  .management-tabs {
    grid-template-columns: 1fr;
  }

  .gateway-layout {
    grid-template-columns: 1fr;
  }

  .binding-row {
    grid-template-columns: 1fr;
    gap: 4px;
    padding: 10px 0;
    border-bottom: 1px solid $border-light;

    &.binding-head {
      display: none;
    }
  }
}

@media (max-width: 1100px) {
  .gateways-view__decision-grid,
  .gateways-view__summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
