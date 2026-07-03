<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NAlert, NButton, NInput, NModal, NRadio, NRadioGroup, NSelect, NSpin } from 'naive-ui'
import FolderPicker from '@/components/hermes/chat/FolderPicker.vue'
import CreateRoomForm from '@/components/hermes/group-chat/CreateRoomForm.vue'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import { useApplicationsStore } from '@/stores/workbench/applications'
import { useGroupChatStore } from '@/stores/hermes/group-chat'
import { getWorkflowTemplate } from '@/api/hermes/group-chat'
import { buildApplicationDetailRoute } from '@/utils/workbench-application-scope'
import type { AgentConfigInput } from '@/api/hermes/group-chat'
import type { ApplicationDetail, ApplicationScenario, ApplicationSectionKey } from '@/types/workbench/application'

const router = useRouter()
const route = useRoute()
const applicationsStore = useApplicationsStore()
const groupChatStore = useGroupChatStore()
const { t, scenarioLabel } = useWorkbenchI18n()

const selectedScenario = ref<ApplicationScenario>('code')
const projectMode = ref<'none' | 'existing' | 'local'>('none')
const selectedExistingProjectId = ref<string | null>(null)
const localProjectName = ref('')
const localProjectDescription = ref('')
const localProjectPath = ref('')
const selectedWorkflowTemplateId = ref<string | null>(null)
const workflowTemplateLoading = ref(false)
const showLocalFolderPicker = ref(false)

const selectedScenarioOption = computed(() =>
  scenarioOptions.value.find(option => option.key === selectedScenario.value) || scenarioOptions.value[0],
)

const selectedWorkflowTemplateOption = computed(() =>
  (applicationsStore.createOptions?.workflowTemplates || []).find(template => template.id === selectedWorkflowTemplateId.value) || null,
)

const scenarioOptions = computed<Array<{ key: ApplicationScenario; label: string; description: string }>>(() => [
  { key: 'code', label: scenarioLabel('code'), description: t('workbench.create.scenarioCode') },
  { key: 'document', label: scenarioLabel('document'), description: t('workbench.create.scenarioDocument') },
  { key: 'ppt', label: scenarioLabel('ppt'), description: t('workbench.create.scenarioPpt') },
  { key: 'research', label: scenarioLabel('research'), description: t('workbench.create.scenarioResearch') },
  { key: 'general', label: scenarioLabel('general'), description: t('workbench.create.scenarioGeneral') },
])

const projectOptions = computed(() =>
  (applicationsStore.createOptions?.projects || []).map(project => ({
    label: project.name,
    value: project.id,
  })),
)

const workflowTemplateOptions = computed(() =>
  (applicationsStore.createOptions?.workflowTemplates || []).map(template => ({
    label: template.name,
    value: template.id,
  })),
)

const recommendedWorkflowTemplateId = computed(() => {
  const templates = applicationsStore.createOptions?.workflowTemplates || []
  return templates.find(template => template.recommendedScenario === selectedScenario.value)?.id || null
})

const recommendedWorkflowTemplate = computed(() =>
  (applicationsStore.createOptions?.workflowTemplates || []).find(template => template.id === recommendedWorkflowTemplateId.value) || null,
)

const templatePreview = computed(() => selectedWorkflowTemplateOption.value || recommendedWorkflowTemplate.value)

const postCreateGuide = computed(() => {
  if (projectMode.value !== 'existing' && projectMode.value !== 'local') {
    return {
      destination: 'projects',
      points: [
        t('workbench.create.afterCreateProject'),
        t('workbench.create.afterCreateWorkflow'),
        t('workbench.create.afterCreateCollaboration'),
      ],
    }
  }

  if (!selectedWorkflowTemplateId.value && !recommendedWorkflowTemplateId.value) {
    return {
      destination: 'workflow',
      points: [
        t('workbench.create.afterCreateWorkflow'),
        t('workbench.create.afterCreateRuns'),
        t('workbench.create.afterCreateCollaboration'),
      ],
    }
  }

  return {
    destination: 'runs',
    points: [
      t('workbench.create.afterCreateRuns'),
      t('workbench.create.afterCreateCollaboration'),
      t('workbench.create.afterCreateWorkflow'),
    ],
  }
})

