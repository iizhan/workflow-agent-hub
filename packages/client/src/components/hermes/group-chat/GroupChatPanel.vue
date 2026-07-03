<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage, NSwitch, NInput, NButton, NSpace, NSelect, NPopover, NPopconfirm, NInputNumber, NRadioGroup, NRadio } from 'naive-ui'
import { useAppStore } from '@/stores/hermes/app'
import { useGroupChatStore } from '@/stores/hermes/group-chat'
import { useProfilesStore } from '@/stores/hermes/profiles'
import { useGatewayStore } from '@/stores/hermes/gateways'
import {
    updateRoomConfig,
    forceCompress,
    updateRoomWorkflowConfig,
    type RoomAgent,
    type WorkflowRoomConfig,
    type WorkflowStageConfig,
} from '@/api/hermes/group-chat'
import GroupMessageList from './GroupMessageList.vue'
import GroupChatInput from './GroupChatInput.vue'
import LogicFlowWorkflowEditor from './LogicFlowWorkflowEditor.vue'
import { buildCartoonAvatarSvg, isImageAvatarSource, type CartoonAvatarKind } from '@/utils/cartoon-avatar'

const { t } = useI18n()
const message = useMessage()
const store = useGroupChatStore()
const appStore = useAppStore()
const profilesStore = useProfilesStore()
const gatewayStore = useGatewayStore()

const showSidebar = ref(window.innerWidth > 768)
const showCreateModal = ref(false)
const showAddAgentModal = ref(false)
const showEditAgentModal = ref(false)
const showCompressionModal = ref(false)
const showWorkflowModal = ref(false)
const showWorkflowConfirmModal = ref(false)
const showWorkflowTemplateApplyModal = ref(false)
const showImportWorkflowModal = ref(false)
const showArtifactsModal = ref(false)
const showChangeHistoryModal = ref(false)
const showProjectModal = ref(false)
const showApprovalRejectModal = ref(false)
const showIdentitySwitchModal = ref(false)
const showRuntimeDetails = ref(false)
const showWorkflowDetails = ref(false)
const compressionConfig = ref({ triggerTokens: 100000, maxHistoryTokens: 32000, tailMessageCount: 20 })
const workflowConfig = ref({ workflowName: '', workflowPrompt: '' })
const workflowRoomConfig = ref<WorkflowRoomConfig>({ mode: 'freeform', ownerRoleName: t('groupChat.workflowEditorDefaultOwnerRole'), ownerUserName: '', stages: [] })
const workflowTemplateId = ref<string | null>(null)
const workflowTemplateName = ref('')
const workflowTemplateDescription = ref('')
const workflowChangeMeta = ref({
    summary: '',
    impactScope: '',
    rollbackPlan: '',
    executionNotes: '',
})
const workflowImportJson = ref('')
const projectBindName = ref('')
const projectBindDescription = ref('')
const projectBindLocalPath = ref('')
const selectedExistingProjectId = ref<string | null>(null)
const isCompressing = ref(false)
const selectedProfile = ref<string | null>(null)
const selectedModelProvider = ref<string | null>(null)
const agentName = ref('')
const agentDescription = ref('')
const agentAvatar = ref('')
const agentSystemPrompt = ref('')
const agentModel = ref('')
const agentTemperature = ref<number | null>(null)
const approvalRejectReason = ref('')
const identityUserName = ref('')
const identityDescription = ref('')
const isSubmittingApproval = ref(false)
const isCancellingWorkflow = ref(false)
const isClearingMessages = ref(false)
const editingAgentId = ref<string | null>(null)
const workflowDrafts = ref<Record<string, {
    workflowName: string
    workflowPrompt: string
    workflowRoomConfig: WorkflowRoomConfig
    workflowTemplateName: string
    workflowTemplateDescription: string
}>>({})
const activeWorkflowDraftKey = ref('__room__')
const workflowRoomBaseSnapshot = ref<string>('')
const workflowTemplateMetaBaseSnapshot = ref<string>('')
const workflowConfirmMode = ref<'save' | 'close'>('save')
const workflowTemplateApplyMode = ref<'workflow-only' | 'workflow-agents'>('workflow-agents')

const avatarPresets = computed(() => [
    { label: t('groupChat.avatarPresets.analyst'), value: 'analyst' },
    { label: t('groupChat.avatarPresets.designer'), value: 'designer' },
    { label: t('groupChat.avatarPresets.architect'), value: 'architect' },
    { label: t('groupChat.avatarPresets.backend'), value: 'backend' },
    { label: t('groupChat.avatarPresets.frontend'), value: 'frontend' },
    { label: t('groupChat.avatarPresets.qa'), value: 'qa' },
    { label: t('groupChat.avatarPresets.product'), value: 'product' },
    { label: t('groupChat.avatarPresets.pm'), value: 'pm' },
])

type WorkflowRoomSnapshot = {
    workflowName: string
    workflowPrompt: string
    workflowRoomConfig: WorkflowRoomConfig
}

type WorkflowTemplateMetaSnapshot = {
    workflowTemplateName: string
    workflowTemplateDescription: string
}

type ChangeHistoryItem = {
    id: string
    title: string
    time: number
    status: string
    content: string
}

type GroupChatInputExpose = {
    focusInput: () => void
    setDraft: (text: string) => void
}

type LiveStatusAction = {
    key: string
    label: string
    type?: 'default' | 'primary' | 'warning'
    secondary?: boolean
    disabled?: boolean
}

