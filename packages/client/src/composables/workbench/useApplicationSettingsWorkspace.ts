import { computed, ref, watch, type Ref } from 'vue'
import {
  applyDefaultAgents,
  bindRoomProject,
  forceCompress,
  getRoomProject,
  getRoomWorkflowConfig,
  saveDefaultAgents,
  updateInviteCode,
  updateRoomConfig,
  updateRoomWorkflowConfig,
  type ProjectPermissionConfig,
  type WorkflowRoomConfig,
} from '@/api/hermes/group-chat'
import { useGroupChatStore } from '@/stores/hermes/group-chat'
import { useApplicationsStore } from '@/stores/workbench/applications'
import type { ApplicationDetail } from '@/types/workbench/application'

interface NormalizedProjectPermissions {
  allowRead: boolean
  allowWrite: boolean
  allowCommit: boolean
  allowPush: boolean
  pushRequireApproval: boolean
}

function normalizeText(value?: string | null): string {
  return String(value || '').trim()
}

function fallbackNumber(value: number | null | undefined, defaultValue: number): number {
  return Number.isFinite(value) ? Number(value) : defaultValue
}

function normalizePositiveInteger(value: number, fallbackValue: number): number {
  const next = Math.round(Number(value) || 0)
  return next > 0 ? next : fallbackValue
}