onMounted(async () => {
  const routeScenario = String(route.query.scenario || '').trim() as ApplicationScenario
  if (scenarioOptions.value.some(option => option.key === routeScenario)) {
    selectedScenario.value = routeScenario
  }
  await applicationsStore.loadCreateOptions()
  if (!selectedWorkflowTemplateId.value && recommendedWorkflowTemplateId.value) {
    selectedWorkflowTemplateId.value = recommendedWorkflowTemplateId.value
  }
})

watch(
  selectedScenario,
  () => {
    if (!selectedWorkflowTemplateId.value || selectedWorkflowTemplateId.value === recommendedWorkflowTemplateId.value) {
      selectedWorkflowTemplateId.value = recommendedWorkflowTemplateId.value
    }
  },
)

function inferNameFromPath(path: string): string {
  const normalized = path.trim().replace(/[\\/]+$/, '')
  if (!normalized) return ''
  const segments = normalized.split(/[\\/]/).filter(Boolean)
  return segments[segments.length - 1] || ''
}

function applyLocalProjectPath(path: string | null) {
  const normalized = String(path || '').trim()
  if (!normalized) return
  localProjectPath.value = normalized
  if (!localProjectName.value.trim()) {
    localProjectName.value = inferNameFromPath(normalized)
  }
  showLocalFolderPicker.value = false
}

function resolvePostCreateSection(detail: ApplicationDetail): ApplicationSectionKey {
  if (detail.run.status === 'running' || detail.run.status === 'paused') return 'collaboration'
  if (detail.status === 'waiting_review' || detail.status === 'failed' || detail.status === 'ready') return 'runs'
  if (detail.nextAction?.targetSection) return detail.nextAction.targetSection
  if (detail.status === 'completed') return 'artifacts'
  return 'overview'
}

async function handleCreate(
  name: string,
  inviteCode: string,
  userName: string,
  description: string,
  compression: { triggerTokens: number; maxHistoryTokens: number; tailMessageCount: number },
  workflow: { workflowName?: string; workflowPrompt?: string },
) {
  let agents: AgentConfigInput[] = []
  let resolvedWorkflow: { workflowName?: string; workflowPrompt?: string; workflowConfig?: Record<string, unknown> } = workflow

  if (selectedWorkflowTemplateId.value) {
    workflowTemplateLoading.value = true
    try {
      const templateResult = await getWorkflowTemplate(selectedWorkflowTemplateId.value)
      const workflowTemplate = templateResult.workflow
      agents = (workflowTemplate.agents || []).map(agent => ({
        profile: agent.profile,
        name: agent.name,
        description: agent.description,
        avatar: agent.avatar,
        systemPrompt: agent.systemPrompt,
        model: agent.model,
        temperature: agent.temperature ?? null,
        invited: agent.invited,
      }))
      resolvedWorkflow = {
        workflowName: workflowTemplate.name || workflow.workflowName,
        workflowPrompt: workflowTemplate.workflowPrompt || workflow.workflowPrompt,
        workflowConfig: (workflowTemplate.workflowConfig || {}) as Record<string, unknown>,
      }
    } finally {
      workflowTemplateLoading.value = false
    }
  }

  groupChatStore.setUserInfo(userName, description)

  const result = await applicationsStore.createNewApplication({
    scenario: selectedScenario.value,
    name,
    userName,
    userDescription: description,
    inviteCode,
    compression,
    workflow: resolvedWorkflow,
    agents,
    existingProjectId: projectMode.value === 'existing' ? selectedExistingProjectId.value : null,
    localProject:
      projectMode.value === 'local' && localProjectPath.value.trim()
        ? {
            name: localProjectName.value.trim() || undefined,
            description: localProjectDescription.value.trim() || undefined,
            localPath: localProjectPath.value.trim(),
          }
        : null,
  })

  const detail = await applicationsStore.loadApplicationDetail(result.applicationId)
  router.push(buildApplicationDetailRoute(result.applicationId, resolvePostCreateSection(detail)))
}
</script>