function createWorkflowStage(partial?: Partial<WorkflowStageConfig>): WorkflowStageConfig {
    return {
        id: partial?.id || `stage-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: partial?.name || '',
        roleName: partial?.roleName || '',
        assignedAgentId: partial?.assignedAgentId || '',
        deliverable: partial?.deliverable || '',
        needsAdminConfirm: partial?.needsAdminConfirm ?? true,
        prompt: partial?.prompt || '',
    }
}

function cloneWorkflowRoomConfig(config?: WorkflowRoomConfig | null): WorkflowRoomConfig {
    return {
        version: config?.version || 2,
        mode: config?.mode || 'freeform',
        ownerRoleName: config?.ownerRoleName || t('groupChat.workflowEditorDefaultOwnerRole'),
        ownerUserName: config?.ownerUserName || '',
        stages: (config?.stages || []).map(stage => createWorkflowStage(stage)),
        editor: config?.editor ? JSON.parse(JSON.stringify(config.editor)) : { type: 'logicflow', viewport: { x: 0, y: 0, zoom: 1 } },
        graph: config?.graph ? JSON.parse(JSON.stringify(config.graph)) : { nodes: [], edges: [] },
        runtime: {
            startNodeId: config?.runtime?.startNodeId || '',
            artifactRootDir: config?.runtime?.artifactRootDir || '.hermes/group-chat-artifacts/${roomId}',
            allowManualJump: !!config?.runtime?.allowManualJump,
        },
    }
}

function workflowDraftKey(templateId: string | null): string {
    return templateId ? `template:${templateId}` : '__room__'
}

function captureWorkflowSnapshot(): {
    workflowName: string
    workflowPrompt: string
    workflowRoomConfig: WorkflowRoomConfig
    workflowTemplateName: string
    workflowTemplateDescription: string
} {
    return {
        workflowName: workflowConfig.value.workflowName,
        workflowPrompt: workflowConfig.value.workflowPrompt,
        workflowRoomConfig: cloneWorkflowRoomConfig(workflowRoomConfig.value),
        workflowTemplateName: workflowTemplateName.value,
        workflowTemplateDescription: workflowTemplateDescription.value,
    }
}

function captureWorkflowRoomSnapshot(): WorkflowRoomSnapshot {
    return {
        workflowName: workflowConfig.value.workflowName,
        workflowPrompt: workflowConfig.value.workflowPrompt,
        workflowRoomConfig: cloneWorkflowRoomConfig(workflowRoomConfig.value),
    }
}

function captureWorkflowTemplateMetaSnapshot(): WorkflowTemplateMetaSnapshot {
    return {
        workflowTemplateName: workflowTemplateName.value,
        workflowTemplateDescription: workflowTemplateDescription.value,
    }
}

function applyWorkflowSnapshot(snapshot: {
    workflowName: string
    workflowPrompt: string
    workflowRoomConfig: WorkflowRoomConfig
    workflowTemplateName: string
    workflowTemplateDescription: string
}) {
    workflowConfig.value = {
        workflowName: snapshot.workflowName,
        workflowPrompt: snapshot.workflowPrompt,
    }
    workflowRoomConfig.value = cloneWorkflowRoomConfig(snapshot.workflowRoomConfig)
    workflowTemplateName.value = snapshot.workflowTemplateName
    workflowTemplateDescription.value = snapshot.workflowTemplateDescription
}

function stringifyWorkflowRoomSnapshot(snapshot: WorkflowRoomSnapshot): string {
    return JSON.stringify(snapshot)
}

function stringifyWorkflowTemplateMetaSnapshot(snapshot: WorkflowTemplateMetaSnapshot): string {
    return JSON.stringify(snapshot)
}

function rememberWorkflowDraft(key: string, snapshot = captureWorkflowSnapshot()) {
    workflowDrafts.value = { ...workflowDrafts.value, [key]: snapshot }
}

function normalizeText(value?: string): string {
    return String(value || '').trim()
}

function normalizeRoleKey(value?: string): string {
    return normalizeText(value).toLowerCase()
}

function uniqueRoleNames(values: Array<string | undefined>): string[] {
    const displayByKey = new Map<string, string>()
    for (const value of values) {
        const label = normalizeText(value)
        if (!label) continue
        const key = normalizeRoleKey(label)
        if (!key || displayByKey.has(key)) continue
        displayByKey.set(key, label)
    }
    return Array.from(displayByKey.values())
}

type WorkflowRequiredAgent = {
    key: string
    label: string
    roleName: string
    assignedAgentId: string
}

function collectWorkflowRequiredAgents(config?: WorkflowRoomConfig | null): WorkflowRequiredAgent[] {
    const displayByKey = new Map<string, WorkflowRequiredAgent>()
    const pushRequirement = (roleName?: string, assignedAgentId?: string) => {
        const normalizedAssignedAgentId = normalizeText(assignedAgentId)
        const normalizedRoleName = normalizeText(roleName)
        const key = normalizedAssignedAgentId ? `agent:${normalizedAssignedAgentId}` : `role:${normalizeRoleKey(normalizedRoleName)}`
        if (!normalizedAssignedAgentId && !normalizedRoleName) return
        if (displayByKey.has(key)) return
        displayByKey.set(key, {
            key,
            label: normalizedRoleName || normalizedAssignedAgentId,
            roleName: normalizedRoleName,
            assignedAgentId: normalizedAssignedAgentId,
        })
    }

    for (const stage of config?.stages || []) {
        pushRequirement(stage.roleName, stage.assignedAgentId)
    }

    for (const node of config?.graph?.nodes || []) {
        const nodeType = normalizeText(String(node?.properties?.workflowNodeType || ''))
        if (nodeType !== 'role-task' && nodeType !== 'artifact-review') continue
        pushRequirement(String(node?.properties?.roleName || ''), String(node?.properties?.assignedAgentId || ''))
    }

    return Array.from(displayByKey.values())
}

function collectWorkflowAssignedAgentIds(config?: WorkflowRoomConfig | null): string[] {
    return uniqueRoleNames(collectWorkflowRequiredAgents(config).map(item => item.assignedAgentId))
}

function collectWorkflowTemplateRoleNames(config?: WorkflowRoomConfig | null): string[] {
    const stageRoles = (config?.stages || []).map(stage => stage.roleName)
    const graphRoles = (config?.graph?.nodes || [])
        .filter(node => {
            const nodeType = normalizeText(String(node?.properties?.workflowNodeType || ''))
            return nodeType === 'role-task' || nodeType === 'artifact-review'
        })
        .map(node => String(node?.properties?.roleName || ''))
    return uniqueRoleNames([...stageRoles, ...graphRoles])
}

function collectAgentRoleNames(agents: Array<Pick<RoomAgent, 'name' | 'profile'>>): string[] {
    return uniqueRoleNames(agents.map(agent => agent.name || agent.profile))
}

function analyzeWorkflowRoleAlignment(
    config: WorkflowRoomConfig | null | undefined,
    agents: Array<Pick<RoomAgent, 'name' | 'profile'> & { id?: string }>,
) {
    const requiredItems = collectWorkflowRequiredAgents(config)
    const requiredRoles = requiredItems.map(item => item.label)
    const agentRoles = collectAgentRoleNames(agents)
    const agentIds = new Set(agents.map(agent => normalizeText(agent.id)))
    const assignedAgentIds = collectWorkflowAssignedAgentIds(config)
    const requiredKeys = new Set(requiredRoles.map(role => normalizeRoleKey(role)))
    const agentKeys = new Set(agentRoles.map(role => normalizeRoleKey(role)))
    const assignedAgentIdKeys = new Set(assignedAgentIds)
    const usedAgentRoleKeys = new Set(requiredItems
        .map(item => {
            const matchedAgent = item.assignedAgentId
                ? agents.find(agent => normalizeText(agent.id) === item.assignedAgentId)
                : null
            return normalizeRoleKey(matchedAgent ? (matchedAgent.name || matchedAgent.profile) : item.roleName)
        })
        .filter(Boolean))
    return {
        requiredRoles,
        agentRoles,
        missingRoles: requiredItems
            .filter(item => item.assignedAgentId
                ? !agentIds.has(item.assignedAgentId)
                : !agentKeys.has(normalizeRoleKey(item.roleName || item.label)))
            .map(item => item.label),
        unusedAgentRoles: agents
            .filter(agent => !assignedAgentIdKeys.has(normalizeText(agent.id)))
            .map(agent => agent.name || agent.profile)
            .filter(role => !requiredKeys.has(normalizeRoleKey(role)) && !usedAgentRoleKeys.has(normalizeRoleKey(role))),
    }
}

function parseUiError(err: any, fallback: string): string {
    const text = String(err?.message || '').trim()
    if (!text) return fallback
    const match = text.match(/^API Error \d+:\s*(.+)$/)
    return (match?.[1] || text).trim() || fallback
}

function resetWorkflowChangeMeta() {
    workflowChangeMeta.value = {
        summary: '',
        impactScope: '',
        rollbackPlan: '',
        executionNotes: '',
    }
}

function summarizeStageDiff(previous: WorkflowStageConfig, next: WorkflowStageConfig): string[] {
    const changes: string[] = []
    if (normalizeText(previous.name) !== normalizeText(next.name)) changes.push(t('groupChat.workflowDiffStageName'))
    if (normalizeText(previous.roleName) !== normalizeText(next.roleName) || normalizeText(previous.assignedAgentId) !== normalizeText(next.assignedAgentId)) changes.push(t('groupChat.workflowDiffStageRole'))
    if (normalizeText(previous.deliverable) !== normalizeText(next.deliverable)) changes.push(t('groupChat.workflowDiffStageDeliverable'))
    if (Boolean(previous.needsAdminConfirm) !== Boolean(next.needsAdminConfirm)) changes.push(t('groupChat.workflowDiffStageConfirm'))
    if (normalizeText(previous.prompt) !== normalizeText(next.prompt)) changes.push(t('groupChat.workflowDiffStagePrompt'))
    return changes
}

function summarizeWorkflowRoomChanges(previous: WorkflowRoomSnapshot, next: WorkflowRoomSnapshot): string[] {
    const changes: string[] = []
    if (normalizeText(previous.workflowName) !== normalizeText(next.workflowName)) {
        changes.push(t('groupChat.workflowDiffWorkflowName', {
            from: normalizeText(previous.workflowName) || t('groupChat.workflowDiffUnset'),
            to: normalizeText(next.workflowName) || t('groupChat.workflowDiffUnset'),
        }))
    }
    if (normalizeText(previous.workflowPrompt) !== normalizeText(next.workflowPrompt)) {
        changes.push(t('groupChat.workflowDiffWorkflowPrompt'))
    }

    const previousConfig = previous.workflowRoomConfig || {}
    const nextConfig = next.workflowRoomConfig || {}

    if (normalizeText(previousConfig.mode) !== normalizeText(nextConfig.mode)) {
        changes.push(t('groupChat.workflowDiffMode', {
            from: normalizeText(previousConfig.mode) || t('groupChat.workflowDiffUnset'),
            to: normalizeText(nextConfig.mode) || t('groupChat.workflowDiffUnset'),
        }))
    }
    if (normalizeText(previousConfig.ownerRoleName) !== normalizeText(nextConfig.ownerRoleName)) {
        changes.push(t('groupChat.workflowDiffOwnerRole', {
            from: normalizeText(previousConfig.ownerRoleName) || t('groupChat.workflowDiffUnset'),
            to: normalizeText(nextConfig.ownerRoleName) || t('groupChat.workflowDiffUnset'),
        }))
    }
    if (normalizeText(previousConfig.ownerUserName) !== normalizeText(nextConfig.ownerUserName)) {
        changes.push(t('groupChat.workflowDiffOwnerName', {
            from: normalizeText(previousConfig.ownerUserName) || t('groupChat.workflowDiffUnset'),
            to: normalizeText(nextConfig.ownerUserName) || t('groupChat.workflowDiffUnset'),
        }))
    }

    const previousStages = previousConfig.stages || []
    const nextStages = nextConfig.stages || []
    const previousStageMap = new Map(previousStages.map(stage => [stage.id, stage]))
    const nextStageMap = new Map(nextStages.map(stage => [stage.id, stage]))

    const addedStages = nextStages
        .filter(stage => !previousStageMap.has(stage.id))
        .map(stage => normalizeText(stage.name) || stage.id)
    const removedStages = previousStages
        .filter(stage => !nextStageMap.has(stage.id))
        .map(stage => normalizeText(stage.name) || stage.id)
    const updatedStages = nextStages
        .map(stage => {
            const previousStage = previousStageMap.get(stage.id)
            if (!previousStage) return ''
            const stageChanges = summarizeStageDiff(previousStage, stage)
            if (stageChanges.length === 0) return ''
            return t('groupChat.workflowDiffStageUpdated', {
                name: normalizeText(stage.name) || stage.id,
                changes: stageChanges.join(' / '),
            })
        })
        .filter(Boolean)

    if (addedStages.length > 0) changes.push(t('groupChat.workflowDiffStageAdded', { stages: addedStages.join('、') }))
    if (removedStages.length > 0) changes.push(t('groupChat.workflowDiffStageRemoved', { stages: removedStages.join('、') }))
    changes.push(...updatedStages)

    const previousNodeCount = previousConfig.graph?.nodes?.length || 0
    const nextNodeCount = nextConfig.graph?.nodes?.length || 0
    if (previousNodeCount !== nextNodeCount) {
        changes.push(t('groupChat.workflowDiffNodeCount', { from: previousNodeCount, to: nextNodeCount }))
    }

    const previousArtifactRoot = normalizeText(previousConfig.runtime?.artifactRootDir)
    const nextArtifactRoot = normalizeText(nextConfig.runtime?.artifactRootDir)
    if (previousArtifactRoot !== nextArtifactRoot) {
        changes.push(t('groupChat.workflowDiffArtifactRoot', {
            from: previousArtifactRoot || t('groupChat.workflowDiffUnset'),
            to: nextArtifactRoot || t('groupChat.workflowDiffUnset'),
        }))
    }

    const previousManualJump = Boolean(previousConfig.runtime?.allowManualJump)
    const nextManualJump = Boolean(nextConfig.runtime?.allowManualJump)
    if (previousManualJump !== nextManualJump) {
        changes.push(t('groupChat.workflowDiffManualJump', {
            from: previousManualJump ? t('common.enabled') : t('common.disabled'),
            to: nextManualJump ? t('common.enabled') : t('common.disabled'),
        }))
    }

    return changes
}

const profileOptions = computed(() =>
    profilesStore.profiles.map(p => ({ label: p.name, value: p.name }))
)
const agentOptions = computed(() =>
    store.agents.map(agent => ({
        label: agent.name || agent.profile,
        value: agent.id,
    })),
)
const modelProviderOptions = computed(() =>
    appStore.modelGroups
        .filter(group => !group.user_disabled)
        .map(group => ({
            label: `${group.label} (${group.models.length})`,
            value: group.provider,
        })),
)
const selectedModelGroup = computed(() =>
    appStore.modelGroups.find(group => group.provider === selectedModelProvider.value && !group.user_disabled) || null,
)
const selectedModelOptions = computed(() => {
    const group = selectedModelGroup.value
    if (!group) return []
    const models = Array.from(new Set([
        ...group.models,
        ...(appStore.customModels[group.provider] || []),
    ]))
    return models.map(model => ({
        label: model,
        value: model,
        disabled: !!group.model_meta?.[model]?.disabled,
    }))
})
const workflowOptions = computed(() =>
    store.workflowTemplates.map(template => ({
        label: template.description ? `${template.name} · ${template.description}` : template.name,
        value: template.id,
    }))
)
const selectedWorkflowTemplate = computed(() =>
    store.workflowTemplates.find(template => template.id === workflowTemplateId.value) || null
)
const selectedWorkflowTemplateAgentCount = computed(() => selectedWorkflowTemplate.value?.agents?.length || 0)
const selectedWorkflowTemplateRequiredRoles = computed(() =>
    selectedWorkflowTemplate.value
        ? collectWorkflowTemplateRoleNames((selectedWorkflowTemplate.value as any).workflowConfig)
        : [],
)
const selectedWorkflowTemplateMissingRoles = computed(() => {
    if (!selectedWorkflowTemplate.value) return []
    return analyzeWorkflowRoleAlignment((selectedWorkflowTemplate.value as any).workflowConfig, store.agents).missingRoles
})
const activeWorkflowTemplateId = computed(() => (
    activeWorkflowDraftKey.value.startsWith('template:')
        ? activeWorkflowDraftKey.value.slice('template:'.length)
        : null
))
const activeWorkflowTemplate = computed(() => (
    activeWorkflowTemplateId.value
        ? store.workflowTemplates.find(template => template.id === activeWorkflowTemplateId.value) || null
        : null
))
const workflowRoomHasUnsavedChanges = computed(() => {
    if (!showWorkflowModal.value || !workflowRoomBaseSnapshot.value) return false
    return stringifyWorkflowRoomSnapshot(captureWorkflowRoomSnapshot()) !== workflowRoomBaseSnapshot.value
})

function syncModelProviderByModel(model?: string) {
    const matchedGroup = appStore.modelGroups.find(group => !group.user_disabled && group.models.includes(String(model || '').trim()))
    if (matchedGroup) {
        selectedModelProvider.value = matchedGroup.provider
        return
    }
    const provider = selectedModelProvider.value
    if (!provider) return
    const currentGroup = appStore.modelGroups.find(group => group.provider === provider && !group.user_disabled)
    const firstEnabledModel = currentGroup?.models.find(item => !currentGroup.model_meta?.[item]?.disabled) || ''
    if (currentGroup && (!currentGroup.models.includes(String(model || '').trim()) || currentGroup.model_meta?.[String(model || '').trim()]?.disabled) && firstEnabledModel) {
        agentModel.value = firstEnabledModel
    }
}

watch(selectedModelProvider, (provider) => {
    if (!provider) return
    const group = appStore.modelGroups.find(item => item.provider === provider && !item.user_disabled)
    if (!group) return
    const firstEnabledModel = group.models.find(model => !group.model_meta?.[model]?.disabled) || ''
    if (!agentModel.value || !group.models.includes(agentModel.value) || group.model_meta?.[agentModel.value]?.disabled) {
        agentModel.value = firstEnabledModel
    }
})

watch(agentModel, (model) => {
    syncModelProviderByModel(model)
})
const workflowTemplateMetaHasUnsavedChanges = computed(() => {
    if (!showWorkflowModal.value || !workflowTemplateMetaBaseSnapshot.value) return false
    return stringifyWorkflowTemplateMetaSnapshot(captureWorkflowTemplateMetaSnapshot()) !== workflowTemplateMetaBaseSnapshot.value
})
const workflowHasUnsavedChanges = computed(() => {
    return workflowRoomHasUnsavedChanges.value || workflowTemplateMetaHasUnsavedChanges.value
})
const workflowRoleAlignment = computed(() => analyzeWorkflowRoleAlignment(workflowRoomConfig.value, store.agents))
const workflowHasRoleMismatch = computed(() => workflowRoleAlignment.value.missingRoles.length > 0)
const selectedWorkflowTemplateRoleNames = computed(() =>
    selectedWorkflowTemplate.value
        ? uniqueRoleNames((selectedWorkflowTemplate.value.agents || []).map(agent => agent.name || agent.profile))
        : [],
)
const selectedWorkflowTemplateCanSupplyMissingRoles = computed(() => {
    if (!selectedWorkflowTemplate.value) return false
    const templateRoleKeys = new Set(selectedWorkflowTemplateRoleNames.value.map(role => normalizeRoleKey(role)))
    return workflowRoleAlignment.value.missingRoles.every(role => templateRoleKeys.has(normalizeRoleKey(role)))
})
const workflowDraftStatusText = computed(() => {
    if (activeWorkflowDraftKey.value === '__room__') return t('groupChat.workflowRoomDraftLabel')
    return t('groupChat.workflowTemplateDraftLabel')
})
const workflowUnsavedStatusText = computed(() => {
    if (workflowRoomHasUnsavedChanges.value && workflowTemplateMetaHasUnsavedChanges.value) {
        return t('groupChat.workflowUnsavedMixed')
    }
    if (workflowRoomHasUnsavedChanges.value) {
        return t('groupChat.workflowUnsavedRoomOnly')
    }
    if (workflowTemplateMetaHasUnsavedChanges.value) {
        return t('groupChat.workflowUnsavedTemplateOnly')
    }
    return t('groupChat.workflowDraftSaved')
})
const workflowRoomChangeSummary = computed(() => {
    if (!workflowRoomBaseSnapshot.value) return []
    return summarizeWorkflowRoomChanges(
        JSON.parse(workflowRoomBaseSnapshot.value) as WorkflowRoomSnapshot,
        captureWorkflowRoomSnapshot(),
    )
})
const workflowConfirmTitle = computed(() => (
    workflowConfirmMode.value === 'save'
        ? t('groupChat.workflowConfirmSaveTitle')
        : t('groupChat.workflowConfirmCloseTitle')
))
const workflowConfirmPrimaryText = computed(() => (
    workflowConfirmMode.value === 'save'
        ? t('groupChat.workflowConfirmSaveAction')
        : t('groupChat.workflowConfirmCloseAction')
))
const workflowConfirmSummaryItems = computed(() => {
    const items = [...workflowRoomChangeSummary.value]
    if (workflowTemplateMetaHasUnsavedChanges.value) {
        items.push(t('groupChat.workflowTemplateMetaChanged'))
    }
    return items
})
const changeHistoryMessages = computed(() => {
    const messageItems: ChangeHistoryItem[] = store.sortedMessages
        .filter(msg => (
            msg.senderId === 'system'
            && /【流程进展】|工作流配置已更新|角色「.*」已更新|新增角色「|角色「.*」已移除|当前群聊已激活|当前群聊已停用/.test(msg.content)
        ))
        .map(msg => ({
            id: `message:${msg.id}`,
            title: msg.senderName,
            time: msg.timestamp,
            status: t('groupChat.changeHistorySystemNotice'),
            content: msg.content,
        }))
    const runItems: ChangeHistoryItem[] = store.workflowRunHistory.map(run => {
        const lines = [
            run.kickoffSummary ? t('groupChat.changeHistoryKickoff', { text: run.kickoffSummary }) : '',
            run.currentNodeTitle ? t('groupChat.changeHistoryCurrentNode', { node: run.currentNodeTitle }) : '',
            run.latestActivityNodeTitle || run.latestActivityStatus
                ? t('groupChat.changeHistoryLatestActivity', {
                    node: run.latestActivityNodeTitle || t('groupChat.changeHistoryUnknownNode'),
                    status: workflowNodeStatusLabel(run.latestActivityStatus),
                })
                : '',
            run.latestApprovalActorName || run.latestApprovalAction || run.latestApprovalStageTitle
                ? t('groupChat.changeHistoryApproval', {
                    actor: run.latestApprovalActorName || t('groupChat.changeHistoryUnknownActor'),
                    action: workflowApprovalActionLabel(run.latestApprovalAction),
                    stage: run.latestApprovalStageTitle || t('groupChat.changeHistoryUnknownNode'),
                })
                : '',
            run.latestApprovalReason ? t('groupChat.changeHistoryRejectReason', { reason: run.latestApprovalReason }) : '',
            run.latestArtifactPath ? t('groupChat.changeHistoryArtifact', { path: run.latestArtifactPath }) : '',
            run.latestSystemNoticeExcerpt ? t('groupChat.changeHistorySystemExcerpt', { text: run.latestSystemNoticeExcerpt }) : '',
        ].filter(Boolean)
        return {
            id: `run:${run.id}`,
            title: t('groupChat.changeHistoryRunTitle', { number: run.runNumber }),
            time: run.latestActivityAt || run.updatedAt || run.startedAt,
            status: workflowRunStatusLabel(run.status),
            content: lines.length ? lines.join('\n') : t('groupChat.changeHistoryNoDetails'),
        }
    })

    return [...runItems, ...messageItems]
        .sort((a, b) => b.time - a.time)
        .slice(0, 50)
})
const workflowReadySpotlightShowFollowUpDraft = computed(() => !!latestWorkflowRun.value)
const workflowReadySpotlightHasHistory = computed(() => changeHistoryMessages.value.length > 0)
const workflowReadySpotlightHistoryActionLabel = computed(() => (
    workflowReadySpotlightHasHistory.value
        ? t('groupChat.workflowReadySpotlightHistoryAction')
        : t('groupChat.workflowReadySpotlightHistoryActionEmpty')
))
const liveStatusStripTone = computed(() => {
    if (!store.currentRoomRuntime?.isActive) return 'idle'
    if (workflowNeedsApproval.value) return workflowApprovalCanAct.value ? 'warning' : 'locked'
    if (workingAgentStatuses.value.length > 0) return 'active'
    if (workflowReadySpotlightVisible.value) {
        return workflowReadySpotlightMode.value === 'completed' ? 'success' : 'ready'
    }
    if (store.workflowRunState?.status === 'completed') return 'success'
    return 'active'
})
const liveStatusStripTitle = computed(() => {
    if (!store.currentRoomRuntime?.isActive) return t('groupChat.liveStatusStripTitleInactive')
    if (workflowNeedsApproval.value) {
        return workflowApprovalCanAct.value
            ? t('groupChat.liveStatusStripTitleApprovalMine', {
                owner: `@${workflowApprovalOwnerLabel.value || currentIdentityName.value || store.userId}`,
            })
            : t('groupChat.liveStatusStripTitleApprovalOther', {
                owner: `@${workflowApprovalOwnerLabel.value || t('groupChat.workflowOwnerRole')}`,
            })
    }
    if (workingAgentStatuses.value.length > 0) {
        return t('groupChat.liveStatusStripTitleAgentWorking', {
            agent: `@${workingAgentStatuses.value[0].agentName}`,
        })
    }
    if (workflowActiveAgentLabel.value) {
        return t('groupChat.liveStatusStripTitleAgentWorking', {
            agent: `@${workflowActiveAgentLabel.value}`,
        })
    }
    if (workflowActiveRoleLabel.value) {
        return t('groupChat.liveStatusStripTitleRoleWorking', {
            role: `@${workflowActiveRoleLabel.value}`,
        })
    }
    if (workflowReadySpotlightVisible.value) {
        if (workflowReadySpotlightMode.value === 'never-started') return t('groupChat.liveStatusStripTitleReadyFirstRun')
        return t('groupChat.liveStatusStripTitleReadyNextRun')
    }
    return t('groupChat.liveStatusStripTitleIdle')
})
const liveStatusStripSummary = computed(() => {
    if (!store.currentRoomRuntime?.isActive) return t('groupChat.liveStatusStripSummaryInactive')
    if (workflowNeedsApproval.value) {
        return workflowApprovalCanAct.value
            ? t('groupChat.liveStatusStripSummaryApprovalMine')
            : t('groupChat.liveStatusStripSummaryApprovalOther')
    }
    if (workingAgentStatuses.value.length > 0) {
        return t('groupChat.liveStatusStripSummaryWorking', {
            status: workingAgentStatuses.value[0].label,
        })
    }
    if (workflowReadySpotlightVisible.value) {
        return workflowReadySpotlightMode.value === 'never-started'
            ? t('groupChat.liveStatusStripSummaryReadyFirstRun')
            : t('groupChat.liveStatusStripSummaryReadyNextRun')
    }
    if (workflowActiveRoleLabel.value) return workflowInteractionHint.value
    return workflowInteractionHint.value
})
const liveStatusStripHandler = computed(() => {
    if (!store.currentRoomRuntime?.isActive) return t('groupChat.liveStatusStripValueOffline')
    if (workflowNeedsApproval.value) return `@${workflowApprovalOwnerLabel.value || currentIdentityName.value || store.userId}`
    if (workflowActiveAgentLabel.value) return `@${workflowActiveAgentLabel.value}`
    if (workflowActiveRoleLabel.value) return `@${workflowActiveRoleLabel.value}`
    if (workflowReadySpotlightVisible.value) return t('groupChat.liveStatusStripValueAwaitingRequest')
    return t('groupChat.liveStatusStripValueNoHandler')
})
const liveStatusStripNextStep = computed(() => {
    if (!store.currentRoomRuntime?.isActive) return t('groupChat.liveStatusStripNextStepInactive')
    if (workflowNeedsApproval.value) {
        return workflowApprovalCanAct.value
            ? t('groupChat.liveStatusStripNextStepApprovalMine')
            : t('groupChat.liveStatusStripNextStepApprovalOther', {
                owner: `@${workflowApprovalOwnerLabel.value || t('groupChat.workflowOwnerRole')}`,
            })
    }
    if (workflowActiveRoleLabel.value) {
        return t('groupChat.liveStatusStripNextStepRole', {
            role: `@${workflowActiveRoleLabel.value}`,
        })
    }
    if (workflowReadySpotlightVisible.value) {
        return workflowReadySpotlightMode.value === 'never-started'
            ? t('groupChat.liveStatusStripNextStepFirstRun')
            : t('groupChat.liveStatusStripNextStepNewRun')
    }
    return t('groupChat.liveStatusStripNextStepIdle')
})
const liveStatusStripRuntime = computed(() => {
    if (!store.currentRoomRuntime?.isActive) return t('groupChat.liveStatusStripRuntimeOffline')
    if (store.currentRoomRuntime.onlineAgents === 0) return t('groupChat.liveStatusStripRuntimeAgentsDown')
    return t('groupChat.liveStatusStripRuntimeOnline', {
        online: store.currentRoomRuntime.onlineAgents,
        total: store.currentRoomRuntime.totalAgents,
    })
})
const liveStatusActions = computed<LiveStatusAction[]>(() => {
    if (!store.currentRoomRuntime?.isActive) {
        return [
            { key: 'activate-workspace', label: t('groupChat.activateWorkspace'), type: 'primary' },
            { key: 'open-gateways', label: t('sidebar.gateways'), secondary: true },
        ]
    }

    if (workflowNeedsApproval.value) {
        return []
    }

    if (workflowReadySpotlightVisible.value) {
        return []
    }

    return [
        { key: 'focus-input', label: t('groupChat.workflowReadySpotlightFocusAction'), type: 'primary' },
        { key: 'open-artifacts', label: t('groupChat.artifacts'), secondary: true },
    ]
})
const workflowStatusLabel = computed(() => {
    const nodeType = store.workflowCurrentNodeType
    const runStatus = store.workflowRunState?.status || ''
    if (runStatus === 'completed') return t('groupChat.workflowStatusCompleted')
    if (nodeType === 'approval') return t('groupChat.workflowStatusAwaitingApproval')
    if (nodeType === 'role-task' || nodeType === 'artifact-review') return t('groupChat.workflowStatusInProgress')
    if (nodeType === 'end') return t('groupChat.workflowStatusCompleted')
    return t('groupChat.workflowStatusIdle')
})
const workflowStatusTone = computed(() => {
    const nodeType = store.workflowCurrentNodeType
    const runStatus = store.workflowRunState?.status || ''
    if (runStatus === 'completed' || nodeType === 'end') return 'success'
    if (nodeType === 'approval') return 'warning'
    if (nodeType === 'role-task' || nodeType === 'artifact-review') return 'active'
    return 'idle'
})
const workflowEnabled = computed(() => {
    const nodes = store.currentWorkflowConfig?.graph?.nodes || []
    return Array.isArray(nodes) && nodes.length > 0
})
const workflowInteractionHint = computed(() => {
    const runStatus = store.workflowRunState?.status || ''
    if (runStatus === 'completed') {
        return t('groupChat.workflowInteractionHintCompleted')
    }
    if (workflowNeedsApproval.value) {
        return t('groupChat.workflowInteractionHintApproval')
    }
    if (workflowActiveRoleLabel.value) {
        return t('groupChat.workflowInteractionHintActive', { role: workflowActiveRoleLabel.value })
    }
    return t('groupChat.workflowInteractionHintIdle')
})
const workflowNodeTrack = computed(() => {
    const nodes = Array.isArray(store.currentWorkflowConfig?.graph?.nodes) ? store.currentWorkflowConfig?.graph?.nodes : []
    const currentNodeId = store.workflowRunState?.currentNodeId || store.workflowCurrentNode?.id || ''
    const currentNodeType = store.workflowCurrentNodeType
    const currentRunStatus = store.workflowRunState?.status || ''
    return nodes
        .filter(node => {
            const nodeType = normalizeText(String(node?.properties?.workflowNodeType || ''))
            return nodeType === 'start' || nodeType === 'role-task' || nodeType === 'artifact-review' || nodeType === 'approval' || nodeType === 'end'
        })
        .map(node => {
            const nodeId = String(node?.id || '')
            const nodeType = normalizeText(String(node?.properties?.workflowNodeType || ''))
            const nodeTitle = typeof node?.text === 'string' ? node.text : String(node?.text?.value || nodeId)
            const nodeRole = normalizeText(String(node?.properties?.roleName || ''))
            const nodeRun = store.workflowNodeRuns
                .filter(item => item.nodeId === nodeId)
                .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null
            const isCurrent = nodeId === currentNodeId
            const isCompleted = currentRunStatus === 'completed'
                ? nodeType !== 'start'
                : !!nodeRun && (nodeRun.status === 'completed' || nodeRun.status === 'waiting_approval' || nodeRun.status === 'rejected')
            const tone = isCurrent
                ? (currentNodeType === 'approval' ? 'warning' : currentRunStatus === 'completed' || nodeType === 'end' ? 'success' : 'active')
                : isCompleted
                    ? 'done'
                    : 'idle'
            return {
                id: nodeId,
                title: nodeTitle,
                role: nodeRole,
                tone,
                isCurrent,
            }
        })
})
const workflowActiveRoleLabel = computed(() => {
    const nodeType = store.workflowCurrentNodeType
    if (nodeType === 'approval') {
        return store.workflowCurrentNode?.properties?.roleName || store.currentWorkflowConfig?.ownerRoleName || t('groupChat.workflowOwnerRole')
    }
    return store.workflowActiveRoleName || ''
})
const workflowActiveAgentLabel = computed(() => {
    const replyingAgent = Array.from(store.contextStatuses.values()).find(status => status.status === 'replying')
    if (replyingAgent?.agentName) return replyingAgent.agentName
    const currentNodeId = store.workflowRunState?.currentNodeId
    if (!currentNodeId) return ''
    const activeNodeRun = store.workflowNodeRuns.find(nodeRun =>
        nodeRun.nodeId === currentNodeId
        && (nodeRun.status === 'running' || nodeRun.status === 'waiting_approval'),
    )
    return activeNodeRun?.actorAgentName || ''
})
const workflowNeedsApproval = computed(() => (
    (
        store.workflowCurrentNodeType === 'approval'
        || (
            (store.workflowCurrentNodeType === 'role-task' || store.workflowCurrentNodeType === 'artifact-review')
            && !!store.workflowNodeRuns.find(nodeRun =>
                nodeRun.nodeId === store.workflowCurrentNode?.id
                && nodeRun.status === 'waiting_approval',
            )
        )
    )
    && store.workflowRunState?.status !== 'completed'
))
const workflowApprovalOwnerName = computed(() => (
    normalizeText(store.currentWorkflowConfig?.ownerUserName || store.userName || store.userId || '')
))
const currentIdentityName = computed(() => normalizeText(store.userName || store.userId || ''))
const currentIdentityDescription = computed(() => normalizeText(store.userDescription || ''))
const workflowApprovalCanAct = computed(() => {
    if (!workflowNeedsApproval.value) return false
    const ownerName = normalizeText(store.currentWorkflowConfig?.ownerUserName)
    if (!ownerName) return true
    return normalizeRoleKey(ownerName) === normalizeRoleKey(store.userName || '')
})
const workflowApprovalDisabledHint = computed(() => {
    const ownerName = normalizeText(store.currentWorkflowConfig?.ownerUserName)
    if (!workflowNeedsApproval.value || !ownerName || workflowApprovalCanAct.value) return ''
    return t('groupChat.workflowApprovalOwnerOnlyHint', { owner: `@${ownerName}` })
})
const workflowApprovalOwnerLabel = computed(() => (
    normalizeText(store.currentWorkflowConfig?.ownerUserName || workflowApprovalOwnerName.value || currentIdentityName.value || store.userId || '')
))
const workflowApprovalPendingNodeTitle = computed(() => (
    store.workflowCurrentNodeTitle || t('groupChat.changeHistoryUnknownNode')
))
const workflowApprovalArtifactPreviewLabel = computed(() => (
    workflowApprovalSourceArtifactPath.value || workflowApprovalSourceArtifactLabel.value
))
const workflowApprovalSpotlightTitle = computed(() => (
    workflowApprovalCanAct.value
        ? t('groupChat.workflowApprovalSpotlightTitle')
        : t('groupChat.workflowApprovalSpotlightTitleOwnerOnly', {
            owner: `@${workflowApprovalOwnerLabel.value || t('groupChat.workflowOwnerRole')}`,
        })
))
const workflowApprovalSpotlightBody = computed(() => (
    workflowApprovalCanAct.value
        ? t('groupChat.workflowApprovalSpotlightBody', {
            actor: workflowApprovalActorMention.value,
        })
        : t('groupChat.workflowApprovalSpotlightBodyOwnerOnly', {
            owner: `@${workflowApprovalOwnerLabel.value || t('groupChat.workflowOwnerRole')}`,
        })
))
const workflowCancelCanAct = computed(() => {
    const ownerName = normalizeText(store.currentWorkflowConfig?.ownerUserName)
    if (!store.workflowRunState || store.workflowRunState.status === 'completed') return false
    if (!ownerName) return true
    return normalizeRoleKey(ownerName) === normalizeRoleKey(store.userName || '')
})
const workflowCancelDisabledHint = computed(() => {
    const ownerName = normalizeText(store.currentWorkflowConfig?.ownerUserName)
    if (!store.workflowRunState || store.workflowRunState.status === 'completed' || !ownerName || workflowCancelCanAct.value) return ''
    return t('groupChat.workflowApprovalOwnerOnlyHint', { owner: `@${ownerName}` })
})
const workflowApprovalSourceNodeId = computed(() => {
    const currentNodeId = store.workflowRunState?.currentNodeId
    const edges = store.currentWorkflowConfig?.graph?.edges || []
    if (!currentNodeId) return ''
    return String(
        edges.find(edge =>
            edge.targetNodeId === currentNodeId
            && String(edge.properties?.branchConditionType || 'always') === 'always',
        )?.sourceNodeId || '',
    )
})
const workflowApprovalSourceRun = computed(() => {
    const sourceNodeId = workflowApprovalSourceNodeId.value
    if (!sourceNodeId) return null
    return store.workflowNodeRuns
        .filter(nodeRun => nodeRun.nodeId === sourceNodeId)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null
})
const workflowApprovalSourceActorLabel = computed(() => (
    workflowApprovalSourceRun.value?.actorAgentName || workflowActiveAgentLabel.value || workflowActiveRoleLabel.value
))
const workflowApprovalActorMention = computed(() => {
    const actor = workflowApprovalSourceActorLabel.value || workflowActiveRoleLabel.value || t('groupChat.workflowOwnerRole')
    return actor ? `@${actor}` : t('groupChat.workflowOwnerRole')
})
const workflowApprovalSourceArtifactLabel = computed(() => {
    const artifactIdsJson = workflowApprovalSourceRun.value?.artifactIdsJson || ''
    if (!artifactIdsJson) return ''
    try {
        const artifactIds = JSON.parse(artifactIdsJson)
        if (!Array.isArray(artifactIds) || artifactIds.length === 0) return ''
        return String(artifactIds[0])
    } catch {
        return ''
    }
})
const workflowApprovalSourceArtifactPath = computed(() => {
    const sourceNodeId = workflowApprovalSourceNodeId.value
    if (!sourceNodeId || !store.currentRoomId) return ''
    const sourceNode = (store.currentWorkflowConfig?.graph?.nodes || []).find(node => String(node?.id || '') === sourceNodeId)
    const configuredPath = [String(sourceNode?.properties?.artifactDir || '').trim(), String(sourceNode?.properties?.artifactFileName || '').trim()]
        .filter(Boolean)
        .join('/')
        .replace(/^\/+/, '')
    if (configuredPath) return configuredPath
    const matchedEntry = store.artifactEntries.find(entry => entry.type === 'file' && entry.relativePath.includes(sourceNodeId))
    return matchedEntry?.relativePath || ''
})
const workingAgentStatuses = computed(() =>
    Array.from(store.contextStatuses.values()).map((status) => ({
        ...status,
        label: status.status === 'compressing'
            ? t('groupChat.agentWorkingCompressing')
            : t('groupChat.agentWorkingReplying'),
    })),
)
const currentProjectSummary = computed(() => store.currentProject?.project || null)
const currentProjectBinding = computed(() => store.currentProject?.binding || null)
const availableProjectOptions = computed(() =>
    store.availableProjects.map(project => ({
        label: project.repoUrl ? `${project.name} · ${project.repoUrl}` : `${project.name} · ${project.localPath}`,
        value: project.id,
    })),
)
const activeProfileName = computed(() => profilesStore.activeProfileName || profilesStore.activeProfile?.name || '')
const gatewayStatePending = computed(() => (
    profilesStore.loading
    || gatewayStore.loading
    || !gatewayStore.hasFetched
    || (!activeProfileName.value && !profilesStore.activeProfile && profilesStore.profiles.length === 0)
))
const activeGateway = computed(() => gatewayStore.gateways.find(gateway => gateway.profile === activeProfileName.value))
const gatewayStatusLabel = computed(() => {
    if (gatewayStatePending.value) return t('groupChat.gatewayStatusChecking')
    if (!activeProfileName.value) return t('gateways.noActiveProfile')
    if (!activeGateway.value) return t('gateways.unavailableGateway')
    return activeGateway.value.running ? t('gateways.running') : t('gateways.stopped')
})
const gatewayStatusHint = computed(() => {
    if (gatewayStatePending.value) return t('groupChat.gatewayHintChecking')
    if (!activeProfileName.value) return t('groupChat.gatewayHintNoProfile')
    if (!activeGateway.value) return t('groupChat.gatewayHintMissing')
    if (!activeGateway.value.running) return t('groupChat.gatewayHintStopped')
    return t('groupChat.gatewayHintReady')
})
const roomRuntimeLabel = computed(() => {
    if (!store.currentRoomRuntime) return t('groupChat.runtimeInactive')
    return store.currentRoomRuntime.isActive ? t('groupChat.runtimeActive') : t('groupChat.runtimeStandby')
})
const roomRuntimeHint = computed(() => {
    if (!store.currentRoomRuntime) return t('groupChat.runtimeHintInactive')
    if (!store.currentRoomRuntime.isActive) {
        return t('groupChat.runtimeHintStandby')
    }
    if (store.currentRoomRuntime.onlineAgents === 0 && store.currentRoomRuntime.totalAgents > 0) {
        return t('groupChat.runtimeHintAgentsDown')
    }
    return t('groupChat.runtimeHintAgentsOnline', {
        online: store.currentRoomRuntime.onlineAgents,
        total: store.currentRoomRuntime.totalAgents,
    })
})
const latestWorkflowRun = computed(() => store.workflowRunHistory[0] || null)
const workflowReadySpotlightVisible = computed(() => {
    if (!workflowEnabled.value) return false
    if (workflowNeedsApproval.value) return false
    if (store.workflowRunState?.status === 'running' || store.workflowRunState?.status === 'paused') return false
    return true
})
const workflowReadySpotlightMode = computed<'never-started' | 'completed' | 'cancelled' | 'idle'>(() => {
    const currentRunStatus = store.workflowRunState?.status || ''
    if (currentRunStatus === 'completed') return 'completed'
    if (!latestWorkflowRun.value) return 'never-started'
    if (latestWorkflowRun.value.status === 'completed') return 'completed'
    if (latestWorkflowRun.value.status === 'cancelled') return 'cancelled'
    return 'idle'
})
const workflowReadySpotlightTitle = computed(() => {
    if (workflowReadySpotlightMode.value === 'never-started') return t('groupChat.workflowReadySpotlightTitleNeverStarted')
    if (workflowReadySpotlightMode.value === 'completed') return t('groupChat.workflowReadySpotlightTitleCompleted')
    if (workflowReadySpotlightMode.value === 'cancelled') return t('groupChat.workflowReadySpotlightTitleCancelled')
    return t('groupChat.workflowReadySpotlightTitleIdle')
})
const workflowReadySpotlightBody = computed(() => {
    if (workflowReadySpotlightMode.value === 'never-started') return t('groupChat.workflowReadySpotlightBodyNeverStarted')
    if (workflowReadySpotlightMode.value === 'completed') return t('groupChat.workflowReadySpotlightBodyCompleted')
    if (workflowReadySpotlightMode.value === 'cancelled') return t('groupChat.workflowReadySpotlightBodyCancelled')
    return t('groupChat.workflowReadySpotlightBodyIdle')
})
const workflowReadySpotlightStatus = computed(() => {
    if (workflowReadySpotlightMode.value === 'never-started') return t('groupChat.workflowNodeStatusPending')
    if (!latestWorkflowRun.value) return t('groupChat.workflowRunStatusIdle')
    return workflowRunStatusLabel(latestWorkflowRun.value.status)
})
const workflowReadySpotlightKickoff = computed(() => (
    latestWorkflowRun.value?.kickoffSummary || ''
))
const workflowReadySpotlightPrimaryDraft = computed(() =>
    t('groupChat.workflowReadyDraftPrimary'),
)
const workflowReadySpotlightSecondaryDraft = computed(() =>
    t('groupChat.workflowReadyDraftSecondary'),
)

function roomStatusText(room: { isActive?: number }): string {
    return room.isActive ? t('groupChat.roomStatusActive') : t('groupChat.roomStatusStandby')
}

onMounted(() => {
    Promise.allSettled([
        profilesStore.fetchProfiles(),
        gatewayStore.fetchStatus(),
    ]).catch(() => { /* ignore */ })
})

const avatarCache = new Map<string, string>()

function isImageAvatar(value?: string): boolean {
    return isImageAvatarSource(value)
}

function agentAvatarKey(name: string, avatar?: string, kind: CartoonAvatarKind = 'agent'): string {
    return `${kind}:${avatar?.trim() || name}:${name}`
}

function agentAvatarUrl(name: string, avatar?: string): string {
    return avatar?.trim() || name
}

function agentAvatarMarkup(name: string, avatar?: string, kind: CartoonAvatarKind = 'agent'): string {
    const key = agentAvatarKey(name, avatar, kind)
    const avatarSource = agentAvatarUrl(name, avatar)
    if (isImageAvatar(avatarSource)) return avatarSource
    if (avatarCache.has(key)) return avatarCache.get(key)!
    const uri = buildCartoonAvatarSvg(avatarSource || name, { kind, label: name })
    avatarCache.set(key, uri)
    return uri
}

const hasRoom = computed(() => !!store.currentRoomId)
const isEditingAgent = computed(() => !!editingAgentId.value)

function formatTokens(tokens: number): string {
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k tokens`
    return `${tokens} tokens`
}

function workflowRunStatusLabel(status?: string): string {
    if (status === 'running') return t('groupChat.workflowRunStatusRunning')
    if (status === 'completed') return t('groupChat.workflowRunStatusCompleted')
    if (status === 'failed') return t('groupChat.workflowRunStatusFailed')
    if (status === 'cancelled') return t('groupChat.workflowRunStatusCancelled')
    if (status === 'paused') return t('groupChat.workflowRunStatusPaused')
    return t('groupChat.workflowRunStatusIdle')
}

function workflowNodeStatusLabel(status?: string): string {
    if (status === 'running') return t('groupChat.workflowNodeStatusRunning')
    if (status === 'completed') return t('groupChat.workflowNodeStatusCompleted')
    if (status === 'waiting_approval') return t('groupChat.workflowNodeStatusWaitingApproval')
    if (status === 'rejected') return t('groupChat.workflowNodeStatusRejected')
    if (status === 'pending') return t('groupChat.workflowNodeStatusPending')
    if (status === 'skipped') return t('groupChat.workflowNodeStatusSkipped')
    return t('groupChat.workflowNodeStatusUnknown')
}

function workflowApprovalActionLabel(action?: string): string {
    if (action === 'approved') return t('groupChat.workflowApprovalActionApproved')
    if (action === 'rejected') return t('groupChat.workflowApprovalActionRejected')
    return t('groupChat.workflowApprovalActionUnknown')
}

function toggleSidebar() {
    showSidebar.value = !showSidebar.value
}

function handleOpenGateways() {
    window.location.hash = '#/hermes/gateways'
}

function handleOpenSettings() {
    window.location.hash = '#/hermes/settings'
}

async function handleToggleRoomActivation() {
    if (!store.currentRoomId) return
    try {
        const nextActive = !store.currentRoomRuntime?.isActive
        await store.setRoomActivation(store.currentRoomId, nextActive)
        message.success(nextActive ? t('groupChat.runtimeActivated') : t('groupChat.runtimeDeactivated'))
    } catch (err: any) {
        message.error(parseUiError(err, t('common.saveFailed')))
    }
}

async function handleCreateRoom(
    name: string,
    inviteCode: string,
    userName: string,
    description: string,
    compression: { triggerTokens: number; maxHistoryTokens: number; tailMessageCount: number },
    workflow: { workflowName?: string; workflowPrompt?: string },
) {
    try {
        store.setUserInfo(userName, description)
        const res = await store.createNewRoom(name, inviteCode, undefined, compression, workflow)
        showCreateModal.value = false
        message.success(t('groupChat.roomCreated'))
        await store.joinRoom(res.room.id)
    } catch (err: any) {
        message.error(parseUiError(err, t('common.saveFailed')))
    }
}

async function handleDeleteRoom(roomId: string) {
    try {
        await store.deleteRoom(roomId)
        message.success(t('groupChat.roomDeleted'))
    } catch {
        message.error(t('common.saveFailed'))
    }
}

function isSystemPresetRoom(roomId: string): boolean {
    const room = store.rooms.find(item => item.id === roomId)
    return !!room?.isSystemPreset
}

function getDeleteRoomConfirmText(roomId: string): string {
    return isSystemPresetRoom(roomId)
        ? t('groupChat.deletePresetRoomConfirm')
        : t('groupChat.deleteRoomConfirm')
}

async function handleSelectRoom(roomId: string) {
    try {
        await store.joinRoom(roomId)
        if (window.innerWidth <= 768) showSidebar.value = false
    } catch {
        message.error(t('groupChat.joinFailed'))
    }
}

async function handleSendMessage(content: string) {
    try {
        await store.sendMessage(content)
    } catch (err: any) {
        message.error(err.message)
    }
}

async function submitWorkflowApproval(action: 'approve' | 'reject') {
    if (!workflowNeedsApproval.value || isSubmittingApproval.value || !store.currentRoomId) return
    if (!workflowApprovalCanAct.value) {
        message.warning(workflowApprovalDisabledHint.value || t('groupChat.workflowApprovalNoPermission'))
        return
    }
    if (action === 'reject' && !approvalRejectReason.value.trim()) {
        message.warning(t('groupChat.workflowRejectReasonRequired'))
        return
    }

    isSubmittingApproval.value = true
    try {
        await store.submitWorkflowApproval(store.currentRoomId, {
            action,
            actorName: workflowApprovalOwnerName.value || undefined,
            reason: action === 'reject' ? approvalRejectReason.value.trim() : undefined,
        })
        if (action === 'approve') {
            message.success(t('groupChat.workflowApproved'))
        } else {
            message.success(t('groupChat.workflowRejected'))
        }
        showApprovalRejectModal.value = false
        approvalRejectReason.value = ''
    } catch (err: any) {
        message.error(err.message || t('common.saveFailed'))
    } finally {
        isSubmittingApproval.value = false
    }
}

async function handleCancelWorkflowExecution() {
    if (!store.currentRoomId || !store.workflowRunState || store.workflowRunState.status === 'completed' || isCancellingWorkflow.value) return
    if (!workflowCancelCanAct.value) {
        message.warning(workflowCancelDisabledHint.value || t('groupChat.workflowApprovalNoPermission'))
        return
    }

    isCancellingWorkflow.value = true
    try {
        await store.cancelWorkflowExecution(store.currentRoomId, {
            actorName: workflowApprovalOwnerName.value || undefined,
        })
        message.success(t('groupChat.workflowCancelled'))
    } catch (err: any) {
        message.error(parseUiError(err, t('common.saveFailed')))
    } finally {
        isCancellingWorkflow.value = false
    }
}

async function handleClearRoomMessages() {
    if (!store.currentRoomId || isClearingMessages.value) return
    isClearingMessages.value = true
    try {
        await store.clearRoomMessages(store.currentRoomId, {
            actorName: workflowApprovalOwnerName.value || undefined,
        })
        message.success(t('groupChat.clearMessagesSuccess'))
    } catch (err: any) {
        message.error(parseUiError(err, t('common.saveFailed')))
    } finally {
        isClearingMessages.value = false
    }
}

function handleOpenRejectApproval() {
    approvalRejectReason.value = ''
    showApprovalRejectModal.value = true
}

function handleOpenIdentitySwitch(ownerName?: string) {
    identityUserName.value = normalizeText(ownerName || workflowApprovalOwnerName.value || store.userName || '')
    identityDescription.value = currentIdentityDescription.value
    showIdentitySwitchModal.value = true
}

async function handleConfirmIdentitySwitch() {
    const nextName = identityUserName.value.trim()
    if (!nextName) {
        message.warning(t('groupChat.identitySwitchNameRequired'))
        return
    }
    try {
        await store.switchUserInfo(nextName, identityDescription.value.trim())
        showIdentitySwitchModal.value = false
        message.success(t('groupChat.identitySwitchSuccess', { name: `@${nextName}` }))
    } catch (err: any) {
        message.error(parseUiError(err, t('common.saveFailed')))
    }
}

async function handleOpenArtifacts() {
    if (!store.currentRoomId) return
    try {
        await store.loadArtifacts(store.currentRoomId, '')
        showArtifactsModal.value = true
    } catch (err: any) {
        message.error(err.message || t('common.loadFailed'))
    }
}

async function handleOpenChangeHistory() {
    if (store.currentRoomId) {
        await store.refreshWorkflowRuntimeData(store.currentRoomId).catch(() => { /* ignore */ })
    }
    showChangeHistoryModal.value = true
}

async function handleOpenApprovalArtifact() {
    if (!store.currentRoomId) return
    try {
        await store.loadArtifacts(store.currentRoomId, '')
        const path = workflowApprovalSourceArtifactPath.value
        if (path) {
            await store.openArtifact(store.currentRoomId, path)
        }
        showArtifactsModal.value = true
    } catch (err: any) {
        message.error(err.message || t('common.loadFailed'))
    }
}

async function handleOpenProjectModal() {
    if (!store.currentRoomId) return
    try {
        await store.loadAvailableProjects()
        await store.loadRoomProject(store.currentRoomId)
        const project = store.currentProject?.project
        projectBindName.value = project?.name || ''
        projectBindDescription.value = project?.description || ''
        projectBindLocalPath.value = project?.localPath || ''
        selectedExistingProjectId.value = project?.id || null
        showProjectModal.value = true
    } catch (err: any) {
        message.error(err.message || t('common.loadFailed'))
    }
}

async function handleOpenArtifactPath(path: string, type: 'file' | 'directory') {
    if (!store.currentRoomId) return
    try {
        if (type === 'directory') {
            await store.loadArtifacts(store.currentRoomId, path)
            return
        }
        await store.openArtifact(store.currentRoomId, path)
    } catch (err: any) {
        message.error(err.message || t('common.loadFailed'))
    }
}

async function handleOpenArtifactParent() {
    if (!store.currentRoomId) return
    const current = store.artifactCurrentPath || ''
    const next = current.includes('/') ? current.slice(0, current.lastIndexOf('/')) : ''
    try {
        await store.loadArtifacts(store.currentRoomId, next)
    } catch (err: any) {
        message.error(err.message || t('common.loadFailed'))
    }
}

async function handleBindLocalProject() {
    if (!store.currentRoomId || !projectBindLocalPath.value.trim()) return
    try {
        await store.attachLocalProjectToRoom(store.currentRoomId, {
            name: projectBindName.value.trim() || undefined,
            description: projectBindDescription.value.trim() || undefined,
            localPath: projectBindLocalPath.value.trim(),
            permissions: {
                allowRead: true,
                allowWrite: true,
                allowCommit: false,
                allowPush: false,
                pushRequireApproval: true,
            },
        })
        message.success(t('groupChat.projectBound'))
    } catch (err: any) {
        message.error(err.message || t('common.saveFailed'))
    }
}

async function handleBindExistingProject() {
    if (!store.currentRoomId || !selectedExistingProjectId.value) return
    try {
        await store.attachExistingProjectToRoom(store.currentRoomId, selectedExistingProjectId.value, {
            allowRead: true,
            allowWrite: true,
            allowCommit: false,
            allowPush: false,
            pushRequireApproval: true,
        })
        const project = store.currentProject?.project
        projectBindName.value = project?.name || ''
        projectBindDescription.value = project?.description || ''
        projectBindLocalPath.value = project?.localPath || ''
        message.success(t('groupChat.projectRebound'))
    } catch (err: any) {
        message.error(err.message || t('common.saveFailed'))
    }
}

async function handleOpenProjectPath(path: string, type: 'file' | 'directory') {
    const projectId = store.currentProject?.project.id
    if (!projectId) return
    try {
        if (type === 'directory') {
            await store.loadProjectFiles(projectId, path)
            return
        }
        await store.openProjectFile(projectId, path)
    } catch (err: any) {
        message.error(err.message || t('common.loadFailed'))
    }
}

async function handleOpenProjectParent() {
    const projectId = store.currentProject?.project.id
    if (!projectId) return
    const current = store.projectCurrentPath || ''
    const next = current.includes('/') ? current.slice(0, current.lastIndexOf('/')) : ''
    try {
        await store.loadProjectFiles(projectId, next)
    } catch (err: any) {
        message.error(err.message || t('common.loadFailed'))
    }
}

async function handleAddAgent() {
    await Promise.allSettled([profilesStore.fetchProfiles(), appStore.loadModels()])
    resetAgentForm()
    showAddAgentModal.value = true
}

async function handleAddMissingWorkflowRole() {
    await Promise.allSettled([profilesStore.fetchProfiles(), appStore.loadModels()])
    resetAgentForm()
    agentName.value = workflowRoleAlignment.value.missingRoles[0] || ''
    showAddAgentModal.value = true
}

function resetAgentForm() {
    editingAgentId.value = null
    selectedProfile.value = null
    selectedModelProvider.value = null
    agentName.value = ''
    agentDescription.value = ''
    agentAvatar.value = ''
    agentSystemPrompt.value = ''
    agentModel.value = ''
    agentTemperature.value = null
}

function fillAgentForm(agent: RoomAgent) {
    editingAgentId.value = agent.id
    selectedProfile.value = agent.profile
    selectedModelProvider.value = null
    agentName.value = agent.name || ''
    agentDescription.value = agent.description || ''
    agentAvatar.value = agent.avatar || ''
    agentSystemPrompt.value = agent.systemPrompt || ''
    agentModel.value = agent.model || ''
    agentTemperature.value = agent.temperature ?? null
    syncModelProviderByModel(agent.model)
}

function selectAgentAvatarPreset(value: string) {
    agentAvatar.value = value
}

function agentLabelById(agentId?: string): string {
    const agent = store.agents.find(item => item.id === agentId)
    return agent ? (agent.name || agent.profile) : ''
}

function assignStageAgent(stage: WorkflowStageConfig, agentId: string | null) {
    const agent = store.agents.find(item => item.id === agentId)
    ;(stage as any).assignedAgentId = agentId || ''
    stage.roleName = agent ? (agent.name || agent.profile) : ''
}

async function handleEditAgent(agent: RoomAgent) {
    await Promise.allSettled([profilesStore.fetchProfiles(), appStore.loadModels()])
    fillAgentForm(agent)
    showEditAgentModal.value = true
}

async function confirmAgentForm() {
    if (!selectedProfile.value || !store.currentRoomId) return
    try {
        const wasEditing = !!editingAgentId.value
        const nextProfile = selectedProfile.value || ''
        if (wasEditing && editingAgentId.value) {
            const nextName = agentName.value.trim() || nextProfile
            const nextAgents = store.agents.map(agent => agent.id === editingAgentId.value
                ? { name: nextName, profile: nextProfile }
                : { name: agent.name, profile: agent.profile })
            const currentAlignment = analyzeWorkflowRoleAlignment(workflowRoomConfig.value, store.agents)
            const nextAlignment = analyzeWorkflowRoleAlignment(workflowRoomConfig.value, nextAgents)
            const newlyMissingRoles = nextAlignment.missingRoles.filter(role =>
                !currentAlignment.missingRoles.some(currentRole => normalizeRoleKey(currentRole) === normalizeRoleKey(role)),
            )
            if (newlyMissingRoles.length > 0) {
                message.warning(t('groupChat.workflowAgentRoleBreakHint', { roles: newlyMissingRoles.join('、') }))
                return
            }
        }
        const payload = {
            profile: nextProfile,
            name: agentName.value.trim() || undefined,
            description: agentDescription.value.trim() || undefined,
            avatar: agentAvatar.value.trim() || undefined,
            systemPrompt: agentSystemPrompt.value.trim() || undefined,
            model: agentModel.value.trim() || undefined,
            temperature: agentTemperature.value,
            operatorName: store.userName || t('groupChat.workflowEditorDefaultOwnerRole'),
        }
        if (editingAgentId.value) {
            await store.updateAgentInRoom(store.currentRoomId, editingAgentId.value, payload)
        } else {
            await store.addAgentToRoom(store.currentRoomId, payload)
        }
        showAddAgentModal.value = false
        showEditAgentModal.value = false
        resetAgentForm()
        message.success(wasEditing ? t('groupChat.agentUpdated') : t('groupChat.agentAdded'))
    } catch (err: any) {
        if (err.message?.includes('already')) {
            message.warning(t('groupChat.agentAlreadyInRoom'))
        } else {
            message.error(parseUiError(err, t('common.saveFailed')))
        }
    }
}

async function handleOpenWorkflowConfig() {
    try {
        await store.loadWorkflowTemplates()
    } catch (err: any) {
        message.error(err?.message || t('common.loadFailed'))
        return
    }
    const room = store.rooms.find(r => r.id === store.currentRoomId)
    workflowConfig.value = {
        workflowName: room?.workflowName || '',
        workflowPrompt: room?.workflowPrompt || '',
    }
    workflowRoomConfig.value = cloneWorkflowRoomConfig(store.currentWorkflowConfig)
    if (!normalizeText(workflowRoomConfig.value.ownerUserName)) {
        workflowRoomConfig.value.ownerUserName = store.userName || store.userId || ''
    }
    workflowTemplateId.value = null
    workflowTemplateName.value = room?.workflowName || ''
    workflowTemplateDescription.value = ''
    resetWorkflowChangeMeta()
    activeWorkflowDraftKey.value = '__room__'
    rememberWorkflowDraft('__room__')
    workflowRoomBaseSnapshot.value = stringifyWorkflowRoomSnapshot(captureWorkflowRoomSnapshot())
    workflowTemplateMetaBaseSnapshot.value = stringifyWorkflowTemplateMetaSnapshot(captureWorkflowTemplateMetaSnapshot())
    showWorkflowModal.value = true
}

async function persistWorkflowConfig() {
    if (!store.currentRoomId) return
    try {
        if (!normalizeText(workflowRoomConfig.value.ownerUserName)) {
            workflowRoomConfig.value.ownerUserName = store.userName || store.userId || ''
        }
        const nextSnapshot = captureWorkflowSnapshot()
        const workflowRes = await updateRoomWorkflowConfig(store.currentRoomId, {
            workflowName: workflowConfig.value.workflowName,
            workflowPrompt: workflowConfig.value.workflowPrompt,
            workflowConfig: cloneWorkflowRoomConfig(workflowRoomConfig.value),
            operatorName: store.userName || t('groupChat.workflowEditorDefaultOwnerRole'),
            workflowTemplateName: activeWorkflowTemplate.value?.name,
            changeNote: normalizeText(workflowChangeMeta.value.summary) || undefined,
            changeMeta: {
                summary: normalizeText(workflowChangeMeta.value.summary) || undefined,
                impactScope: normalizeText(workflowChangeMeta.value.impactScope) || undefined,
                rollbackPlan: normalizeText(workflowChangeMeta.value.rollbackPlan) || undefined,
                executionNotes: normalizeText(workflowChangeMeta.value.executionNotes) || undefined,
            },
        })
        const idx = store.rooms.findIndex(r => r.id === store.currentRoomId)
        if (idx >= 0 && workflowRes.room) store.rooms[idx] = workflowRes.room
        store.currentWorkflowConfig = cloneWorkflowRoomConfig(workflowRes.workflowConfig)
        workflowRoomBaseSnapshot.value = stringifyWorkflowRoomSnapshot(captureWorkflowRoomSnapshot())
        workflowTemplateMetaBaseSnapshot.value = stringifyWorkflowTemplateMetaSnapshot(captureWorkflowTemplateMetaSnapshot())
        rememberWorkflowDraft(activeWorkflowDraftKey.value, nextSnapshot)
        rememberWorkflowDraft('__room__', nextSnapshot)
        resetWorkflowChangeMeta()
        showWorkflowConfirmModal.value = false
        showWorkflowModal.value = false
        message.success(t('groupChat.workflowSaved'))
    } catch (err: any) {
        message.error(parseUiError(err, t('common.saveFailed')))
    }
}

async function handleSaveWorkflowConfig() {
    if (!store.currentRoomId) return
    if (workflowHasRoleMismatch.value) {
        message.warning(t('groupChat.workflowRoleMismatchSaveBlocked', {
            roles: workflowRoleAlignment.value.missingRoles.join('、'),
        }))
        return
    }
    if (workflowRoomHasUnsavedChanges.value) {
        workflowConfirmMode.value = 'save'
        showWorkflowConfirmModal.value = true
        return
    }
    await persistWorkflowConfig()
}

function closeWorkflowConfirmModal() {
    if (workflowConfirmMode.value === 'save') {
        resetWorkflowChangeMeta()
    }
    showWorkflowConfirmModal.value = false
}

async function confirmWorkflowModalAction() {
    if (workflowConfirmMode.value === 'save') {
        await persistWorkflowConfig()
        return
    }
    resetWorkflowChangeMeta()
    showWorkflowConfirmModal.value = false
    showWorkflowModal.value = false
}

function closeWorkflowModal() {
    if (workflowHasUnsavedChanges.value) {
        workflowConfirmMode.value = 'close'
        showWorkflowConfirmModal.value = true
        return
    }
    showWorkflowModal.value = false
}

function handleSelectWorkflowTemplate(templateId: string | null) {
    workflowTemplateId.value = templateId
}

function openWorkflowTemplateApplyModal() {
    if (!workflowTemplateId.value) return
    workflowTemplateApplyMode.value = selectedWorkflowTemplateAgentCount.value > 0 ? 'workflow-agents' : 'workflow-only'
    showWorkflowTemplateApplyModal.value = true
}

function applyWorkflowTemplate(templateId: string | null) {
    const template = store.workflowTemplates.find(item => item.id === templateId)
    if (!template) return
    const currentKey = activeWorkflowDraftKey.value
    rememberWorkflowDraft(currentKey)
    const nextKey = workflowDraftKey(templateId)
    if (currentKey !== nextKey) {
        message.warning(t('groupChat.workflowTemplateDraftSavedForSwitch'))
    }
    const cached = workflowDrafts.value[nextKey]
    if (cached) {
        applyWorkflowSnapshot(cached)
        message.info(t('groupChat.workflowTemplateDraftRestored'))
    } else {
        applyWorkflowSnapshot({
            workflowName: template.name,
            workflowPrompt: template.workflowPrompt,
            workflowRoomConfig: cloneWorkflowRoomConfig((template as any).workflowConfig),
            workflowTemplateName: template.name,
            workflowTemplateDescription: template.description || '',
        })
        rememberWorkflowDraft(nextKey)
    }
    activeWorkflowDraftKey.value = nextKey
    workflowTemplateId.value = templateId
}

async function applyWorkflowTemplateWithAgents(templateId: string | null) {
    applyWorkflowTemplate(templateId)
    await handleApplyWorkflowAgents()
}

async function confirmApplyWorkflowTemplate() {
    if (!workflowTemplateId.value) return
    if (workflowTemplateApplyMode.value === 'workflow-agents') {
        await applyWorkflowTemplateWithAgents(workflowTemplateId.value)
    } else {
        applyWorkflowTemplate(workflowTemplateId.value)
        if (selectedWorkflowTemplateMissingRoles.value.length > 0) {
            message.warning(t('groupChat.workflowTemplateOnlyMissingHint', { roles: selectedWorkflowTemplateMissingRoles.value.join('、') }))
        }
    }
    showWorkflowTemplateApplyModal.value = false
}

function handleRestoreRoomWorkflowDraft() {
    const cached = workflowDrafts.value.__room__
    if (cached) {
        applyWorkflowSnapshot(cached)
        activeWorkflowDraftKey.value = '__room__'
        workflowTemplateId.value = null
        message.info(t('groupChat.workflowRoomDraftRestored'))
    }
}

async function refreshSelectedWorkflowTemplate() {
    if (!workflowTemplateId.value) return
    try {
        await store.loadWorkflowTemplate(workflowTemplateId.value)
    } catch {
        // Ignore preview refresh failures and keep current in-memory item.
    }
}

async function handleSaveWorkflowTemplate() {
    try {
        const workflow = await store.createWorkflowTemplate({
            id: workflowTemplateName.value.trim() || undefined,
            name: workflowTemplateName.value.trim() || workflowConfig.value.workflowName.trim() || 'workflow-template',
            description: workflowTemplateDescription.value.trim() || undefined,
            workflowPrompt: workflowConfig.value.workflowPrompt.trim(),
            workflowConfig: cloneWorkflowRoomConfig(workflowRoomConfig.value),
            agents: store.agents.map(agent => ({
                profile: agent.profile,
                name: agent.name,
                description: agent.description,
                avatar: agent.avatar,
                systemPrompt: agent.systemPrompt,
                model: agent.model,
                temperature: agent.temperature,
                invited: !!agent.invited,
            })),
            readme: selectedWorkflowTemplate.value?.readme || '',
            iconDataUrl: selectedWorkflowTemplate.value?.iconDataUrl || '',
            iconFileName: selectedWorkflowTemplate.value?.iconFileName || '',
        })
        workflowTemplateId.value = workflow.id
        workflowTemplateName.value = workflow.name
        workflowTemplateDescription.value = workflow.description || ''
        await refreshSelectedWorkflowTemplate()
        if (activeWorkflowDraftKey.value !== '__room__') {
            activeWorkflowDraftKey.value = workflowDraftKey(workflow.id)
            rememberWorkflowDraft(activeWorkflowDraftKey.value)
        }
        message.success(t('groupChat.workflowTemplateSaved'))
    } catch (err: any) {
        message.error(err.message || t('common.saveFailed'))
    }
}

async function handleApplyWorkflowAgents() {
    const template = store.workflowTemplates.find(item => item.id === workflowTemplateId.value)
    if (!template || !store.currentRoomId) return

    try {
        for (const agent of template.agents) {
            const exists = store.agents.find(existing => existing.profile === agent.profile && existing.name === (agent.name || agent.profile))
            if (!exists) {
                await store.addAgentToRoom(store.currentRoomId, agent)
            }
        }
        message.success(t('groupChat.workflowAgentsApplied'))
    } catch (err: any) {
        message.error(parseUiError(err, t('common.saveFailed')))
    }
}

async function handleDeleteWorkflowTemplate() {
    if (!workflowTemplateId.value) return
    try {
        await store.removeWorkflowTemplate(workflowTemplateId.value)
        workflowTemplateId.value = null
        message.success(t('groupChat.workflowTemplateDeleted'))
    } catch {
        message.error(t('common.deleteFailed'))
    }
}

async function handleExportWorkflowTemplate() {
    const template = selectedWorkflowTemplate.value
    if (!template) return
    try {
        await navigator.clipboard.writeText(JSON.stringify(template, null, 2))
        message.success(t('groupChat.workflowTemplateCopied'))
    } catch {
        message.error(t('common.copyFailed'))
    }
}

async function handleImportWorkflowTemplate() {
    try {
        const parsed = JSON.parse(workflowImportJson.value)
        const workflow = await store.createWorkflowTemplate(parsed)
        workflowTemplateId.value = workflow.id
        handleSelectWorkflowTemplate(workflow.id)
        showImportWorkflowModal.value = false
        workflowImportJson.value = ''
        message.success(t('groupChat.workflowTemplateImported'))
    } catch (err: any) {
        message.error(err.message || t('groupChat.workflowTemplateImportFailed'))
    }
}

function addWorkflowStage() {
    workflowRoomConfig.value.stages = [...(workflowRoomConfig.value.stages || []), createWorkflowStage()]
}

function removeWorkflowStage(stageId: string) {
    workflowRoomConfig.value.stages = (workflowRoomConfig.value.stages || []).filter(stage => stage.id !== stageId)
}

async function handleSaveDefaultAgents() {
    if (!store.currentRoomId) return
    try {
        await store.saveCurrentAgentsAsDefault(store.currentRoomId)
        message.success(t('groupChat.defaultAgentsSaved'))
    } catch {
        message.error(t('common.saveFailed'))
    }
}

async function handleApplyDefaultAgents() {
    if (!store.currentRoomId) return
    try {
        const res = await store.applyRoomDefaultAgents(store.currentRoomId)
        message.success(t('groupChat.defaultAgentsApplied', { count: res.added.length }))
    } catch {
        message.error(t('common.saveFailed'))
    }
}

function handleOpenCompressionConfig() {
    const room = store.rooms.find(r => r.id === store.currentRoomId)
    if (room) {
        compressionConfig.value = {
            triggerTokens: room.triggerTokens ?? 100000,
            maxHistoryTokens: room.maxHistoryTokens ?? 32000,
            tailMessageCount: room.tailMessageCount ?? 20,
        }
    }
    showCompressionModal.value = true
}

async function handleSaveCompressionConfig() {
    if (!store.currentRoomId) return
    try {
        const res = await updateRoomConfig(store.currentRoomId, { ...compressionConfig.value })
        const idx = store.rooms.findIndex(r => r.id === store.currentRoomId)
        if (idx >= 0 && res.room) store.rooms[idx] = res.room
        showCompressionModal.value = false
        message.success(t('groupChat.compressionSaved'))
    } catch {
        message.error(t('common.saveFailed'))
    }
}

async function handleForceCompress() {
    if (!store.currentRoomId || isCompressing.value) return
    if (store.contextStatuses.size > 0) {
        message.warning(t('groupChat.compressingInProgress'))
        return
    }
    isCompressing.value = true
    try {
        await forceCompress(store.currentRoomId)
        message.success(t('groupChat.compressionSaved'))
    } catch {
        message.error(t('common.saveFailed'))
    } finally {
        isCompressing.value = false
    }
}

async function handleRemoveAgent(agentId: string) {
    if (!store.currentRoomId) return
    try {
        const nextAgents = store.agents
            .filter(agent => agent.id !== agentId)
            .map(agent => ({ name: agent.name, profile: agent.profile }))
        const currentAlignment = analyzeWorkflowRoleAlignment(workflowRoomConfig.value, store.agents)
        const nextAlignment = analyzeWorkflowRoleAlignment(workflowRoomConfig.value, nextAgents)
        const newlyMissingRoles = nextAlignment.missingRoles.filter(role =>
            !currentAlignment.missingRoles.some(currentRole => normalizeRoleKey(currentRole) === normalizeRoleKey(role)),
        )
        if (newlyMissingRoles.length > 0) {
            message.warning(t('groupChat.workflowAgentRoleDeleteBlocked', { roles: newlyMissingRoles.join('、') }))
            return
        }
        await store.removeAgentFromRoom(store.currentRoomId, agentId, store.userName || t('groupChat.workflowEditorDefaultOwnerRole'))
    } catch (err: any) {
        message.error(parseUiError(err, t('common.deleteFailed')))
    }
}

// Auto-scroll on new messages
const messageListRef = ref()
const chatInputRef = ref<GroupChatInputExpose | null>(null)
watch(() => store.workflowRunState?.currentNodeId, async (nextId, previousId) => {
    if (!nextId || nextId === previousId) return
    await nextTick()
    messageListRef.value?.scrollToBottom(true)
})

watch(() => store.currentRoomId, (roomId) => {
    if (!roomId) {
        approvalRejectReason.value = ''
        showApprovalRejectModal.value = false
        return
    }
    store.refreshWorkflowRuntimeData(roomId).catch(() => { /* ignore */ })
}, { immediate: true })

watch(() => store.currentWorkflowConfig?.version, () => {
    if (!store.currentRoomId) return
    store.refreshWorkflowRuntimeData(store.currentRoomId).catch(() => { /* ignore */ })
})

function handleFocusChatInput() {
    chatInputRef.value?.focusInput()
}

function handlePrefillWorkflowDraft(text: string) {
    chatInputRef.value?.setDraft(text)
}

async function handleLiveStatusAction(actionKey: string) {
    if (actionKey === 'activate-workspace') {
        await handleToggleRoomActivation()
        return
    }
    if (actionKey === 'open-gateways') {
        handleOpenGateways()
        return
    }
    if (actionKey === 'switch-identity') {
        handleOpenIdentitySwitch(store.currentWorkflowConfig?.ownerUserName)
        return
    }
    if (actionKey === 'open-approval-artifact') {
        await handleOpenApprovalArtifact()
        return
    }
    if (actionKey === 'approve') {
        await submitWorkflowApproval('approve')
        return
    }
    if (actionKey === 'reject') {
        handleOpenRejectApproval()
        return
    }
    if (actionKey === 'open-history') {
        await handleOpenChangeHistory()
        return
    }
    if (actionKey === 'open-artifacts') {
        await handleOpenArtifacts()
        return
    }
    if (actionKey === 'focus-input') {
        handleFocusChatInput()
    }
}
</script>

<template>
    <div class="group-chat-panel">
        <!-- Mobile backdrop -->
        <div class="sidebar-backdrop" :class="{ active: showSidebar }" @click="showSidebar = false" />
        <!-- Room sidebar -->
        <div v-if="showSidebar" class="room-sidebar">
            <div class="sidebar-header">
                <span class="sidebar-title">{{ t('groupChat.title') }}</span>
                <div class="sidebar-actions">
                    <button class="icon-btn" :title="t('groupChat.createRoom')" @click="showCreateModal = true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                </div>
            </div>
            <div class="room-list">
                <div
                    v-for="room in store.rooms"
                    :key="room.id"
                    class="room-item"
                    :class="{ active: store.currentRoomId === room.id }"
                    @click="handleSelectRoom(room.id)"
                >
                    <svg class="room-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <div class="room-info">
                        <div class="room-name-row">
                            <span class="room-name">{{ room.name || room.id }}</span>
                            <span v-if="room.isSystemPreset" class="room-badge">{{ t('groupChat.systemPreset') }}</span>
                            <span class="room-status-badge" :class="{ 'room-status-badge--active': !!room.isActive }">
                                {{ roomStatusText(room) }}
                            </span>
                        </div>
                        <span v-if="room.workflowName" class="room-code">{{ room.workflowName }}</span>
                        <span v-if="room.inviteCode" class="room-code">{{ room.inviteCode }}</span>
                        <span class="room-tokens">{{ formatTokens(room.totalTokens || 0) }}</span>
                    </div>
                    <NPopconfirm @positive-click="handleDeleteRoom(room.id)">
                        <template #trigger>
                            <button class="room-delete-btn" @click.stop>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </template>
                        {{ getDeleteRoomConfirmText(room.id) }}
                    </NPopconfirm>
                </div>
                <div v-if="store.rooms.length === 0" class="empty-rooms">
                    {{ t('groupChat.noRooms') }}
                </div>
            </div>
        </div>

        <!-- Main chat area -->
        <div class="chat-main">
            <div class="chat-header">
                <button class="icon-btn" @click="toggleSidebar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" />
                    </svg>
                </button>
                <span class="room-title-text">{{ store.roomName || (store.currentRoomId || t('groupChat.title')) }}</span>
                <div class="header-info">
                    <!-- Stacked avatars (user + agents) -->
                    <NPopover v-if="store.agents.length" trigger="click" placement="bottom-end" :width="320">
                        <template #trigger>
                            <div class="avatar-stack-inner">
                                <!-- User avatar first -->
                                    <span class="avatar-stack-item" :style="{ zIndex: store.agents.length + 1 }">
                                        <span class="agent-avatar" v-html="agentAvatarMarkup(store.userName || store.userId, undefined, 'user')" />
                                    </span>
                                <span
                                    v-for="(agent, index) in store.agents.slice(-4)"
                                    :key="agent.id"
                                    class="avatar-stack-item"
                                    :style="{ zIndex: store.agents.length - index }"
                                >
                                    <span v-if="isImageAvatar(agent.avatar)" class="agent-avatar">
                                        <img :src="agentAvatarUrl(agent.name, agent.avatar)" :alt="agent.name">
                                    </span>
                                    <span v-else class="agent-avatar" v-html="agentAvatarMarkup(agent.name, agent.avatar, 'agent')" />
                                </span>
                                <span v-if="store.agents.length > 4" class="avatar-stack-more">+{{ store.agents.length - 4 }}</span>
                            </div>
                        </template>
                        <div class="agent-popover">
                            <div class="agent-popover-item agent-popover-item--self">
                                <span class="agent-avatar agent-popover-avatar" v-html="agentAvatarMarkup(store.userName || store.userId, undefined, 'user')" />
                                <div class="agent-popover-info">
                                    <span class="agent-popover-name">{{ store.userName || 'You' }}</span>
                                    <span class="agent-popover-profile">{{ t('groupChat.currentIdentity') }}</span>
                                    <span v-if="currentIdentityDescription" class="agent-popover-profile">{{ currentIdentityDescription }}</span>
                                </div>
                                <button class="mini-action-btn" @click="handleOpenIdentitySwitch()">{{ t('groupChat.switchIdentity') }}</button>
                            </div>
                            <div class="agent-popover-title">
                                <span>{{ t('groupChat.agents') }} ({{ store.agents.length }})</span>
                                <div class="agent-popover-actions">
                                    <button class="mini-action-btn" @click="handleSaveDefaultAgents">{{ t('groupChat.saveDefaultAgents') }}</button>
                                    <button class="mini-action-btn" @click="handleApplyDefaultAgents">{{ t('groupChat.applyDefaultAgents') }}</button>
                                </div>
                            </div>
                            <div v-for="agent in store.agents" :key="agent.id" class="agent-popover-item">
                                <span v-if="isImageAvatar(agent.avatar)" class="agent-avatar agent-popover-avatar">
                                    <img :src="agentAvatarUrl(agent.name, agent.avatar)" :alt="agent.name">
                                </span>
                                <span v-else class="agent-avatar agent-popover-avatar" v-html="agentAvatarMarkup(agent.name, agent.avatar, 'agent')" />
                                <div class="agent-popover-info">
                                    <span class="agent-popover-name">{{ agent.name }}</span>
                                    <span class="agent-popover-profile">
                                        {{ agent.profile }}<template v-if="agent.model"> · {{ agent.model }}</template>
                                    </span>
                                    <span v-if="agent.systemPrompt" class="agent-popover-profile">{{ t('groupChat.customPromptEnabled') }}</span>
                                </div>
                                <button class="agent-popover-remove" :title="t('common.edit')" @click="handleEditAgent(agent)">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                                </button>
                                <button class="agent-popover-remove" @click="handleRemoveAgent(agent.id)">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>
                        </div>
                    </NPopover>
                    <!-- Only user avatar, no agents -->
                    <div v-else-if="store.userName" class="avatar-stack-inner">
                        <span class="avatar-stack-item">
                            <span class="agent-avatar" v-html="agentAvatarMarkup(store.userName || store.userId, undefined, 'user')" />
                        </span>
                    </div>
                    <button class="identity-chip" type="button" @click="handleOpenIdentitySwitch()">
                        <span class="identity-chip__label">{{ t('groupChat.currentIdentity') }}</span>
                        <strong>@{{ currentIdentityName || store.userId }}</strong>
                    </button>
                    <button class="icon-btn" :title="t('groupChat.addAgent')" @click="handleAddAgent">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <button class="header-action-btn" :title="t('groupChat.workspaceSettings')" @click="handleOpenWorkflowConfig">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6h7"/><path d="M4 12h12"/><path d="M4 18h16"/><circle cx="17" cy="6" r="2"/><circle cx="20" cy="12" r="2"/></svg>
                        <span>{{ t('groupChat.workspaceSettings') }}</span>
                    </button>
                    <button class="header-action-btn" :title="t('groupChat.artifacts')" @click="handleOpenArtifacts">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8l2 3h4a2 2 0 0 1 2 2Z"/></svg>
                        <span>{{ t('groupChat.artifacts') }}</span>
                    </button>
                    <button class="header-action-btn" :title="t('groupChat.changeHistory')" @click="handleOpenChangeHistory">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12h18"/><path d="M3 6h12"/><path d="M3 18h8"/><circle cx="18" cy="6" r="2"/><circle cx="14" cy="18" r="2"/></svg>
                        <span>{{ t('groupChat.changeHistory') }}</span>
                    </button>
                    <button class="header-action-btn" :title="t('groupChat.project')" @click="handleOpenProjectModal">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z"/><path d="M12 12 21 7.5"/><path d="M12 12v9"/><path d="M12 12 3 7.5"/></svg>
                        <span>{{ t('groupChat.project') }}</span>
                    </button>
                    <button class="icon-btn" :title="t('groupChat.compressionConfig')" @click="handleOpenCompressionConfig">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 4.6a1.65 1.65 0 0 0 1.51 1V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1z"/></svg>
                    </button>
                    <span v-if="store.members.length" class="member-count">
                        {{ store.members.length }} {{ t('groupChat.members') }}
                    </span>
                    <span class="connection-dot" :class="{ connected: store.connected, disconnected: !store.connected }"></span>
                </div>
            </div>

            <template v-if="hasRoom">
                <div class="gateway-status-banner" :class="{ 'gateway-status-banner--down': !gatewayStatePending && !activeGateway?.running }">
                    <button class="gateway-status-banner__summary" @click="showRuntimeDetails = !showRuntimeDetails">
                        <span class="gateway-status-banner__summary-main">
                            <span class="gateway-status-banner__label">{{ t('gateways.activeProfile') }}</span>
                            <strong class="gateway-status-banner__value">{{ activeProfileName || t('gateways.noActiveProfile') }}</strong>
                            <span class="gateway-status-banner__meta">{{ gatewayStatusLabel }}</span>
                        </span>
                        <span class="gateway-status-banner__summary-side">
                            <span class="gateway-status-banner__hint">{{ roomRuntimeLabel }}</span>
                            <span class="gateway-status-banner__toggle">{{ showRuntimeDetails ? t('common.collapse') : t('common.expand') }}</span>
                        </span>
                    </button>
                    <div v-if="showRuntimeDetails" class="gateway-status-banner__detail">
                        <span class="gateway-status-banner__hint">{{ gatewayStatusHint }}</span>
                        <span v-if="activeGateway" class="gateway-status-banner__hint">{{ activeGateway.host }}:{{ activeGateway.port }}</span>
                        <span class="gateway-status-banner__hint">{{ roomRuntimeHint }}</span>
                    </div>
                    <div class="gateway-status-banner__actions">
                        <NButton size="small" type="primary" secondary @click="handleToggleRoomActivation">
                            {{ store.currentRoomRuntime?.isActive ? t('groupChat.deactivateWorkspace') : t('groupChat.activateWorkspace') }}
                        </NButton>
                        <NButton size="small" secondary type="warning" :loading="isClearingMessages" @click="handleClearRoomMessages">
                            {{ t('groupChat.clearMessages') }}
                        </NButton>
                        <NButton size="small" secondary @click="handleOpenGateways">{{ t('sidebar.gateways') }}</NButton>
                        <NButton size="small" secondary @click="handleOpenSettings">{{ t('sidebar.settings') }}</NButton>
                    </div>
                </div>
                <div v-if="workflowEnabled && (store.workflowRunState || store.workflowCurrentNode)" class="workflow-live-banner">
                    <button class="workflow-live-banner__summary" @click="showWorkflowDetails = !showWorkflowDetails">
                        <span class="workflow-live-banner__label">{{ t('groupChat.workflowNow') }}</span>
                        <span class="workflow-live-banner__title">
                            {{ store.workflowCurrentNodeTitle || t('groupChat.workflowStatusIdle') }}
                        </span>
                        <span class="workflow-live-banner__badge" :class="`workflow-live-banner__badge--${workflowStatusTone}`">
                            {{ workflowStatusLabel }}
                        </span>
                        <span class="workflow-live-banner__toggle">{{ showWorkflowDetails ? t('common.collapse') : t('common.expand') }}</span>
                    </button>
                    <div v-if="showWorkflowDetails && workflowNodeTrack.length > 0" class="workflow-live-banner__track">
                        <div
                            v-for="node in workflowNodeTrack"
                            :key="node.id"
                            class="workflow-live-banner__track-node"
                            :class="[
                                `workflow-live-banner__track-node--${node.tone}`,
                                { 'workflow-live-banner__track-node--current': node.isCurrent },
                            ]"
                        >
                            <span class="workflow-live-banner__track-dot" />
                            <span class="workflow-live-banner__track-copy">
                                <span class="workflow-live-banner__track-title">{{ node.title }}</span>
                                <span v-if="node.role" class="workflow-live-banner__track-role">@{{ node.role }}</span>
                            </span>
                        </div>
                    </div>
                    <div v-if="showWorkflowDetails && store.currentWorkflowConfig?.ownerUserName" class="workflow-live-banner__owner">
                        <span class="workflow-live-banner__owner-label">{{ t('groupChat.workflowOwnerName') }}</span>
                        <span class="workflow-live-banner__owner-name">@{{ store.currentWorkflowConfig.ownerUserName }}</span>
                    </div>
                    <div v-if="showWorkflowDetails && workflowActiveRoleLabel" class="workflow-live-banner__owner">
                        <span class="workflow-live-banner__owner-label">{{ t('groupChat.workflowActiveRole') }}</span>
                        <span class="workflow-live-banner__owner-name">@{{ workflowActiveRoleLabel }}</span>
                    </div>
                    <div v-if="showWorkflowDetails && workflowActiveAgentLabel" class="workflow-live-banner__owner">
                        <span class="workflow-live-banner__owner-label">{{ t('groupChat.workflowActiveAgent') }}</span>
                        <span class="workflow-live-banner__owner-name">@{{ workflowActiveAgentLabel }}</span>
                    </div>
                    <div v-if="showWorkflowDetails" class="workflow-live-banner__owner">
                        <span class="workflow-live-banner__owner-label">{{ t('groupChat.workflowInteractionGuide') }}</span>
                        <span class="workflow-live-banner__owner-name">{{ workflowInteractionHint }}</span>
                    </div>
                    <div v-if="store.workflowRunState?.status === 'completed'" class="workflow-live-banner__completed-note">
                        <span class="workflow-live-banner__completed-title">{{ t('groupChat.workflowCompletedGuideTitle') }}</span>
                        <span class="workflow-live-banner__completed-copy">{{ t('groupChat.workflowCompletedGuideBody') }}</span>
                    </div>
                    <div v-if="store.workflowRunState && store.workflowRunState.status !== 'completed'" class="workflow-live-banner__actions">
                        <div class="workflow-live-banner__approval">
                            <span class="workflow-live-banner__approval-title">{{ t('groupChat.workflowCancelAction') }}</span>
                            <span class="workflow-live-banner__approval-hint">{{ t('groupChat.workflowCancelHint') }}</span>
                            <span v-if="workflowCancelDisabledHint" class="workflow-live-banner__approval-artifact">
                                {{ workflowCancelDisabledHint }}
                            </span>
                        </div>
                        <div class="workflow-live-banner__approval-buttons">
                            <NButton
                                size="small"
                                type="warning"
                                secondary
                                :disabled="!workflowCancelCanAct"
                                :loading="isCancellingWorkflow"
                                @click="handleCancelWorkflowExecution"
                            >
                                {{ t('groupChat.workflowCancelAction') }}
                            </NButton>
                        </div>
                    </div>
                </div>
                <div v-else class="workflow-live-banner workflow-live-banner--empty">
                    <div class="workflow-live-banner__summary workflow-live-banner__summary--static">
                        <span class="workflow-live-banner__label">{{ t('groupChat.workflowLabel') }}</span>
                        <span class="workflow-live-banner__title">{{ t('groupChat.workflowDisabledTitle') }}</span>
                        <span class="workflow-live-banner__badge workflow-live-banner__badge--idle">{{ t('groupChat.workflowDisabledBadge') }}</span>
                    </div>
                </div>
                <div
                    v-if="workflowEnabled || store.currentRoomRuntime"
                    class="live-status-strip"
                    :class="`live-status-strip--${liveStatusStripTone}`"
                >
                    <div class="live-status-strip__main">
                        <div class="live-status-strip__eyebrow">{{ t('groupChat.liveStatusStripEyebrow') }}</div>
                        <h3 class="live-status-strip__title">{{ liveStatusStripTitle }}</h3>
                        <p class="live-status-strip__summary">{{ liveStatusStripSummary }}</p>
                    </div>
                    <div class="live-status-strip__meta">
                        <div class="live-status-strip__meta-item">
                            <span class="live-status-strip__meta-label">{{ t('groupChat.liveStatusStripCurrentHandler') }}</span>
                            <span class="live-status-strip__meta-value">{{ liveStatusStripHandler }}</span>
                        </div>
                        <div class="live-status-strip__meta-item">
                            <span class="live-status-strip__meta-label">{{ t('groupChat.liveStatusStripNextStep') }}</span>
                            <span class="live-status-strip__meta-value">{{ liveStatusStripNextStep }}</span>
                        </div>
                        <div class="live-status-strip__meta-item">
                            <span class="live-status-strip__meta-label">{{ t('groupChat.liveStatusStripRuntime') }}</span>
                            <span class="live-status-strip__meta-value">{{ liveStatusStripRuntime }}</span>
                        </div>
                    </div>
                    <div v-if="liveStatusActions.length > 0" class="live-status-strip__actions">
                        <NButton
                            v-for="action in liveStatusActions"
                            :key="action.key"
                            size="small"
                            :type="action.type === 'primary' ? 'primary' : action.type === 'warning' ? 'warning' : 'default'"
                            :secondary="action.secondary ?? action.type !== 'primary'"
                            :disabled="action.disabled"
                            @click="handleLiveStatusAction(action.key)"
                        >
                            {{ action.label }}
                        </NButton>
                    </div>
                </div>
                <div v-if="workflowReadySpotlightVisible" class="workflow-ready-spotlight">
                    <div class="workflow-ready-spotlight__eyebrow">{{ t('groupChat.workflowReadySpotlightEyebrow') }}</div>
                    <div class="workflow-ready-spotlight__layout">
                        <div class="workflow-ready-spotlight__main">
                            <h3 class="workflow-ready-spotlight__title">{{ workflowReadySpotlightTitle }}</h3>
                            <p class="workflow-ready-spotlight__body">{{ workflowReadySpotlightBody }}</p>
                            <div class="workflow-ready-spotlight__meta">
                                <div class="workflow-ready-spotlight__meta-item">
                                    <span class="workflow-ready-spotlight__meta-label">{{ t('groupChat.workflowReadySpotlightStatus') }}</span>
                                    <span class="workflow-ready-spotlight__meta-value">{{ workflowReadySpotlightStatus }}</span>
                                </div>
                                <div v-if="workflowReadySpotlightKickoff" class="workflow-ready-spotlight__meta-item">
                                    <span class="workflow-ready-spotlight__meta-label">{{ t('groupChat.workflowReadySpotlightLatestKickoff') }}</span>
                                    <span class="workflow-ready-spotlight__meta-value">{{ workflowReadySpotlightKickoff }}</span>
                                </div>
                            </div>
                            <div class="workflow-ready-spotlight__chips">
                                <button class="workflow-ready-spotlight__chip" @click="handlePrefillWorkflowDraft(workflowReadySpotlightPrimaryDraft)">
                                    {{ t('groupChat.workflowReadySpotlightChipPrimary') }}
                                </button>
                                <button
                                    v-if="workflowReadySpotlightShowFollowUpDraft"
                                    class="workflow-ready-spotlight__chip"
                                    @click="handlePrefillWorkflowDraft(workflowReadySpotlightSecondaryDraft)"
                                >
                                    {{ t('groupChat.workflowReadySpotlightChipSecondary') }}
                                </button>
                            </div>
                        </div>
                        <div class="workflow-ready-spotlight__actions">
                            <NButton size="small" type="primary" @click="handleFocusChatInput">
                                {{ t('groupChat.workflowReadySpotlightFocusAction') }}
                            </NButton>
                            <NButton
                                size="small"
                                secondary
                                :disabled="!workflowReadySpotlightHasHistory"
                                @click="handleOpenChangeHistory"
                            >
                                {{ workflowReadySpotlightHistoryActionLabel }}
                            </NButton>
                        </div>
                    </div>
                </div>
                <div v-if="workflowNeedsApproval" class="approval-spotlight" :class="{ 'approval-spotlight--locked': !workflowApprovalCanAct }">
                    <div class="approval-spotlight__eyebrow">{{ t('groupChat.workflowApprovalSpotlightEyebrow') }}</div>
                    <div class="approval-spotlight__layout">
                        <div class="approval-spotlight__main">
                            <h3 class="approval-spotlight__title">{{ workflowApprovalSpotlightTitle }}</h3>
                            <p class="approval-spotlight__body">{{ workflowApprovalSpotlightBody }}</p>
                            <div class="approval-spotlight__meta">
                                <div class="approval-spotlight__meta-item">
                                    <span class="approval-spotlight__meta-label">{{ t('groupChat.workflowApprovalSpotlightPendingNode') }}</span>
                                    <span class="approval-spotlight__meta-value">{{ workflowApprovalPendingNodeTitle }}</span>
                                </div>
                                <div class="approval-spotlight__meta-item">
                                    <span class="approval-spotlight__meta-label">{{ t('groupChat.workflowApprovalSpotlightCurrentIdentity') }}</span>
                                    <span class="approval-spotlight__meta-value">@{{ currentIdentityName || store.userId }}</span>
                                </div>
                                <div class="approval-spotlight__meta-item">
                                    <span class="approval-spotlight__meta-label">{{ t('groupChat.workflowApprovalSpotlightOwner') }}</span>
                                    <span class="approval-spotlight__meta-value">@{{ workflowApprovalOwnerLabel || currentIdentityName || store.userId }}</span>
                                </div>
                                <div v-if="workflowApprovalArtifactPreviewLabel" class="approval-spotlight__meta-item">
                                    <span class="approval-spotlight__meta-label">{{ t('groupChat.workflowApprovalSpotlightArtifact') }}</span>
                                    <span class="approval-spotlight__meta-value">{{ workflowApprovalArtifactPreviewLabel }}</span>
                                </div>
                            </div>
                            <p v-if="workflowApprovalDisabledHint" class="approval-spotlight__note">
                                {{ workflowApprovalDisabledHint }}
                            </p>
                        </div>
                        <div class="approval-spotlight__actions">
                            <NButton
                                v-if="!workflowApprovalCanAct && store.currentWorkflowConfig?.ownerUserName"
                                size="small"
                                type="warning"
                                secondary
                                @click="handleOpenIdentitySwitch(store.currentWorkflowConfig.ownerUserName)"
                            >
                                {{ t('groupChat.switchToApprovalOwner') }}
                            </NButton>
                            <NButton
                                v-else
                                size="small"
                                secondary
                                @click="handleOpenIdentitySwitch()"
                            >
                                {{ t('groupChat.switchIdentity') }}
                            </NButton>
                            <NButton
                                v-if="workflowApprovalSourceArtifactLabel"
                                size="small"
                                secondary
                                @click="handleOpenApprovalArtifact"
                            >
                                {{ t('groupChat.workflowOpenArtifact') }}
                            </NButton>
                            <NButton
                                size="small"
                                secondary
                                :disabled="isSubmittingApproval || !workflowApprovalCanAct"
                                @click="handleOpenRejectApproval"
                            >
                                {{ t('groupChat.workflowRejectAction') }}
                            </NButton>
                            <NButton
                                size="small"
                                type="primary"
                                :disabled="!workflowApprovalCanAct"
                                :loading="isSubmittingApproval"
                                @click="submitWorkflowApproval('approve')"
                            >
                                {{ t('groupChat.workflowApproveAction') }}
                            </NButton>
                        </div>
                    </div>
                </div>
                <GroupMessageList ref="messageListRef" />
                <div v-if="store.contextStatuses.size > 0 || (store.typingText && store.contextStatuses.size === 0)" class="status-bar">
                    <div v-if="store.contextStatuses.size > 0" class="context-status-list">
                        <div v-for="status in workingAgentStatuses" :key="status.agentName" class="context-status">
                            <span class="typing-dots">
                                <span /><span /><span />
                            </span>
                            <span class="context-status__agent">@{{ status.agentName }}</span>
                            <span class="context-status__label">{{ status.label }}</span>
                        </div>
                    </div>
                    <div v-else-if="store.typingText" class="typing-indicator">
                        <span class="typing-dots">
                            <span /><span /><span />
                        </span>
                        {{ store.typingText }}
                    </div>
                </div>
                <GroupChatInput ref="chatInputRef" @send="handleSendMessage" />
            </template>

            <div v-else class="no-room">
                <div class="no-room-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                </div>
                <p>{{ t('groupChat.selectOrCreate') }}</p>
            </div>
        </div>

        <!-- Create room modal -->
        <Teleport to="body">
            <div v-if="showCreateModal" class="modal-backdrop" @click.self="showCreateModal = false">
                <div class="modal">
                    <h3>{{ t('groupChat.createRoom') }}</h3>
                    <CreateRoomForm @submit="handleCreateRoom" @cancel="showCreateModal = false" />
                </div>
            </div>
        </Teleport>

        <Teleport to="body">
            <div v-if="showAddAgentModal || showEditAgentModal" class="modal-backdrop" @click.self="showAddAgentModal = false; showEditAgentModal = false; resetAgentForm()">
                <div class="modal">
                    <h3>{{ isEditingAgent ? t('groupChat.editAgent') : t('groupChat.addAgent') }}</h3>
                    <div class="form-group">
                        <NSelect
                            v-model:value="selectedProfile"
                            :options="profileOptions"
                            :placeholder="t('groupChat.selectProfile')"
                            filterable
                        />
                    </div>
                    <div class="form-group">
                        <label class="form-label">{{ t('groupChat.agentName') }}</label>
                        <NInput
                            v-model:value="agentName"
                            :placeholder="t('groupChat.agentNamePlaceholder')"
                        />
                    </div>
                    <div class="form-group">
                        <label class="form-label">{{ t('groupChat.agentDesc') }}</label>
                        <NInput
                            v-model:value="agentDescription"
                            type="textarea"
                            :rows="2"
                            :placeholder="t('groupChat.agentDescPlaceholder')"
                        />
                    </div>
                    <div class="form-group">
                        <label class="form-label">{{ t('groupChat.agentAvatar') }}</label>
                        <div class="avatar-picker">
                            <button
                                v-for="preset in avatarPresets"
                                :key="preset.value"
                                type="button"
                                class="avatar-picker__item"
                                :class="{ active: agentAvatar === preset.value }"
                                @click="selectAgentAvatarPreset(preset.value)"
                            >
                                <span class="agent-avatar" v-html="agentAvatarMarkup(agentName || preset.label, preset.value, 'agent')" />
                                <span>{{ preset.label }}</span>
                            </button>
                        </div>
                        <NInput
                            v-model:value="agentAvatar"
                            :placeholder="t('groupChat.agentAvatarPlaceholder')"
                        />
                        <p class="form-hint">{{ t('groupChat.agentAvatarHint') }}</p>
                    </div>
                    <div class="form-group">
                        <label class="form-label">{{ t('groupChat.agentSystemPrompt') }}</label>
                        <NInput
                            v-model:value="agentSystemPrompt"
                            type="textarea"
                            :rows="4"
                            :placeholder="t('groupChat.agentSystemPromptPlaceholder')"
                        />
                    </div>
                    <div v-if="workflowHasRoleMismatch" class="workflow-role-check workflow-role-check--warning">
                        <div class="workflow-role-check__title">{{ t('groupChat.workflowRoleMismatchTitle') }}</div>
                        <div class="workflow-role-check__text">
                            {{ t('groupChat.workflowRoleMismatchHint', { roles: workflowRoleAlignment.missingRoles.join('、') }) }}
                        </div>
                    </div>
                    <div class="form-grid form-grid--workflow-meta">
                        <div class="form-group">
                            <label class="form-label">{{ t('groupChat.agentModelSource') }}</label>
                            <NSelect
                                v-model:value="selectedModelProvider"
                                :options="modelProviderOptions"
                                :placeholder="t('groupChat.agentModelSourcePlaceholder')"
                                clearable
                                filterable
                            />
                            <p class="form-hint">{{ t('groupChat.agentModelSourceHint') }}</p>
                        </div>
                        <div class="form-group">
                            <label class="form-label">{{ t('groupChat.agentModel') }}</label>
                            <NSelect
                                v-model:value="agentModel"
                                :options="selectedModelOptions"
                                :placeholder="selectedModelProvider ? t('groupChat.agentModelPlaceholder') : t('groupChat.agentModelSourceFirst')"
                                clearable
                                filterable
                                :disabled="!selectedModelProvider"
                            />
                            <p class="form-hint">{{ t('groupChat.agentModelHint') }}</p>
                        </div>
                    </div>
                    <div class="form-grid form-grid--workflow-meta">
                        <div class="form-group">
                            <label class="form-label">{{ t('groupChat.agentTemperature') }}</label>
                            <NInputNumber
                                v-model:value="agentTemperature"
                                :min="0"
                                :max="2"
                                :step="0.1"
                                clearable
                                style="width: 100%"
                            />
                        </div>
                    </div>
                    <div class="modal-actions">
                        <NSpace justify="end">
                            <NButton @click="showAddAgentModal = false; showEditAgentModal = false; resetAgentForm()">{{ t('common.cancel') }}</NButton>
                            <NButton type="primary" :disabled="!selectedProfile" @click="confirmAgentForm">
                                {{ isEditingAgent ? t('common.save') : t('common.add') }}
                            </NButton>
                        </NSpace>
                    </div>
                </div>
            </div>
            <div v-if="showApprovalRejectModal" class="modal-backdrop" @click.self="showApprovalRejectModal = false">
                <div class="modal modal--approval">
                    <h3>{{ t('groupChat.workflowRejectModalTitle') }}</h3>
                    <p class="form-hint">{{ t('groupChat.workflowRejectModalHint') }}</p>
                    <div class="form-group">
                        <label class="form-label">{{ t('groupChat.workflowRejectReasonLabel') }}</label>
                        <NInput
                            v-model:value="approvalRejectReason"
                            type="textarea"
                            :rows="5"
                            :placeholder="t('groupChat.workflowRejectReasonPlaceholder')"
                        />
                    </div>
                    <div class="modal-actions">
                        <NSpace justify="end">
                            <NButton @click="showApprovalRejectModal = false">{{ t('common.cancel') }}</NButton>
                            <NButton type="warning" :loading="isSubmittingApproval" @click="submitWorkflowApproval('reject')">
                                {{ t('groupChat.workflowRejectSubmitAction') }}
                            </NButton>
                        </NSpace>
                    </div>
                </div>
            </div>
            <div v-if="showIdentitySwitchModal" class="modal-backdrop" @click.self="showIdentitySwitchModal = false">
                <div class="modal modal--identity">
                    <h3>{{ t('groupChat.identitySwitchTitle') }}</h3>
                    <p class="form-hint">{{ t('groupChat.identitySwitchHint') }}</p>
                    <div class="identity-current-card">
                        <span class="agent-avatar identity-current-card__avatar" v-html="agentAvatarMarkup(identityUserName || currentIdentityName || store.userId, undefined, 'user')" />
                        <div>
                            <div class="identity-current-card__label">{{ t('groupChat.currentIdentity') }}</div>
                            <div class="identity-current-card__name">@{{ identityUserName || currentIdentityName || store.userId }}</div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">{{ t('groupChat.yourName') }}</label>
                        <NInput
                            v-model:value="identityUserName"
                            :placeholder="t('groupChat.yourNamePlaceholder')"
                            @keyup.enter="handleConfirmIdentitySwitch"
                        />
                    </div>
                    <div class="form-group">
                        <label class="form-label">{{ t('groupChat.yourDescription') }}</label>
                        <NInput
                            v-model:value="identityDescription"
                            type="textarea"
                            :rows="3"
                            :placeholder="t('groupChat.yourDescriptionPlaceholder')"
                        />
                    </div>
                    <div v-if="workflowNeedsApproval && store.currentWorkflowConfig?.ownerUserName" class="identity-approval-note">
                        <span>{{ t('groupChat.workflowApprovalIdentityHint', {
                            current: `@${identityUserName || currentIdentityName || store.userId}`,
                            owner: `@${store.currentWorkflowConfig.ownerUserName}`,
                        }) }}</span>
                    </div>
                    <div class="modal-actions">
                        <NSpace justify="end">
                            <NButton @click="showIdentitySwitchModal = false">{{ t('common.cancel') }}</NButton>
                            <NButton type="primary" @click="handleConfirmIdentitySwitch">
                                {{ t('groupChat.identitySwitchSubmit') }}
                            </NButton>
                        </NSpace>
                    </div>
                </div>
            </div>
            <div v-if="showWorkflowModal" class="modal-backdrop" @click.self="closeWorkflowModal">
                <div class="modal modal--workflow">
                    <div class="modal-title-row">
                        <h3>{{ t('groupChat.workflowConfig') }}</h3>
                        <span v-if="workflowHasUnsavedChanges" class="workflow-draft-badge">{{ t('groupChat.workflowUnsavedChanges') }}</span>
                    </div>
                    <div class="modal-body modal-body--workflow">
                    <div class="form-group form-group--workflow-canvas">
                        <label class="form-label">{{ t('groupChat.workflowTemplateLibrary') }}</label>
                        <NSelect
                            v-model:value="workflowTemplateId"
                            :options="workflowOptions"
                            clearable
                            filterable
                            :placeholder="t('groupChat.workflowTemplatePlaceholder')"
                            @update:value="handleSelectWorkflowTemplate"
                        />
                        <p class="form-hint">{{ t('groupChat.workflowTemplateHint') }}</p>
                        <p class="form-hint">{{ t('groupChat.workflowTemplateSelectHint') }}</p>
                        <p class="form-hint" :class="{ 'form-hint--warning': workflowHasUnsavedChanges }">
                            {{ workflowDraftStatusText }} · {{ workflowUnsavedStatusText }}
                        </p>
                    </div>
                    <div class="form-group">
                        <label class="form-label">{{ t('groupChat.workflowName') }}</label>
                        <NInput v-model:value="workflowConfig.workflowName" :placeholder="t('groupChat.workflowNamePlaceholder')" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">{{ t('groupChat.workflowPrompt') }}</label>
                        <NInput
                            v-model:value="workflowConfig.workflowPrompt"
                            type="textarea"
                            :rows="6"
                            :placeholder="t('groupChat.workflowPromptPlaceholder')"
                        />
                        <p class="form-hint">{{ t('groupChat.workflowPromptHint') }}</p>
                    </div>
                    <div class="form-grid form-grid--workflow-meta">
                        <div class="form-group">
                            <label class="form-label">{{ t('groupChat.workflowMode') }}</label>
                            <NSelect
                                v-model:value="workflowRoomConfig.mode"
                                :options="[
                                    { label: t('groupChat.workflowModeFreeform'), value: 'freeform' },
                                    { label: t('groupChat.workflowModeStageGated'), value: 'stage-gated' },
                                ]"
                            />
                        </div>
                        <div class="form-group">
                            <label class="form-label">{{ t('groupChat.workflowOwnerRole') }}</label>
                            <NInput v-model:value="workflowRoomConfig.ownerRoleName" :placeholder="t('groupChat.workflowOwnerRolePlaceholder')" />
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">{{ t('groupChat.workflowOwnerName') }}</label>
                        <NInput v-model:value="workflowRoomConfig.ownerUserName" :placeholder="t('groupChat.workflowOwnerNamePlaceholder')" />
                    </div>
                    <div class="workflow-role-check" :class="{ 'workflow-role-check--warning': workflowHasRoleMismatch }">
                        <div class="workflow-role-check__title">
                            {{ workflowHasRoleMismatch ? t('groupChat.workflowRoleMismatchTitle') : t('groupChat.workflowRoleMatchTitle') }}
                        </div>
                        <div v-if="workflowRoleAlignment.requiredRoles.length === 0" class="workflow-role-check__text">
                            {{ t('groupChat.workflowRoleNoRequirements') }}
                        </div>
                        <template v-else>
                            <div v-if="workflowHasRoleMismatch" class="workflow-role-check__text">
                                {{ t('groupChat.workflowRoleMismatchHint', { roles: workflowRoleAlignment.missingRoles.join('、') }) }}
                            </div>
                            <div v-else class="workflow-role-check__text">
                                {{ t('groupChat.workflowRoleMatchHint') }}
                            </div>
                            <div class="workflow-role-check__chips">
                                <span
                                    v-for="role in workflowRoleAlignment.requiredRoles"
                                    :key="`required-${role}`"
                                    class="workflow-role-chip"
                                    :class="{ 'workflow-role-chip--missing': workflowRoleAlignment.missingRoles.some(item => normalizeRoleKey(item) === normalizeRoleKey(role)) }"
                                >
                                    {{ role }}
                                </span>
                            </div>
                            <div v-if="workflowRoleAlignment.unusedAgentRoles.length > 0" class="workflow-role-check__text">
                                {{ t('groupChat.workflowRoleUnusedHint', { roles: workflowRoleAlignment.unusedAgentRoles.join('、') }) }}
                            </div>
                            <div class="workflow-role-check__actions">
                                <NButton
                                    v-if="selectedWorkflowTemplateCanSupplyMissingRoles"
                                    size="small"
                                    secondary
                                    @click="handleApplyWorkflowAgents"
                                >
                                    {{ t('groupChat.applyWorkflowAgents') }}
                                </NButton>
                                <NButton
                                    v-if="workflowHasRoleMismatch"
                                    size="small"
                                    secondary
                                    @click="handleAddMissingWorkflowRole"
                                >
                                    {{ t('groupChat.workflowAddMissingRole') }}
                                </NButton>
                            </div>
                        </template>
                    </div>
                    <div class="form-group">
                        <label class="form-label">{{ t('groupChat.workflowCanvas') }}</label>
                        <p class="form-hint">{{ t('groupChat.workflowCanvasHint') }}</p>
                        <LogicFlowWorkflowEditor v-model="workflowRoomConfig" :agents="store.agents" />
                    </div>
                    <div class="form-group">
                        <div class="workflow-stage-header">
                            <label class="form-label">{{ t('groupChat.workflowStages') }}</label>
                            <NButton size="small" secondary @click="addWorkflowStage">{{ t('groupChat.addWorkflowStage') }}</NButton>
                        </div>
                        <p class="form-hint">{{ t('groupChat.workflowStagesHint') }}</p>
                        <div v-if="(workflowRoomConfig.stages || []).length === 0" class="workflow-empty">
                            {{ t('groupChat.workflowStagesEmpty') }}
                        </div>
                        <div v-for="(stage, index) in workflowRoomConfig.stages || []" :key="stage.id" class="workflow-stage-card">
                            <div class="workflow-stage-card__header">
                                <span>{{ t('groupChat.workflowStageLabel', { index: index + 1 }) }}</span>
                                <button class="room-delete-btn" @click="removeWorkflowStage(stage.id)">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>
                            <div class="form-grid">
                                <div class="form-group">
                                    <label class="form-label">{{ t('groupChat.workflowStageName') }}</label>
                                    <NInput v-model:value="stage.name" :placeholder="t('groupChat.workflowStageNamePlaceholder')" />
                                </div>
                                <div class="form-group">
                                    <label class="form-label">{{ t('groupChat.workflowStageAgent') }}</label>
                                    <NSelect
                                        :value="(stage as any).assignedAgentId || null"
                                        :options="agentOptions"
                                        :placeholder="t('groupChat.workflowStageAgentPlaceholder')"
                                        clearable
                                        filterable
                                        @update:value="assignStageAgent(stage, $event)"
                                    />
                                    <p class="form-hint">{{ t('groupChat.workflowStageAgentHint', { agent: agentLabelById((stage as any).assignedAgentId) || stage.roleName || '-' }) }}</p>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">{{ t('groupChat.workflowStageDeliverable') }}</label>
                                <NInput v-model:value="stage.deliverable" type="textarea" :rows="2" :placeholder="t('groupChat.workflowStageDeliverablePlaceholder')" />
                            </div>
                            <div class="form-group">
                                <label class="form-label">{{ t('groupChat.workflowStagePrompt') }}</label>
                                <NInput v-model:value="stage.prompt" type="textarea" :rows="3" :placeholder="t('groupChat.workflowStagePromptPlaceholder')" />
                            </div>
                            <div class="workflow-stage-switch">
                                <span>{{ t('groupChat.workflowStageNeedsConfirm') }}</span>
                                <NSwitch v-model:value="stage.needsAdminConfirm" />
                            </div>
                        </div>
                    </div>
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label">{{ t('groupChat.workflowTemplateName') }}</label>
                            <NInput v-model:value="workflowTemplateName" :placeholder="t('groupChat.workflowTemplateNamePlaceholder')" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">{{ t('groupChat.workflowTemplateDesc') }}</label>
                            <NInput v-model:value="workflowTemplateDescription" :placeholder="t('groupChat.workflowTemplateDescPlaceholder')" />
                        </div>
                    </div>
                    <div v-if="selectedWorkflowTemplate" class="workflow-preview">
                        <div class="workflow-preview__header">
                            <div v-if="selectedWorkflowTemplate.iconDataUrl" class="workflow-preview__icon">
                                <img :src="selectedWorkflowTemplate.iconDataUrl" :alt="selectedWorkflowTemplate.name">
                            </div>
                            <div class="workflow-preview__meta">
                                <div class="workflow-preview__title">{{ t('groupChat.workflowTemplatePreview') }}</div>
                                <div class="workflow-preview__source">
                                    {{ t('groupChat.workflowTemplateSource') }}:
                                    {{ selectedWorkflowTemplate.sourceType === 'package' ? t('groupChat.workflowTemplatePackage') : t('groupChat.workflowTemplateJson') }}
                                </div>
                            </div>
                        </div>
                        <div v-if="selectedWorkflowTemplate.readme" class="form-group" style="margin-bottom: 0;">
                            <label class="form-label">{{ t('groupChat.workflowTemplateReadme') }}</label>
                            <NInput
                                :value="selectedWorkflowTemplate.readme"
                                type="textarea"
                                :rows="5"
                                readonly
                            />
                        </div>
                    </div>
                    </div>
                    <div class="modal-actions">
                        <NSpace justify="end">
                            <NButton :disabled="!workflowTemplateId" @click="openWorkflowTemplateApplyModal">{{ t('groupChat.useWorkflowTemplate') }}</NButton>
                            <NButton v-if="activeWorkflowDraftKey !== '__room__'" @click="handleRestoreRoomWorkflowDraft">{{ t('groupChat.restoreRoomWorkflowDraft') }}</NButton>
                            <NButton @click="handleSaveWorkflowTemplate">{{ t('groupChat.saveAsWorkflowTemplate') }}</NButton>
                            <NButton @click="showImportWorkflowModal = true">{{ t('groupChat.importWorkflowTemplate') }}</NButton>
                            <NButton :disabled="!workflowTemplateId" @click="handleExportWorkflowTemplate">{{ t('groupChat.exportWorkflowTemplate') }}</NButton>
                            <NPopconfirm v-if="workflowTemplateId" @positive-click="handleDeleteWorkflowTemplate">
                                <template #trigger>
                                    <NButton type="error" secondary>{{ t('groupChat.deleteWorkflowTemplate') }}</NButton>
                                </template>
                                {{ t('groupChat.deleteWorkflowTemplate') }}?
                            </NPopconfirm>
                            <NButton @click="closeWorkflowModal">{{ t('common.cancel') }}</NButton>
                            <NButton type="primary" :disabled="workflowHasRoleMismatch" @click="handleSaveWorkflowConfig">{{ t('common.save') }}</NButton>
                        </NSpace>
                    </div>
                </div>
            </div>
            <div v-if="showWorkflowConfirmModal" class="modal-backdrop" @click.self="closeWorkflowConfirmModal">
                <div class="modal modal--confirm">
                    <div class="modal-title-row">
                        <h3>{{ workflowConfirmTitle }}</h3>
                        <span v-if="workflowRoomHasUnsavedChanges" class="workflow-draft-badge">{{ t('groupChat.workflowUnsavedChanges') }}</span>
                    </div>
                    <div class="confirm-copy">
                        {{ workflowConfirmMode === 'save' ? t('groupChat.workflowChangeConfirm') : t('groupChat.workflowCloseConfirm') }}
                    </div>
                    <div v-if="workflowConfirmSummaryItems.length > 0" class="workflow-confirm-summary">
                        <div class="workflow-confirm-summary__title">{{ t('groupChat.workflowChangeSummaryTitle') }}</div>
                        <div class="workflow-confirm-summary__list">
                            <div v-for="(item, index) in workflowConfirmSummaryItems" :key="`${workflowConfirmMode}-${index}`" class="workflow-confirm-summary__item">
                                {{ item }}
                            </div>
                        </div>
                    </div>
                    <div v-if="workflowConfirmMode === 'save'" class="workflow-change-meta">
                        <div class="form-group">
                            <label class="form-label">{{ t('groupChat.workflowChangeSummary') }}</label>
                            <NInput
                                v-model:value="workflowChangeMeta.summary"
                                type="textarea"
                                :rows="3"
                                :placeholder="t('groupChat.workflowChangeSummaryPlaceholder')"
                            />
                        </div>
                        <div class="form-group">
                            <label class="form-label">{{ t('groupChat.workflowChangeImpactScope') }}</label>
                            <NInput
                                v-model:value="workflowChangeMeta.impactScope"
                                type="textarea"
                                :rows="3"
                                :placeholder="t('groupChat.workflowChangeImpactScopePlaceholder')"
                            />
                        </div>
                        <div class="form-group">
                            <label class="form-label">{{ t('groupChat.workflowChangeRollbackPlan') }}</label>
                            <NInput
                                v-model:value="workflowChangeMeta.rollbackPlan"
                                type="textarea"
                                :rows="3"
                                :placeholder="t('groupChat.workflowChangeRollbackPlanPlaceholder')"
                            />
                        </div>
                        <div class="form-group">
                            <label class="form-label">{{ t('groupChat.workflowChangeExecutionNotes') }}</label>
                            <NInput
                                v-model:value="workflowChangeMeta.executionNotes"
                                type="textarea"
                                :rows="3"
                                :placeholder="t('groupChat.workflowChangeExecutionNotesPlaceholder')"
                            />
                        </div>
                        <p class="form-hint">{{ t('groupChat.workflowChangeNoteHint') }}</p>
                    </div>
                    <div class="modal-actions">
                        <NSpace justify="end">
                            <NButton @click="closeWorkflowConfirmModal">{{ t('common.cancel') }}</NButton>
                            <NButton
                                :type="workflowConfirmMode === 'save' ? 'primary' : 'warning'"
                                @click="confirmWorkflowModalAction"
                            >
                                {{ workflowConfirmPrimaryText }}
                            </NButton>
                        </NSpace>
                    </div>
                </div>
            </div>
            <div v-if="showWorkflowTemplateApplyModal" class="modal-backdrop" @click.self="showWorkflowTemplateApplyModal = false">
                <div class="modal modal--confirm">
                    <h3>{{ t('groupChat.workflowTemplateApplyTitle') }}</h3>
                    <p class="confirm-copy">{{ t('groupChat.workflowTemplateApplyIntro') }}</p>
                    <div class="workflow-template-apply-summary">
                        <div>
                            <strong>{{ selectedWorkflowTemplate?.name || '-' }}</strong>
                            <span>{{ selectedWorkflowTemplate?.description || t('groupChat.workflowTemplateNoDescription') }}</span>
                        </div>
                        <div>
                            {{ t('groupChat.workflowTemplateApplyStats', {
                                roles: selectedWorkflowTemplateRequiredRoles.length,
                                agents: selectedWorkflowTemplateAgentCount,
                            }) }}
                        </div>
                        <div v-if="selectedWorkflowTemplateMissingRoles.length > 0" class="form-hint form-hint--warning">
                            {{ t('groupChat.workflowTemplateApplyMissingRoles', { roles: selectedWorkflowTemplateMissingRoles.join('、') }) }}
                        </div>
                    </div>
                    <NRadioGroup v-model:value="workflowTemplateApplyMode" class="workflow-template-apply-options">
                        <NRadio value="workflow-agents" :disabled="selectedWorkflowTemplateAgentCount === 0">
                            {{ t('groupChat.applyWorkflowTemplateWithAgents') }}
                            <span class="workflow-template-apply-option-hint">{{ t('groupChat.applyWorkflowTemplateWithAgentsHint') }}</span>
                        </NRadio>
                        <NRadio value="workflow-only">
                            {{ t('groupChat.applyWorkflowTemplateOnly') }}
                            <span class="workflow-template-apply-option-hint">{{ t('groupChat.applyWorkflowTemplateOnlyHint') }}</span>
                        </NRadio>
                    </NRadioGroup>
                    <div class="modal-actions">
                        <NSpace justify="end">
                            <NButton @click="showWorkflowTemplateApplyModal = false">{{ t('common.cancel') }}</NButton>
                            <NButton type="primary" @click="confirmApplyWorkflowTemplate">{{ t('groupChat.useWorkflowTemplate') }}</NButton>
                        </NSpace>
                    </div>
                </div>
            </div>
            <div v-if="showImportWorkflowModal" class="modal-backdrop" @click.self="showImportWorkflowModal = false">
                <div class="modal">
                    <h3>{{ t('groupChat.importWorkflowTemplate') }}</h3>
                    <div class="form-group">
                        <label class="form-label">{{ t('groupChat.workflowImportJson') }}</label>
                        <NInput
                            v-model:value="workflowImportJson"
                            type="textarea"
                            :rows="12"
                            :placeholder="t('groupChat.workflowImportJsonPlaceholder')"
                        />
                    </div>
                    <div class="modal-actions">
                        <NSpace justify="end">
                            <NButton @click="showImportWorkflowModal = false">{{ t('common.cancel') }}</NButton>
                            <NButton type="primary" @click="handleImportWorkflowTemplate">{{ t('common.save') }}</NButton>
                        </NSpace>
                    </div>
                </div>
            </div>
            <div v-if="showCompressionModal" class="modal-backdrop" @click.self="showCompressionModal = false">
                <div class="modal">
                    <h3>{{ t('groupChat.compressionConfig') }}</h3>
                    <div class="form-group">
                        <label class="form-label">{{ t('groupChat.triggerTokens') }}</label>
                        <NInputNumber v-model:value="compressionConfig.triggerTokens" :min="1000" :step="10000" style="width: 100%" />
                        <p class="form-hint">{{ t('groupChat.triggerTokensDesc') }}</p>
                    </div>
                    <div class="form-group">
                        <label class="form-label">{{ t('groupChat.maxHistoryTokens') }}</label>
                        <NInputNumber v-model:value="compressionConfig.maxHistoryTokens" :min="1000" :step="1000" style="width: 100%" />
                        <p class="form-hint">{{ t('groupChat.maxHistoryTokensDesc') }}</p>
                    </div>
                    <div class="form-group">
                        <label class="form-label">{{ t('groupChat.tailMessageCount') }}</label>
                        <NInputNumber v-model:value="compressionConfig.tailMessageCount" :min="1" :step="5" style="width: 100%" />
                        <p class="form-hint">{{ t('groupChat.tailMessageCountDesc') }}</p>
                    </div>
                    <div style="margin-top: 8px">
                        <NButton
                            block
                            :disabled="isCompressing || store.contextStatuses.size > 0"
                            :loading="isCompressing"
                            @click="handleForceCompress"
                        >
                            {{ isCompressing ? t('groupChat.compressingInProgress') : t('groupChat.compressNow') }}
                        </NButton>
                    </div>
                    <div class="modal-actions">
                        <NSpace justify="end">
                            <NButton @click="showCompressionModal = false">{{ t('common.cancel') }}</NButton>
                            <NButton type="primary" @click="handleSaveCompressionConfig">{{ t('common.save') }}</NButton>
                        </NSpace>
                    </div>
                </div>
            </div>
            <div v-if="showArtifactsModal" class="modal-backdrop" @click.self="showArtifactsModal = false">
                <div class="modal modal--workflow">
                    <h3>{{ t('groupChat.artifacts') }}</h3>
                    <div class="modal-body modal-body--workflow">
                        <div class="workflow-preview">
                            <div class="workflow-preview__title">{{ t('groupChat.artifactRootDir') }}</div>
                            <div class="workflow-preview__source">{{ store.artifactRootDir || '-' }}</div>
                        </div>
                        <div class="artifacts-layout">
                            <div class="artifacts-browser">
                                <div class="workflow-stage-header">
                                    <label class="form-label">{{ t('groupChat.artifactDirectory') }}</label>
                                    <NButton size="small" secondary :disabled="!store.artifactCurrentPath" @click="handleOpenArtifactParent">
                                        {{ t('groupChat.artifactGoParent') }}
                                    </NButton>
                                </div>
                                <p class="form-hint">{{ store.artifactCurrentPath || '/' }}</p>
                                <div v-if="store.artifactEntries.length === 0" class="workflow-empty">
                                    {{ t('groupChat.artifactEmpty') }}
                                </div>
                                <button
                                    v-for="entry in store.artifactEntries"
                                    :key="entry.relativePath || entry.name"
                                    class="artifact-entry"
                                    @click="handleOpenArtifactPath(entry.relativePath, entry.type)"
                                >
                                    <span class="artifact-entry__icon">{{ entry.type === 'directory' ? 'DIR' : 'FILE' }}</span>
                                    <span class="artifact-entry__name">{{ entry.name }}</span>
                                </button>
                            </div>
                            <div class="artifacts-preview">
                                <div class="workflow-stage-header">
                                    <label class="form-label">{{ t('groupChat.artifactPreview') }}</label>
                                    <span class="form-hint">{{ store.artifactCurrentFile?.fileName || t('groupChat.artifactNotSelected') }}</span>
                                </div>
                                <div v-if="!store.artifactCurrentFile" class="workflow-empty">
                                    {{ t('groupChat.artifactSelectHint') }}
                                </div>
                                <NInput
                                    v-else
                                    :value="store.artifactCurrentFile.content"
                                    type="textarea"
                                    :rows="24"
                                    readonly
                                />
                            </div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <NSpace justify="end">
                            <NButton @click="showArtifactsModal = false">{{ t('common.close') }}</NButton>
                        </NSpace>
                    </div>
                </div>
            </div>
            <div v-if="showChangeHistoryModal" class="modal-backdrop" @click.self="showChangeHistoryModal = false">
                <div class="modal modal--workflow">
                    <h3>{{ t('groupChat.changeHistory') }}</h3>
                    <div class="modal-body modal-body--workflow">
                        <div v-if="changeHistoryMessages.length === 0" class="workflow-empty">
                            {{ t('groupChat.changeHistoryEmpty') }}
                        </div>
                        <div v-else class="change-history-list">
                            <div v-for="item in changeHistoryMessages" :key="item.id" class="change-history-card">
                                <div class="change-history-card__meta">
                                    <span class="change-history-card__name">{{ item.title }}</span>
                                    <span class="change-history-card__status">{{ item.status }}</span>
                                    <span class="change-history-card__time">{{ new Date(item.time).toLocaleString() }}</span>
                                </div>
                                <pre class="change-history-card__content">{{ item.content }}</pre>
                            </div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <NSpace justify="end">
                            <NButton @click="showChangeHistoryModal = false">{{ t('common.close') }}</NButton>
                        </NSpace>
                    </div>
                </div>
            </div>
            <div v-if="showProjectModal" class="modal-backdrop" @click.self="showProjectModal = false">
                <div class="modal modal--workflow">
                    <h3>{{ t('groupChat.project') }}</h3>
                    <div class="modal-body modal-body--workflow">
                        <div class="form-group">
                            <label class="form-label">{{ t('groupChat.projectExistingList') }}</label>
                            <NSelect
                                v-model:value="selectedExistingProjectId"
                                :options="availableProjectOptions"
                                clearable
                                filterable
                                :placeholder="t('groupChat.projectExistingPlaceholder')"
                            />
                            <p class="form-hint">{{ t('groupChat.projectExistingHint') }}</p>
                        </div>
                        <div class="modal-actions" style="padding-top: 0; margin-top: 0;">
                            <NSpace justify="end">
                                <NButton :disabled="!selectedExistingProjectId" @click="handleBindExistingProject">{{ t('groupChat.bindExistingProject') }}</NButton>
                            </NSpace>
                        </div>
                        <div class="form-grid">
                            <div class="form-group">
                                <label class="form-label">{{ t('groupChat.projectName') }}</label>
                                <NInput v-model:value="projectBindName" :placeholder="t('groupChat.projectNamePlaceholder')" />
                            </div>
                            <div class="form-group">
                                <label class="form-label">{{ t('groupChat.projectDescription') }}</label>
                                <NInput v-model:value="projectBindDescription" :placeholder="t('groupChat.projectDescriptionPlaceholder')" />
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">{{ t('groupChat.projectLocalPath') }}</label>
                            <NInput v-model:value="projectBindLocalPath" :placeholder="t('groupChat.projectLocalPathPlaceholder')" />
                            <p class="form-hint">{{ t('groupChat.projectLocalPathHint') }}</p>
                        </div>
                        <div class="modal-actions" style="padding-top: 0; margin-top: 0;">
                            <NSpace justify="end">
                                <NButton type="primary" @click="handleBindLocalProject">{{ t('groupChat.bindLocalProject') }}</NButton>
                            </NSpace>
                        </div>

                        <div v-if="currentProjectSummary" class="project-overview">
                            <div class="workflow-preview">
                                <div class="workflow-preview__title">{{ currentProjectSummary.name }}</div>
                                <div class="workflow-preview__source">{{ currentProjectSummary.localPath }}</div>
                            </div>
                            <div class="project-meta-grid">
                                <div class="project-meta-card">
                                    <div class="project-meta-card__label">{{ t('groupChat.projectRepoUrl') }}</div>
                                    <div class="project-meta-card__value">{{ currentProjectSummary.repoUrl || '-' }}</div>
                                </div>
                                <div class="project-meta-card">
                                    <div class="project-meta-card__label">{{ t('groupChat.projectCurrentBranch') }}</div>
                                    <div class="project-meta-card__value">{{ currentProjectSummary.currentBranch || '-' }}</div>
                                </div>
                                <div class="project-meta-card">
                                    <div class="project-meta-card__label">{{ t('groupChat.projectDefaultBranch') }}</div>
                                    <div class="project-meta-card__value">{{ currentProjectSummary.defaultBranch || '-' }}</div>
                                </div>
                                <div class="project-meta-card">
                                    <div class="project-meta-card__label">{{ t('groupChat.projectPermissions') }}</div>
                                    <div class="project-meta-card__value">
                                        {{ currentProjectBinding?.allowRead ? 'R' : '-' }}/{{ currentProjectBinding?.allowWrite ? 'W' : '-' }}/{{ currentProjectBinding?.allowCommit ? 'C' : '-' }}/{{ currentProjectBinding?.allowPush ? 'P' : '-' }}
                                    </div>
                                </div>
                            </div>

                            <div class="artifacts-layout">
                                <div class="artifacts-browser">
                                    <div class="artifacts-browser__header">
                                        <span>{{ t('groupChat.projectFiles') }}</span>
                                        <button
                                            v-if="store.projectCurrentPath"
                                            class="mini-action-btn"
                                            @click="handleOpenProjectParent"
                                        >
                                            {{ t('groupChat.projectGoParent') }}
                                        </button>
                                    </div>
                                    <div class="artifacts-path">{{ store.projectCurrentPath || '/' }}</div>
                                    <div v-if="store.projectEntries.length === 0" class="workflow-empty">
                                        {{ t('groupChat.projectFilesEmpty') }}
                                    </div>
                                    <div
                                        v-for="entry in store.projectEntries"
                                        :key="entry.path"
                                        class="artifact-entry"
                                        @click="handleOpenProjectPath(entry.path, entry.type)"
                                    >
                                        <div>
                                            <div class="artifact-entry__name">{{ entry.name }}</div>
                                            <div class="artifact-entry__meta">{{ entry.type === 'directory' ? 'DIR' : `${entry.size} B` }}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="artifacts-preview">
                                    <div class="artifacts-browser__header">
                                        <span>{{ t('groupChat.projectFilePreview') }}</span>
                                    </div>
                                    <div v-if="!store.projectCurrentFile" class="workflow-empty">
                                        {{ t('groupChat.projectFileNotSelected') }}
                                    </div>
                                    <template v-else>
                                        <div class="artifacts-path">{{ store.projectCurrentFile.relativePath }}</div>
                                        <pre class="artifact-content">{{ store.projectCurrentFile.content }}</pre>
                                    </template>
                                </div>
                            </div>

                            <div class="project-meta-grid" style="margin-top: 16px;">
                                <div class="project-meta-card">
                                    <div class="project-meta-card__label">{{ t('groupChat.projectGitStatus') }}</div>
                                    <div class="project-meta-card__value">
                                        {{ t('groupChat.projectGitStatusSummary', {
                                            staged: store.projectGitStatus?.staged.length || 0,
                                            modified: store.projectGitStatus?.modified.length || 0,
                                            untracked: store.projectGitStatus?.untracked.length || 0,
                                        }) }}
                                    </div>
                                </div>
                                <div class="project-meta-card">
                                    <div class="project-meta-card__label">{{ t('groupChat.projectBranches') }}</div>
                                    <div class="project-meta-card__value">
                                        {{ (store.projectGitBranches?.localBranches || []).join(', ') || '-' }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <NSpace justify="end">
                            <NButton @click="showProjectModal = false">{{ t('common.close') }}</NButton>
                        </NSpace>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import CreateRoomForm from './CreateRoomForm.vue'

export default defineComponent({ components: { CreateRoomForm } })
</script>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.group-chat-panel {
    display: flex;
    height: 100%;
    overflow: hidden;
    position: relative;
}

.sidebar-backdrop {
    display: none;
}

@media (max-width: $breakpoint-mobile) {
    .sidebar-backdrop {
        display: block;
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: 99;
        opacity: 0;
        pointer-events: none;
        transition: opacity $transition-fast;

        &.active {
            opacity: 1;
            pointer-events: auto;
        }
    }
}

// ─── Status Bar ──────────────────────────────────────────

.workflow-live-banner {
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 14px;
    padding: 12px 20px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.16);
    background:
        linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.1), rgba(var(--accent-primary-rgb), 0.04)),
        rgba(248, 250, 252, 0.9);
}