function cloneWorkflowRoomConfig(config?: WorkflowRoomConfig | null): WorkflowRoomConfig {
  return JSON.parse(JSON.stringify(config || {
    version: 2,
    mode: 'freeform',
    ownerRoleName: '',
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

function normalizeProjectPermissions(
  permissions?: Partial<ProjectPermissionConfig> | null,
): NormalizedProjectPermissions {
  const allowRead = permissions?.allowRead !== false
  const allowWrite = !!permissions?.allowWrite
  const allowCommit = allowWrite && !!permissions?.allowCommit
  const allowPush = allowCommit && !!permissions?.allowPush
  return {
    allowRead,
    allowWrite,
    allowCommit,
    allowPush,
    pushRequireApproval: allowPush ? permissions?.pushRequireApproval !== false : true,
  }
}

function sameProjectPermissions(
  left: NormalizedProjectPermissions,
  right: NormalizedProjectPermissions,
): boolean {
  return (
    left.allowRead === right.allowRead &&
    left.allowWrite === right.allowWrite &&
    left.allowCommit === right.allowCommit &&
    left.allowPush === right.allowPush &&
    left.pushRequireApproval === right.pushRequireApproval
  )
}

export function useApplicationSettingsWorkspace(
  applicationId: Ref<string>,
  application: Ref<ApplicationDetail>,
) {
  const applicationsStore = useApplicationsStore()
  const groupChatStore = useGroupChatStore()

  const inviteCode = ref('')
  const triggerTokens = ref(100000)
  const maxHistoryTokens = ref(32000)
  const tailMessageCount = ref(20)
  const flowMode = ref<'freeform' | 'stage-gated'>('freeform')
  const flowOwnerName = ref('')
  const flowOwnerRole = ref('')
  const outputRootDir = ref('')
  const allowManualJump = ref(false)
  const allowRead = ref(true)
  const allowWrite = ref(false)
  const allowCommit = ref(false)
  const allowPush = ref(false)
  const pushRequireApproval = ref(true)
  const isSavingInviteCode = ref(false)
  const isSavingCompression = ref(false)
  const isCompressing = ref(false)
  const isLoadingFlowControl = ref(false)
  const isSavingFlowControl = ref(false)
  const isLoadingProjectContext = ref(false)
  const isSavingProjectContext = ref(false)
  const isSavingRoleBaseline = ref(false)
  const isApplyingRoleBaseline = ref(false)
  const workflowConfigDraft = ref<WorkflowRoomConfig>(cloneWorkflowRoomConfig())
  const projectPermissionSnapshot = ref<NormalizedProjectPermissions>(normalizeProjectPermissions())

  function hydrateFromApplication(detail: ApplicationDetail) {
    inviteCode.value = normalizeText(detail.settings.inviteCode)
    triggerTokens.value = fallbackNumber(detail.settings.compression.triggerTokens, 100000)
    maxHistoryTokens.value = fallbackNumber(detail.settings.compression.maxHistoryTokens, 32000)
    tailMessageCount.value = fallbackNumber(detail.settings.compression.tailMessageCount, 20)
    flowOwnerName.value = normalizeText(detail.settings.workflowOwnerName)
    flowOwnerRole.value = normalizeText(detail.settings.workflowOwnerRoleName)
    flowMode.value = detail.settings.workflowMode === 'stage-gated' ? 'stage-gated' : 'freeform'
  }

  function hydrateFlowControlFromConfig(config?: WorkflowRoomConfig | null) {
    const next = cloneWorkflowRoomConfig(config)
    workflowConfigDraft.value = next
    flowMode.value = next.mode === 'stage-gated' ? 'stage-gated' : 'freeform'
    flowOwnerName.value = normalizeText(next.ownerUserName) || normalizeText(application.value.settings.workflowOwnerName)
    flowOwnerRole.value = normalizeText(next.ownerRoleName) || normalizeText(application.value.settings.workflowOwnerRoleName)
    outputRootDir.value = normalizeText(next.runtime?.artifactRootDir)
    allowManualJump.value = !!next.runtime?.allowManualJump
  }

  function hydrateProjectPermissions(permissions?: Partial<ProjectPermissionConfig> | null) {
    const normalized = normalizeProjectPermissions(permissions)
    projectPermissionSnapshot.value = normalized
    allowRead.value = normalized.allowRead
    allowWrite.value = normalized.allowWrite
    allowCommit.value = normalized.allowCommit
    allowPush.value = normalized.allowPush
    pushRequireApproval.value = normalized.pushRequireApproval
  }

  async function loadFlowControl() {
    if (!applicationId.value) return
    isLoadingFlowControl.value = true
    try {
      const res = await getRoomWorkflowConfig(applicationId.value)
      hydrateFlowControlFromConfig(res.workflowConfig)
    } finally {
      isLoadingFlowControl.value = false
    }
  }

  async function loadProjectContext() {
    if (!applicationId.value || !application.value.primaryProject?.id) {
      hydrateProjectPermissions()
      return
    }
    isLoadingProjectContext.value = true
    try {
      const res = await getRoomProject(applicationId.value)
      hydrateProjectPermissions(res.roomProject?.binding
        ? {
            allowRead: !!res.roomProject.binding.allowRead,
            allowWrite: !!res.roomProject.binding.allowWrite,
            allowCommit: !!res.roomProject.binding.allowCommit,
            allowPush: !!res.roomProject.binding.allowPush,
            pushRequireApproval: !!res.roomProject.binding.pushRequireApproval,
          }
        : null)
    } finally {
      isLoadingProjectContext.value = false
    }
  }

  async function refreshApplicationState() {
    if (!applicationId.value) return
    await applicationsStore.loadApplicationDetail(applicationId.value)
    await groupChatStore.loadRooms()
    if (groupChatStore.currentRoomId === applicationId.value) {
      await groupChatStore.loadAgents(applicationId.value).catch(() => {
        // Keep settings refresh resilient when the active room agent list cannot be reloaded.
      })
    }
    await loadFlowControl()
    await loadProjectContext()
  }

  const inviteCodeDirty = computed(
    () => normalizeText(inviteCode.value) !== normalizeText(application.value.settings.inviteCode),
  )

  const compressionDirty = computed(() => {
    const current = application.value.settings.compression
    return (
      normalizePositiveInteger(triggerTokens.value, 100000) !== fallbackNumber(current.triggerTokens, 100000) ||
      normalizePositiveInteger(maxHistoryTokens.value, 32000) !== fallbackNumber(current.maxHistoryTokens, 32000) ||
      normalizePositiveInteger(tailMessageCount.value, 20) !== fallbackNumber(current.tailMessageCount, 20)
    )
  })

  const canSaveInviteCode = computed(() => normalizeText(inviteCode.value).length > 0 && inviteCodeDirty.value)

  const canSaveCompression = computed(() => {
    const trigger = normalizePositiveInteger(triggerTokens.value, 100000)
    const maxHistory = normalizePositiveInteger(maxHistoryTokens.value, 32000)
    const tail = normalizePositiveInteger(tailMessageCount.value, 20)
    return compressionDirty.value && trigger > 0 && maxHistory > 0 && tail > 0
  })

  const flowControlDirty = computed(() => {
    const current = workflowConfigDraft.value
    return (
      flowMode.value !== (current.mode === 'stage-gated' ? 'stage-gated' : 'freeform') ||
      normalizeText(flowOwnerName.value) !== normalizeText(current.ownerUserName) ||
      normalizeText(flowOwnerRole.value) !== normalizeText(current.ownerRoleName) ||
      normalizeText(outputRootDir.value) !== normalizeText(current.runtime?.artifactRootDir) ||
      allowManualJump.value !== !!current.runtime?.allowManualJump
    )
  })

  const canSaveFlowControl = computed(() => {
    return flowControlDirty.value && normalizeText(outputRootDir.value).length > 0
  })

  const normalizedProjectPermissionsDraft = computed<NormalizedProjectPermissions>(() =>
    normalizeProjectPermissions({
      allowRead: allowRead.value,
      allowWrite: allowWrite.value,
      allowCommit: allowCommit.value,
      allowPush: allowPush.value,
      pushRequireApproval: pushRequireApproval.value,
    }),
  )

  const projectContextDirty = computed(() =>
    !sameProjectPermissions(normalizedProjectPermissionsDraft.value, projectPermissionSnapshot.value),
  )

  const canSaveProjectContext = computed(() =>
    !!application.value.primaryProject?.id && projectContextDirty.value,
  )

  const savedRoleBaseline = computed(() => application.value.settings.defaultAgentBaseline)

  const canSaveRoleBaseline = computed(() => application.value.agents.total > 0)

  const canApplyRoleBaseline = computed(() => savedRoleBaseline.value.roleCount > 0)

  async function saveInviteCodeValue() {
    if (!applicationId.value || !canSaveInviteCode.value) return
    isSavingInviteCode.value = true
    try {
      await updateInviteCode(applicationId.value, normalizeText(inviteCode.value))
      await refreshApplicationState()
    } finally {
      isSavingInviteCode.value = false
    }
  }

  async function saveCompressionRules() {
    if (!applicationId.value || !canSaveCompression.value) return
    isSavingCompression.value = true
    try {
      await updateRoomConfig(applicationId.value, {
        triggerTokens: normalizePositiveInteger(triggerTokens.value, 100000),
        maxHistoryTokens: normalizePositiveInteger(maxHistoryTokens.value, 32000),
        tailMessageCount: normalizePositiveInteger(tailMessageCount.value, 20),
      })
      await refreshApplicationState()
    } finally {
      isSavingCompression.value = false
    }
  }

  async function compressNow() {
    if (!applicationId.value) return
    isCompressing.value = true
    try {
      await forceCompress(applicationId.value)
      await refreshApplicationState()
    } finally {
      isCompressing.value = false
    }
  }

  async function saveFlowControl() {
    if (!applicationId.value || !canSaveFlowControl.value) return
    isSavingFlowControl.value = true
    try {
      const nextConfig = cloneWorkflowRoomConfig(workflowConfigDraft.value)
      nextConfig.mode = flowMode.value
      nextConfig.ownerUserName = normalizeText(flowOwnerName.value)
      nextConfig.ownerRoleName = normalizeText(flowOwnerRole.value)
      nextConfig.runtime = {
        ...(nextConfig.runtime || {}),
        artifactRootDir: normalizeText(outputRootDir.value),
        allowManualJump: allowManualJump.value,
      }

      await updateRoomWorkflowConfig(applicationId.value, {
        workflowConfig: nextConfig,
        operatorName: normalizeText(groupChatStore.userName) || normalizeText(application.value.settings.userName) || '管理员',
        changeNote: 'Updated flow ownership and execution guardrails from application settings',
      })
      await refreshApplicationState()
    } finally {
      isSavingFlowControl.value = false
    }
  }

  async function saveProjectContext() {
    if (!applicationId.value || !application.value.primaryProject?.id || !canSaveProjectContext.value) return
    isSavingProjectContext.value = true
    try {
      await bindRoomProject(
        applicationId.value,
        application.value.primaryProject.id,
        normalizedProjectPermissionsDraft.value,
      )
      await refreshApplicationState()
    } finally {
      isSavingProjectContext.value = false
    }
  }

  async function saveRoleBaseline() {
    if (!applicationId.value || !canSaveRoleBaseline.value) return
    isSavingRoleBaseline.value = true
    try {
      await saveDefaultAgents(applicationId.value)
      await refreshApplicationState()
    } finally {
      isSavingRoleBaseline.value = false
    }
  }

  async function applyRoleBaseline() {
    if (!applicationId.value || !canApplyRoleBaseline.value) return
    isApplyingRoleBaseline.value = true
    try {
      await applyDefaultAgents(applicationId.value)
      await refreshApplicationState()
    } finally {
      isApplyingRoleBaseline.value = false
    }
  }

  watch(
    application,
    detail => {
      hydrateFromApplication(detail)
    },
    { immediate: true },
  )

  watch(allowWrite, value => {
    if (!value) {
      allowCommit.value = false
      allowPush.value = false
      return
    }
    allowRead.value = true
  })

  watch(allowCommit, value => {
    if (value) {
      allowRead.value = true
      allowWrite.value = true
      return
    }
    allowPush.value = false
  })

  watch(allowPush, value => {
    if (value) {
      allowRead.value = true
      allowWrite.value = true
      allowCommit.value = true
      return
    }
    pushRequireApproval.value = true
  })

  watch(allowRead, value => {
    if (!value) {
      allowWrite.value = false
      allowCommit.value = false
      allowPush.value = false
    }
  })

  watch(
    applicationId,
    () => {
      loadFlowControl().catch(() => {
        // Keep the settings workspace usable even if flow control bootstrap fails.
      })
      loadProjectContext().catch(() => {
        // Keep the settings workspace usable even if project context bootstrap fails.
      })
    },
    { immediate: true },
  )

  return {
    inviteCode,
    triggerTokens,
    maxHistoryTokens,
    tailMessageCount,
    flowMode,
    flowOwnerName,
    flowOwnerRole,
    outputRootDir,
    allowManualJump,
    allowRead,
    allowWrite,
    allowCommit,
    allowPush,
    pushRequireApproval,
    inviteCodeDirty,
    compressionDirty,
    flowControlDirty,
    projectContextDirty,
    canSaveInviteCode,
    canSaveCompression,
    canSaveFlowControl,
    canSaveProjectContext,
    savedRoleBaseline,
    canSaveRoleBaseline,
    canApplyRoleBaseline,
    isSavingInviteCode,
    isSavingCompression,
    isCompressing,
    isLoadingFlowControl,
    isSavingFlowControl,
    isLoadingProjectContext,
    isSavingProjectContext,
    isSavingRoleBaseline,
    isApplyingRoleBaseline,
    saveInviteCodeValue,
    saveCompressionRules,
    compressNow,
    saveFlowControl,
    saveProjectContext,
    saveRoleBaseline,
    applyRoleBaseline,
  }
}