<template>
  <div class="application-create-wizard">
    <section class="application-create-wizard__section workbench-card">
        <div class="wizard-section__header">
        <div class="wizard-section__eyebrow workbench-eyebrow">{{ t('workbench.create.step1') }}</div>
        <h2 class="wizard-section__title">{{ t('workbench.create.chooseScenario') }}</h2>
      </div>

      <div class="scenario-grid">
        <button
          v-for="scenario in scenarioOptions"
          :key="scenario.key"
          type="button"
          class="scenario-tile"
          :class="{ 'scenario-tile--active': selectedScenario === scenario.key }"
          @click="selectedScenario = scenario.key"
        >
          <span class="scenario-tile__title">{{ scenario.label }}</span>
          <span class="scenario-tile__body">{{ scenario.description }}</span>
        </button>
      </div>

      <div class="scenario-guidance workbench-panel workbench-panel--soft">
        <div class="scenario-guidance__eyebrow workbench-section-title">{{ t('workbench.create.scenarioGuidanceTitle') }}</div>
        <div class="scenario-guidance__title">{{ selectedScenarioOption?.label }}</div>
        <p class="scenario-guidance__body">
          {{ selectedScenarioOption?.description }}
        </p>
        <p class="scenario-guidance__body">
          {{ t('workbench.create.scenarioGuidanceBody') }}
        </p>
        <ul class="scenario-guidance__list">
          <li>{{ t('workbench.create.scenarioGuidancePoint1') }}</li>
          <li>{{ t('workbench.create.scenarioGuidancePoint2') }}</li>
          <li>{{ t('workbench.create.scenarioGuidancePoint3') }}</li>
        </ul>
      </div>
    </section>

    <section class="application-create-wizard__section workbench-card">
        <div class="wizard-section__header">
        <div class="wizard-section__eyebrow workbench-eyebrow">{{ t('workbench.create.step2') }}</div>
        <h2 class="wizard-section__title">{{ t('workbench.create.optionalContext') }}</h2>
      </div>

      <div class="wizard-grid">
        <div class="wizard-card">
          <label class="wizard-label">{{ t('workbench.create.projectContext') }}</label>
          <NRadioGroup v-model:value="projectMode" name="projectMode">
            <div class="wizard-radio-list">
              <NRadio value="none">{{ t('workbench.create.skipForNow') }}</NRadio>
              <NRadio value="existing">{{ t('workbench.create.reuseExistingProject') }}</NRadio>
              <NRadio value="local">{{ t('workbench.create.attachLocalProject') }}</NRadio>
            </div>
          </NRadioGroup>

          <div v-if="projectMode === 'existing'" class="wizard-field-stack">
            <label class="wizard-label">{{ t('workbench.create.existingProjectContext') }}</label>
            <NSelect
              v-model:value="selectedExistingProjectId"
              :options="projectOptions"
              :placeholder="t('workbench.create.chooseExistingProject')"
            />
          </div>

          <div v-if="projectMode === 'local'" class="wizard-field-stack">
            <label class="wizard-label">{{ t('workbench.create.localProjectPath') }}</label>
            <div class="wizard-inline-action">
              <NInput v-model:value="localProjectPath" :placeholder="t('workbench.create.localProjectPathPlaceholder')" />
              <NButton secondary @click="showLocalFolderPicker = true">
                {{ t('workbench.create.browseWorkspaceFolders') }}
              </NButton>
            </div>
            <p class="wizard-hint">{{ t('workbench.create.localProjectPickerHint') }}</p>
            <label class="wizard-label">{{ t('workbench.create.workspaceName') }}</label>
            <NInput v-model:value="localProjectName" :placeholder="t('workbench.create.optionalWorkspaceName')" />
            <label class="wizard-label">{{ t('workbench.create.contextSummary') }}</label>
            <NInput v-model:value="localProjectDescription" :placeholder="t('workbench.create.optionalContextSummary')" type="textarea" />
          </div>
        </div>

        <div class="wizard-card">
          <label class="wizard-label">{{ t('workbench.create.executionFlowTemplate') }}</label>
          <NSelect
            v-model:value="selectedWorkflowTemplateId"
            :options="workflowTemplateOptions"
            :placeholder="t('workbench.create.optionalTemplate')"
            clearable
          />
          <p class="wizard-hint">
            {{ t('workbench.create.flowTemplateHint') }}
          </p>
          <p v-if="recommendedWorkflowTemplate" class="wizard-hint wizard-hint--accent">
            {{ t('workbench.create.recommendedTemplateHint', { name: recommendedWorkflowTemplate.name }) }}
          </p>
        </div>

        <div v-if="templatePreview" class="wizard-card">
          <label class="wizard-label">{{ t('workbench.create.templatePreview') }}</label>
          <div class="template-preview">
            <div class="template-preview__title">{{ templatePreview.name }}</div>
            <p v-if="templatePreview.description" class="template-preview__body">{{ templatePreview.description }}</p>
            <div class="template-preview__group">
              <div class="template-preview__label">{{ t('workbench.create.defaultRoles') }}</div>
              <div class="template-preview__chips">
                <span v-for="item in templatePreview.defaultRoles" :key="item" class="template-preview__chip">{{ item }}</span>
              </div>
            </div>
            <div class="template-preview__group">
              <div class="template-preview__label">{{ t('workbench.create.defaultStages') }}</div>
              <div class="template-preview__chips">
                <span v-for="item in templatePreview.defaultStages" :key="item" class="template-preview__chip">{{ item }}</span>
              </div>
            </div>
            <div v-if="templatePreview.artifactDirectories.length" class="template-preview__group">
              <div class="template-preview__label">{{ t('workbench.create.defaultArtifacts') }}</div>
              <div class="template-preview__chips">
                <span v-for="item in templatePreview.artifactDirectories" :key="item" class="template-preview__chip template-preview__chip--muted">{{ item }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="application-create-wizard__section workbench-card">
      <div class="wizard-section__header">
        <div class="wizard-section__eyebrow workbench-eyebrow">{{ t('workbench.create.step3') }}</div>
        <h2 class="wizard-section__title">{{ t('workbench.create.defineWorkspace') }}</h2>
      </div>

      <article class="launch-plan workbench-panel workbench-panel--soft">
        <div class="launch-plan__eyebrow workbench-section-title">{{ t('workbench.create.afterCreateTitle') }}</div>
        <div class="launch-plan__title">
          {{ t('workbench.card.openFirstSection', { section: t(`workbench.sections.${postCreateGuide.destination}`) }) }}
        </div>
        <p class="launch-plan__body">{{ t('workbench.create.afterCreateBody') }}</p>
        <div class="launch-plan__points">
          <div v-for="point in postCreateGuide.points" :key="point" class="launch-plan__point">{{ point }}</div>
        </div>
      </article>

      <NAlert type="info" :title="t('workbench.create.phaseNoteTitle')" class="wizard-alert">
        {{ t('workbench.create.phaseNoteBody') }}
      </NAlert>

      <NSpin :show="applicationsStore.isCreating || workflowTemplateLoading">
        <CreateRoomForm @submit="handleCreate" @cancel="router.push({ name: 'workbench.applications' })" />
      </NSpin>
    </section>

    <NModal v-model:show="showLocalFolderPicker" preset="card" :title="t('workbench.create.selectLocalProjectDirectory')" style="width: 760px; max-width: calc(100vw - 32px);">
      <FolderPicker v-model="localProjectPath" />
      <template #footer>
        <div class="wizard-modal-footer">
          <NButton @click="showLocalFolderPicker = false">{{ t('common.cancel') }}</NButton>
          <NButton type="primary" :disabled="!localProjectPath.trim()" @click="applyLocalProjectPath(localProjectPath)">
            {{ t('workbench.create.useSelectedDirectory') }}
          </NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.application-create-wizard {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.application-create-wizard__section {
  background:
    radial-gradient(circle at top right, rgba(var(--accent-primary-rgb), 0.05), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.9), $bg-card);
  padding: 24px;
}

.wizard-section__header {
  margin-bottom: 18px;
}

.wizard-section__title {
  margin-top: 8px;
  font-size: 24px;
  color: $text-primary;
}

.scenario-grid,
.wizard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.scenario-guidance {
  margin-top: 16px;
  padding: 18px;
}

.scenario-guidance__eyebrow {
  margin-bottom: 8px;
}

.scenario-guidance__title {
  color: $text-primary;
  font-size: 16px;
  font-weight: 700;
}

.scenario-guidance__body {
  margin-top: 10px;
  color: $text-secondary;
  line-height: 1.7;
}

.scenario-guidance__list {
  margin: 12px 0 0;
  padding-left: 18px;
  color: $text-secondary;
  line-height: 1.7;
}

.scenario-tile,
.wizard-card {
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: rgba(255, 255, 255, 0.72);
}

.scenario-tile {
  padding: 18px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.scenario-tile:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(20, 20, 20, 0.05);
}

.scenario-tile--active {
  border-color: rgba(var(--accent-primary-rgb), 0.4);
  background: rgba(var(--accent-primary-rgb), 0.1);
}

.scenario-tile__title {
  display: block;
  font-size: 16px;
  font-weight: 700;
  color: $text-primary;
}

.scenario-tile__body {
  display: block;
  margin-top: 8px;
  color: $text-secondary;
  line-height: 1.6;
}

.wizard-card {
  padding: 18px;
}

.wizard-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: $text-secondary;
}