.workflow-live-banner--empty {
    padding-top: 10px;
    padding-bottom: 10px;
}

.gateway-status-banner {
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 20px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.16);
    background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.08), rgba(var(--accent-primary-rgb), 0.03));
    flex-wrap: wrap;
}

.gateway-status-banner--down {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.04));
}

.gateway-status-banner__main,
.gateway-status-banner__detail {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.gateway-status-banner__summary,
.workflow-live-banner__summary {
    appearance: none;
    border: none;
    background: transparent;
    padding: 0;
    text-align: left;
    cursor: pointer;
}

.workflow-live-banner__summary--static {
    cursor: default;
}

.gateway-status-banner__summary {
    flex: 1 1 360px;
    min-width: min(100%, 280px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.gateway-status-banner__summary-main,
.gateway-status-banner__summary-side {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.gateway-status-banner__summary-side {
    align-items: flex-end;
}

.gateway-status-banner__label,
.gateway-status-banner__meta,
.gateway-status-banner__hint {
    font-size: 12px;
    color: $text-muted;
}

.gateway-status-banner__value {
    font-size: 14px;
    font-weight: 700;
    color: $text-primary;
}

.gateway-status-banner__actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
    flex-wrap: wrap;
}

.gateway-status-banner__toggle,
.workflow-live-banner__toggle {
    font-size: 11px;
    font-weight: 700;
    color: rgba(var(--accent-primary-rgb), 0.84);
    white-space: nowrap;
}

.workflow-live-banner__summary {
    flex: 1 1 360px;
    min-width: min(100%, 280px);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.workflow-live-banner__label {
    font-size: 11px;
    font-weight: 700;
    color: rgba(var(--accent-primary-rgb), 0.92);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.workflow-live-banner__title {
    display: inline-block;
    min-width: 0;
    font-size: 14px;
    font-weight: 700;
    line-height: 1.45;
    color: $text-primary;
    overflow-wrap: anywhere;
}

.workflow-live-banner__track {
    width: 100%;
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 2px;

    &::-webkit-scrollbar {
        height: 0;
    }
}

.workflow-live-banner__track-node {
    position: relative;
    min-width: 140px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(255, 255, 255, 0.72);
    transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background-color 180ms ease;

    &:not(:last-child)::after {
        content: '';
        position: absolute;
        right: -10px;
        top: 50%;
        width: 10px;
        height: 1px;
        background: rgba(148, 163, 184, 0.35);
        transform: translateY(-50%);
    }

    &--current {
        transform: translateY(-1px);
        box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
        animation: workflow-node-pulse 1.8s ease-in-out infinite;
    }

    &--active {
        border-color: rgba(20, 184, 166, 0.28);
        background: linear-gradient(135deg, rgba(20, 184, 166, 0.16), rgba(20, 184, 166, 0.06));
    }

    &--warning {
        border-color: rgba(245, 158, 11, 0.28);
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(245, 158, 11, 0.06));
    }

    &--success,
    &--done {
        border-color: rgba(34, 197, 94, 0.24);
        background: linear-gradient(135deg, rgba(34, 197, 94, 0.14), rgba(34, 197, 94, 0.05));
    }
}

.workflow-live-banner__track-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    flex-shrink: 0;
    background: rgba(148, 163, 184, 0.72);
    box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.12);

    .workflow-live-banner__track-node--active & {
        background: #0f766e;
        box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.18);
    }

    .workflow-live-banner__track-node--warning & {
        background: #d97706;
        box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.18);
    }

    .workflow-live-banner__track-node--success &,
    .workflow-live-banner__track-node--done & {
        background: #15803d;
        box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.16);
    }
}

