import { computed, ref, watch, type Ref } from 'vue'
import { useAppStore } from '@/stores/hermes/app'
import { useGroupChatStore } from '@/stores/hermes/group-chat'
import { useProfilesStore } from '@/stores/hermes/profiles'
import type { RoomAgent, WorkflowRoomConfig } from '@/api/hermes/group-chat'
import type {
  ApplicationAgentSummary,
  ApplicationAgentWorkspaceSummary,
} from '@/types/workbench/application'

function normalizeText(value?: string | null): string {
  return String(value || '').trim()
}

function normalizeRoleKey(value?: string | null): string {
  return normalizeText(value).toLowerCase()
}

function uniqueValues(values: Array<string | undefined>): string[] {
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

function collectWorkflowRoles(config?: WorkflowRoomConfig | null): string[] {
  const stageRoles = (config?.stages || []).map(stage => stage.roleName)
  const graphRoles = (config?.graph?.nodes || [])
    .filter(node => {
      const type = normalizeText(String(node?.properties?.workflowNodeType || ''))
      return type === 'role-task' || type === 'artifact-review'
    })
    .map(node => String(node?.properties?.roleName || ''))

  return uniqueValues([...stageRoles, ...graphRoles])
}

function analyzeWorkflowRoleAlignment(config: WorkflowRoomConfig | null | undefined, agents: Array<Pick<RoomAgent, 'id' | 'name' | 'profile'>>) {
  const requiredRoles = collectWorkflowRoles(config)
  const requiredKeys = new Set(requiredRoles.map(role => normalizeRoleKey(role)))
  const agentRoles = uniqueValues(agents.map(agent => agent.name || agent.profile))
  const agentKeys = new Set(agentRoles.map(role => normalizeRoleKey(role)))

  return {
    requiredRoles,
    agentRoles,
    missingRoles: requiredRoles.filter(role => !agentKeys.has(normalizeRoleKey(role))),
    unusedAgentRoles: agentRoles.filter(role => !requiredKeys.has(normalizeRoleKey(role))),
  }
}

export function useApplicationAgentWorkspace(applicationId: Ref<string>) {
  const groupChatStore = useGroupChatStore()
  const appStore = useAppStore()
  const profilesStore = useProfilesStore()

  const isLoading = ref(false)
  const isSaving = ref(false)
  const showFormModal = ref(false)
  const editingAgentId = ref<string | null>(null)
  const selectedProfile = ref<string | null>(null)
  const selectedModelProvider = ref<string | null>(null)
  const agentName = ref('')
  const agentDescription = ref('')
  const agentAvatar = ref('')
  const agentSystemPrompt = ref('')
  const agentModel = ref('')
  const agentTemperature = ref<number | null>(null)

  async function ensureRoomReady() {
    const roomId = applicationId.value
    if (!roomId) return

    if (!groupChatStore.connected) {
      groupChatStore.connect()
    }

    await groupChatStore.loadRooms()
    if (groupChatStore.currentRoomId !== roomId) {
      await groupChatStore.joinRoom(roomId)
      return
    }

    await groupChatStore.loadAgents(roomId)
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

  const agents = computed<ApplicationAgentSummary[]>(() =>
    groupChatStore.agents.map(agent => ({
      id: agent.id,
      profile: agent.profile,
      name: agent.name || agent.profile,
      description: normalizeText(agent.description) || null,
      avatar: normalizeText(agent.avatar) || null,
      systemPromptEnabled: !!normalizeText(agent.systemPrompt),
      model: normalizeText(agent.model) || null,
      temperature: agent.temperature ?? null,
      invited: !!agent.invited,
    })),
  )

  const workflowAlignment = computed(() =>
    analyzeWorkflowRoleAlignment(groupChatStore.currentWorkflowConfig, groupChatStore.agents),
  )

  const summary = computed<ApplicationAgentWorkspaceSummary>(() => ({
    total: agents.value.length,
    invitedCount: agents.value.filter(agent => agent.invited).length,
    namedRoles: uniqueValues(agents.value.map(agent => agent.name)),
    workflowMissingRoles: workflowAlignment.value.missingRoles,
  }))

  const profileOptions = computed(() =>
    profilesStore.profiles.map(profile => ({
      label: profile.name,
      value: profile.name,
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

  const selectedModelOptions = computed(() => {
    const group = appStore.modelGroups.find(
      item => item.provider === selectedModelProvider.value && !item.user_disabled,
    )
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

  function syncModelProviderByModel(model?: string | null) {
    const matchedGroup = appStore.modelGroups.find(
      group => !group.user_disabled && group.models.includes(String(model || '').trim()),
    )
    if (matchedGroup) {
      selectedModelProvider.value = matchedGroup.provider
      return
    }
    const provider = selectedModelProvider.value
    if (!provider) return
    const currentGroup = appStore.modelGroups.find(
      group => group.provider === provider && !group.user_disabled,
    )
    const firstEnabledModel = currentGroup?.models.find(
      item => !currentGroup.model_meta?.[item]?.disabled,
    ) || ''
    if (
      currentGroup &&
      (!currentGroup.models.includes(String(model || '').trim()) ||
        currentGroup.model_meta?.[String(model || '').trim()]?.disabled) &&
      firstEnabledModel
    ) {
      agentModel.value = firstEnabledModel
    }
  }

  function resetForm() {
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

  async function prepareFormDependencies() {
    await Promise.allSettled([
      profilesStore.fetchProfiles(),
      appStore.loadModels(),
    ])
  }

  async function openCreate() {
    await prepareFormDependencies()
    resetForm()
    const firstMissingRole = summary.value.workflowMissingRoles[0]
    if (firstMissingRole) {
      agentName.value = firstMissingRole
    }
    showFormModal.value = true
  }

  async function openEdit(agentId: string) {
    const agent = groupChatStore.agents.find(item => item.id === agentId)
    if (!agent) return
    await prepareFormDependencies()
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
    showFormModal.value = true
  }

  function closeForm() {
    showFormModal.value = false
    resetForm()
  }

  async function submitForm() {
    if (!selectedProfile.value || !applicationId.value) return
    isSaving.value = true
    try {
      const wasEditing = !!editingAgentId.value
      if (wasEditing && editingAgentId.value) {
        const nextProfile = selectedProfile.value || ''
        const nextName = agentName.value.trim() || nextProfile
        const nextAgents = groupChatStore.agents.map(agent =>
          agent.id === editingAgentId.value
            ? { id: agent.id, name: nextName, profile: nextProfile }
            : { id: agent.id, name: agent.name, profile: agent.profile },
        )
        const currentAlignment = analyzeWorkflowRoleAlignment(
          groupChatStore.currentWorkflowConfig,
          groupChatStore.agents,
        )
        const nextAlignment = analyzeWorkflowRoleAlignment(
          groupChatStore.currentWorkflowConfig,
          nextAgents,
        )
        const newlyMissingRoles = nextAlignment.missingRoles.filter(
          role => !currentAlignment.missingRoles.some(current => normalizeRoleKey(current) === normalizeRoleKey(role)),
        )
        if (newlyMissingRoles.length > 0) {
          throw new Error(`Workflow roles would become unassigned: ${newlyMissingRoles.join(', ')}`)
        }
      }

      const payload = {
        profile: selectedProfile.value,
        name: agentName.value.trim() || undefined,
        description: agentDescription.value.trim() || undefined,
        avatar: agentAvatar.value.trim() || undefined,
        systemPrompt: agentSystemPrompt.value.trim() || undefined,
        model: agentModel.value.trim() || undefined,
        temperature: agentTemperature.value,
        operatorName: groupChatStore.userName || '管理员',
      }

      if (editingAgentId.value) {
        await groupChatStore.updateAgentInRoom(applicationId.value, editingAgentId.value, payload)
      } else {
        await groupChatStore.addAgentToRoom(applicationId.value, payload)
      }

      showFormModal.value = false
      resetForm()
    } finally {
      isSaving.value = false
    }
  }

  async function removeAgent(agentId: string) {
    if (!applicationId.value) return

    const nextAgents = groupChatStore.agents
      .filter(agent => agent.id !== agentId)
      .map(agent => ({ id: agent.id, name: agent.name, profile: agent.profile }))
    const currentAlignment = analyzeWorkflowRoleAlignment(
      groupChatStore.currentWorkflowConfig,
      groupChatStore.agents,
    )
    const nextAlignment = analyzeWorkflowRoleAlignment(
      groupChatStore.currentWorkflowConfig,
      nextAgents,
    )
    const newlyMissingRoles = nextAlignment.missingRoles.filter(
      role => !currentAlignment.missingRoles.some(current => normalizeRoleKey(current) === normalizeRoleKey(role)),
    )

    if (newlyMissingRoles.length > 0) {
      throw new Error(`Workflow roles would become unassigned: ${newlyMissingRoles.join(', ')}`)
    }

    await groupChatStore.removeAgentFromRoom(
      applicationId.value,
      agentId,
      groupChatStore.userName || '管理员',
    )
  }

  async function saveLiveTeamAsBaseline() {
    if (!applicationId.value) return
    await groupChatStore.saveCurrentAgentsAsDefault(applicationId.value)
  }

  async function restoreSavedBaselineToLiveTeam() {
    if (!applicationId.value) return
    await groupChatStore.applyRoomDefaultAgents(applicationId.value)
  }

  watch(selectedModelProvider, provider => {
    if (!provider) return
    const group = appStore.modelGroups.find(item => item.provider === provider && !item.user_disabled)
    if (!group) return
    const firstEnabledModel = group.models.find(model => !group.model_meta?.[model]?.disabled) || ''
    if (
      !agentModel.value ||
      !group.models.includes(agentModel.value) ||
      group.model_meta?.[agentModel.value]?.disabled
    ) {
      agentModel.value = firstEnabledModel
    }
  })

  watch(agentModel, model => {
    syncModelProviderByModel(model)
  })

  watch(applicationId, () => {
    initialize().catch(() => {
      // Surface via UI state rather than throwing during watchers.
    })
  }, { immediate: true })

  return {
    isLoading,
    isSaving,
    showFormModal,
    editingAgentId,
    selectedProfile,
    selectedModelProvider,
    agentName,
    agentDescription,
    agentAvatar,
    agentSystemPrompt,
    agentModel,
    agentTemperature,
    profileOptions,
    modelProviderOptions,
    selectedModelOptions,
    agents,
    summary,
    openCreate,
    openEdit,
    closeForm,
    submitForm,
    removeAgent,
    saveLiveTeamAsBaseline,
    restoreSavedBaselineToLiveTeam,
    resetForm,
  }
}
