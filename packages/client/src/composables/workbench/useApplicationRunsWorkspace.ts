import { computed, ref, watch, type Ref } from 'vue'
import { useGroupChatStore } from '@/stores/hermes/group-chat'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type {
  ApplicationRunArtifactOption,
  ApplicationRunHistoryItem,
  ApplicationRunNode,
  ApplicationRunSummary,
} from '@/types/workbench/application'

function normalizeText(value?: string | null): string {
  return String(value || '').trim()
}

function normalizeRoleKey(value?: string | null): string {
  return normalizeText(value).toLowerCase()
}

function parseArtifactIds(raw: string): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(item => String(item)) : []
  } catch {
    return []
  }
}

function parseStringArray(raw: string): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(item => String(item)) : []
  } catch {
    return []
  }
}

function parseGitChanges(raw: string): Array<{
  relativePath: string
  displayPath: string
  kind: 'staged' | 'modified' | 'untracked' | 'mixed' | 'conflicted'
  previewContent: string
  previewMode: 'diff' | 'text' | 'binary' | 'empty'
  previewTruncated: boolean
}> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(item => ({
        relativePath: normalizeText(item?.relativePath),
        displayPath: normalizeText(item?.displayPath),
        kind: normalizeText(item?.kind) as 'staged' | 'modified' | 'untracked' | 'mixed' | 'conflicted',
        previewContent: String(item?.previewContent || ''),
        previewMode: normalizeText(item?.previewMode) as 'diff' | 'text' | 'binary' | 'empty',
        previewTruncated: !!item?.previewTruncated,
      }))
      .filter(item =>
        item.relativePath
        && item.displayPath
        && item.kind
        && item.previewMode,
      )
  } catch {
    return []
  }
}