.workflow-live-banner__track-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.workflow-live-banner__track-title {
    font-size: 12px;
    font-weight: 700;
    line-height: 1.45;
    color: $text-primary;
    overflow-wrap: anywhere;
}

.workflow-live-banner__track-role {
    font-size: 11px;
    color: $text-muted;
    line-height: 1.35;
    overflow-wrap: anywhere;
}

.workflow-live-banner__badge {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 11px;
    font-weight: 700;
    border: 1px solid transparent;

    &--active {
        color: #0f766e;
        background: rgba(20, 184, 166, 0.12);
        border-color: rgba(20, 184, 166, 0.2);
    }

    &--warning {
        color: #b45309;
        background: rgba(245, 158, 11, 0.14);
        border-color: rgba(245, 158, 11, 0.22);
    }

    &--success {
        color: #166534;
        background: rgba(34, 197, 94, 0.12);
        border-color: rgba(34, 197, 94, 0.2);
    }

    &--idle {
        color: #475569;
        background: rgba(148, 163, 184, 0.14);
        border-color: rgba(148, 163, 184, 0.22);
    }
}

.workflow-live-banner__owner {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(148, 163, 184, 0.18);
    flex: 1 1 220px;
    min-width: 0;
}

.workflow-live-banner__owner-label {
    font-size: 11px;
    font-weight: 600;
    color: $text-muted;
}

