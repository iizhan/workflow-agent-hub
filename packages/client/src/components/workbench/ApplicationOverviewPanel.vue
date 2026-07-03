<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationDetail, ApplicationSectionKey } from '@/types/workbench/application'
import { buildScopedWorkbenchRoute } from '@/utils/workbench-application-scope'

const props = defineProps<{
  application: ApplicationDetail
  isStartingExecution?: boolean
}>()

const router = useRouter()
const { t, statusLabel, nextActionLabel, statusReasonLabel } = useWorkbenchI18n()

const emit = defineEmits<{
  navigate: [section: ApplicationSectionKey]
  startExecution: []
}>()

const primaryAction = computed(() => {
  const runNotStarted = !props.application.run.status || props.application.run.status === 'idle'

  if (props.application.status === 'ready' && runNotStarted) {
    return {
      label: props.isStartingExecution ? t('workbench.header.startingExecution') : t('workbench.overview.startFirstRun'),
      note: t('workbench.overview.startFirstRunNote'),
      disabled: !!props.isStartingExecution,
      action: () => emit('startExecution'),
    }
  }

  if (props.application.nextAction) {
    return {
      label: nextActionLabel(props.application.nextAction),
      note: '',
      disabled: false,
      action: () => emit('navigate', props.application.nextAction!.targetSection),
    }
  }

  return {
    label: t('workbench.overview.openExecutionScene'),
    note: '',
    disabled: false,
    action: () => emit('navigate', 'collaboration'),
  }
})

const checklist = computed(() => [
  {
    label: t('workbench.overview.checklistProject'),
    done: !!props.application.primaryProject,
    target: 'projects' as ApplicationSectionKey,
  },
  {
    label: t('workbench.overview.checklistAgents'),
    done: props.application.agents.total > 0,
    target: 'agents' as ApplicationSectionKey,
  },
  {
    label: t('workbench.overview.checklistWorkflow'),
    done: props.application.workflow.enabled,
    target: 'workflow' as ApplicationSectionKey,
  },
])

const readinessItems = computed(() => [
  {
    label: t('workbench.overview.readinessProject'),
    value: props.application.primaryProject?.name || t('workbench.overview.readinessMissing'),
    ready: !!props.application.primaryProject,
    target: 'projects' as ApplicationSectionKey,
  },
  {
    label: t('workbench.overview.readinessTeam'),
    value: props.application.agents.total > 0
      ? t('workbench.overview.readinessConfiguredCount', { count: props.application.agents.total })
      : t('workbench.overview.readinessMissing'),
    ready: props.application.agents.total > 0,
    target: 'agents' as ApplicationSectionKey,
  },
  {
    label: t('workbench.overview.readinessFlow'),
    value: props.application.workflow.enabled
      ? props.application.workflow.name || t('workbench.overview.readinessConfigured')
      : t('workbench.overview.readinessMissing'),
    ready: props.application.workflow.enabled,
    target: 'workflow' as ApplicationSectionKey,
  },
  {
    label: t('workbench.overview.readinessRun'),
    value: props.application.run.status
      ? statusLabel(props.application.run.status)
      : t('workbench.overview.readinessNotStarted'),
    ready: !!props.application.run.status && props.application.run.status !== 'idle',
    target: 'runs' as ApplicationSectionKey,
  },
])

