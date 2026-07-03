import { computed, ref, watch, type Ref } from 'vue'
import { useGroupChatStore } from '@/stores/hermes/group-chat'
import type {
  ApplicationArtifactEntry,
  ApplicationArtifactPreview,
  ApplicationArtifactsGitState,
  ApplicationArtifactsSummary,
  ApplicationRunHistoryItem,
} from '@/types/workbench/application'

function normalizeText(value?: string | null): string {
  return String(value || '').trim()
}

export function useApplicationArtifactsWorkspace(applicationId: Ref<string>) {
  const groupChatStore = useGroupChatStore()

  const isLoading = ref(false)

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
        groupChatStore.loadWorkflowArtifacts(roomId, 100),
        groupChatStore.loadWorkflowRunHistory(roomId, 20),
      ])
      return
    }

    await Promise.all([
      groupChatStore.loadRoomProject(roomId),
      groupChatStore.loadArtifacts(roomId, ''),
      groupChatStore.loadWorkflowState(roomId),
      groupChatStore.loadWorkflowArtifacts(roomId, 100),
      groupChatStore.loadWorkflowRunHistory(roomId, 20),
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

  const summary = computed<ApplicationArtifactsSummary>(() => {
    const entries = groupChatStore.artifactEntries || []
    const treeSummary = groupChatStore.artifactTreeSummary
    const registeredArtifacts = groupChatStore.workflowArtifacts || []
    const currentNode = groupChatStore.workflowCurrentNode
    const nodeText = currentNode?.text

    return {
      rootDir: normalizeText(groupChatStore.artifactRootDir) || null,
      currentPath: groupChatStore.artifactCurrentPath || '',
      totalEntries: treeSummary?.totalEntryCount ?? entries.length,
      fileCount: treeSummary?.totalFileCount ?? entries.filter(entry => entry.type === 'file').length,
      directoryCount: treeSummary?.totalDirectoryCount ?? entries.filter(entry => entry.type === 'directory').length,
      latestArtifactName: normalizeText(treeSummary?.latestFileName) || null,
      registeredArtifactCount: registeredArtifacts.length,
      latestRegisteredArtifactTitle: normalizeText(registeredArtifacts[0]?.title)
        || normalizeText(registeredArtifacts[0]?.relativePath)
        || null,
      unlinkedFileCount: treeSummary?.unlinkedFileCount ?? 0,
      workflowArtifactRootDir: normalizeText(groupChatStore.currentWorkflowConfig?.runtime?.artifactRootDir) || null,
      runStatus: groupChatStore.workflowRunState?.status || null,
      currentNodeTitle: typeof nodeText === 'string'
        ? normalizeText(nodeText) || null
        : normalizeText(nodeText?.value) || null,
    }
  })

  const artifactEntries = computed<ApplicationArtifactEntry[]>(() =>
    groupChatStore.artifactEntries
      .map(entry => {
        const artifactMeta = groupChatStore.workflowArtifacts.find(item => item.relativePath === entry.relativePath)
        return {
          name: entry.name,
          path: entry.path,
          relativePath: entry.relativePath,
          type: entry.type,
          size: entry.size,
          updatedAt: entry.updatedAt,
          sourceRunNumber: artifactMeta?.runNumber || null,
        }
      })
      .sort((left, right) => {
        if (left.type !== right.type) {
          return left.type === 'directory' ? -1 : 1
        }
        if ((left.sourceRunNumber || 0) !== (right.sourceRunNumber || 0)) {
          return (right.sourceRunNumber || 0) - (left.sourceRunNumber || 0)
        }
        return (right.updatedAt || 0) - (left.updatedAt || 0)
      }),
  )

  const currentArtifact = computed<ApplicationArtifactPreview | null>(() =>
    groupChatStore.artifactCurrentFile
      ? (() => {
          const artifactMeta = groupChatStore.workflowArtifacts.find(item => item.relativePath === groupChatStore.artifactCurrentFile?.relativePath)
          return {
            rootDir: groupChatStore.artifactCurrentFile.rootDir,
            relativePath: groupChatStore.artifactCurrentFile.relativePath,
            fileName: groupChatStore.artifactCurrentFile.fileName,
            content: groupChatStore.artifactCurrentFile.content,
            language: groupChatStore.artifactCurrentFile.language,
            sourceRunNumber: artifactMeta?.runNumber || null,
          }
        })()
      : null,
  )

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
      projectGitSnapshot: null,
      updatedAt: item.updatedAt || null,
    })),
  )

  const gitState = computed<ApplicationArtifactsGitState>(() => {
    const currentProject = groupChatStore.currentProject?.project || null
    const diff = groupChatStore.projectGitDiff
    const status = groupChatStore.projectGitStatus

    return {
      hasProject: !!currentProject?.id,
      projectName: normalizeText(currentProject?.name) || null,
      projectLocalPath: normalizeText(currentProject?.localPath) || null,
      gitEnabled: !!diff?.gitEnabled || !!status?.gitEnabled,
      currentBranch: normalizeText(diff?.currentBranch) || normalizeText(status?.currentBranch) || null,
      aheadCount: diff?.aheadCount ?? status?.aheadCount ?? 0,
      behindCount: diff?.behindCount ?? status?.behindCount ?? 0,
      changeCount: diff?.changes.length ?? 0,
      stagedCount: diff?.staged.length ?? status?.staged.length ?? 0,
      modifiedCount: diff?.modified.length ?? status?.modified.length ?? 0,
      untrackedCount: diff?.untracked.length ?? status?.untracked.length ?? 0,
      changes: (diff?.changes || []).map(item => ({
        relativePath: item.relativePath,
        displayPath: item.displayPath,
        kind: item.kind,
        staged: item.staged,
        modified: item.modified,
        untracked: item.untracked,
        conflicted: item.conflicted,
      })),
      selectedPath: normalizeText(diff?.selectedPath) || null,
      selectedDisplayPath: normalizeText(diff?.selectedDisplayPath) || null,
      selectedKind: normalizeText(diff?.selectedKind)
        ? diff?.selectedKind || null
        : null,
      selectedContent: diff?.selectedContent || '',
      selectedContentMode: diff?.selectedContentMode || 'empty',
      selectedTruncated: !!diff?.selectedTruncated,
    }
  })

  async function openArtifactPath(path: string, type: 'file' | 'directory') {
    if (!applicationId.value) return
    if (type === 'directory') {
      await groupChatStore.loadArtifacts(applicationId.value, path)
      return
    }
    await groupChatStore.openArtifact(applicationId.value, path)
  }

  async function openArtifactFile(path: string) {
    if (!applicationId.value || !path) return
    const parentPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
    await groupChatStore.loadArtifacts(applicationId.value, parentPath)
    await groupChatStore.openArtifact(applicationId.value, path)
  }

  async function openArtifactParent() {
    if (!applicationId.value) return
    const current = groupChatStore.artifactCurrentPath || ''
    const next = current.includes('/') ? current.slice(0, current.lastIndexOf('/')) : ''
    await groupChatStore.loadArtifacts(applicationId.value, next)
  }

  async function refreshArtifacts() {
    if (!applicationId.value) return
    await Promise.all([
      groupChatStore.loadRoomProject(applicationId.value),
      groupChatStore.loadArtifacts(applicationId.value, groupChatStore.artifactCurrentPath || ''),
      groupChatStore.loadWorkflowState(applicationId.value),
      groupChatStore.loadWorkflowArtifacts(applicationId.value, 100),
      groupChatStore.loadWorkflowRunHistory(applicationId.value, 20),
    ])
  }

  async function openGitChange(path: string) {
    const projectId = groupChatStore.currentProject?.project?.id
    if (!projectId) return
    await groupChatStore.loadProjectGitDiff(projectId, path)
  }

  async function refreshGitChanges() {
    const projectId = groupChatStore.currentProject?.project?.id
    if (!projectId) return
    await Promise.all([
      groupChatStore.loadProjectGitStatus(projectId),
      groupChatStore.loadProjectGitBranches(projectId),
      groupChatStore.loadProjectGitDiff(projectId, groupChatStore.projectGitDiff?.selectedPath || ''),
    ])
  }

  watch(applicationId, () => {
    initialize().catch(() => {
      // Keep UI available if artifact bootstrap fails.
    })
  }, { immediate: true })

  return {
    isLoading,
    summary,
    artifactEntries,
    runHistory,
    currentArtifact,
    gitState,
    initialize,
    openArtifactPath,
    openArtifactFile,
    openArtifactParent,
    refreshArtifacts,
    openGitChange,
    refreshGitChanges,
  }
}