.workflow-live-banner__owner-name {
    font-size: 13px;
    font-weight: 700;
    line-height: 1.5;
    color: $text-primary;
    overflow-wrap: anywhere;
}

.workflow-live-banner__actions {
    margin-left: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-start;
    width: 100%;
}

.workflow-live-banner__approval {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 220px;
}

.workflow-live-banner__approval--attention {
    flex: 1 1 360px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(245, 158, 11, 0.24);
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(255, 255, 255, 0.76));
}

.workflow-live-banner__approval-title {
    font-size: 12px;
    font-weight: 700;
    color: $text-primary;
}

.workflow-live-banner__approval-hint,
.workflow-live-banner__approval-artifact {
    font-size: 12px;
    color: $text-secondary;
}

.workflow-live-banner__approval-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 5px;
}

.workflow-live-banner__approval-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
}

.workflow-live-banner__approval-buttons .n-button {
    white-space: nowrap;
}

.workflow-live-banner__completed-note {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(34, 197, 94, 0.2);
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(255, 255, 255, 0.72));
}

.workflow-live-banner__completed-title {
    font-size: 12px;
    font-weight: 800;
    color: #166534;
}

.workflow-live-banner__completed-copy {
    font-size: 12px;
    line-height: 1.6;
    color: $text-secondary;
}

