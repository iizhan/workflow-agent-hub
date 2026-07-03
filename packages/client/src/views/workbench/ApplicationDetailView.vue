<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NSpin, useMessage } from 'naive-ui'
import ApplicationAgentsWorkspace from '@/components/workbench/agents/ApplicationAgentsWorkspace.vue'
import ApplicationHeader from '@/components/workbench/ApplicationHeader.vue'
import ApplicationOverviewPanel from '@/components/workbench/ApplicationOverviewPanel.vue'
import ApplicationArtifactsWorkspace from '@/components/workbench/artifacts/ApplicationArtifactsWorkspace.vue'
import ApplicationCollaborationWorkspace from '@/components/workbench/collaboration/ApplicationCollaborationWorkspace.vue'
import ApplicationProjectsWorkspace from '@/components/workbench/projects/ApplicationProjectsWorkspace.vue'
import ApplicationRunsWorkspace from '@/components/workbench/runs/ApplicationRunsWorkspace.vue'
import ApplicationSettingsWorkspace from '@/components/workbench/settings/ApplicationSettingsWorkspace.vue'
import ApplicationSectionNav from '@/components/workbench/ApplicationSectionNav.vue'
import ApplicationWorkflowWorkspace from '@/components/workbench/workflow/ApplicationWorkflowWorkspace.vue'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import { useApplicationsStore } from '@/stores/workbench/applications'
import { useGroupChatStore } from '@/stores/hermes/group-chat'
import type { ApplicationSectionKey } from '@/types/workbench/application'

const route = useRoute()
const router = useRouter()
const applicationsStore = useApplicationsStore()
const groupChatStore = useGroupChatStore()
const { t, statusLabel } = useWorkbenchI18n()
const message = useMessage()
const isStartingExecution = ref(false)

const applicationId = computed(() => String(route.params.applicationId || ''))
const activeSection = computed<ApplicationSectionKey>(() => {
  const section = String(route.query.section || 'overview')
  const allowed: ApplicationSectionKey[] = [
    'overview',
    'projects',
    'agents',
    'workflow',
    'artifacts',
    'runs',
    'collaboration',
    'settings',
  ]
  return allowed.includes(section as ApplicationSectionKey) ? (section as ApplicationSectionKey) : 'overview'
})

const collaborationReady = computed(() => groupChatStore.currentRoomId === applicationId.value)
const canStartFirstRun = computed(() => {
  const application = applicationsStore.currentApplication
  if (!application) return false
  return application.status === 'ready' && (!application.run.status || application.run.status === 'idle')
})

const collaborationVisibilityBody = computed(() => {
  const application = applicationsStore.currentApplication
  if (!application) return t('workbench.detail.visibilityCollaborationBody')
  if (application.run.status === 'running' || application.run.status === 'paused') {
    return t('workbench.detail.visibilityCollaborationLiveBody')
  }
  return t('workbench.detail.visibilityCollaborationBody')
})

const runsVisibilityBody = computed(() => {
  const application = applicationsStore.currentApplication
  if (!application) return t('workbench.detail.visibilityRunsBody')
  if (application.run.hasPendingReview) {
    return t('workbench.detail.visibilityRunsReviewBody')
  }
  if (application.status === 'failed') {
    return t('workbench.detail.visibilityRunsFailureBody')
  }
  return t('workbench.detail.visibilityRunsBody')
})

async function ensureCollaborationReady() {
  if (!applicationId.value) return
  if (!groupChatStore.connected) {
    groupChatStore.connect()
  }
  await groupChatStore.loadRooms()
  if (groupChatStore.currentRoomId !== applicationId.value) {
    await groupChatStore.joinRoom(applicationId.value)
  }
}

function goToSection(section: ApplicationSectionKey) {
  applicationsStore.setCurrentApplicationSection(section)
  router.replace({
    name: 'workbench.applicationDetail',
    params: { applicationId: applicationId.value },
    query: section === 'overview' ? undefined : { section },
  })
}

async function handleStartExecution() {
  if (!applicationId.value || isStartingExecution.value) return

  isStartingExecution.value = true
  try {
    const actorName = await groupChatStore.ensureUserName()
    await groupChatStore.startWorkflowExecution(applicationId.value, {
      actorName: actorName || undefined,
    })
    await applicationsStore.loadApplicationDetail(applicationId.value)
    message.success(t('workbench.header.startExecutionSuccess'))
    goToSection('collaboration')
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.header.startExecutionFailed')))
  } finally {
    isStartingExecution.value = false
  }
}

