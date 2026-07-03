import { io } from 'socket.io-client'
import { request, getApiKey } from '../client'

// ─── Types ──────────────────────────────────────────────────

export interface RoomInfo {
    id: string
    name: string
    inviteCode: string | null
    isSystemPreset?: number
    isActive?: number
    presetKey?: string
    workflowName?: string
    workflowPrompt?: string
    workflowConfigJson?: string
    defaultAgentsJson?: string
    triggerTokens?: number
    maxHistoryTokens?: number
    tailMessageCount?: number
    totalTokens?: number
}

export interface WorkflowStageConfig {
    id: string
    name: string
    roleName: string
    assignedAgentId?: string
    deliverable: string
    needsAdminConfirm: boolean
    prompt?: string
}

export interface WorkflowRoomConfig {
    mode?: 'freeform' | 'stage-gated'
    ownerRoleName?: string
    ownerUserName?: string
    stages?: WorkflowStageConfig[]
    version?: number
    editor?: {
        type?: 'logicflow'
        viewport?: { x?: number; y?: number; zoom?: number }
    }
    graph?: {
        nodes?: Array<Record<string, any>>
        edges?: Array<Record<string, any>>
    }
    runtime?: {
        startNodeId?: string
        artifactRootDir?: string
        allowManualJump?: boolean
    }
}

export interface WorkflowExecutionRunState {
    roomId: string
    workflowVersion: number
    runNumber: number
    status: 'idle' | 'running' | 'paused' | 'completed' | 'failed'
    currentNodeId: string
    kickoffSummary: string
    kickoffArtifactPath: string
    startedAt: number
    updatedAt: number
}

export interface WorkflowExecutionNodeState {
    id: string
    type: string
    text?: string | { value?: string }
    properties?: Record<string, any>
}

export interface WorkflowNodeRunState {
    id: string
    roomId: string
    nodeId: string
    status: 'pending' | 'running' | 'waiting_approval' | 'completed' | 'rejected' | 'skipped'
    actorAgentName: string
    artifactIdsJson: string
    startedAt: number
    completedAt: number
    updatedAt: number
}

export interface WorkflowExecutionStateResult {
    run: WorkflowExecutionRunState | null
    currentNode: WorkflowExecutionNodeState | null
    nodeRuns: WorkflowNodeRunState[]
}

export interface WorkflowArtifactRecordSummary {
    id: string
    roomId: string
    nodeId: string
    runNumber: number
    relativePath: string
    format: string
    title: string
    summary: string
    createdBy: string
    createdAt: number
    confirmedBy: string
    confirmedAt: number
}

export interface WorkflowRunHistoryRecord {
    id: string
    roomId: string
    runNumber: number
    workflowVersion: number
    status: string
    currentNodeId: string
    currentNodeTitle: string
    kickoffSummary: string
    kickoffArtifactPath: string
    startedAt: number
    endedAt: number
    completedNodeCount: number
    rejectedNodeCount: number
    pendingApprovalCount: number
    totalNodeRuns: number
    latestActorAgentName: string
    latestActivityNodeTitle: string
    latestActivityStatus: string
    latestActivityAt: number
    latestSystemNoticeExcerpt: string
    latestMessageExcerpt: string
    latestMessageSenderName: string
    latestApprovalActorName: string
    latestApprovalAction: string
    latestApprovalStageTitle: string
    latestApprovalReason: string
    latestCompletedNodeTitle: string
    latestRejectedNodeTitle: string
    latestPendingApprovalNodeTitle: string
    latestArtifactPath: string
    latestArtifactTitle: string
    projectId: string
    projectName: string
    projectGitEnabled: number
    projectGitBranch: string
    projectGitRepoUrl: string
    projectGitTrackedAt: number
    projectGitAheadCount: number
    projectGitBehindCount: number
    projectGitStagedCount: number
    projectGitModifiedCount: number
    projectGitUntrackedCount: number
    projectGitChangeCount: number
    projectTouchedFileCount: number
    projectTouchedFilesJson: string
    projectGitChangesJson: string
    updatedAt: number
}

export interface StartWorkflowRunResult extends WorkflowExecutionStateResult {
    runtime: RoomRuntimeSummary
    kickoffMessage: ChatMessage | null
}

export interface WorkflowTemplate {
    id: string
    name: string
    description?: string
    workflowPrompt: string
    workflowConfig?: WorkflowRoomConfig
    agents: AgentConfigInput[]
    tags?: string[]
    updatedAt?: number
    readme?: string
    iconDataUrl?: string
    iconFileName?: string
    sourceType?: 'json' | 'package'
}