.approval-spotlight {
    flex-shrink: 0;
    margin: 0 20px 12px;
    padding: 16px 18px;
    border-radius: 18px;
    border: 1px solid rgba(245, 158, 11, 0.24);
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(255, 255, 255, 0.92));
    box-shadow: 0 18px 36px rgba(245, 158, 11, 0.12);
}

.approval-spotlight--locked {
    border-color: rgba(148, 163, 184, 0.24);
    background: linear-gradient(135deg, rgba(148, 163, 184, 0.14), rgba(255, 255, 255, 0.92));
    box-shadow: 0 18px 36px rgba(148, 163, 184, 0.1);
}

.approval-spotlight__eyebrow {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #b45309;
    background: rgba(255, 255, 255, 0.72);
}

.approval-spotlight--locked .approval-spotlight__eyebrow {
    color: #475569;
}

.approval-spotlight__layout {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
    margin-top: 12px;
}

.approval-spotlight__main {
    flex: 1 1 auto;
    min-width: 0;
}

.approval-spotlight__title {
    margin: 0;
    font-size: 18px;
    line-height: 1.35;
    font-weight: 800;
    color: $text-primary;
}

.approval-spotlight__body {
    margin: 8px 0 0;
    font-size: 13px;
    line-height: 1.7;
    color: $text-secondary;
}