watch(
  applicationId,
  async value => {
    if (!value) return
    await applicationsStore.loadApplicationDetail(value)
    if (activeSection.value === 'collaboration') {
      await ensureCollaborationReady()
    }
  },
  { immediate: true },
)

watch(
  activeSection,
  async section => {
    applicationsStore.setCurrentApplicationSection(section)
    if (section === 'collaboration') {
      await ensureCollaborationReady()
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  groupChatStore.disconnect()
})
</script>

<template>
  <div class="application-detail-view workbench-page">
    <NSpin :show="applicationsStore.isLoadingDetail">
      <template v-if="applicationsStore.currentApplication">
        <ApplicationHeader
          :application="applicationsStore.currentApplication"
          :active-section="activeSection"
          :is-starting-execution="isStartingExecution"
          @navigate="goToSection"
          @start-execution="handleStartExecution"
        />

        <ApplicationSectionNav
          :active-section="activeSection"
          :sections="applicationsStore.currentApplication.sections"
          @change="goToSection"
        />

        <main class="application-detail-view__content">
          <template v-if="activeSection === 'overview'">
            <ApplicationOverviewPanel
              :application="applicationsStore.currentApplication"
              :is-starting-execution="isStartingExecution"
              @navigate="goToSection"
              @start-execution="handleStartExecution"
            />

            <section class="application-visibility-grid">
              <article class="summary-card workbench-panel workbench-panel--soft">
                <div class="summary-card__title">{{ t('workbench.detail.visibilityCollaborationTitle') }}</div>
                <div class="summary-card__value">{{ collaborationVisibilityBody }}</div>
                <button type="button" class="summary-card__action workbench-action-primary" @click="goToSection('collaboration')">
                  {{ t('workbench.header.openCollaboration') }}
                </button>
              </article>

              <article class="summary-card workbench-panel workbench-panel--soft">
                <div class="summary-card__title">{{ t('workbench.detail.visibilityRunsTitle') }}</div>
                <div class="summary-card__value">{{ runsVisibilityBody }}</div>
                <button type="button" class="summary-card__action workbench-action-secondary" @click="goToSection('runs')">
                  {{ t('workbench.detail.openRunState') }}
                </button>
              </article>

              <article class="summary-card workbench-panel workbench-panel--soft">
                <div class="summary-card__title">{{ t('workbench.detail.visibilityTroubleshootTitle') }}</div>
                <div class="summary-card__value">{{ t('workbench.detail.visibilityTroubleshootBody') }}</div>
                <div class="application-visibility-actions">
                  <button type="button" class="summary-card__action workbench-action-secondary" @click="router.push({ name: 'hermes.logs' })">
                    {{ t('sidebar.logs') }}
                  </button>
                  <button type="button" class="summary-card__action workbench-action-secondary" @click="router.push({ name: 'workbench.system', query: { applicationId, fromSection: 'overview' } })">
                    {{ t('workbench.header.systemControl') }}
                  </button>
                </div>
              </article>
            </section>

            <section class="application-summary-grid">
              <article class="summary-card workbench-panel">
                <div class="summary-card__title">{{ t('workbench.detail.projectContext') }}</div>
                <div class="summary-card__value">
                  {{ applicationsStore.currentApplication.primaryProject?.name || t('workbench.detail.noPrimaryProject') }}
                </div>
                <button type="button" class="summary-card__action workbench-action-secondary" @click="goToSection('projects')">{{ t('workbench.detail.openProjectContext') }}</button>
              </article>

              <article class="summary-card workbench-panel">
                <div class="summary-card__title">{{ t('workbench.detail.agentTeam') }}</div>
                <div class="summary-card__value">{{ t('workbench.detail.rolesConfigured', { count: applicationsStore.currentApplication.agents.total }) }}</div>
                <button type="button" class="summary-card__action workbench-action-secondary" @click="goToSection('agents')">{{ t('workbench.detail.openAgentTeam') }}</button>
              </article>

              <article class="summary-card workbench-panel">
                <div class="summary-card__title">{{ t('workbench.detail.executionFlow') }}</div>
                <div class="summary-card__value">
                  {{ applicationsStore.currentApplication.workflow.name || t('workbench.detail.flowNotConfiguredYet') }}
                </div>
                <button type="button" class="summary-card__action workbench-action-secondary" @click="goToSection('workflow')">{{ t('workbench.detail.openExecutionFlow') }}</button>
              </article>

              <article class="summary-card workbench-panel">
                <div class="summary-card__title">{{ t('workbench.detail.runState') }}</div>
                <div class="summary-card__value">
                  {{ applicationsStore.currentApplication.run.status ? statusLabel(applicationsStore.currentApplication.run.status) : t('workbench.detail.noExecutionStarted') }}
                </div>
                <button
                  v-if="canStartFirstRun"
                  type="button"
                  class="summary-card__action workbench-action-primary"
                  :disabled="isStartingExecution"
                  @click="handleStartExecution"
                >
                  {{ isStartingExecution ? t('workbench.header.startingExecution') : t('workbench.detail.startFirstRun') }}
                </button>
                <button
                  v-else
                  type="button"
                  class="summary-card__action workbench-action-secondary"
                  @click="goToSection('runs')"
                >
                  {{ t('workbench.detail.openRunState') }}
                </button>
                <p v-if="canStartFirstRun" class="summary-card__hint">
                  {{ t('workbench.detail.startFirstRunHint') }}
                </p>
              </article>
            </section>
          </template>

          <section v-else-if="activeSection === 'collaboration'" class="application-detail-view__collaboration">
            <div v-if="!collaborationReady" class="summary-card workbench-panel">
              <div class="summary-card__title">{{ t('workbench.detail.preparingCollaborationTitle') }}</div>
              <div class="summary-card__value">{{ t('workbench.detail.preparingCollaborationBody') }}</div>
            </div>
            <ApplicationCollaborationWorkspace v-else :application="applicationsStore.currentApplication" />
          </section>

          <section v-else-if="activeSection === 'projects'" class="application-detail-view__workspace">
            <ApplicationProjectsWorkspace :application="applicationsStore.currentApplication" />
          </section>

          <section v-else-if="activeSection === 'agents'" class="application-detail-view__workspace">
            <ApplicationAgentsWorkspace :application="applicationsStore.currentApplication" />
          </section>

          <section v-else-if="activeSection === 'workflow'" class="application-detail-view__workspace">
            <ApplicationWorkflowWorkspace :application="applicationsStore.currentApplication" />
          </section>

          <section v-else-if="activeSection === 'artifacts'" class="application-detail-view__workspace">
            <ApplicationArtifactsWorkspace :application="applicationsStore.currentApplication" />
          </section>

          <section v-else-if="activeSection === 'runs'" class="application-detail-view__workspace">
            <ApplicationRunsWorkspace :application="applicationsStore.currentApplication" />
          </section>

          <section v-else-if="activeSection === 'settings'" class="application-detail-view__workspace">
            <ApplicationSettingsWorkspace :application="applicationsStore.currentApplication" />
          </section>

          <section v-else class="summary-card workbench-panel summary-card--placeholder">
            <div class="summary-card__title">{{ activeSection }}</div>
            <div class="summary-card__value">
              {{ t('workbench.detail.placeholderBody') }}
            </div>
            <button type="button" class="summary-card__action workbench-action-secondary" @click="goToSection('collaboration')">{{ t('workbench.header.openCollaboration') }}</button>
          </section>
        </main>
      </template>
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.application-detail-view {
}

.application-detail-view__content {
  padding: 0 24px 28px;
}

.application-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.application-visibility-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.summary-card {
}

.summary-card--placeholder {
  margin-top: 8px;
}

.summary-card__title {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $accent-primary;
  font-weight: 700;
}

.summary-card__value {
  margin-top: 12px;
  color: $text-primary;
  font-size: 16px;
  line-height: 1.5;
}

.summary-card__action {
  margin-top: 18px;
}

.summary-card__hint {
  margin-top: 10px;
  color: $text-muted;
  line-height: 1.6;
}

.application-visibility-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.application-detail-view__collaboration {
  margin-top: 8px;
  min-height: 70vh;
}

.application-detail-view__workspace {
  margin-top: 8px;
}

@media (max-width: 1100px) {
  .application-visibility-grid,
  .application-summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