export interface RoomAgent {
    id: string
    roomId: string
    agentId: string
    profile: string
    name: string
    description: string
    avatar?: string
    systemPrompt?: string
    model?: string
    temperature?: number | null
    invited: number
}

export interface ChatMessage {
    id: string
    roomId: string
    senderId: string
    senderName: string
    content: string
    timestamp: number
}

export interface MemberInfo {
    id: string
    userId: string
    name: string
    description: string
    joinedAt: number
}

export interface JoinResult {
    roomId: string
    roomName: string
    members: MemberInfo[]
    messages: ChatMessage[]
    rooms: string[]
}

export interface GroupChatArtifactEntry {
    name: string
    path: string
    relativePath: string
    type: 'file' | 'directory'
    size: number
    updatedAt: number
}

export interface GroupChatArtifactListResult {
    rootDir: string
    currentPath: string
    entries: GroupChatArtifactEntry[]
    summary: {
        totalEntryCount: number
        totalFileCount: number
        totalDirectoryCount: number
        latestFileName: string
        unlinkedFileCount: number
    }
}

export interface GroupChatArtifactContentResult {
    rootDir: string
    relativePath: string
    fileName: string
    content: string
    language: string
}

export interface ProjectPermissionConfig {
    allowRead?: boolean
    allowWrite?: boolean
    allowCommit?: boolean
    allowPush?: boolean
    pushRequireApproval?: boolean
}

export interface ProjectRecord {
    id: string
    name: string
    description: string
    sourceType: string
    localPath: string
    repoUrl: string
    defaultBranch: string
    currentBranch: string
    gitEnabled: number
    gitAuthType: string
    artifactRootMode: string
    artifactRootPath: string
    createdAt: number
    updatedAt: number
}

export interface RoomProjectBindingRecord {
    id: string
    roomId: string
    projectId: string
    isPrimary: number
    allowRead: number
    allowWrite: number
    allowCommit: number
    allowPush: number
    pushRequireApproval: number
    createdAt: number
    updatedAt: number
}

export interface RoomProjectResult {
    project: ProjectRecord
    binding: RoomProjectBindingRecord
}

export interface RoomRuntimeSummary {
    roomId: string
    isActive: boolean
    onlineAgents: number
    totalAgents: number
}

export interface ProjectTreeEntry {
    name: string
    path: string
    relativePath: string
    type: 'file' | 'directory'
    size: number
    updatedAt: number
}

export interface ProjectFileContentResult {
    relativePath: string
    fileName: string
    content: string
    language: string
}

export interface ProjectGitStatusResult {
    gitEnabled: boolean
    currentBranch: string
    defaultBranch: string
    repoUrl: string
    aheadCount: number
    behindCount: number
    staged: string[]
    modified: string[]
    untracked: string[]
}

export interface ProjectGitBranchResult {
    currentBranch: string
    localBranches: string[]
    remoteBranches: string[]
    defaultBranch: string
}

export interface ProjectGitChangeEntry {
    relativePath: string
    displayPath: string
    kind: 'staged' | 'modified' | 'untracked' | 'mixed' | 'conflicted'
    indexStatus: string
    workTreeStatus: string
    staged: boolean
    modified: boolean
    untracked: boolean
    conflicted: boolean
}

export interface ProjectGitDiffResult extends ProjectGitStatusResult {
    changes: ProjectGitChangeEntry[]
    selectedPath: string
    selectedDisplayPath: string
    selectedKind: ProjectGitChangeEntry['kind'] | ''
    selectedContent: string
    selectedContentMode: 'diff' | 'text' | 'binary' | 'empty'
    selectedTruncated: boolean
}

// ─── Socket.IO Client ──────────────────────────────────────

let socket: ReturnType<typeof io> | null = null

