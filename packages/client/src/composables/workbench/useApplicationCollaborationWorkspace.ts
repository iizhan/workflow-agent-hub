import { computed, ref, watch, type Ref } from 'vue'
import { useGroupChatStore } from '@/stores/hermes/group-chat'
import type { ApplicationCollaborationSummary } from '@/types/workbench/application'

function normalizeText(value?: string | null): string {
  return String(value || '').trim()
}

export function useApplicationCollaborationWorkspace(applicationId: Ref<string>) {
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
      return
    }

    await Promise.all([
      groupChatStore.loadRoomRuntime(roomId),
      groupChatStore.loadWorkflowState(roomId),
      groupChatStore.loadArtifacts(roomId, groupChatStore.artifactCurrentPath || ''),
      groupChatStore.loadRoomProject(roomId),
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

  const summary = computed<ApplicationCollaborationSummary>(() => {
    const currentNode = groupChatStore.workflowCurrentNode
    const nodeText = currentNode?.text

    return {
      roomId: applicationId.value,
      roomName: normalizeText(groupChatStore.roomName) || normalizeText(applicationId.value),
      memberCount: groupChatStore.members.length,
      onlineAgentCount: groupChatStore.currentRoomRuntime?.onlineAgents || 0,
      totalAgentCount: groupChatStore.currentRoomRuntime?.totalAgents || groupChatStore.agents.length,
      activeNodeTitle: typeof nodeText === 'string'
        ? normalizeText(nodeText) || null
        : normalizeText(nodeText?.value) || null,
      activeRoleName: normalizeText(String(currentNode?.properties?.roleName || '')) || null,
      runStatus: groupChatStore.workflowRunState?.status || 'idle',
      pendingApprovalCount: groupChatStore.workflowNodeRuns.filter(item => item.status === 'waiting_approval').length,
      artifactCount: groupChatStore.artifactEntries.filter(entry => entry.type === 'file').length,
      projectBound: !!groupChatStore.currentProject?.project?.id,
    }
  })

  async function refresh() {
    if (!applicationId.value) return
    await ensureRoomReady()
  }

  watch(applicationId, () => {
    initialize().catch(() => {
      // Keep collaboration shell resilient if runtime bootstrap fails.
    })
  }, { immediate: true })

  return {
    isLoading,
    summary,
    initialize,
    refresh,
  }
}
