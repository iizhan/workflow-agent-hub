import { computed, ref, watch, type Ref } from 'vue'
import { updateRoomWorkflowConfig } from '@/api/hermes/group-chat'
import type { WorkflowRoomConfig } from '@/api/hermes/group-chat'
import { useGroupChatStore } from '@/stores/hermes/group-chat'
import type {
  ApplicationWorkflowRoleAlignment,
  ApplicationWorkflowRunSummary,
  ApplicationWorkflowSummary,
  ApplicationWorkflowTemplateSummary,
} from '@/types/workbench/application'

function normalizeText(value?: string | null): string {
  return String(value || '').trim()
}

function normalizeRoleKey(value?: string | null): string {
  return normalizeText(value).toLowerCase()
}

function uniqueValues(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const text = normalizeText(value)
    const key = normalizeRoleKey(text)
    if (!text || seen.has(key)) continue
    seen.add(key)
    result.push(text)
  }
  return result
}

function cloneWorkflowRoomConfig(config?: WorkflowRoomConfig | null): WorkflowRoomConfig {
  return JSON.parse(JSON.stringify(config || {
    version: 2,
    mode: 'freeform',
    ownerRoleName: '管理员',
    ownerUserName: '',
    stages: [],
    editor: {
      type: 'logicflow',
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    graph: {
      nodes: [],
      edges: [],
    },
    runtime: {
      startNodeId: '',
      artifactRootDir: '.hermes/group-chat-artifacts/${roomId}',
      allowManualJump: false,
    },
  }))
}

function collectWorkflowRoles(config?: WorkflowRoomConfig | null): string[] {
  const stageRoles = (config?.stages || []).map(stage => stage.roleName)
  const graphRoles = (config?.graph?.nodes || [])
    .filter(node => {
      const type = normalizeText(String(node?.properties?.workflowNodeType || ''))
      return type === 'role-task' || type === 'artifact-review' || type === 'approval'
    })
    .map(node => String(node?.properties?.roleName || ''))

  return uniqueValues([...stageRoles, ...graphRoles])
}

export function useApplicationWorkflowWorkspace(applicationId: Ref<string>) {
  const groupChatStore = useGroupChatStore()

  const isLoading = ref(false)
  const isSaving = ref(false)
  const isApplyingTemplate = ref(false)
  const selectedTemplateId = ref<string | null>(null)
  const workflowName = ref('')
  const workflowPrompt = ref('')
  const workflowConfigDraft = ref<WorkflowRoomConfig>(cloneWorkflowRoomConfig())

  async function ensureRoomReady() {
    const roomId = applicationId.value
    if (!roomId) return

    if (!groupChatStore.connected) {
      groupChatStore.connect()
    }

    await groupChatStore.loadRooms()
    if (groupChatStore.currentRoomId !== roomId) {
      await groupChatStore.joinRoom(roomId)
    } else {
      await Promise.all([
        groupChatStore.loadWorkflowState(roomId),
        groupChatStore.loadRoomRuntime(roomId),
        groupChatStore.loadAgents(roomId),
      ])
    }

    await groupChatStore.loadWorkflowTemplates()
    hydrateDraftFromRoom()
  }

  function hydrateDraftFromRoom() {
    const room = groupChatStore.rooms.find(item => item.id === applicationId.value)
    workflowName.value = normalizeText(room?.workflowName) || normalizeText(groupChatStore.roomName) || ''
    workflowPrompt.value = normalizeText(room?.workflowPrompt)
    workflowConfigDraft.value = cloneWorkflowRoomConfig(groupChatStore.currentWorkflowConfig)
    if (!normalizeText(workflowConfigDraft.value.ownerUserName)) {
      workflowConfigDraft.value.ownerUserName = normalizeText(groupChatStore.userName) || normalizeText(groupChatStore.userId)
    }
  }

  async function initialize() {
    if (!applicationId.value) return
    isLoading.value = true
    try {
      await ensureRoomReady()
    } finally {
      isLoading.value = false
    }
  }

  const workflowSummary = computed<ApplicationWorkflowSummary>(() => {
    const config = workflowConfigDraft.value
    return {
      enabled: !!normalizeText(workflowName.value) || !!normalizeText(workflowPrompt.value) || (config.graph?.nodes?.length || 0) > 0,
      workflowName: normalizeText(workflowName.value) || null,
      workflowPrompt: normalizeText(workflowPrompt.value) || null,
      mode: config.mode === 'stage-gated' ? 'stage-gated' : 'freeform',
      stageCount: config.stages?.length || 0,
      graphNodeCount: config.graph?.nodes?.length || 0,
      graphEdgeCount: config.graph?.edges?.length || 0,
      startNodeConfigured: !!normalizeText(config.runtime?.startNodeId),
      ownerRoleName: normalizeText(config.ownerRoleName) || null,
      ownerUserName: normalizeText(config.ownerUserName) || null,
      artifactRootDir: normalizeText(config.runtime?.artifactRootDir) || null,
      allowManualJump: !!config.runtime?.allowManualJump,
    }
  })

  const workflowRun = computed<ApplicationWorkflowRunSummary>(() => {
    const currentNode = groupChatStore.workflowCurrentNode
    const nodeText = currentNode?.text
    const currentNodeTitle = typeof nodeText === 'string'
      ? normalizeText(nodeText) || null
      : normalizeText(nodeText?.value) || null

    const nodeRuns = groupChatStore.workflowNodeRuns || []
    return {
      status: groupChatStore.workflowRunState?.status || 'idle',
      currentNodeTitle,
      currentNodeRoleName: normalizeText(String(currentNode?.properties?.roleName || '')) || null,
      currentNodeType: normalizeText(String(currentNode?.properties?.workflowNodeType || '')) || null,
      startedAt: groupChatStore.workflowRunState?.startedAt || null,
      updatedAt: groupChatStore.workflowRunState?.updatedAt || null,
      pendingApprovalCount: nodeRuns.filter(item => item.status === 'waiting_approval').length,
      completedNodeCount: nodeRuns.filter(item => item.status === 'completed').length,
      totalNodeRuns: nodeRuns.length,
    }
  })

  const workflowTemplates = computed<ApplicationWorkflowTemplateSummary[]>(() =>
    groupChatStore.workflowTemplates.map(template => ({
      id: template.id,
      name: template.name,
      description: normalizeText(template.description) || null,
      agentCount: template.agents?.length || 0,
      tagCount: template.tags?.length || 0,
      sourceType: template.sourceType || 'unknown',
      updatedAt: template.updatedAt || null,
    })),
  )

  const roleAlignment = computed<ApplicationWorkflowRoleAlignment>(() => {
    const requiredRoles = collectWorkflowRoles(workflowConfigDraft.value)
    const assignedRoles = uniqueValues(groupChatStore.agents.map(agent => agent.name || agent.profile))
    const assignedKeys = new Set(assignedRoles.map(role => normalizeRoleKey(role)))
    const requiredKeys = new Set(requiredRoles.map(role => normalizeRoleKey(role)))

    return {
      requiredRoles,
      assignedRoles,
      missingRoles: requiredRoles.filter(role => !assignedKeys.has(normalizeRoleKey(role))),
      unusedRoles: assignedRoles.filter(role => !requiredKeys.has(normalizeRoleKey(role))),
    }
  })

  const selectedTemplate = computed(() =>
    groupChatStore.workflowTemplates.find(template => template.id === selectedTemplateId.value) || null,
  )

  const templateOptions = computed(() =>
    workflowTemplates.value.map(template => ({
      label: template.description ? `${template.name} · ${template.description}` : template.name,
      value: template.id,
    })),
  )

  async function applyTemplate(templateId: string | null, syncAgents = false) {
    if (!templateId) return
    const template = groupChatStore.workflowTemplates.find(item => item.id === templateId)
    if (!template) return

    isApplyingTemplate.value = true
    try {
      selectedTemplateId.value = templateId
      workflowName.value = template.name
      workflowPrompt.value = template.workflowPrompt || ''
      workflowConfigDraft.value = cloneWorkflowRoomConfig(template.workflowConfig)

      if (syncAgents) {
        for (const agent of template.agents || []) {
          const exists = groupChatStore.agents.find(existing =>
            existing.profile === agent.profile && (existing.name || existing.profile) === (agent.name || agent.profile),
          )
          if (!exists && applicationId.value) {
            await groupChatStore.addAgentToRoom(applicationId.value, agent)
          }
        }
      }
    } finally {
      isApplyingTemplate.value = false
    }
  }

  async function saveWorkflow() {
    if (!applicationId.value) return
    isSaving.value = true
    try {
      const res = await updateRoomWorkflowConfig(applicationId.value, {
        workflowName: normalizeText(workflowName.value) || undefined,
        workflowPrompt: normalizeText(workflowPrompt.value) || undefined,
        workflowConfig: cloneWorkflowRoomConfig(workflowConfigDraft.value),
        operatorName: normalizeText(groupChatStore.userName) || '管理员',
        workflowTemplateName: selectedTemplate.value?.name,
      })

      const roomIndex = groupChatStore.rooms.findIndex(room => room.id === applicationId.value)
      if (roomIndex >= 0) {
        groupChatStore.rooms[roomIndex] = res.room
      }
      groupChatStore.currentWorkflowConfig = cloneWorkflowRoomConfig(res.workflowConfig)
      hydrateDraftFromRoom()
      await groupChatStore.loadWorkflowState(applicationId.value)
    } finally {
      isSaving.value = false
    }
  }

  async function refreshRuntime() {
    if (!applicationId.value) return
    await Promise.all([
      groupChatStore.loadWorkflowState(applicationId.value),
      groupChatStore.loadRoomRuntime(applicationId.value),
    ])
  }

  watch(applicationId, () => {
    initialize().catch(() => {
      // Keep the page responsive even if workflow bootstrap fails.
    })
  }, { immediate: true })

  return {
    isLoading,
    isSaving,
    isApplyingTemplate,
    selectedTemplateId,
    workflowName,
    workflowPrompt,
    workflowConfigDraft,
    workflowSummary,
    workflowRun,
    workflowTemplates,
    roleAlignment,
    selectedTemplate,
    templateOptions,
    initialize,
    applyTemplate,
    saveWorkflow,
    refreshRuntime,
  }
}
