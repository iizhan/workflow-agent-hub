<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationDetail, ApplicationSectionKey } from '@/types/workbench/application'
import { buildScopedWorkbenchRoute } from '@/utils/workbench-application-scope'

const props = defineProps<{
  application: ApplicationDetail
  activeSection: ApplicationSectionKey
  isStartingExecution?: boolean
}>()

const emit = defineEmits<{
  navigate: [section: ApplicationSectionKey]
  startExecution: []
}>()

const router = useRouter()
const { t, scenarioLabel, statusLabel, statusReasonLabel, nextActionLabel } = useWorkbenchI18n()
const statusClass = computed(() => `workbench-status-pill--${props.application.status}`)
const runNotStarted = computed(() => !props.application.run.status || props.application.run.status === 'idle')

const primaryAction = computed(() => {
  if (props.application.status === 'ready' && runNotStarted.value) {
    return {
      label: props.isStartingExecution ? t('workbench.header.startingExecution') : t('workbench.header.startExecution'),
      note: t('workbench.header.startExecutionReadyNote'),
      disabled: !!props.isStartingExecution,
      action: () => emit('startExecution'),
    }
  }

  if (props.application.nextAction) {
    return {
      label: nextActionLabel(props.application.nextAction),
      note: t('workbench.header.suggestedNextStepNote'),
      disabled: false,
      action: () => emit('navigate', props.application.nextAction!.targetSection),
    }
  }

  return {
    label: t('workbench.header.openCollaboration'),
    note: t('workbench.header.openCollaborationNote'),
    disabled: false,
    action: () => emit('navigate', 'collaboration'),
  }
})

const heroStats = computed(() => [
  {
    label: t('workbench.header.primaryProject'),
    value: props.application.primaryProject?.name || t('workbench.header.notConnectedYet'),
  },
  {
    label: t('workbench.header.agentTeam'),
    value: t('workbench.header.configured', { count: props.application.agents.total }),
  },
  {
    label: t('workbench.header.executionFlow'),
    value: props.application.workflow.name || t('workbench.header.notConfiguredYet'),
  },
  {
    label: t('workbench.header.runState'),
    value: props.application.status === 'ready' && runNotStarted.value
      ? t('workbench.header.readyToStartFirstRun')
      : props.application.run.status
        ? statusLabel(props.application.run.status)
        : t('workbench.header.idle'),
  },
])

const scopeActions = computed(() => [
  {
    label: t('workbench.header.applicationSettings'),
    action: () => emit('navigate', 'settings'),
  },
  {
    label: t('workbench.header.sharedResources'),
    action: () => router.push(buildScopedWorkbenchRoute('workbench.resources', props.application.id, props.activeSection)),
  },
  {
    label: t('workbench.header.systemControl'),
    action: () => router.push(buildScopedWorkbenchRoute('workbench.system', props.application.id, props.activeSection)),
  },
])
</script>

<template>
  <section class="application-header">
    <div class="application-header__hero">
      <div class="application-header__copy">
        <div class="application-header__meta">
          <span class="workbench-pill">{{ scenarioLabel(application.scenario) }}</span>
          <span class="workbench-status-pill" :class="statusClass">{{ statusLabel(application.status) }}</span>
        </div>
        <h1 class="application-header__title">{{ application.name }}</h1>
        <p class="application-header__summary">
          {{ application.goalSummary || statusReasonLabel(application.statusReason) || t('workbench.header.defaultSummary') }}
        </p>
      </div>

      <div class="application-header__action-stack">
        <div class="application-header__actions">
          <button
            class="application-header__primary workbench-action-primary"
            type="button"
            :disabled="primaryAction.disabled"
            @click="primaryAction.action()"
          >
            {{ primaryAction.label }}
          </button>
          <button
            v-for="item in scopeActions"
            :key="item.label"
            class="application-header__secondary workbench-action-secondary"
            type="button"
            @click="item.action()"
          >
            {{ item.label }}
          </button>
        </div>
        <p class="application-header__primary-note">
          {{ primaryAction.note }}
        </p>
        <p class="application-header__scope-note">
          {{ t('workbench.header.scopeNote') }}
        </p>
      </div>
    </div>

    <div class="application-header__stats">
      <article v-for="item in heroStats" :key="item.label" class="hero-stat workbench-stat-card">
        <div class="hero-stat__label">{{ item.label }}</div>
        <div class="hero-stat__value">{{ item.value }}</div>
      </article>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.application-header {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 28px 24px 20px;
  border-bottom: 1px solid $border-color;
  background: var(--workbench-hero-bg);
}

.application-header__hero {
  display: flex;
  justify-content: space-between;
  gap: 20px;
}

.application-header__meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.application-header__title {
  margin-top: 12px;
  font-size: 30px;
  line-height: 1.1;
  color: $text-primary;
}

.application-header__summary {
  margin-top: 12px;
  max-width: 760px;
  color: $text-secondary;
  line-height: 1.7;
}

.application-header__actions {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
}

.application-header__action-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.application-header__primary-note {
  max-width: 420px;
  color: $text-secondary;
  line-height: 1.6;
}

.application-header__scope-note {
  max-width: 420px;
  color: $text-secondary;
  line-height: 1.6;
}

.application-header__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.hero-stat__label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $text-muted;
}

.hero-stat__value {
  margin-top: 8px;
  color: $text-primary;
  font-weight: 700;
  line-height: 1.4;
}

@media (max-width: 960px) {
  .application-header__hero {
    flex-direction: column;
  }

  .application-header__stats {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