export function connectGroupChat(opts?: { userId?: string; userName?: string; description?: string }): ReturnType<typeof io> {
    if (socket?.connected) return socket

    const token = getApiKey()
    const userId = opts?.userId || localStorage.getItem('gc_user_id') || generateUUID()
    localStorage.setItem('gc_user_id', userId)

    socket = io('/group-chat', {
        auth: {
            token: token || undefined,
            userId,
            name: opts?.userName || localStorage.getItem('gc_user_name') || undefined,
            description: opts?.description || localStorage.getItem('gc_user_description') || undefined,
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
    })

    return socket
}

export function getStoredUserId(): string {
    let id = localStorage.getItem('gc_user_id')
    if (!id) {
        id = generateUUID()
        localStorage.setItem('gc_user_id', id)
    }
    return id
}

export function getStoredUserName(): string | null {
    return localStorage.getItem('gc_user_name')
}

export function getStoredUserDescription(): string | null {
    return localStorage.getItem('gc_user_description')
}

function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

export function getSocket(): ReturnType<typeof io> | null {
    return socket?.connected ? socket : null
}

export function disconnectGroupChat(): void {
    if (socket) {
        socket.disconnect()
        socket = null
    }
}

// ─── REST API ───────────────────────────────────────────────

export async function createRoom(data: {
    name: string
    inviteCode: string
    agents?: AgentConfigInput[]
    compression?: { triggerTokens?: number; maxHistoryTokens?: number; tailMessageCount?: number }
    workflow?: { workflowName?: string; workflowPrompt?: string; workflowConfig?: WorkflowRoomConfig }
}): Promise<{ room: RoomInfo; agents: RoomAgent[] }> {
    return request('/api/hermes/group-chat/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
}

export async function listRooms(): Promise<{ rooms: RoomInfo[] }> {
    return request('/api/hermes/group-chat/rooms')
}

export async function getRoomDetail(roomId: string): Promise<{ room: RoomInfo; messages: ChatMessage[]; agents: RoomAgent[]; members: MemberInfo[] }> {
    return request(`/api/hermes/group-chat/rooms/${roomId}`)
}

export async function getRoomRuntime(roomId: string): Promise<{ runtime: RoomRuntimeSummary }> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/runtime`)
}

export async function updateRoomActivation(roomId: string, active: boolean): Promise<{ room: RoomInfo; runtime: RoomRuntimeSummary }> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/activation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
    })
}

export async function joinRoomByCode(code: string): Promise<{ room: RoomInfo }> {
    return request(`/api/hermes/group-chat/rooms/join/${code}`)
}

export async function updateInviteCode(roomId: string, inviteCode: string): Promise<void> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/invite-code`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode }),
    })
}

export async function addAgent(roomId: string, data: {
    profile: string
    name?: string
    description?: string
    avatar?: string
    systemPrompt?: string
    model?: string
    temperature?: number | null
    invited?: boolean
    operatorName?: string
}): Promise<{ agent: RoomAgent }> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
}

export async function updateAgent(roomId: string, agentId: string, data: AgentConfigInput): Promise<{ agent: RoomAgent }> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
}

export async function listAgents(roomId: string): Promise<{ agents: RoomAgent[] }> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/agents`)
}

export async function removeAgent(roomId: string, agentId: string, operatorName?: string): Promise<void> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/agents/${agentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorName }),
    })
}

export async function deleteRoom(roomId: string): Promise<void> {
    return request(`/api/hermes/group-chat/rooms/${roomId}`, {
        method: 'DELETE',
    })
}

export async function updateRoomConfig(roomId: string, config: { triggerTokens?: number; maxHistoryTokens?: number; tailMessageCount?: number }): Promise<{ room: RoomInfo }> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
    })
}

export async function forceCompress(roomId: string): Promise<{ success: boolean; summary: string }> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/compress`, {
        method: 'POST',
    })
}

export interface AgentConfigInput {
    profile: string
    name?: string
    description?: string
    avatar?: string
    systemPrompt?: string
    model?: string
    temperature?: number | null
    invited?: boolean
    operatorName?: string
}

export async function updateRoomWorkflow(roomId: string, workflow: { workflowName?: string; workflowPrompt?: string }): Promise<{ room: RoomInfo }> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/workflow`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow),
    })
}

export async function getRoomWorkflowConfig(roomId: string): Promise<{ workflowConfig: WorkflowRoomConfig }> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/workflow-config`)
}

export async function updateRoomWorkflowConfig(
    roomId: string,
    payload: {
        workflowName?: string
        workflowPrompt?: string
        workflowConfig: WorkflowRoomConfig
        operatorName?: string
        workflowTemplateName?: string
        changeNote?: string
        changeMeta?: {
            summary?: string
            impactScope?: string
            rollbackPlan?: string
            executionNotes?: string
        }
    },
): Promise<{ room: RoomInfo; workflowConfig: WorkflowRoomConfig }> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/workflow-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
}

export async function getRoomWorkflowState(roomId: string): Promise<WorkflowExecutionStateResult> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/workflow-state`)
}

export async function startRoomWorkflowRun(
    roomId: string,
    payload?: {
        actorName?: string
        content?: string
        summary?: string
        artifactPath?: string
    },
): Promise<StartWorkflowRunResult> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/start-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
    })
}

export async function listRoomWorkflowArtifacts(roomId: string, limit = 20): Promise<{ artifacts: WorkflowArtifactRecordSummary[] }> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/workflow-artifacts?limit=${encodeURIComponent(String(limit))}`)
}