.approval-spotlight__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 14px;
}

.approval-spotlight__meta-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 160px;
    padding: 10px 12px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(148, 163, 184, 0.16);
}

.approval-spotlight__meta-label {
    font-size: 11px;
    font-weight: 700;
    color: $text-muted;
}

.approval-spotlight__meta-value {
    font-size: 13px;
    font-weight: 700;
    line-height: 1.5;
    color: $text-primary;
    overflow-wrap: anywhere;
}

.approval-spotlight__note {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.6;
    color: #92400e;
}

.approval-spotlight__actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 180px;
}

.approval-spotlight__actions .n-button {
    justify-content: center;
}

.live-status-strip {
    flex-shrink: 0;
    margin: 0 20px 12px;
    padding: 14px 16px;
    border-radius: 18px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.92));
    box-shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
}

.live-status-strip--active {
    border-color: rgba(var(--accent-primary-rgb), 0.18);
    background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.1), rgba(255, 255, 255, 0.96));
}

.live-status-strip--warning {
    border-color: rgba(245, 158, 11, 0.24);
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(255, 255, 255, 0.94));
}

.live-status-strip--locked,
.live-status-strip--idle {
    border-color: rgba(148, 163, 184, 0.22);
    background: linear-gradient(135deg, rgba(148, 163, 184, 0.12), rgba(255, 255, 255, 0.94));
}

.live-status-strip--success {
    border-color: rgba(34, 197, 94, 0.22);
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(255, 255, 255, 0.94));
}

.live-status-strip--ready {
    border-color: rgba(59, 130, 246, 0.18);
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(255, 255, 255, 0.96));
}

.live-status-strip__main {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.live-status-strip__eyebrow {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: $text-primary;
    background: rgba(255, 255, 255, 0.78);
}

.live-status-strip__title {
    margin: 0;
    font-size: 18px;
    line-height: 1.35;
    font-weight: 800;
    color: $text-primary;
}

.live-status-strip__summary {
    margin: 0;
    font-size: 13px;
    line-height: 1.7;
    color: $text-secondary;
}

.live-status-strip__meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 14px;
}

.live-status-strip__meta-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    padding: 10px 12px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.74);
    border: 1px solid rgba(148, 163, 184, 0.16);
}

.live-status-strip__meta-label {
    font-size: 11px;
    font-weight: 700;
    color: $text-muted;
}