.wizard-radio-list,
.wizard-field-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wizard-inline-action {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.wizard-hint {
  margin-top: 10px;
  color: $text-muted;
  font-size: 13px;
  line-height: 1.6;
}

.wizard-hint--accent {
  color: $accent-primary;
}

.template-preview {
  margin-top: 8px;
}

.template-preview__title {
  color: $text-primary;
  font-size: 16px;
  font-weight: 700;
}

.template-preview__body {
  margin-top: 8px;
  color: $text-secondary;
  line-height: 1.6;
}

.template-preview__group {
  margin-top: 14px;
}

.template-preview__label {
  margin-bottom: 8px;
  color: $text-secondary;
  font-size: 13px;
  font-weight: 600;
}

.template-preview__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.template-preview__chip {
  border: 1px solid rgba(var(--accent-primary-rgb), 0.18);
  border-radius: 999px;
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: $text-primary;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.4;
}

.template-preview__chip--muted {
  background: rgba(255, 255, 255, 0.8);
  border-color: $border-color;
}

.wizard-alert {
  margin-bottom: 18px;
}

.launch-plan {
  margin-bottom: 18px;
  padding: 18px;
}

.launch-plan__title {
  margin-top: 8px;
  color: $text-primary;
  font-size: 18px;
  font-weight: 700;
}

.launch-plan__body {
  margin-top: 10px;
  color: $text-secondary;
  line-height: 1.7;
}

.launch-plan__points {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.launch-plan__point {
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: rgba(var(--accent-primary-rgb), 0.04);
  color: $text-primary;
  padding: 14px 16px;
  line-height: 1.6;
}

.wizard-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 900px) {
  .scenario-grid,
  .wizard-grid {
    grid-template-columns: 1fr;
  }

  .wizard-inline-action,
  .launch-plan__points {
    grid-template-columns: 1fr;
  }
}
</style>
