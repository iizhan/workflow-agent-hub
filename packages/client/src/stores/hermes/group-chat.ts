import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchAuthStatus } from '@/api/auth'
import {
    connectGroupChat,
    disconnectGroupChat,
    getSocket,
    getStoredUserId,
    getStoredUserDescription,
    getStoredUserName,
    type RoomInfo,
    type RoomAgent,
    type ChatMessage,
    type MemberInfo,
    createRoom,
    listRooms,
    getRoomDetail,
    joinRoomByCode,
    addAgent,
    updateAgent,
    listAgents,
    removeAgent,
    deleteRoom as deleteRoomApi,
    saveDefaultAgents,
    applyDefaultAgents,
    listWorkflowTemplates,
    getWorkflowTemplate,
    saveWorkflowTemplate,
    deleteWorkflowTemplate,
    listRoomArtifacts,
    getRoomArtifactContent,
    clearRoomMessages as clearRoomMessagesApi,
    type AgentConfigInput,
    type GroupChatArtifactEntry,
    type GroupChatArtifactContentResult,
    type ProjectFileContentResult,
    type ProjectGitBranchResult,
    type ProjectGitDiffResult,
    type ProjectGitStatusResult,
    type ProjectPermissionConfig,
    type ProjectRecord,
    type ProjectTreeEntry,
    type RoomProjectResult,
    type RoomRuntimeSummary,
    type WorkflowArtifactRecordSummary,
    type WorkflowExecutionNodeState,
    type WorkflowExecutionRunState,
    type WorkflowExecutionStateResult,
    type WorkflowRunHistoryRecord,
    type WorkflowNodeRunState,
    type WorkflowTemplate,
    type WorkflowRoomConfig,
    listRoomWorkflowArtifacts,
    listRoomWorkflowRunHistory,
    startRoomWorkflowRun,
    getRoomRuntime,
    submitRoomWorkflowApproval,
    cancelRoomWorkflowExecution,
    getRoomWorkflowState,
    bindLocalProject,
    bindRoomProject,
    getProjectDetail,
    getProjectFileContent,
    getProjectGitBranches,
    getProjectGitDiff,
    getProjectGitStatus,
    getRoomProject,
    listProjects,
    listProjectFiles,
    updateRoomActivation,
} from '@/api/hermes/group-chat'