.live-status-strip__meta-value {
    font-size: 13px;
    font-weight: 700;
    line-height: 1.5;
    color: $text-primary;
    overflow-wrap: anywhere;
}

.live-status-strip__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 14px;
}

.live-status-strip__actions .n-button {
    justify-content: center;
    white-space: nowrap;
}

.workflow-ready-spotlight {
    flex-shrink: 0;
    margin: 0 20px 12px;
    padding: 16px 18px;
    border-radius: 18px;
    border: 1px solid rgba(var(--accent-primary-rgb), 0.16);
    background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.1), rgba(255, 255, 255, 0.94));
    box-shadow: 0 18px 36px rgba(var(--accent-primary-rgb), 0.08);
}

.workflow-ready-spotlight__eyebrow {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: $accent-primary;
    background: rgba(255, 255, 255, 0.76);
}

.workflow-ready-spotlight__layout {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
    margin-top: 12px;
}

.workflow-ready-spotlight__main {
    flex: 1 1 auto;
    min-width: 0;
}

.workflow-ready-spotlight__title {
    margin: 0;
    font-size: 18px;
    line-height: 1.35;
    font-weight: 800;
    color: $text-primary;
}

.workflow-ready-spotlight__body {
    margin: 8px 0 0;
    font-size: 13px;
    line-height: 1.7;
    color: $text-secondary;
}

.workflow-ready-spotlight__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 14px;
}

.workflow-ready-spotlight__meta-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 160px;
    padding: 10px 12px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(148, 163, 184, 0.16);
}

.workflow-ready-spotlight__meta-label {
    font-size: 11px;
    font-weight: 700;
    color: $text-muted;
}

.workflow-ready-spotlight__meta-value {
    font-size: 13px;
    font-weight: 700;
    line-height: 1.5;
    color: $text-primary;
    overflow-wrap: anywhere;
}

.workflow-ready-spotlight__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 14px;
}

.workflow-ready-spotlight__chip {
    border: 0;
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 600;
    color: $accent-primary;
    background: rgba(var(--accent-primary-rgb), 0.1);
    cursor: pointer;
    transition: background-color 0.2s ease, transform 0.2s ease;

    &:hover {
        background: rgba(var(--accent-primary-rgb), 0.16);
        transform: translateY(-1px);
    }
}

.workflow-ready-spotlight__actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 180px;
}

.workflow-ready-spotlight__actions .n-button {
    justify-content: center;
}

.status-bar {
    flex-shrink: 0;
    padding: 8px 20px 10px;
    overflow: hidden;
}

.context-status-list {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    flex-wrap: nowrap;

    &::-webkit-scrollbar {
        height: 0;
    }
}

.context-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    font-size: 12px;
    color: $text-secondary;
    background: rgba(var(--accent-primary-rgb), 0.08);
    border: 1px solid rgba(var(--accent-primary-rgb), 0.14);
    border-radius: 999px;

    .dark & {
        background-color: rgba(255, 255, 255, 0.06);
    }
}

.context-status__agent {
    font-weight: 700;
    color: $text-primary;
}

.context-status__label {
    color: $text-secondary;
}

.modal--approval {
    width: min(560px, calc(100vw - 32px));
}

.typing-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: $text-muted;
}

.typing-dots {
    display: inline-flex;
    align-items: center;
    gap: 2px;

    span {
        display: block;
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background-color: $text-muted;
        animation: typing-bounce 1.2s infinite;

        &:nth-child(2) { animation-delay: 0.2s; }
        &:nth-child(3) { animation-delay: 0.4s; }
    }
}

@keyframes typing-bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-3px); opacity: 1; }
}

@keyframes workflow-node-pulse {
    0%, 100% { box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08); }
    50% { box-shadow: 0 16px 30px rgba(var(--accent-primary-rgb), 0.16); }
}

// ─── Room Sidebar ────────────────────────────────────────

.room-sidebar {
    width: 220px;
    flex-shrink: 0;
    border-right: 1px solid $border-color;
    display: flex;
    flex-direction: column;
}

.sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    flex-shrink: 0;

    .sidebar-title {
        font-size: 15px;
        font-weight: 600;
        color: $text-primary;
    }

    .sidebar-actions {
        display: flex;
        gap: 4px;
    }
}

.room-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
}

.room-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border-radius: $radius-sm;
    cursor: pointer;
    transition: background-color $transition-fast;

    &:hover {
        background-color: rgba(var(--accent-primary-rgb), 0.06);
    }

    &.active {
        background-color: rgba(var(--accent-primary-rgb), 0.12);
    }

    .room-icon {
        color: $text-muted;
        flex-shrink: 0;
    }

    .room-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
    }

    .room-name-row {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }

    .room-name {
        font-size: 13px;
        color: $text-primary;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .room-badge {
        flex-shrink: 0;
        font-size: 10px;
        font-weight: 600;
        color: $accent-primary;
        background: rgba(var(--accent-primary-rgb), 0.12);
        border: 1px solid rgba(var(--accent-primary-rgb), 0.18);
        border-radius: 999px;
        padding: 1px 6px;
    }

    .room-status-badge {
        flex-shrink: 0;
        font-size: 10px;
        font-weight: 700;
        color: #6b7280;
        background: rgba(107, 114, 128, 0.12);
        border: 1px solid rgba(107, 114, 128, 0.2);
        border-radius: 999px;
        padding: 1px 6px;

        &.room-status-badge--active {
            color: #166534;
            background: rgba(34, 197, 94, 0.12);
            border-color: rgba(34, 197, 94, 0.24);
        }
    }

    .room-code {
        font-size: 11px;
        color: $text-muted;
        font-family: $font-code;
    }

    .room-tokens {
        font-size: 11px;
        color: $text-muted;
    }

    .room-delete-btn {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        color: $text-muted;
        cursor: pointer;
        border-radius: $radius-sm;
        opacity: 0;
        transition: opacity $transition-fast, color $transition-fast, background-color $transition-fast;

        &:hover {
            color: $error;
            background-color: rgba(var(--error-rgb), 0.1);
        }
    }

    &:hover .room-delete-btn {
        opacity: 1;
    }
}

.empty-rooms {
    padding: 20px 12px;
    text-align: center;
    font-size: 13px;
    color: $text-muted;
}

// ─── Chat Main ──────────────────────────────────────────

.chat-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    background-color: transparent;
}

.modal-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.workflow-draft-badge {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 700;
    color: #b45309;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.28);
    border-radius: 999px;
    padding: 4px 10px;
}

.form-hint--warning {
    color: #b45309;
}

.modal--confirm {
    width: min(720px, calc(100vw - 32px));
}

.confirm-copy {
    color: var(--n-text-color, #334155);
    font-size: 14px;
    line-height: 1.6;
}

.workflow-confirm-summary {
    margin-top: 16px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 14px;
    background: rgba(248, 250, 252, 0.88);
    padding: 14px;
}

.workflow-confirm-summary__title {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 10px;
}

.workflow-confirm-summary__list {
    max-height: 320px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 4px;
}

.workflow-confirm-summary__item {
    position: relative;
    padding-left: 14px;
    color: #334155;
    font-size: 13px;
    line-height: 1.6;
}

.workflow-confirm-summary__item::before {
    content: '';
    position: absolute;
    left: 0;
    top: 8px;
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: rgba(var(--accent-primary-rgb), 0.75);
}

.workflow-change-meta {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.workflow-template-apply-summary {
    margin-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 14px;
    background: rgba(248, 250, 252, 0.88);
    color: #334155;
    font-size: 13px;

    strong,
    span {
        display: block;
    }

    span {
        margin-top: 4px;
        color: $text-secondary;
        line-height: 1.5;
    }
}

.workflow-template-apply-options {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.workflow-template-apply-option-hint {
    display: block;
    margin-top: 4px;
    color: $text-muted;
    font-size: 12px;
    line-height: 1.5;
}

.change-history-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.change-history-card {
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 14px;
    background: rgba(248, 250, 252, 0.9);
    padding: 14px;
}

.change-history-card__meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 10px;
}

.change-history-card__name {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
}

.change-history-card__time {
    margin-left: auto;
    font-size: 12px;
    color: #64748b;
}

.change-history-card__status {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 700;
    color: #1f6f8b;
    background: rgba(var(--accent-primary-rgb), 0.1);
    border: 1px solid rgba(var(--accent-primary-rgb), 0.16);
}

.change-history-card__content {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    line-height: 1.65;
    color: #334155;
    background: rgba(255, 255, 255, 0.72);
    border-radius: 10px;
    padding: 12px;
}

.project-overview {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.project-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}

.project-meta-card {
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 14px;
    background: rgba(248, 250, 252, 0.9);
    padding: 14px;
}

.project-meta-card__label {
    font-size: 12px;
    color: #64748b;
    margin-bottom: 6px;
}

.project-meta-card__value {
    font-size: 13px;
    line-height: 1.6;
    color: #0f172a;
    word-break: break-word;
}

.chat-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 21px 20px;
    border-bottom: 1px solid $border-color;

    .room-title-text {
        font-size: 16px;
        font-weight: 600;
        color: $text-primary;
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .header-info {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
    }

    .member-count {
        font-size: 12px;
        color: $text-muted;
    }
}

@media (max-width: 860px) {
    .workflow-live-banner {
        flex-direction: column;
        align-items: flex-start;
    }

    .gateway-status-banner {
        flex-direction: column;
    }

    .gateway-status-banner__summary {
        width: 100%;
        align-items: flex-start;
        flex-direction: column;
    }

    .gateway-status-banner__summary-side {
        align-items: flex-start;
    }

    .workflow-live-banner__owner {
        width: 100%;
        justify-content: space-between;
    }

    .workflow-live-banner__actions {
        width: 100%;
        margin-left: 0;
        justify-content: flex-start;
    }

    .workflow-live-banner__approval {
        min-width: 0;
        width: 100%;
    }

    .approval-spotlight {
        margin: 0 12px 12px;
        padding: 14px;
    }

    .approval-spotlight__layout {
        flex-direction: column;
    }

    .approval-spotlight__actions {
        width: 100%;
        min-width: 0;
    }

    .live-status-strip {
        margin: 0 12px 12px;
        padding: 14px;
    }

    .live-status-strip__meta {
        grid-template-columns: 1fr;
    }

    .workflow-ready-spotlight {
        margin: 0 12px 12px;
        padding: 14px;
    }

    .workflow-ready-spotlight__layout {
        flex-direction: column;
    }

    .workflow-ready-spotlight__actions {
        width: 100%;
        min-width: 0;
    }

    .identity-chip {
        max-width: 100%;
    }
}

// ─── Header Avatar Stack ──────────────────────────────

.avatar-stack {
    cursor: pointer;
}

.avatar-stack-inner {
    display: flex;
    align-items: center;
}

.avatar-stack-item {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid $bg-card;
    margin-left: -12px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: $bg-secondary;
    transition: transform $transition-fast;

    &:first-child {
        margin-left: 0;
    }

    &:hover {
        transform: translateY(-2px);
        z-index: 100 !important;
    }
}

.avatar-stack-more {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid $bg-card;
    margin-left: -12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: $bg-secondary;
    font-size: 11px;
    font-weight: 600;
    color: $text-secondary;
}

.agent-avatar {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
    }

    :deep(svg) {
        width: 100%;
        height: 100%;
    }
}

.avatar-picker {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
    gap: 8px;
    margin-bottom: 10px;
}

.avatar-picker__item {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding: 7px 8px;
    border: 1px solid $border-color;
    border-radius: $radius-sm;
    background: $bg-card;
    color: $text-secondary;
    font-size: 12px;
    cursor: pointer;
    transition: border-color $transition-fast, background $transition-fast;

    &:hover,
    &.active {
        border-color: rgba(var(--accent-primary-rgb), 0.4);
        background: rgba(var(--accent-primary-rgb), 0.06);
        color: $text-primary;
    }

    .agent-avatar {
        width: 24px;
        height: 24px;
        flex-shrink: 0;
    }
}

.identity-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    max-width: 178px;
    padding: 0 10px;
    border: 1px solid rgba(var(--accent-primary-rgb), 0.18);
    background: rgba(var(--accent-primary-rgb), 0.06);
    border-radius: 999px;
    color: $text-secondary;
    cursor: pointer;
    transition: border-color $transition-fast, background-color $transition-fast, color $transition-fast;

    &:hover {
        border-color: rgba(var(--accent-primary-rgb), 0.34);
        background: rgba(var(--accent-primary-rgb), 0.1);
        color: $text-primary;
    }

    strong {
        min-width: 0;
        font-size: 12px;
        font-weight: 700;
        color: $text-primary;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
}

.identity-chip__label {
    font-size: 11px;
    color: $text-muted;
    white-space: nowrap;
}

// ─── Agent Popover ─────────────────────────────────────

.agent-popover {
    max-height: 360px;
    overflow-y: auto;
}

.agent-popover-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    color: $text-muted;
    padding: 0 0 8px;
    border-bottom: 1px solid $border-color;
    margin-bottom: 8px;
}

.agent-popover-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
}

.mini-action-btn {
    border: 1px solid $border-color;
    background: transparent;
    color: $text-secondary;
    border-radius: $radius-sm;
    padding: 2px 6px;
    font-size: 11px;
    cursor: pointer;
    transition: all $transition-fast;

    &:hover {
        border-color: $accent-primary;
        color: $accent-primary;
    }
}

.agent-popover-item {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 8px 6px;
    border-radius: $radius-sm;
    transition: background-color $transition-fast;

    &.agent-popover-item--self {
        margin-bottom: 8px;
        padding-bottom: 12px;
        border-bottom: 1px solid $border-color;
        border-radius: 0;

        &:hover {
            background-color: transparent;
        }
    }

    .agent-popover-avatar {
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        overflow: hidden;
        border-radius: 10px;
        background-color: $bg-secondary;
        border: 1px solid rgba(var(--accent-primary-rgb), 0.08);
        box-shadow: 0 1px 0 rgba(var(--accent-primary-rgb), 0.04);

        img {
            border-radius: 10px;
        }
    }

    &:hover {
        background-color: rgba(var(--accent-primary-rgb), 0.06);
    }

    .agent-popover-info {
        flex: 1;
        min-width: 0;
    }

    .agent-popover-name {
        display: block;
        font-size: 13px;
        color: $text-primary;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .agent-popover-profile {
        display: block;
        font-size: 11px;
        color: $text-muted;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .agent-popover-remove {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border: none;
        background: none;
        border-radius: $radius-sm;
        color: $text-muted;
        cursor: pointer;
        flex-shrink: 0;
        transition: all $transition-fast;

        &:hover {
            color: $error;
            background-color: rgba(200, 50, 50, 0.08);
        }
    }
}

// ─── No Room State ────────────────────────────────────────

.no-room {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: $text-muted;

    .no-room-icon {
        opacity: 0.3;
    }

    p {
        font-size: 14px;
    }
}

// ─── Shared ──────────────────────────────────────────────

.icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    border-radius: $radius-sm;
    color: $text-secondary;
    cursor: pointer;
    transition: all $transition-fast;

    &:hover {
        background-color: rgba(var(--accent-primary-rgb), 0.08);
        color: $text-primary;
    }
}

.header-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 10px;
    border: 1px solid $border-color;
    background: rgba(var(--accent-primary-rgb), 0.04);
    border-radius: $radius-sm;
    color: $text-secondary;
    cursor: pointer;
    transition: all $transition-fast;
    flex-shrink: 0;

    &:hover {
        border-color: rgba(var(--accent-primary-rgb), 0.2);
        background: rgba(var(--accent-primary-rgb), 0.08);
        color: $text-primary;
    }

    span {
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
    }
}

.header-action-btn--accent {
    border-color: rgba(var(--accent-primary-rgb), 0.28);
    background: rgba(var(--accent-primary-rgb), 0.08);
}

.modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal {
    background: $bg-card;
    border-radius: $radius-lg;
    padding: 24px;
    width: 460px;
    max-width: 90vw;
    max-height: 86vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);

    h3 {
        font-size: 16px;
        font-weight: 600;
        color: $text-primary;
        margin: 0 0 20px;
    }
}

.modal-body {
    min-height: 0;
}

.modal--workflow {
    width: min(1440px, 96vw);
    max-width: min(1440px, 96vw);
    max-height: 94vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    h3 {
        margin-bottom: 16px;
        flex-shrink: 0;
    }
}

.modal--identity {
    width: min(520px, 92vw);
}

.identity-current-card {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 14px 0 16px;
    padding: 12px;
    border: 1px solid rgba(var(--accent-primary-rgb), 0.16);
    border-radius: $radius-md;
    background: rgba(var(--accent-primary-rgb), 0.05);
}

.identity-current-card__avatar {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    overflow: hidden;
    border-radius: 12px;
    background: $bg-card;
    border: 1px solid rgba(var(--accent-primary-rgb), 0.12);
}

.identity-current-card__label {
    font-size: 11px;
    color: $text-muted;
}

.identity-current-card__name {
    margin-top: 2px;
    font-size: 15px;
    font-weight: 700;
    color: $text-primary;
    word-break: break-word;
}

.identity-approval-note {
    margin-top: 10px;
    padding: 10px 12px;
    border: 1px solid rgba(245, 158, 11, 0.24);
    border-radius: $radius-sm;
    background: rgba(245, 158, 11, 0.08);
    color: #92400e;
    font-size: 12px;
    line-height: 1.6;
}

.modal-body--workflow {
    flex: 1;
    overflow-y: auto;
    padding-right: 6px;
}

.form-group {
    margin-bottom: 16px;
}

.form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;

    @media (max-width: $breakpoint-mobile) {
        grid-template-columns: 1fr;
    }
}

.form-grid--workflow-meta {
    grid-template-columns: repeat(2, minmax(240px, 1fr));
}

.form-group--workflow-canvas {
    margin-bottom: 20px;
}

.workflow-role-check {
    margin-bottom: 16px;
    padding: 14px;
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: $radius-md;
    background: rgba(248, 250, 252, 0.88);
}

.workflow-role-check--warning {
    border-color: rgba(245, 158, 11, 0.28);
    background: rgba(245, 158, 11, 0.08);
}

.workflow-role-check__title {
    font-size: 13px;
    font-weight: 700;
    color: $text-primary;
}

.workflow-role-check__text {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.6;
    color: $text-secondary;
}

.workflow-role-check__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
}

.workflow-role-chip {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid rgba(var(--accent-primary-rgb), 0.18);
    background: rgba(var(--accent-primary-rgb), 0.08);
    font-size: 12px;
    color: $text-primary;
}

.workflow-role-chip--missing {
    border-color: rgba(245, 158, 11, 0.28);
    background: rgba(245, 158, 11, 0.14);
    color: #92400e;
}

.workflow-role-check__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
}

.workflow-preview {
    margin-bottom: 16px;
    padding: 14px;
    border: 1px solid $border-color;
    border-radius: $radius-md;
    background: rgba(var(--accent-primary-rgb), 0.04);
}

.workflow-stage-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
}

.workflow-empty {
    padding: 14px;
    border: 1px dashed $border-color;
    border-radius: $radius-md;
    font-size: 12px;
    color: $text-muted;
    background: rgba(var(--accent-primary-rgb), 0.03);
}

.workflow-stage-card {
    margin-top: 12px;
    padding: 14px;
    border: 1px solid $border-color;
    border-radius: $radius-md;
    background: rgba(var(--accent-primary-rgb), 0.03);
}

.workflow-stage-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    font-size: 13px;
    font-weight: 600;
    color: $text-primary;
}

.workflow-stage-switch {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 4px;
    font-size: 12px;
    color: $text-secondary;
}

.workflow-preview__header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}

.workflow-preview__icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
    background: $bg-secondary;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
}

.workflow-preview__meta {
    min-width: 0;
}

.workflow-preview__title {
    font-size: 13px;
    font-weight: 600;
    color: $text-primary;
}

.workflow-preview__source {
    margin-top: 2px;
    font-size: 12px;
    color: $text-muted;
}

.artifacts-layout {
    display: grid;
    grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
    gap: 16px;
    min-height: 520px;
}

.artifacts-browser,
.artifacts-preview {
    border: 1px solid $border-color;
    border-radius: $radius-md;
    background: rgba(var(--accent-primary-rgb), 0.03);
    padding: 14px;
    min-width: 0;
}

.artifact-entry {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid $border-color;
    background: $bg-card;
    border-radius: $radius-sm;
    padding: 10px 12px;
    text-align: left;
    cursor: pointer;
    transition: all $transition-fast;
    margin-top: 10px;

    &:hover {
        border-color: rgba(var(--accent-primary-rgb), 0.24);
        background: rgba(var(--accent-primary-rgb), 0.05);
    }
}

.artifact-entry__icon {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 700;
    color: $accent-primary;
    background: rgba(var(--accent-primary-rgb), 0.12);
    border-radius: 999px;
    padding: 3px 7px;
}

.artifact-entry__name {
    min-width: 0;
    font-size: 13px;
    color: $text-primary;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.modal-actions {
    margin-top: 12px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    flex-shrink: 0;
    padding-top: 16px;
    border-top: 1px solid $border-color;
    background: $bg-card;
}

.form-hint {
    font-size: 11px;
    color: $text-muted;
    margin: 4px 0 0;
}

// ─── Connection Dot ──────────────────────────────────────

.connection-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;

    &.connected {
        background-color: $success;
        box-shadow: 0 0 6px rgba(var(--success-rgb), 0.5);
    }

    &.disconnected {
        background-color: $error;
    }
}

// ─── Mobile ──────────────────────────────────────────────

@media (max-width: $breakpoint-mobile) {
    .artifacts-layout {
        grid-template-columns: 1fr;
        min-height: auto;
    }

    .modal--workflow {
        width: 100vw;
        max-width: 100vw;
        height: 100vh;
        max-height: 100vh;
        border-radius: 0;
        padding: 18px 16px;
    }

    .modal-body--workflow {
        padding-right: 0;
    }

    .room-sidebar {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        z-index: 100;
        background-color: $bg-card;
        box-shadow: 4px 0 16px rgba(0, 0, 0, 0.1);
    }

    .chat-header {
        padding: 16px 12px 16px 52px;
    }

    .header-action-btn span {
        display: none;
    }
}
</style>