export function useApplicationRunsWorkspace(applicationId: Ref<string>) {
  const groupChatStore = useGroupChatStore()
  const { t } = useWorkbenchI18n()

  const isLoading = ref(false)
  const isSubmitting = ref(false)
  const rejectReason = ref('')
  const launchBrief = ref('')
  const launchArtifactPath = ref('')
  const selectedRunNumber = ref<number | null>(null)

  async function ensureRoomReady() {
    const roomId = applicationId.value
    if (!roomId) return

    if (!groupChatStore.connected) {
      groupChatStore.connect()
    }

    await groupChatStore.loadRooms()
    if (groupChatStore.currentRoomId !== roomId) {
      await groupChatStore.joinRoom(roomId)
      await Promise.all([
        groupChatStore.loadWorkflowArtifacts(roomId, 30),
        groupChatStore.loadWorkflowRunHistory(roomId, 12),
      ])
      return
    }

    await Promise.all([
      groupChatStore.loadWorkflowState(roomId),
      groupChatStore.loadRoomRuntime(roomId),
      groupChatStore.loadWorkflowArtifacts(roomId, 30),
      groupChatStore.loadWorkflowRunHistory(roomId, 12),
    ])
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

  const runSummary = computed<ApplicationRunSummary>(() => {
    const currentNode = groupChatStore.workflowCurrentNode
    const nodeText = currentNode?.text
    const currentNodeTitle = typeof nodeText === 'string'
      ? normalizeText(nodeText) || null
      : normalizeText(nodeText?.value) || null

    const currentNodeRoleName = normalizeText(String(currentNode?.properties?.roleName || '')) || null
    const approvalRequired = String(currentNode?.properties?.workflowNodeType || '') === 'approval'
      && groupChatStore.workflowRunState?.status !== 'completed'
    const approvalOwnerName = normalizeText(groupChatStore.currentWorkflowConfig?.ownerUserName || groupChatStore.userName || groupChatStore.userId) || null
    const canCurrentUserApprove = !approvalOwnerName
      || normalizeRoleKey(approvalOwnerName) === normalizeRoleKey(groupChatStore.userName || '')
    const nodeRuns = groupChatStore.workflowNodeRuns || []

    return {
      runNumber: groupChatStore.workflowRunState?.runNumber || null,
      status: groupChatStore.workflowRunState?.status || 'idle',
      currentNodeId: groupChatStore.workflowRunState?.currentNodeId || null,
      currentNodeTitle,
      currentNodeRoleName,
      startActionKind: groupChatStore.workflowRunState?.status === 'completed'
        ? 'next_run'
        : groupChatStore.workflowRunState?.status === 'failed'
          ? 'retry_failed_run'
          : 'first_run',
      startActionLabel: groupChatStore.workflowRunState?.status === 'completed'
        ? t('workbench.runs.startNextRun')
        : groupChatStore.workflowRunState?.status === 'failed'
          ? t('workbench.runs.retryRun')
          : t('workbench.header.startExecution'),
      kickoffSummary: normalizeText(groupChatStore.workflowRunState?.kickoffSummary) || null,
      kickoffArtifactPath: normalizeText(groupChatStore.workflowRunState?.kickoffArtifactPath) || null,
      approvalRequired,
      approvalOwnerName,
      canCurrentUserApprove,
      canCurrentUserCancel: !!groupChatStore.workflowRunState
        && (groupChatStore.workflowRunState.status === 'running' || groupChatStore.workflowRunState.status === 'paused')
        && canCurrentUserApprove,
      canStartNewRun: !groupChatStore.workflowRunState
        || groupChatStore.workflowRunState.status === 'idle'
        || groupChatStore.workflowRunState.status === 'completed'
        || groupChatStore.workflowRunState.status === 'failed',
      startedAt: groupChatStore.workflowRunState?.startedAt || null,
      updatedAt: groupChatStore.workflowRunState?.updatedAt || null,
      pendingApprovalCount: nodeRuns.filter(item => item.status === 'waiting_approval').length,
      completedNodeCount: nodeRuns.filter(item => item.status === 'completed').length,
      rejectedNodeCount: nodeRuns.filter(item => item.status === 'rejected').length,
      totalNodeRuns: nodeRuns.length,
    }
  })

  const artifactOptions = computed<ApplicationRunArtifactOption[]>(() => {
    const unique = new Set<string>()
    return (groupChatStore.workflowArtifacts || [])
      .filter(item => {
        const path = normalizeText(item.relativePath)
        if (!path || unique.has(path)) return false
        unique.add(path)
        return true
      })
      .map(item => ({
        label: item.title ? `${item.title} · ${item.relativePath}` : item.relativePath,
        value: item.relativePath,
        type: 'option' as const,
        title: normalizeText(item.title) || null,
        createdAt: item.createdAt || null,
      }))
  })

  const runHistory = computed<ApplicationRunHistoryItem[]>(() =>
    (groupChatStore.workflowRunHistory || []).map(item => ({
      id: item.id,
      runNumber: item.runNumber || 0,
      status: (item.status || 'idle') as ApplicationRunHistoryItem['status'],
      currentNodeTitle: normalizeText(item.currentNodeTitle) || null,
      kickoffSummary: normalizeText(item.kickoffSummary) || null,
      kickoffArtifactPath: normalizeText(item.kickoffArtifactPath) || null,
      startedAt: item.startedAt || null,
      endedAt: item.endedAt || null,
      completedNodeCount: item.completedNodeCount || 0,
      rejectedNodeCount: item.rejectedNodeCount || 0,
      pendingApprovalCount: item.pendingApprovalCount || 0,
      totalNodeRuns: item.totalNodeRuns || 0,
      latestActorAgentName: normalizeText(item.latestActorAgentName) || null,
      latestActivityNodeTitle: normalizeText(item.latestActivityNodeTitle) || null,
      latestActivityStatus: normalizeText(item.latestActivityStatus)
        ? item.latestActivityStatus as ApplicationRunHistoryItem['latestActivityStatus']
        : null,
      latestActivityAt: item.latestActivityAt || null,
      latestSystemNoticeExcerpt: normalizeText(item.latestSystemNoticeExcerpt) || null,
      latestMessageExcerpt: normalizeText(item.latestMessageExcerpt) || null,
      latestMessageSenderName: normalizeText(item.latestMessageSenderName) || null,
      latestApprovalActorName: normalizeText(item.latestApprovalActorName) || null,
      latestApprovalAction: normalizeText(item.latestApprovalAction)
        ? item.latestApprovalAction as ApplicationRunHistoryItem['latestApprovalAction']
        : null,
      latestApprovalStageTitle: normalizeText(item.latestApprovalStageTitle) || null,
      latestApprovalReason: normalizeText(item.latestApprovalReason) || null,
      latestCompletedNodeTitle: normalizeText(item.latestCompletedNodeTitle) || null,
      latestRejectedNodeTitle: normalizeText(item.latestRejectedNodeTitle) || null,
      latestPendingApprovalNodeTitle: normalizeText(item.latestPendingApprovalNodeTitle) || null,
      latestArtifactPath: normalizeText(item.latestArtifactPath) || null,
      latestArtifactTitle: normalizeText(item.latestArtifactTitle) || null,
      projectGitSnapshot: item.projectId || item.projectName || item.projectGitTrackedAt || item.projectTouchedFileCount || item.projectGitChangeCount
        ? {
            projectId: normalizeText(item.projectId) || null,
            projectName: normalizeText(item.projectName) || null,
            gitEnabled: !!item.projectGitEnabled,
            branch: normalizeText(item.projectGitBranch) || null,
            repoUrl: normalizeText(item.projectGitRepoUrl) || null,
            trackedAt: item.projectGitTrackedAt || null,
            aheadCount: item.projectGitAheadCount || 0,
            behindCount: item.projectGitBehindCount || 0,
            stagedCount: item.projectGitStagedCount || 0,
            modifiedCount: item.projectGitModifiedCount || 0,
            untrackedCount: item.projectGitUntrackedCount || 0,
            changeCount: item.projectGitChangeCount || 0,
            touchedFileCount: item.projectTouchedFileCount || 0,
            touchedFiles: parseStringArray(item.projectTouchedFilesJson),
            changes: parseGitChanges(item.projectGitChangesJson),
          }
        : null,
      updatedAt: item.updatedAt || null,
    })),
  )

  const selectedRunDetail = computed<ApplicationRunHistoryItem | null>(() => {
    const items = runHistory.value
    if (!items.length) return null

    if (selectedRunNumber.value) {
      return items.find(item => item.runNumber === selectedRunNumber.value) || items[0] || null
    }

    const currentRunNumber = runSummary.value.runNumber
    if (currentRunNumber) {
      return items.find(item => item.runNumber === currentRunNumber) || items[0] || null
    }

    return items[0] || null
  })

  const runNodes = computed<ApplicationRunNode[]>(() =>
    groupChatStore.workflowNodeRuns
      .slice()
      .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))
      .map(item => ({
        id: item.id,
        nodeId: item.nodeId,
        status: item.status,
        actorAgentName: normalizeText(item.actorAgentName) || null,
        artifactIds: parseArtifactIds(item.artifactIdsJson),
        startedAt: item.startedAt || null,
        completedAt: item.completedAt || null,
        updatedAt: item.updatedAt || null,
      })),
  )

  async function refreshRuns() {
    if (!applicationId.value) return
    await Promise.all([
      groupChatStore.loadWorkflowState(applicationId.value),
      groupChatStore.loadWorkflowArtifacts(applicationId.value, 30),
      groupChatStore.loadWorkflowRunHistory(applicationId.value, 12),
    ])
  }

  async function startRun() {
    if (!applicationId.value) return
    isSubmitting.value = true
    try {
      const actorName = await groupChatStore.ensureUserName()
      await groupChatStore.startWorkflowExecution(applicationId.value, {
        actorName: actorName || undefined,
        summary: launchBrief.value.trim() || undefined,
        artifactPath: launchArtifactPath.value.trim() || undefined,
      })
      await groupChatStore.loadWorkflowRunHistory(applicationId.value, 12)
      if (groupChatStore.workflowRunState?.runNumber) {
        selectedRunNumber.value = groupChatStore.workflowRunState.runNumber
      }
      launchBrief.value = ''
      launchArtifactPath.value = ''
    } finally {
      isSubmitting.value = false
    }
  }

  async function approveRun() {
    if (!applicationId.value) return
    isSubmitting.value = true
    try {
      await groupChatStore.submitWorkflowApproval(applicationId.value, {
        action: 'approve',
        actorName: runSummary.value.approvalOwnerName || undefined,
      })
      await groupChatStore.loadWorkflowRunHistory(applicationId.value, 12)
      if (groupChatStore.workflowRunState?.runNumber) {
        selectedRunNumber.value = groupChatStore.workflowRunState.runNumber
      }
      rejectReason.value = ''
    } finally {
      isSubmitting.value = false
    }
  }

  async function rejectRun() {
    if (!applicationId.value) return
    isSubmitting.value = true
    try {
      await groupChatStore.submitWorkflowApproval(applicationId.value, {
        action: 'reject',
        actorName: runSummary.value.approvalOwnerName || undefined,
        reason: rejectReason.value.trim(),
      })
      await groupChatStore.loadWorkflowRunHistory(applicationId.value, 12)
      if (groupChatStore.workflowRunState?.runNumber) {
        selectedRunNumber.value = groupChatStore.workflowRunState.runNumber
      }
      rejectReason.value = ''
    } finally {
      isSubmitting.value = false
    }
  }

  async function cancelRun() {
    if (!applicationId.value) return
    isSubmitting.value = true
    try {
      await groupChatStore.cancelWorkflowExecution(applicationId.value, {
        actorName: runSummary.value.approvalOwnerName || undefined,
      })
      await groupChatStore.loadWorkflowRunHistory(applicationId.value, 12)
      if (groupChatStore.workflowRunState?.runNumber) {
        selectedRunNumber.value = groupChatStore.workflowRunState.runNumber
      }
      rejectReason.value = ''
    } finally {
      isSubmitting.value = false
    }
  }

  function selectRun(runNumber: number | null) {
    if (!runNumber || Number.isNaN(runNumber)) {
      selectedRunNumber.value = null
      return
    }
    selectedRunNumber.value = runNumber
  }

  function reuseRunContext(item: ApplicationRunHistoryItem | null) {
    if (!item) return
    selectedRunNumber.value = item.runNumber
    launchBrief.value = item.kickoffSummary || ''
    launchArtifactPath.value = item.kickoffArtifactPath || ''
  }

  watch(
    [runHistory, () => runSummary.value.runNumber],
    ([items, currentRunNumber]) => {
      if (!items.length) {
        selectedRunNumber.value = null
        return
      }

      if (selectedRunNumber.value && items.some(item => item.runNumber === selectedRunNumber.value)) {
        return
      }

      if (currentRunNumber && items.some(item => item.runNumber === currentRunNumber)) {
        selectedRunNumber.value = currentRunNumber
        return
      }

      selectedRunNumber.value = items[0]?.runNumber || null
    },
    { immediate: true },
  )

  watch(applicationId, () => {
    initialize().catch(() => {
      // Keep runs view stable if runtime bootstrap fails.
    })
  }, { immediate: true })

  return {
    isLoading,
    isSubmitting,
    rejectReason,
    launchBrief,
    launchArtifactPath,
    selectedRunNumber,
    artifactOptions,
    runSummary,
    runNodes,
    runHistory,
    selectedRunDetail,
    initialize,
    refreshRuns,
    startRun,
    approveRun,
    rejectRun,
    cancelRun,
    selectRun,
    reuseRunContext,
  }
}