export async function listRoomWorkflowRunHistory(roomId: string, limit = 20): Promise<{ history: WorkflowRunHistoryRecord[] }> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/workflow-run-history?limit=${encodeURIComponent(String(limit))}`)
}

export async function submitRoomWorkflowApproval(
    roomId: string,
    payload: {
        action: 'approve' | 'reject'
        actorName?: string
        reason?: string
    },
): Promise<WorkflowExecutionStateResult> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/workflow-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
}

export async function cancelRoomWorkflowExecution(
    roomId: string,
    payload?: {
        actorName?: string
        reason?: string
    },
): Promise<WorkflowExecutionStateResult> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/workflow-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
    })
}

export async function saveDefaultAgents(roomId: string, agents?: AgentConfigInput[]): Promise<{ room: RoomInfo; agents: AgentConfigInput[] }> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/default-agents`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agents }),
    })
}

export async function applyDefaultAgents(roomId: string): Promise<{ agents: RoomAgent[]; added: RoomAgent[] }> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/default-agents/apply`, {
        method: 'POST',
    })
}

export async function listWorkflowTemplates(): Promise<{ workflows: WorkflowTemplate[] }> {
    return request('/api/hermes/group-chat/workflows')
}

export async function bindLocalProject(data: {
    name?: string
    description?: string
    localPath: string
    roomId?: string
    permissions?: ProjectPermissionConfig
}): Promise<{ project: ProjectRecord; binding: RoomProjectBindingRecord | null }> {
    return request('/api/hermes/projects/local-bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
}

export async function listProjects(): Promise<{ projects: ProjectRecord[] }> {
    return request('/api/hermes/projects')
}

export async function getRoomProject(roomId: string): Promise<{ roomProject: RoomProjectResult | null }> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/project`)
}

export async function bindRoomProject(roomId: string, projectId: string, permissions?: ProjectPermissionConfig): Promise<{ binding: RoomProjectBindingRecord; roomProject: RoomProjectResult | null }> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/project`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, permissions }),
    })
}

export async function getProjectDetail(projectId: string): Promise<{ project: ProjectRecord }> {
    return request(`/api/hermes/projects/${projectId}`)
}

export async function listProjectFiles(projectId: string, path = ''): Promise<{ entries: ProjectTreeEntry[]; path: string }> {
    const query = path ? `?path=${encodeURIComponent(path)}` : ''
    return request(`/api/hermes/projects/${projectId}/files${query}`)
}

export async function getProjectFileContent(projectId: string, path: string): Promise<ProjectFileContentResult> {
    return request(`/api/hermes/projects/${projectId}/file-content?path=${encodeURIComponent(path)}`)
}

export async function getProjectGitStatus(projectId: string): Promise<ProjectGitStatusResult> {
    return request(`/api/hermes/projects/${projectId}/git/status`)
}

export async function getProjectGitBranches(projectId: string): Promise<ProjectGitBranchResult> {
    return request(`/api/hermes/projects/${projectId}/git/branches`)
}

export async function getProjectGitDiff(projectId: string, path = ''): Promise<ProjectGitDiffResult> {
    const query = path ? `?path=${encodeURIComponent(path)}` : ''
    return request(`/api/hermes/projects/${projectId}/git/diff${query}`)
}

export async function getWorkflowTemplate(id: string): Promise<{ workflow: WorkflowTemplate }> {
    return request(`/api/hermes/group-chat/workflows/${id}`)
}

export async function saveWorkflowTemplate(data: Partial<WorkflowTemplate>): Promise<{ workflow: WorkflowTemplate }> {
    return request('/api/hermes/group-chat/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
}

export async function deleteWorkflowTemplate(id: string): Promise<{ success: boolean }> {
    return request(`/api/hermes/group-chat/workflows/${id}`, {
        method: 'DELETE',
    })
}

export async function listRoomArtifacts(roomId: string, path = ''): Promise<GroupChatArtifactListResult> {
    const query = path ? `?path=${encodeURIComponent(path)}` : ''
    return request(`/api/hermes/group-chat/rooms/${roomId}/artifacts${query}`)
}

export async function getRoomArtifactContent(roomId: string, path: string): Promise<GroupChatArtifactContentResult> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/artifacts/content?path=${encodeURIComponent(path)}`)
}

export async function clearRoomMessages(roomId: string, payload?: { actorName?: string }): Promise<{ cleared: boolean }> {
    return request(`/api/hermes/group-chat/rooms/${roomId}/messages/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
    })
}