export const useGroupChatStore = defineStore('groupChat', () => {
    // ─── State ─────────────────────────────────────────────
    const connected = ref(false)
    const currentRoomId = ref<string | null>(null)
    const rooms = ref<RoomInfo[]>([])
    const messages = ref<ChatMessage[]>([])
    const members = ref<MemberInfo[]>([])
    const agents = ref<RoomAgent[]>([])
    const roomName = ref('')
    const currentRoomRuntime = ref<RoomRuntimeSummary | null>(null)
    const currentWorkflowConfig = ref<WorkflowRoomConfig | null>(null)
    const workflowRunState = ref<WorkflowExecutionRunState | null>(null)
    const workflowCurrentNode = ref<WorkflowExecutionNodeState | null>(null)
    const workflowNodeRuns = ref<WorkflowNodeRunState[]>([])
    const workflowArtifacts = ref<WorkflowArtifactRecordSummary[]>([])
    const workflowRunHistory = ref<WorkflowRunHistoryRecord[]>([])
    const workflowTemplates = ref<WorkflowTemplate[]>([])
    const currentProject = ref<RoomProjectResult | null>(null)
    const availableProjects = ref<ProjectRecord[]>([])
    const projectEntries = ref<ProjectTreeEntry[]>([])
    const projectCurrentPath = ref('')
    const projectCurrentFile = ref<ProjectFileContentResult | null>(null)
    const projectGitStatus = ref<ProjectGitStatusResult | null>(null)
    const projectGitBranches = ref<ProjectGitBranchResult | null>(null)
    const projectGitDiff = ref<ProjectGitDiffResult | null>(null)
    const artifactRootDir = ref('')
    const artifactCurrentPath = ref('')
    const artifactEntries = ref<GroupChatArtifactEntry[]>([])
    const artifactTreeSummary = ref<{
        totalEntryCount: number
        totalFileCount: number
        totalDirectoryCount: number
        latestFileName: string
        unlinkedFileCount: number
    } | null>(null)
    const artifactCurrentFile = ref<GroupChatArtifactContentResult | null>(null)
    const isJoining = ref(false)
    const error = ref<string | null>(null)
    const typingUsers = ref<Map<string, { name: string; timer: ReturnType<typeof setTimeout> }>>(new Map())
    const contextStatuses = ref<Map<string, { agentName: string; status: string }>>(new Map())

    // Computed: returns first active status for backward compat
    const contextStatus = computed(() => {
        for (const [, status] of contextStatuses.value) {
            return status
        }
        return null
    })
    const userId = ref(getStoredUserId())
    const userName = ref(getStoredUserName() || '')
    const userDescription = ref(getStoredUserDescription() || '')

    // ─── Computed ───────────────────────────────────────────
    const sortedMessages = computed(() => {
        return [...messages.value].sort((a, b) => a.timestamp - b.timestamp)
    })

    const memberNames = computed(() => {
        return members.value.map(m => m.name)
    })

    const typingNames = computed(() => {
        return Array.from(typingUsers.value.values()).map(u => u.name)
    })

    const typingText = computed(() => {
        const names = typingNames.value
        if (names.length === 0) return ''
        if (names.length === 1) return `${names[0]} is typing...`
        if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`
        return `${names[0]} and ${names.length - 1} others are typing...`
    })

    const workflowActiveRoleName = computed(() => {
        return String(workflowCurrentNode.value?.properties?.roleName || '')
    })

    const workflowCurrentNodeType = computed(() => {
        return String(workflowCurrentNode.value?.properties?.workflowNodeType || '')
    })

    const workflowCurrentNodeTitle = computed(() => {
        const text = workflowCurrentNode.value?.text
        return typeof text === 'string' ? text : String(text?.value || '')
    })

    let _workflowStateTimer: ReturnType<typeof setTimeout> | null = null

    function scheduleWorkflowStateRefresh(delay = 200) {
        if (!currentRoomId.value) return
        if (_workflowStateTimer) clearTimeout(_workflowStateTimer)
        _workflowStateTimer = setTimeout(() => {
            _workflowStateTimer = null
            if (currentRoomId.value) {
                loadWorkflowState(currentRoomId.value).catch(() => { /* ignore */ })
            }
        }, delay)
    }

    // ─── Connection ────────────────────────────────────────
    function connect() {
        const socket = connectGroupChat({
            userId: userId.value,
            userName: userName.value || undefined,
            description: userDescription.value || undefined,
        })
        console.log('[GroupChat] connecting...', { userId: userId.value, userName: userName.value })

        socket.on('connect', () => {
            console.log('[GroupChat] connected, socket id:', socket.id)
            connected.value = true
            error.value = null
        })

        socket.on('disconnect', (reason) => {
            console.log('[GroupChat] disconnected:', reason)
            connected.value = false
        })

        socket.on('connect_error', (err: Error) => {
            console.error('[GroupChat] connect_error:', err.message)
            error.value = err.message
            connected.value = false
        })

        socket.on('message', (msg: ChatMessage) => {
            if (msg.roomId === currentRoomId.value) {
                messages.value.push(msg)
                scheduleWorkflowStateRefresh()
            }
        })

        socket.on('member_joined', (data: { roomId: string; members: MemberInfo[] }) => {
            if (data.roomId === currentRoomId.value) {
                members.value = data.members
            }
        })

        socket.on('member_left', (data: { roomId: string; members: MemberInfo[] }) => {
            if (data.roomId === currentRoomId.value) {
                members.value = data.members
            }
        })

        socket.on('typing', (data: { roomId: string; userId: string; userName: string }) => {
            if (data.roomId === currentRoomId.value && !typingUsers.value.has(data.userId)) {
                const timer = setTimeout(() => typingUsers.value.delete(data.userId), 5000)
                typingUsers.value.set(data.userId, { name: data.userName, timer })
            }
        })

        socket.on('stop_typing', (data: { roomId: string; userId: string }) => {
            if (data.roomId === currentRoomId.value && typingUsers.value.has(data.userId)) {
                const entry = typingUsers.value.get(data.userId)!
                clearTimeout(entry.timer)
                typingUsers.value.delete(data.userId)
            }
        })

        socket.on('context_status', (data: { roomId: string; agentName: string; status: string }) => {
            if (data.roomId === currentRoomId.value) {
                if (data.status === 'ready') {
                    contextStatuses.value.delete(data.agentName)
                } else {
                    contextStatuses.value.set(data.agentName, { agentName: data.agentName, status: data.status })
                }
                // Trigger reactivity
                contextStatuses.value = new Map(contextStatuses.value)
                scheduleWorkflowStateRefresh(80)
            }
        })

        socket.on('room_updated', (data: { roomId: string; totalTokens: number }) => {
            const room = rooms.value.find(r => r.id === data.roomId)
            if (room) room.totalTokens = data.totalTokens
        })
    }

    function disconnect() {
        disconnectGroupChat()
        connected.value = false
        currentRoomId.value = null
        messages.value = []
        members.value = []
        agents.value = []
        roomName.value = ''
        currentRoomRuntime.value = null
        currentWorkflowConfig.value = null
        workflowRunState.value = null
        workflowCurrentNode.value = null
        workflowNodeRuns.value = []
        workflowArtifacts.value = []
        workflowRunHistory.value = []
        currentProject.value = null
        projectEntries.value = []
        projectCurrentPath.value = ''
        projectCurrentFile.value = null
        projectGitStatus.value = null
        projectGitBranches.value = null
        projectGitDiff.value = null
        artifactRootDir.value = ''
        artifactCurrentPath.value = ''
        artifactEntries.value = []
        artifactTreeSummary.value = null
        artifactCurrentFile.value = null
        typingUsers.value.clear()
        contextStatuses.value.clear()
        if (_workflowStateTimer) {
            clearTimeout(_workflowStateTimer)
            _workflowStateTimer = null
        }
    }

    function setUserInfo(name: string, description: string) {
        userName.value = name
        userDescription.value = description
        localStorage.setItem('gc_user_name', name)
        localStorage.setItem('gc_user_description', description)
    }

    async function switchUserInfo(name: string, description = '') {
        const roomId = currentRoomId.value
        const previousName = userName.value
        const previousDescription = userDescription.value
        setUserInfo(name, description)
        if (!roomId) return
        try {
            await joinRoom(roomId)
        } catch (err) {
            setUserInfo(previousName, previousDescription)
            throw err
        }
    }

    async function ensureUserName() {
        const current = userName.value.trim()
        if (current) return current

        const stored = String(localStorage.getItem('gc_user_name') || '').trim()
        if (stored) {
            userName.value = stored
            return stored
        }

        try {
            const status = await fetchAuthStatus()
            const fallback = String(status.username || '').trim()
            if (fallback) {
                userName.value = fallback
                localStorage.setItem('gc_user_name', fallback)
                return fallback
            }
        } catch {
            // Ignore auth status failures and keep the anonymous fallback below.
        }

        return ''
    }

    // ─── Room Actions ──────────────────────────────────────
    async function joinRoom(roomId: string) {
        isJoining.value = true
        error.value = null

        try {
            await ensureUserName()
            const res = await getRoomDetail(roomId)
            currentRoomId.value = res.room.id
            roomName.value = res.room.name
            messages.value = res.messages
            agents.value = res.agents
            members.value = res.members || []
            try {
                currentWorkflowConfig.value = res.room.workflowConfigJson ? JSON.parse(res.room.workflowConfigJson) : null
            } catch {
                currentWorkflowConfig.value = null
            }
            await Promise.all([
                loadRoomProject(roomId),
                loadArtifacts(roomId, ''),
                loadWorkflowState(roomId),
                loadWorkflowRunHistory(roomId),
                loadRoomRuntime(roomId),
            ])
        } catch (err: any) {
            error.value = err.message
            throw err
        } finally {
            isJoining.value = false
        }

        // Join via socket for real-time updates
        const socket = getSocket()
        if (socket) {
            await new Promise<void>((resolve) => {
                socket.emit('join', {
                    roomId,
                    name: userName.value || undefined,
                    description: userDescription.value || undefined,
                }, (res: any) => {
                    if (!res?.error) {
                        members.value = res.members || []
                        if (res.agents) agents.value = res.agents

                        // Restore typing state from server
                        if (res.typingUsers) {
                            for (const u of res.typingUsers) {
                                if (!typingUsers.value.has(u.userId)) {
                                    const timer = setTimeout(() => typingUsers.value.delete(u.userId), 5000)
                                    typingUsers.value.set(u.userId, { name: u.userName, timer })
                                }
                            }
                        }

                        // Restore context statuses from server
                        if (res.contextStatuses) {
                            contextStatuses.value = new Map(
                                res.contextStatuses.map((s: any) => [s.agentName, s])
                            )
                        }
                    }
                    resolve()
                })
            })
        }
    }

    async function sendMessage(content: string) {
        const socket = getSocket()
        if (!socket || !currentRoomId.value) return
        emitStopTyping()

        return new Promise<void>((resolve, reject) => {
            socket!.emit('message', { roomId: currentRoomId.value, content }, (res: { id?: string; error?: string }) => {
                if (res.error) {
                    reject(new Error(res.error))
                    return
                }
                scheduleWorkflowStateRefresh()
                resolve()
            })
        })
    }

    async function loadWorkflowState(roomId: string): Promise<WorkflowExecutionStateResult> {
        const res = await getRoomWorkflowState(roomId)
        workflowRunState.value = res.run
        workflowCurrentNode.value = res.currentNode
        workflowNodeRuns.value = res.nodeRuns || []
        return res
    }

    async function refreshWorkflowRuntimeData(roomId: string): Promise<void> {
        await Promise.allSettled([
            loadWorkflowState(roomId),
            loadWorkflowRunHistory(roomId),
        ])
    }

    async function loadWorkflowArtifacts(roomId: string, limit = 20): Promise<WorkflowArtifactRecordSummary[]> {
        const res = await listRoomWorkflowArtifacts(roomId, limit)
        workflowArtifacts.value = res.artifacts || []
        return workflowArtifacts.value
    }

    async function loadWorkflowRunHistory(roomId: string, limit = 20): Promise<WorkflowRunHistoryRecord[]> {
        const res = await listRoomWorkflowRunHistory(roomId, limit)
        workflowRunHistory.value = res.history || []
        return workflowRunHistory.value
    }

    async function startWorkflowExecution(
        roomId: string,
        payload?: {
            actorName?: string
            content?: string
            summary?: string
            artifactPath?: string
        },
    ) {
        const res = await startRoomWorkflowRun(roomId, payload)
        workflowRunState.value = res.run
        workflowCurrentNode.value = res.currentNode
        workflowNodeRuns.value = res.nodeRuns || []
        currentRoomRuntime.value = res.runtime
        rooms.value = rooms.value.map(room => ({
            ...room,
            isActive: room.id === roomId ? 1 : 0,
        }))
        await loadWorkflowRunHistory(roomId).catch(() => { /* ignore */ })
        return res
    }

    async function submitWorkflowApproval(
        roomId: string,
        payload: {
            action: 'approve' | 'reject'
            actorName?: string
            reason?: string
        },
    ): Promise<WorkflowExecutionStateResult> {
        const res = await submitRoomWorkflowApproval(roomId, payload)
        workflowRunState.value = res.run
        workflowCurrentNode.value = res.currentNode
        workflowNodeRuns.value = res.nodeRuns || []
        await loadWorkflowRunHistory(roomId).catch(() => { /* ignore */ })
        return res
    }

    async function cancelWorkflowExecution(
        roomId: string,
        payload?: {
            actorName?: string
            reason?: string
        },
    ): Promise<WorkflowExecutionStateResult> {
        const res = await cancelRoomWorkflowExecution(roomId, payload)
        workflowRunState.value = res.run
        workflowCurrentNode.value = res.currentNode
        workflowNodeRuns.value = res.nodeRuns || []
        contextStatuses.value = new Map()
        await loadWorkflowRunHistory(roomId).catch(() => { /* ignore */ })
        return res
    }

    async function loadRoomRuntime(roomId: string): Promise<RoomRuntimeSummary> {
        const res = await getRoomRuntime(roomId)
        currentRoomRuntime.value = res.runtime
        return res.runtime
    }

    async function loadRooms() {
        try {
            const res = await listRooms()
            rooms.value = res.rooms
        } catch (err: any) {
            error.value = err.message
        }
    }

    async function setRoomActivation(roomId: string, active: boolean) {
        const res = await updateRoomActivation(roomId, active)
        currentRoomRuntime.value = res.runtime
        rooms.value = rooms.value.map(room => ({
            ...room,
            isActive: room.id === roomId ? (active ? 1 : 0) : (active ? 0 : room.isActive || 0),
        }))
        try {
            await loadRooms()
        } catch {
            // Ignore refresh failure and keep the optimistic room state above.
        }
        return res
    }

    async function createNewRoom(
        name: string,
        inviteCode: string,
        agentList?: AgentConfigInput[],
        compression?: { triggerTokens: number; maxHistoryTokens: number; tailMessageCount: number },
        workflow?: { workflowName?: string; workflowPrompt?: string },
    ) {
        try {
            const res = await createRoom({
                name,
                inviteCode,
                agents: agentList,
                compression: compression || { triggerTokens: 100000, maxHistoryTokens: 32000, tailMessageCount: 20 },
                workflow,
            })
            rooms.value.push(res.room)
            return res
        } catch (err: any) {
            error.value = err.message
            throw err
        }
    }

    async function joinByCode(code: string) {
        try {
            const res = await joinRoomByCode(code)
            await joinRoom(res.room.id)
            return res.room
        } catch (err: any) {
            error.value = err.message
            throw err
        }
    }

    async function deleteRoom(roomId: string) {
        try {
            await deleteRoomApi(roomId)
            rooms.value = rooms.value.filter(r => r.id !== roomId)
            if (currentRoomId.value === roomId) {
                currentRoomId.value = null
                messages.value = []
                members.value = []
                agents.value = []
                roomName.value = ''
                currentRoomRuntime.value = null
                currentWorkflowConfig.value = null
            }
        } catch (err: any) {
            error.value = err.message
            throw err
        }
    }

    // ─── Agent Actions ─────────────────────────────────────
    async function loadAgents(roomId: string) {
        try {
            const res = await listAgents(roomId)
            agents.value = res.agents
        } catch { /* ignore */ }
    }

    async function addAgentToRoom(roomId: string, data: AgentConfigInput) {
        try {
            const res = await addAgent(roomId, data)
            agents.value.push(res.agent)
            return res.agent
        } catch (err: any) {
            error.value = err.message
            throw err
        }
    }

    async function updateAgentInRoom(roomId: string, agentId: string, data: AgentConfigInput) {
        try {
            const res = await updateAgent(roomId, agentId, data)
            const idx = agents.value.findIndex(a => a.id === agentId)
            if (idx >= 0) agents.value[idx] = res.agent
            return res.agent
        } catch (err: any) {
            error.value = err.message
            throw err
        }
    }

    async function removeAgentFromRoom(roomId: string, agentId: string, operatorName?: string) {
        try {
            await removeAgent(roomId, agentId, operatorName)
            agents.value = agents.value.filter(a => a.id !== agentId)
        } catch (err: any) {
            error.value = err.message
            throw err
        }
    }

    async function saveCurrentAgentsAsDefault(roomId: string) {
        const res = await saveDefaultAgents(roomId)
        const idx = rooms.value.findIndex(r => r.id === roomId)
        if (idx >= 0 && res.room) rooms.value[idx] = res.room
        return res
    }

    async function applyRoomDefaultAgents(roomId: string) {
        const res = await applyDefaultAgents(roomId)
        agents.value = res.agents
        return res
    }

    async function loadWorkflowTemplates() {
        const res = await listWorkflowTemplates()
        workflowTemplates.value = res.workflows
        return res.workflows
    }

    async function createWorkflowTemplate(data: Partial<WorkflowTemplate>) {
        const res = await saveWorkflowTemplate(data)
        const idx = workflowTemplates.value.findIndex(w => w.id === res.workflow.id)
        if (idx >= 0) workflowTemplates.value[idx] = res.workflow
        else workflowTemplates.value.unshift(res.workflow)
        return res.workflow
    }

    async function loadWorkflowTemplate(id: string) {
        const res = await getWorkflowTemplate(id)
        const idx = workflowTemplates.value.findIndex(w => w.id === res.workflow.id)
        if (idx >= 0) workflowTemplates.value[idx] = res.workflow
        else workflowTemplates.value.unshift(res.workflow)
        return res.workflow
    }

    async function removeWorkflowTemplate(id: string) {
        await deleteWorkflowTemplate(id)
        workflowTemplates.value = workflowTemplates.value.filter(workflow => workflow.id !== id)
    }

    async function loadArtifacts(roomId: string, path = '') {
        const res = await listRoomArtifacts(roomId, path)
        artifactRootDir.value = res.rootDir
        artifactCurrentPath.value = res.currentPath
        artifactEntries.value = res.entries
        artifactTreeSummary.value = res.summary || null
        if (path === '') {
            artifactCurrentFile.value = null
        }
        return res
    }

    async function openArtifact(roomId: string, path: string) {
        const res = await getRoomArtifactContent(roomId, path)
        artifactCurrentFile.value = res
        return res
    }

    async function clearRoomMessages(roomId: string, payload?: { actorName?: string }) {
        const res = await clearRoomMessagesApi(roomId, payload)
        messages.value = []
        typingUsers.value.clear()
        contextStatuses.value = new Map()
        return res
    }

    async function loadRoomProject(roomId: string) {
        const res = await getRoomProject(roomId)
        currentProject.value = res.roomProject
        if (!res.roomProject) {
            projectEntries.value = []
            projectCurrentPath.value = ''
            projectCurrentFile.value = null
            projectGitStatus.value = null
            projectGitBranches.value = null
            projectGitDiff.value = null
            return null
        }
        await Promise.all([
            loadProjectFiles(res.roomProject.project.id, ''),
            loadProjectGitStatus(res.roomProject.project.id),
            loadProjectGitBranches(res.roomProject.project.id),
            loadProjectGitDiff(res.roomProject.project.id),
        ])
        return res.roomProject
    }

    async function attachLocalProjectToRoom(roomId: string, data: {
        name?: string
        description?: string
        localPath: string
        permissions?: ProjectPermissionConfig
    }) {
        const res = await bindLocalProject({ ...data, roomId })
        await loadAvailableProjects()
        await loadRoomProject(roomId)
        return res
    }

    async function attachExistingProjectToRoom(roomId: string, projectId: string, permissions?: ProjectPermissionConfig) {
        const res = await bindRoomProject(roomId, projectId, permissions)
        await loadAvailableProjects()
        currentProject.value = res.roomProject
        if (res.roomProject) {
            await Promise.all([
                loadProjectFiles(res.roomProject.project.id, ''),
                loadProjectGitStatus(res.roomProject.project.id),
                loadProjectGitBranches(res.roomProject.project.id),
                loadProjectGitDiff(res.roomProject.project.id),
            ])
        }
        return res
    }

    async function loadAvailableProjects() {
        const res = await listProjects()
        availableProjects.value = res.projects
        return res.projects
    }

    async function loadProjectDetail(projectId: string) {
        return getProjectDetail(projectId)
    }

    async function loadProjectFiles(projectId: string, path = '') {
        const res = await listProjectFiles(projectId, path)
        projectEntries.value = res.entries
        projectCurrentPath.value = res.path
        if (path === '') projectCurrentFile.value = null
        return res
    }

    async function openProjectFile(projectId: string, path: string) {
        const res = await getProjectFileContent(projectId, path)
        projectCurrentFile.value = res
        return res
    }

    async function loadProjectGitStatus(projectId: string) {
        const res = await getProjectGitStatus(projectId)
        projectGitStatus.value = res
        return res
    }

    async function loadProjectGitBranches(projectId: string) {
        const res = await getProjectGitBranches(projectId)
        projectGitBranches.value = res
        return res
    }

    async function loadProjectGitDiff(projectId: string, path = '') {
        const res = await getProjectGitDiff(projectId, path)
        projectGitDiff.value = res
        return res
    }

    // ─── Typing ────────────────────────────────────────────
    let _typingTimer: ReturnType<typeof setTimeout> | null = null

    function emitTyping() {
        const socket = getSocket()
        if (!socket || !currentRoomId.value) return
        socket.emit('typing', { roomId: currentRoomId.value })
        if (_typingTimer) clearTimeout(_typingTimer)
        _typingTimer = setTimeout(() => emitStopTyping(), 4000)
    }

    function emitStopTyping() {
        const socket = getSocket()
        if (!socket || !currentRoomId.value) return
        socket.emit('stop_typing', { roomId: currentRoomId.value })
        if (_typingTimer) { clearTimeout(_typingTimer); _typingTimer = null }
    }

    return {
        // State
        connected,
        currentRoomId,
        rooms,
        messages,
        members,
        agents,
        roomName,
        currentRoomRuntime,
        currentWorkflowConfig,
        workflowRunState,
        workflowCurrentNode,
        workflowNodeRuns,
        workflowArtifacts,
        workflowRunHistory,
        workflowActiveRoleName,
        workflowCurrentNodeType,
        workflowCurrentNodeTitle,
        workflowTemplates,
        currentProject,
        availableProjects,
        projectEntries,
        projectCurrentPath,
        projectCurrentFile,
        projectGitStatus,
        projectGitBranches,
        projectGitDiff,
        artifactRootDir,
        artifactCurrentPath,
        artifactEntries,
        artifactTreeSummary,
        artifactCurrentFile,
        isJoining,
        error,
        contextStatus,
        contextStatuses,
        userId,
        userName,
        userDescription,
        // Computed
        sortedMessages,
        memberNames,
        typingNames,
        typingText,
        // Actions
        connect,
        disconnect,
        setUserInfo,
        switchUserInfo,
        ensureUserName,
        joinRoom,
        sendMessage,
        loadRooms,
        emitTyping,
        emitStopTyping,
        createNewRoom,
        joinByCode,
        deleteRoom,
        loadAgents,
        addAgentToRoom,
        updateAgentInRoom,
        removeAgentFromRoom,
        saveCurrentAgentsAsDefault,
        applyRoomDefaultAgents,
        loadWorkflowTemplates,
        loadWorkflowTemplate,
        createWorkflowTemplate,
        removeWorkflowTemplate,
        loadRoomProject,
        loadAvailableProjects,
        attachLocalProjectToRoom,
        attachExistingProjectToRoom,
        loadProjectDetail,
        loadProjectFiles,
        openProjectFile,
        loadProjectGitStatus,
        loadProjectGitBranches,
        loadProjectGitDiff,
        loadArtifacts,
        openArtifact,
        clearRoomMessages,
        loadWorkflowState,
        refreshWorkflowRuntimeData,
        loadWorkflowArtifacts,
        loadWorkflowRunHistory,
        startWorkflowExecution,
        submitWorkflowApproval,
        cancelWorkflowExecution,
        loadRoomRuntime,
        setRoomActivation,
        scheduleWorkflowStateRefresh,
    }
})