const nextLinks = computed(() => {
  const hasProject = !!props.application.primaryProject
  const hasWorkflow = props.application.workflow.enabled
  const hasOutputs = !!props.application.artifacts.count
  const runActive = !!props.application.run.status && props.application.run.status !== 'idle'

  if (props.application.scenario === 'code') {
    return [
      {
        label: t('workbench.overview.codeMoveProject'),
        hint: hasProject
          ? t('workbench.overview.codeMoveProjectHintReady', { project: props.application.primaryProject?.name || t('workbench.overview.readinessConfigured') })
          : t('workbench.overview.codeMoveProjectHintSetup'),
        target: 'projects' as ApplicationSectionKey,
      },
      {
        label: t('workbench.overview.codeMoveWorkflow'),
        hint: hasWorkflow
          ? t('workbench.overview.codeMoveWorkflowHintReady')
          : t('workbench.overview.codeMoveWorkflowHintSetup'),
        target: 'workflow' as ApplicationSectionKey,
      },
      {
        label: t('workbench.overview.codeMoveOutputs'),
        hint: hasOutputs
          ? t('workbench.overview.codeMoveOutputsHintReady', { count: props.application.artifacts.count || 0 })
          : t('workbench.overview.codeMoveOutputsHintSetup'),
        target: hasOutputs ? ('artifacts' as ApplicationSectionKey) : ('runs' as ApplicationSectionKey),
      },
    ]
  }

  if (props.application.scenario === 'document') {
    return [
      {
        label: t('workbench.overview.documentMoveProject'),
        hint: hasProject
          ? t('workbench.overview.documentMoveProjectHintReady', { project: props.application.primaryProject?.name || t('workbench.overview.readinessConfigured') })
          : t('workbench.overview.documentMoveProjectHintSetup'),
        target: 'projects' as ApplicationSectionKey,
      },
      {
        label: t('workbench.overview.documentMoveWorkflow'),
        hint: hasWorkflow
          ? t('workbench.overview.documentMoveWorkflowHintReady')
          : t('workbench.overview.documentMoveWorkflowHintSetup'),
        target: 'workflow' as ApplicationSectionKey,
      },
      {
        label: t('workbench.overview.documentMoveOutputs'),
        hint: hasOutputs
          ? t('workbench.overview.documentMoveOutputsHintReady', { count: props.application.artifacts.count || 0 })
          : t('workbench.overview.documentMoveOutputsHintSetup'),
        target: hasOutputs ? ('artifacts' as ApplicationSectionKey) : ('runs' as ApplicationSectionKey),
      },
    ]
  }

  if (props.application.scenario === 'ppt') {
    return [
      {
        label: t('workbench.overview.pptMoveProject'),
        hint: hasProject
          ? t('workbench.overview.pptMoveProjectHintReady', { project: props.application.primaryProject?.name || t('workbench.overview.readinessConfigured') })
          : t('workbench.overview.pptMoveProjectHintSetup'),
        target: 'projects' as ApplicationSectionKey,
      },
      {
        label: t('workbench.overview.pptMoveWorkflow'),
        hint: hasWorkflow
          ? t('workbench.overview.pptMoveWorkflowHintReady')
          : t('workbench.overview.pptMoveWorkflowHintSetup'),
        target: 'workflow' as ApplicationSectionKey,
      },
      {
        label: t('workbench.overview.pptMoveOutputs'),
        hint: hasOutputs
          ? t('workbench.overview.pptMoveOutputsHintReady', { count: props.application.artifacts.count || 0 })
          : t('workbench.overview.pptMoveOutputsHintSetup'),
        target: hasOutputs ? ('artifacts' as ApplicationSectionKey) : ('runs' as ApplicationSectionKey),
      },
    ]
  }

  if (props.application.scenario === 'research') {
    return [
      {
        label: t('workbench.overview.researchMoveProject'),
        hint: hasProject
          ? t('workbench.overview.researchMoveProjectHintReady', { project: props.application.primaryProject?.name || t('workbench.overview.readinessConfigured') })
          : t('workbench.overview.researchMoveProjectHintSetup'),
        target: 'projects' as ApplicationSectionKey,
      },
      {
        label: t('workbench.overview.researchMoveWorkflow'),
        hint: hasWorkflow
          ? t('workbench.overview.researchMoveWorkflowHintReady')
          : t('workbench.overview.researchMoveWorkflowHintSetup'),
        target: 'workflow' as ApplicationSectionKey,
      },
      {
        label: t('workbench.overview.researchMoveOutputs'),
        hint: hasOutputs
          ? t('workbench.overview.researchMoveOutputsHintReady', { count: props.application.artifacts.count || 0 })
          : t('workbench.overview.researchMoveOutputsHintSetup'),
        target: hasOutputs ? ('artifacts' as ApplicationSectionKey) : ('runs' as ApplicationSectionKey),
      },
    ]
  }

  return [
    {
      label: t('workbench.overview.shapeExecutionFlow'),
      hint: hasWorkflow
        ? t('workbench.overview.shapeExecutionFlowHintReady')
        : t('workbench.overview.shapeExecutionFlowHintSetup'),
      target: 'workflow' as ApplicationSectionKey,
    },
    {
      label: t('workbench.overview.reviewCurrentOutputs'),
      hint: hasOutputs
        ? t('workbench.overview.reviewCurrentOutputsHintCount', { count: props.application.artifacts.count || 0 })
        : t('workbench.overview.reviewCurrentOutputsHintNone'),
      target: 'artifacts' as ApplicationSectionKey,
    },
    {
      label: t('workbench.overview.inspectLiveExecution'),
      hint: runActive
        ? t('workbench.overview.inspectLiveExecutionHintStatus', { status: statusLabel(props.application.run.status!) })
        : t('workbench.overview.inspectLiveExecutionHintIdle'),
      target: 'collaboration' as ApplicationSectionKey,
    },
  ]
})

const scenarioJourney = computed(() => {
  if (props.application.scenario === 'code') {
    return {
      title: t('workbench.overview.scenarioJourneyCodeTitle'),
      body: t('workbench.overview.scenarioJourneyCodeBody'),
      steps: [
        t('workbench.overview.scenarioJourneyCodeStep1'),
        t('workbench.overview.scenarioJourneyCodeStep2'),
        t('workbench.overview.scenarioJourneyCodeStep3'),
      ],
    }
  }
  if (props.application.scenario === 'document') {
    return {
      title: t('workbench.overview.scenarioJourneyDocumentTitle'),
      body: t('workbench.overview.scenarioJourneyDocumentBody'),
      steps: [
        t('workbench.overview.scenarioJourneyDocumentStep1'),
        t('workbench.overview.scenarioJourneyDocumentStep2'),
        t('workbench.overview.scenarioJourneyDocumentStep3'),
      ],
    }
  }
  if (props.application.scenario === 'ppt') {
    return {
      title: t('workbench.overview.scenarioJourneyPptTitle'),
      body: t('workbench.overview.scenarioJourneyPptBody'),
      steps: [
        t('workbench.overview.scenarioJourneyPptStep1'),
        t('workbench.overview.scenarioJourneyPptStep2'),
        t('workbench.overview.scenarioJourneyPptStep3'),
      ],
    }
  }
  if (props.application.scenario === 'research') {
    return {
      title: t('workbench.overview.scenarioJourneyResearchTitle'),
      body: t('workbench.overview.scenarioJourneyResearchBody'),
      steps: [
        t('workbench.overview.scenarioJourneyResearchStep1'),
        t('workbench.overview.scenarioJourneyResearchStep2'),
        t('workbench.overview.scenarioJourneyResearchStep3'),
      ],
    }
  }
  return {
    title: t('workbench.overview.scenarioJourneyGeneralTitle'),
    body: t('workbench.overview.scenarioJourneyGeneralBody'),
    steps: [
      t('workbench.overview.scenarioJourneyGeneralStep1'),
      t('workbench.overview.scenarioJourneyGeneralStep2'),
      t('workbench.overview.scenarioJourneyGeneralStep3'),
    ],
  }
})

const boundaryLinks = computed(() => [
  {
    label: t('workbench.header.applicationSettings'),
    eyebrow: t('workbench.overview.appOwned'),
    hint: t('workbench.overview.settingsHint'),
    action: () => emit('navigate', 'settings' as ApplicationSectionKey),
  },
  {
    label: t('workbench.header.sharedResources'),
    eyebrow: t('workbench.overview.sharedScope'),
    hint: t('workbench.overview.resourcesHint'),
    action: () => router.push(buildScopedWorkbenchRoute('workbench.resources', props.application.id, 'overview')),
  },
  {
    label: t('workbench.header.systemControl'),
    eyebrow: t('workbench.overview.systemScope'),
    hint: t('workbench.overview.systemHint'),
    action: () => router.push(buildScopedWorkbenchRoute('workbench.system', props.application.id, 'overview')),
  },
])
</script>

<template>
  <section class="overview-grid">
    <article class="overview-card workbench-card overview-card--primary">
      <div class="overview-card__eyebrow">{{ t('workbench.overview.applicationStatus') }}</div>
      <h2 class="overview-card__title">{{ statusLabel(application.status) }}</h2>
      <p class="overview-card__body">
        {{ statusReasonLabel(application.statusReason) || t('workbench.overview.statusFallback') }}
      </p>
      <button
        type="button"
        class="overview-card__action workbench-action-primary"
        :disabled="primaryAction.disabled"
        @click="primaryAction.action()"
      >
        {{ primaryAction.label }}
      </button>
      <p v-if="primaryAction.note" class="overview-card__action-note">{{ primaryAction.note }}</p>
    </article>

    <article class="overview-card workbench-card workbench-card--soft">
      <div class="overview-card__eyebrow">{{ t('workbench.overview.readinessChecklist') }}</div>
      <div class="checklist">
        <button
          v-for="item in checklist"
          :key="item.label"
          type="button"
          class="checklist__item"
          @click="emit('navigate', item.target)"
        >
          <span class="checklist__dot" :class="{ 'checklist__dot--done': item.done }"></span>
          <span>{{ item.label }}</span>
        </button>
      </div>
    </article>

    <article class="overview-card workbench-card workbench-card--soft">
      <div class="overview-card__eyebrow">{{ t('workbench.overview.readinessSummary') }}</div>
      <div class="readiness-list">
        <button
          v-for="item in readinessItems"
          :key="item.label"
          type="button"
          class="readiness-item"
          @click="emit('navigate', item.target)"
        >
          <div class="readiness-item__label">{{ item.label }}</div>
          <div class="readiness-item__value" :class="{ 'readiness-item__value--ready': item.ready }">
            {{ item.value }}
          </div>
        </button>
      </div>
    </article>

    <article class="overview-card workbench-card workbench-card--soft overview-card--wide">
      <div class="overview-card__eyebrow">{{ t('workbench.overview.recommendedMoves') }}</div>
      <div class="next-links">
        <button
          v-for="item in nextLinks"
          :key="item.label"
          type="button"
          class="next-links__item"
          @click="emit('navigate', item.target)"
        >
          <strong>{{ item.label }}</strong>
          <span>{{ item.hint }}</span>
        </button>
      </div>
    </article>

    <article class="overview-card workbench-card workbench-card--soft overview-card--wide">
      <div class="overview-card__eyebrow">{{ t('workbench.overview.scenarioJourney') }}</div>
      <div class="scenario-journey">
        <div class="scenario-journey__title">{{ scenarioJourney.title }}</div>
        <p class="scenario-journey__body">{{ scenarioJourney.body }}</p>
        <div class="scenario-journey__steps">
          <div v-for="step in scenarioJourney.steps" :key="step" class="scenario-journey__step">
            {{ step }}
          </div>
        </div>
      </div>
    </article>

    <article class="overview-card workbench-card workbench-card--soft overview-card--wide">
      <div class="overview-card__eyebrow">{{ t('workbench.overview.scopeMap') }}</div>
      <div class="boundary-links">
        <button
          v-for="item in boundaryLinks"
          :key="item.label"
          type="button"
          class="boundary-links__item"
          @click="item.action()"
        >
          <span class="boundary-links__eyebrow">{{ item.eyebrow }}</span>
          <strong>{{ item.label }}</strong>
          <span>{{ item.hint }}</span>
        </button>
      </div>
    </article>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.overview-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 16px;
  align-items: start;
}

.overview-card {
  padding: 20px;
}

.overview-card--primary {
  background: linear-gradient(180deg, rgba(var(--accent-primary-rgb), 0.09), rgba(var(--accent-primary-rgb), 0.03));
}

.overview-card__eyebrow {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $accent-primary;
  font-weight: 700;
}

.overview-card__title {
  margin-top: 10px;
  font-size: 26px;
  line-height: 1.1;
  text-transform: capitalize;
}

.overview-card__body {
  margin-top: 12px;
  color: $text-secondary;
}

.overview-card__action {
  margin-top: 18px;
  border: none;
}

.overview-card__action-note {
  margin-top: 10px;
  color: $text-muted;
  line-height: 1.6;
}

.checklist {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
}

.checklist__item {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $bg-card;
  color: $text-primary;
  padding: 12px 14px;
  cursor: pointer;
  text-align: left;
}

.checklist__dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #b7791f;
}

.checklist__dot--done {
  background: #2f7d4a;
}

.overview-card--wide {
  grid-column: 1 / -1;
}

.readiness-list {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.readiness-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $bg-card;
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
}

.readiness-item__label {
  color: $text-secondary;
  font-size: 13px;
}

.readiness-item__value {
  color: $text-primary;
  font-weight: 700;
}

.readiness-item__value--ready {
  color: $success;
}

.next-links {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.next-links__item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: linear-gradient(180deg, rgba(var(--accent-primary-rgb), 0.04), transparent);
  color: $text-primary;
  padding: 16px;
  cursor: pointer;
  text-align: left;
}

.next-links__item strong {
  font-size: 15px;
}

.next-links__item span {
  color: $text-secondary;
  line-height: 1.5;
}

.scenario-journey {
  margin-top: 14px;
}

.scenario-journey__title {
  color: $text-primary;
  font-size: 18px;
  font-weight: 700;
}

.scenario-journey__body {
  margin-top: 10px;
  color: $text-secondary;
  line-height: 1.7;
}

.scenario-journey__steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.scenario-journey__step {
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: rgba(var(--accent-primary-rgb), 0.04);
  color: $text-primary;
  padding: 16px;
  line-height: 1.6;
}

.boundary-links {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.boundary-links__item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: rgba(255, 255, 255, 0.84);
  color: $text-primary;
  padding: 16px;
  cursor: pointer;
  text-align: left;
}

.boundary-links__eyebrow {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $text-muted;
  font-weight: 700;
}

.boundary-links__item strong {
  font-size: 15px;
}

.boundary-links__item span:last-child {
  color: $text-secondary;
  line-height: 1.6;
}

@media (max-width: 960px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }

  .scenario-journey__steps {
    grid-template-columns: 1fr;
  }

  .next-links {
    grid-template-columns: 1fr;
  }

  .boundary-links {
    grid-template-columns: 1fr;
  }
}
</style>
