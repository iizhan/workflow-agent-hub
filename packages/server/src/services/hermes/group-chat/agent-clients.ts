import { io, Socket } from 'socket.io-client'
import { EventSource } from 'eventsource'
import { getToken } from '../../../services/auth'
import type { GatewayManager } from '../gateway-manager'
import { deleteSession as hermesDeleteSession } from '../hermes-cli'
import { getActiveProfileName } from '../hermes-profile'
import { logger } from '../../../services/logger'
import { updateUsage } from '../../../db/hermes/usage-store'
import { getSessionDetailFromDbWithProfile } from '../../../db/hermes/sessions-db'
import { parseAnthropicContentArray } from '../../../lib/llm-json'
import { projectService } from '../project'
import { rememberAgentResponseMemories } from '../memory-extractor'

// ─── Types ────────────────────────────────────────────────────

interface AgentConfig {
    profile: string
    name: string
    description: string
    avatar?: string
    systemPrompt?: string
    model?: string
    temperature?: number | null
    invited: number
}

interface WorkflowStageConfig {
    id: string
    name: string
    roleName: string
    assignedAgentId?: string
    deliverable: string
    needsAdminConfirm: boolean
    prompt?: string
}

interface WorkflowRoomConfig {
    mode?: 'freeform' | 'stage-gated'
    ownerRoleName?: string
    ownerUserName?: string
    completionMode?: 'reply' | 'idle' | 'archive'
    stages?: WorkflowStageConfig[]
    graph?: {
        nodes?: Array<{
            id: string
            type: string
            text?: string | { value?: string }
            properties?: Record<string, any>
        }>
        edges?: Array<{
            id: string
            sourceNodeId: string
            targetNodeId: string
            properties?: Record<string, any>
        }>
    }
}

interface WorkflowGraphNodeLite {
    id: string
    type: string
    text?: string | { value?: string }
    properties?: Record<string, any>
}

interface MessageData {
    id: string
    roomId: string
    senderId: string
    senderName: string
    content: string
    timestamp: number
}

interface MemberData {
    id: string
    name: string
    joinedAt: number
}

interface JoinResult {
    roomId: string
    roomName: string
    members: MemberData[]
    messages: MessageData[]
    rooms: string[]
}

const AGENT_SELF_NOTE_INSTRUCTION = [
    'If you discover a stable private working rule for yourself, you may append a hidden self note marker.',
    'Supported formats: [[SELF_NOTE: concise note]] or [[SELF_NOTE]]multi-line note[[/SELF_NOTE]].',
    'Only use it for durable agent-specific working rules, not for task output or user-visible content.',
].join('\n')

export interface AgentEventHandler {
    onMessage?: (data: { roomId: string; msg: MessageData }) => void
    onTyping?: (data: { roomId: string; userId: string; userName: string }) => void
    onStopTyping?: (data: { roomId: string; userId: string; userName: string }) => void
    onMemberJoined?: (data: { roomId: string; memberId: string; memberName: string; members: MemberData[] }) => void
    onMemberLeft?: (data: { roomId: string; memberId: string; memberName: string; members: MemberData[] }) => void
}

function extractAssistantText(value: unknown): string {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const blocks = parseAnthropicContentArray(trimmed)
                const text = blocks
                    .filter((block: any) => block?.type === 'text')
                    .map((block: any) => String(block?.text || ''))
                    .join('')
                    .trim()
                if (text) return text
            } catch {
                // Fall back to the raw string when array parsing fails.
            }
        }
        return value
    }
    if (value == null) return ''
    return JSON.stringify(value)
}

function extractLastAssistantMessage(detail: Awaited<ReturnType<typeof getSessionDetailFromDbWithProfile>>): string {
    const lastAssistant = detail?.messages
        ?.filter((message) => message.role === 'assistant')
        ?.at(-1)
    return extractAssistantText(lastAssistant?.content || '')
}

// ─── Agent Client (single connection) ─────────────────────────

class AgentClient {
    readonly agentId: string
    readonly profile: string
    readonly name: string
    readonly description: string
    readonly avatar: string
    readonly systemPrompt: string
    readonly model: string
    readonly temperature: number | null
    private socket: Socket | null = null
    private joinedRooms = new Set<string>()
    private handlers: AgentEventHandler
    private _reconnecting = false
    private gatewayManager: GatewayManager | null = null
    private contextEngine: any = null
    private storage: any = null

    constructor(config: AgentConfig, handlers: AgentEventHandler = {}) {
        this.agentId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
        this.profile = config.profile
        this.name = config.name
        this.description = config.description
        this.avatar = config.avatar || ''
        this.systemPrompt = config.systemPrompt || ''
        this.model = config.model || ''
        this.temperature = typeof config.temperature === 'number' ? config.temperature : null
        this.handlers = handlers
    }

    get connected(): boolean {
        return this.socket?.connected ?? false
    }

    get id(): string | undefined {
        return this.socket?.id
    }

    setGatewayManager(manager: GatewayManager): void {
        this.gatewayManager = manager
    }

    setContextEngine(engine: any): void {
        this.contextEngine = engine
    }

    setStorage(storage: any): void {
        this.storage = storage
    }

    async connect(port?: number): Promise<void> {
        const actualPort = port ?? parseInt(process.env.PORT || '8648', 10)
        const token = await getToken()

        this.socket = io(`http://127.0.0.1:${actualPort}/group-chat`, {
            auth: {
                token: token || undefined,
                name: this.name,
            },
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 30000,
        })

        this.bindEvents()

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000)

            this.socket!.on('connect', () => {
                clearTimeout(timeout)
                logger.debug(`[AgentClient] ${this.name} connected, socket id: ${this.socket!.id}`)
                resolve()
            })

            this.socket!.on('connect_error', (err) => {
                clearTimeout(timeout)
                logger.error(err, `[AgentClient] ${this.name} connect_error`)
                reject(err)
            })
        })
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect()
            this.socket = null
            this.joinedRooms.clear()
        }
    }

    async joinRoom(roomId: string): Promise<JoinResult> {
        this.ensureConnected()
        return new Promise((resolve, reject) => {
            this.socket!.emit('join', { roomId }, (res: JoinResult | { error: string }) => {
                if ('error' in res) {
                    reject(new Error(res.error))
                } else {
                    this.joinedRooms.add(roomId)
                    resolve(res)
                }
            })
        })
    }

    async sendMessage(roomId: string, content: string): Promise<string> {
        this.ensureConnected()
        if (!this.joinedRooms.has(roomId)) {
            await this.joinRoom(roomId)
        }
        return new Promise((resolve, reject) => {
            this.socket!.emit('message', { roomId, content }, async (res: { id?: string; error?: string }) => {
                if (res.error === 'Not in room') {
                    try {
                        await this.joinRoom(roomId)
                        this.socket!.emit('message', { roomId, content }, (retryRes: { id?: string; error?: string }) => {
                            if (retryRes.error) {
                                reject(new Error(retryRes.error))
                            } else {
                                resolve(retryRes.id!)
                            }
                        })
                        return
                    } catch (err: any) {
                        reject(new Error(err?.message || res.error))
                        return
                    }
                }
                if (res.error) {
                    reject(new Error(res.error))
                } else {
                    resolve(res.id!)
                }
            })
        })
    }

    startTyping(roomId: string): void {
        this.ensureConnected()
        this.socket!.emit('typing', { roomId })
    }

    stopTyping(roomId: string): void {
        this.ensureConnected()
        this.socket!.emit('stop_typing', { roomId })
    }

    emitContextStatus(roomId: string, status: 'compressing' | 'replying' | 'ready'): void {
        this.ensureConnected()
        this.socket!.emit('context_status', { roomId, agentName: this.name, status })
    }

    getJoinedRooms(): string[] {
        return Array.from(this.joinedRooms)
    }

    private ensureConnected(): void {
        if (!this.socket?.connected) {
            throw new Error(`Agent "${this.name}" is not connected`)
        }
    }

    private buildGatewayFailureReply(reason?: string): string {
        const normalizedReason = String(reason || '').trim()
        const compactReason = normalizedReason
            ? normalizedReason.replace(/\s+/g, ' ').slice(0, 120)
            : ''
        return [
            `我刚刚在调用绑定的 Gateway（profile: ${this.profile}）时失败了，这次没法继续处理。`,
            `请到“网关”或“日志”页检查 ${this.profile} 的运行状态后再试一次。`,
            compactReason ? `原因：${compactReason}` : '',
        ].filter(Boolean).join('')
    }

    private async sendGatewayFailureReply(roomId: string, reason?: string): Promise<void> {
        try {
            await this.sendMessage(roomId, this.buildGatewayFailureReply(reason))
        } catch (err: any) {
            logger.warn(`[AgentClients] ${this.name}: failed to send gateway failure reply: ${err?.message || err}`)
        }
    }

    private async deleteSession(sessionId: string): Promise<void> {
        try {
            const sessionProfile = this.storage?.getSessionProfile?.(sessionId)
            const currentProfile = getActiveProfileName()

            if (sessionProfile && sessionProfile.profile_name !== currentProfile) {
                // Cross-profile: enqueue deferred delete, don't switch profile
                this.storage?.enqueuePendingSessionDelete?.(sessionId, sessionProfile.profile_name)
                logger.info(`[AgentClients] ${this.name}: cross-profile deferred delete session ${sessionId} (session=${sessionProfile.profile_name}, active=${currentProfile})`)
                return
            }

            // Same profile or no mapping: delete directly
            const ok = await hermesDeleteSession(sessionId)
            if (ok) {
                this.storage?.deleteSessionProfile?.(sessionId)
            }
            logger.debug(`[AgentClients] ${this.name}: delete session ${sessionId} (profile=${this.profile}) → ${ok ? 'ok' : 'failed'}`)
        } catch (err: any) {
            logger.warn(`[AgentClients] ${this.name}: failed to delete session ${sessionId}: ${err.message}`)
        }
    }

    // ─── Hermes Gateway Integration ────────────────────────────

    /**
     * Handle an @mention from the server side.
     * Called by AgentClients.processMentions() — no socket round-trip needed.
     * onStatus is called to report context compression progress.
     */
    async replyToMention(
        roomId: string,
        msg: { content: string; senderName: string; senderId: string; timestamp: number },
        onStatus?: (status: 'compressing' | 'replying' | 'ready') => void,
    ): Promise<void> {
        logger.debug(`[AgentClients] ${this.name} mentioned by ${msg.senderName}: "${msg.content.slice(0, 50)}"`)
        if (!this.gatewayManager) {
            logger.debug(`[AgentClients] ${this.name}: gatewayManager is null, skipping`)
            await this.sendGatewayFailureReply(roomId, 'GatewayManager 未初始化')
            return
        }

        const upstream = this.gatewayManager.getUpstream(this.profile)
        const apiKey = this.gatewayManager.getApiKey(this.profile)
        logger.debug(`[AgentClients] ${this.name}: upstream=${upstream}, profile=${this.profile}`)
        if (!upstream) {
            logger.error(`[AgentClients] ${this.name}: no gateway upstream for profile "${this.profile}"`)
            await this.sendGatewayFailureReply(roomId, `profile ${this.profile} 没有可用的 gateway upstream`)
            return
        }

        const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

        try {
            const roomInfo = this.storage?.getRoom?.(roomId)
            const workflowConfig = this.storage?.getRoomWorkflowConfig?.(roomId) as WorkflowRoomConfig | null | undefined
            const currentNodeInstructions = this.buildActiveNodeInstructions(roomId, workflowConfig)
            const runState = this.storage?.getWorkflowRunState?.(roomId)
            const currentGraphRole = this.getCurrentGraphRole(roomId, workflowConfig)
            const currentStageRole = this.getCurrentStageRole(roomId, workflowConfig)
            const activeRole = currentGraphRole || currentStageRole
            const currentNodeLabel = this.getCurrentNodeLabel(roomId, workflowConfig)
            // Notify room that agent is typing
            this.startTyping(roomId)
            if ((workflowConfig?.mode === 'stage-gated' || workflowConfig?.graph?.nodes?.length) && runState?.status && runState.status !== 'completed' && activeRole && activeRole !== this.name) {
                const statusText = [
                    `我当前不是执行中的角色。`,
                    currentNodeLabel ? `当前正在处理「${currentNodeLabel}」。` : '当前流程仍在进行中。',
                    `当前负责角色是 @${activeRole}。`,
                    `如果你是想问整体进度，我可以告诉你：当前流程还没有完成。`,
                ].join('')
                this.stopTyping(roomId)
                await this.sendMessage(roomId, statusText)
                onStatus?.('ready')
                return
            }

            // Build compressed context if context engine is available
            let conversationHistory: Array<{ role: string; content: string }> = []
            let instructions: string | undefined
            let workflowPrompt: string | undefined
            if (roomInfo?.workflowPrompt) {
                workflowPrompt = [
                    roomInfo.workflowName ? `Workflow: ${roomInfo.workflowName}` : 'Workflow',
                    roomInfo.workflowPrompt,
                ].join('\n')
            }
            const activeNodeInstructions = currentNodeInstructions

            if (this.contextEngine && this.storage) {
                try {
                    logger.debug(`[AgentClients] ${this.name}: building context...`)
                    onStatus?.('compressing')
                    // Get room members with descriptions for context
                    const roomMembers: Array<{ userId: string; name: string; description: string }> = this.storage.getRoomMembers(roomId) || []
                    const memberNames = roomMembers.map((m: any) => m.name)
                    const members = roomMembers.map((m: any) => ({ userId: m.userId, name: m.name, description: m.description }))

                    // Get room compression config
                    const compression = roomInfo ? {
                        triggerTokens: roomInfo.triggerTokens,
                        maxHistoryTokens: roomInfo.maxHistoryTokens,
                        tailMessageCount: roomInfo.tailMessageCount,
                    } : undefined

                    const ctx = await this.contextEngine.buildContext({
                        roomId,
                        agentId: this.agentId,
                        agentName: this.name,
                        agentDescription: this.description,
                        agentSocketId: this.socket?.id || '',
                        roomName: roomId,
                        memberNames,
                        members,
                        upstream,
                        apiKey,
                        currentMessage: msg,
                        compression,
                        profile: this.profile,
                    })
                    conversationHistory = ctx.conversationHistory
                    instructions = ctx.instructions
                    logger.debug(`[AgentClients] ${this.name}: context built — historyLen=${conversationHistory.length}, meta=%j`, ctx.meta)
                    onStatus?.('replying')
                } catch (err: any) {
                    logger.warn(`[AgentClients] ${this.name}: context engine failed: ${err.message}`)
                    onStatus?.('replying')
                    // Degrade: continue without context
                }
            }

            // Strip @mention from input — agent already knows it was mentioned
            const input = this.stripMentions(msg.content).trim() || msg.content
            const runBody: Record<string, any> = {
                input,
                session_id: sessionId,
                ...(conversationHistory.length > 0 ? { conversation_history: conversationHistory } : {}),
                ...(this.model ? { model: this.model } : {}),
            }
            const mergedInstructions = [workflowPrompt, activeNodeInstructions, this.systemPrompt, instructions, AGENT_SELF_NOTE_INSTRUCTION]
                .map(v => v?.trim())
                .filter(Boolean)
                .join('\n\n')
            if (mergedInstructions) runBody.instructions = mergedInstructions
            if (typeof this.temperature === 'number') {
                runBody.temperature = this.temperature
                // Some Hermes-compatible gateways read generation params from model_config.
                runBody.model_config = { temperature: this.temperature }
            }

            // Start a run on Hermes gateway
            const runRes = await fetch(`${upstream}/v1/runs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
                },
                body: JSON.stringify(runBody),
                signal: AbortSignal.timeout(120000),
            })

            if (!runRes.ok) {
                const text = await runRes.text().catch(() => '')
                logger.error(`[AgentClients] ${this.name}: gateway run failed (${runRes.status}): ${text}`)
                this.stopTyping(roomId)
                await this.sendGatewayFailureReply(roomId, text || `Gateway 返回 ${runRes.status}`)
                onStatus?.('ready')
                return
            }

            const runData = await runRes.json() as any
            const run_id = runData.run_id
            logger.debug(`[AgentClients] ${this.name}: run started, response=%j`, runData)
            if (!run_id) {
                logger.error(`[AgentClients] ${this.name}: no run_id in response`)
                this.stopTyping(roomId)
                await this.sendGatewayFailureReply(roomId, 'Gateway 返回结果里缺少 run_id')
                onStatus?.('ready')
                return
            }

            // Save session-to-profile mapping after gateway confirms the run
            const actualSessionId = runData.session_id || sessionId
            if (!this.storage) {
                logger.warn(`[AgentClients] ${this.name}: storage is null, cannot save session profile for ${actualSessionId}`)
            } else {
                this.storage.saveSessionProfile(actualSessionId, roomId, this.agentId, this.profile)
                logger.debug(`[AgentClients] ${this.name}: saved session profile ${actualSessionId} → profile=${this.profile}`)
            }

            // Stream events from Hermes
            const eventsUrl = new URL(`${upstream}/v1/runs/${run_id}/events`)
            logger.debug(`[AgentClients] ${this.name}: streaming events from ${eventsUrl}`)

            // Use Authorization header instead of query parameter for better compatibility
            const eventSourceInit: any = apiKey ? {
                fetch: (url: string, init: any = {}) => fetch(url, {
                    ...init,
                    headers: {
                        ...(init.headers || {}),
                        Authorization: `Bearer ${apiKey}`,
                    },
                }),
            } : {}

            // @ts-ignore - eventsource library types are too strict
            const source = new EventSource(eventsUrl.toString(), eventSourceInit)

            let fullContent = ''

            source.onmessage = async (e: any) => {
                try {
                    const parsed = JSON.parse(e.data)
                    logger.debug(`[AgentClients] ${this.name}: event=${parsed.event}`)

                    if (parsed.event === 'run.completed') {
                        let detail: Awaited<ReturnType<typeof getSessionDetailFromDbWithProfile>> = null
                        // Record usage data from Hermes state.db BEFORE closing source
                        // This ensures we fetch usage before deleteSession can delete it
                        try {
                            detail = await getSessionDetailFromDbWithProfile(actualSessionId, this.profile)
                            if (detail) {
                                updateUsage(roomId, {
                                    inputTokens: detail.input_tokens,
                                    outputTokens: detail.output_tokens,
                                    cacheReadTokens: detail.cache_read_tokens,
                                    cacheWriteTokens: detail.cache_write_tokens,
                                    reasoningTokens: detail.reasoning_tokens,
                                    model: detail.model,
                                    profile: this.profile,
                                })
                                logger.debug(`[AgentClients] Recorded usage for room ${roomId} (session ${actualSessionId}, profile=${this.profile}): input=${detail.input_tokens}, output=${detail.output_tokens}`)
                            } else {
                                logger.warn(`[AgentClients] Failed to get session detail for ${actualSessionId} (profile=${this.profile})`)
                            }
                        } catch (err: any) {
                            logger.warn(err, '[AgentClients] Failed to record usage from DB')
                        }

                        source.close()
                        const finalContent = fullContent.trim()
                            || extractAssistantText(parsed.output)
                            || extractLastAssistantMessage(detail)
                        const memoryResult = await rememberAgentResponseMemories(finalContent, {
                            profileName: this.profile,
                            roomId,
                            agentId: this.agentId,
                        })
                        const visibleContent = memoryResult.visibleContent
                        logger.debug(`[AgentClients] ${this.name}: run completed, content length=${visibleContent.length}, selfNotes=${memoryResult.saved}`)
                        this.stopTyping(roomId)
                        if (visibleContent) {
                            try {
                                await this.sendMessage(roomId, visibleContent)
                            } catch (err: any) {
                                logger.error(`[AgentClients] ${this.name}: failed to send group chat reply: ${err.message}`)
                            }
                        } else {
                            logger.warn(`[AgentClients] ${this.name}: run completed with empty visible output`)
                        }
                        this.deleteSession(actualSessionId).catch(() => { })
                        onStatus?.('ready')
                        return
                    }

                    if (parsed.event === 'run.failed') {
                        source.close()
                        logger.error(`[AgentClients] ${this.name}: run failed`)
                        this.stopTyping(roomId)
                        this.deleteSession(actualSessionId).catch(() => { })
                        this.sendGatewayFailureReply(roomId, 'Gateway 运行任务失败').catch(() => { })
                        onStatus?.('ready')
                        return
                    }

                    // Accumulate message deltas
                    if (parsed.event === 'message.delta' && parsed.delta) {
                        fullContent += parsed.delta
                    }
                } catch {
                    // ignore parse errors
                }
            }

            source.onerror = (err: any) => {
                logger.error(err, `[AgentClients] ${this.name}: EventSource error`)
                source.close()
                this.stopTyping(roomId)
                this.deleteSession(actualSessionId).catch(() => { })
                this.sendGatewayFailureReply(roomId, err?.message || 'Gateway 事件流异常中断').catch(() => { })
                onStatus?.('ready')
            }
        } catch (err: any) {
            logger.error(`[AgentClients] ${this.name}: error handling message: ${err.message}`)
            this.stopTyping(roomId)
            this.deleteSession(sessionId).catch(() => { })
            await this.sendGatewayFailureReply(roomId, err?.message || '调用 Gateway 时出现异常')
            onStatus?.('ready')
        }
    }

    private bindEvents(): void {
        const s = this.socket!

        s.on('typing', (data: any) => {
            this.handlers.onTyping?.(data)
        })

        s.on('stop_typing', (data: any) => {
            this.handlers.onStopTyping?.(data)
        })

        s.on('member_joined', (data: any) => {
            this.handlers.onMemberJoined?.(data)
        })

        s.on('member_left', (data: any) => {
            this.handlers.onMemberLeft?.(data)
        })

        // Auto rejoin rooms on reconnect
        s.io.on('reconnect', async () => {
            if (this._reconnecting) return
            this._reconnecting = true
            logger.info(`[AgentClients] ${this.name} reconnecting, rejoining ${this.joinedRooms.size} rooms...`)
            const rooms = Array.from(this.joinedRooms)
            for (const roomId of rooms) {
                try {
                    await this.joinRoom(roomId)
                } catch (err: any) {
                    logger.error(`[AgentClients] ${this.name} failed to rejoin room ${roomId}: ${err.message}`)
                }
            }
            this._reconnecting = false
        })
    }

    private stripMentions(content: string): string {
        return content.replace(/@[\p{L}\p{N}_-]+/gu, ' ').replace(/\s+/g, ' ').trim()
    }

    private getCurrentNodeLabel(roomId: string, workflowConfig?: WorkflowRoomConfig | null): string {
        const currentNodeId = this.storage?.getWorkflowRunState?.(roomId)?.currentNodeId
        const currentNode = currentNodeId
            ? (workflowConfig?.graph?.nodes || []).find((node: WorkflowGraphNodeLite) => node.id === currentNodeId)
            : null
        return typeof currentNode?.text === 'string'
            ? currentNode.text
            : currentNode?.text?.value || ''
    }

    private getAssignedAgentName(roomId: string, assignedAgentId?: string): string {
        const normalizedId = String(assignedAgentId || '').trim()
        if (!normalizedId) return ''
        const agent = (this.storage?.getRoomAgents?.(roomId) || [])
            .find((item: any) => String(item?.id || '') === normalizedId)
        return String(agent?.name || agent?.profile || '').trim()
    }

    private currentAgentMatchesAssignedAgent(roomId: string, assignedAgentId?: string): boolean {
        const normalizedId = String(assignedAgentId || '').trim()
        if (!normalizedId) return true
        const agent = (this.storage?.getRoomAgents?.(roomId) || [])
            .find((item: any) => String(item?.id || '') === normalizedId)
        if (!agent) return false
        return String(agent.agentId || '') === this.agentId || String(agent.name || '') === this.name
    }

    private buildActiveNodeInstructions(roomId: string, workflowConfig?: WorkflowRoomConfig | null): string {
        const currentNodeId = this.storage?.getWorkflowRunState?.(roomId)?.currentNodeId
        const nodes = (workflowConfig?.graph?.nodes || []) as WorkflowGraphNodeLite[]
        if (!currentNodeId || nodes.length === 0) return ''

        const node = nodes.find((item) => item.id === currentNodeId)
        if (!node) return ''

        const nodeType = String(node.properties?.workflowNodeType || '')
        if (nodeType !== 'role-task' && nodeType !== 'artifact-review') return ''

        const assignedAgentId = String(node.properties?.assignedAgentId || '').trim()
        const assignedAgentName = this.getAssignedAgentName(roomId, assignedAgentId)
        const roleName = assignedAgentName || String(node.properties?.roleName || '').trim()
        if (assignedAgentId && !this.currentAgentMatchesAssignedAgent(roomId, assignedAgentId)) return ''
        if (!assignedAgentId && roleName && roleName !== this.name) return ''

        const nodeTitle = typeof node.text === 'string' ? node.text : node.text?.value || node.id
        const stage = (workflowConfig?.stages || []).find((item) => item.id === node.id || item.name === nodeTitle || item.assignedAgentId === assignedAgentId || item.roleName === roleName)
        const deliverable = String(stage?.deliverable || '').trim()
        const promptOverride = String(node.properties?.promptOverride || stage?.prompt || '').trim()
        const artifactDir = String(node.properties?.artifactDir || '').trim()
        const artifactFileName = String(node.properties?.artifactFileName || '').trim()
        const requiresArtifact = Boolean(node.properties?.requiresArtifact)
        const executionMode = String(node.properties?.executionMode || 'artifact')
        const roomProject = projectService.getRoomPrimaryProject(roomId)
        const boundProject = roomProject?.project || null
        const binding = roomProject?.binding || null
        const projectStructure = executionMode === 'project-write' && boundProject
            ? projectService.getRoomPrimaryProjectStructure(roomId, 140)
            : null
        const projectManifestLines = projectStructure?.manifests?.length
            ? projectStructure.manifests.slice(0, 20).map(path => `- ${path}`).join('\n')
            : ''
        const projectTreeLines = projectStructure?.entries?.length
            ? projectStructure.entries.slice(0, 120).map(path => `- ${path}`).join('\n')
            : ''

        const lines = [
            '当前你是被激活的唯一执行角色，请直接完成当前节点正式交付物。',
            `当前节点：${nodeTitle}`,
            roleName ? `当前角色：${roleName}` : '',
            deliverable ? `本节点交付物：${deliverable}` : '',
            promptOverride ? `节点补充要求：${promptOverride}` : '',
            requiresArtifact ? `产物文件要求：${artifactDir || '.'}/${artifactFileName || '未命名产物'}` : '',
            executionMode === 'project-write' && boundProject
                ? `当前房间已绑定项目：${String(boundProject.localPath || boundProject.name || '')}`
                : '',
            executionMode === 'project-write' && binding?.allowWrite
                ? '这是代码写入节点，不接受纯文档交付。你必须优先输出真实代码变更，并严格使用以下文件块格式：<<<FILE:path/to/file>>> 文件内容 <<<END FILE>>>。至少输出 1 个有效文件块，可以输出多个文件块。'
                : '',
            executionMode === 'project-write' && binding?.allowWrite && projectManifestLines
                ? `绑定项目关键入口/构建文件如下。你必须据此判断真实模块路径，不要凭空创建看似合理但项目里不存在的顶层模块：\n${projectManifestLines}`
                : '',
            executionMode === 'project-write' && binding?.allowWrite && projectTreeLines
                ? `绑定项目结构摘要如下。新增文件应落在这些真实模块目录下；修改已有能力时优先改已有目录中的文件：\n${projectTreeLines}`
                : '',
            executionMode === 'project-write' && binding?.allowWrite
                ? '文件块路径必须使用绑定项目根目录的相对路径。例如真实模块在 apps/server/pms-cloud/pms-gateway/ 时，不能简写成 pms-gateway/。'
                : '',
            executionMode === 'project-write' && binding?.allowWrite
                ? '修改已有配置文件时必须保留原文件全部有效配置，只做最小增量变更；不要用示例模板整体替换 bootstrap.yml、application.yml、package.json、pom.xml 等关键文件。'
                : '',
            executionMode === 'project-write' && binding?.allowWrite
                ? '如果没有文件块，系统会判定本轮失败并要求你重试。先输出文件块，再补充简短说明：改了哪些文件、为什么改、还有哪些风险或后续建议。'
                : '',
            executionMode === 'project-write' && boundProject && !binding?.allowWrite
                ? '当前房间虽然绑定了项目，但没有写权限。本轮只能输出代码方案，不能落真实文件。'
                : '',
            '不要回复“还需要等待其他角色”或“等待被再次@后再输出”。如果当前节点已经轮到你，就直接给出完整可评审的正式内容。',
            '除非用户明确要求讨论流程，否则优先输出最终交付物正文，必要时可先给简短说明，再给完整结构化产物。',
        ]

        return lines.filter(Boolean).join('\n')
    }

    private getCurrentStageRole(roomId: string, workflowConfig?: WorkflowRoomConfig | null): string | null {
        if (!workflowConfig || workflowConfig.mode !== 'stage-gated') return null
        const stages = Array.isArray(workflowConfig.stages) ? workflowConfig.stages : []
        if (stages.length === 0) return null
        const messages = this.storage?.getMessages?.(roomId, 200) || []
        const agentNames = new Set((this.storage?.getRoomAgents?.(roomId) || []).map((agent: any) => String(agent?.name || '')))
        const ownerName = workflowConfig.ownerUserName?.trim()
        const approvedCount = messages.filter((message: any) => {
            const content = String(message?.content || '')
            const senderName = String(message?.senderName || '')
            if (agentNames.has(senderName)) return false
            const fromOwner = ownerName ? senderName === ownerName : true
            return fromOwner && /(确认|批准|approve|approved|继续下一阶段|进入下一阶段)/i.test(content)
        }).length
        const stage = stages[Math.min(approvedCount, stages.length - 1)] || stages[0]
        return this.getAssignedAgentName(roomId, stage?.assignedAgentId) || stage?.roleName || null
    }

    private getCurrentGraphRole(roomId: string, workflowConfig?: WorkflowRoomConfig | null): string | null {
        const currentNodeId = this.storage?.getWorkflowRunState?.(roomId)?.currentNodeId
        const nodes = workflowConfig?.graph?.nodes || []
        if (!currentNodeId || nodes.length === 0) return null
        const node = nodes.find((item: any) => item.id === currentNodeId)
        if (!node) return null
        return this.getAssignedAgentName(roomId, node.properties?.assignedAgentId) || String(node.properties?.roleName || '')
    }
}

// ─── AgentClients (roomId -> agents) ──────────────────────────

export class AgentClients {
    private rooms = new Map<string, Map<string, AgentClient>>()
    private _gatewayManager: GatewayManager | null = null
    private _contextEngine: any = null
    private _storage: any = null

    // Per-room processing lock + mention queue
    private _processingRooms = new Set<string>()
    private _mentionQueue = new Map<string, Array<{ agent: AgentClient; msg: { content: string; senderName: string; senderId: string; timestamp: number } }>>()

    private _describeAgentBusyState(roomId: string, agentName: string): string {
        const workflowConfig = this._storage?.getRoomWorkflowConfig?.(roomId) as WorkflowRoomConfig | null | undefined
        const currentGraphRole = this._getCurrentGraphRole(roomId, workflowConfig)
        const currentStageRole = this._getCurrentStageRole(roomId, workflowConfig)
        const activeRole = currentGraphRole || currentStageRole
        const currentNodeId = this._storage?.getWorkflowRunState?.(roomId)?.currentNodeId
        const currentNode = currentNodeId
            ? (workflowConfig?.graph?.nodes || []).find((node: WorkflowGraphNodeLite) => node.id === currentNodeId)
            : null
        const currentNodeLabel = typeof currentNode?.text === 'string'
            ? currentNode.text
            : currentNode?.text?.value || ''

        if (currentNodeLabel && activeRole === agentName) {
            return `我正在处理「${currentNodeLabel}」，你这条消息我先排队，当前任务完成后会继续响应。`
        }
        if (currentNodeLabel) {
            return `我正在处理上一条消息（当前流程节点：「${currentNodeLabel}」），你这条消息我先排队，处理完成后会继续响应。`
        }
        return '我正在处理上一条消息，你这条消息我先排队，处理完成后会继续响应。'
    }

    /**
     * Create an agent client and connect it to the server.
     * The agent will NOT auto-join any room — call addAgentToRoom separately.
     */
    async createAgent(config: AgentConfig, handlers?: AgentEventHandler, port?: number): Promise<AgentClient> {
        const client = new AgentClient(config, handlers)
        await client.connect(port)

        // Auto-apply stored references (fixes propagation for agents created after set*)
        if (this._gatewayManager) client.setGatewayManager(this._gatewayManager)
        if (this._contextEngine) client.setContextEngine(this._contextEngine)
        if (this._storage) client.setStorage(this._storage)

        logger.info(`[AgentClients] Connected: ${client.name} (${client.agentId})`)
        return client
    }

    /**
     * Connect an agent to a room.
     */
    async addAgentToRoom(roomId: string, client: AgentClient): Promise<JoinResult> {
        let room = this.rooms.get(roomId)
        if (!room) {
            room = new Map()
            this.rooms.set(roomId, room)
        }

        room.set(client.agentId, client)
        const result = await client.joinRoom(roomId)
        logger.info(`[AgentClients] ${client.name} joined room: ${roomId}`)
        return result
    }

    async replaceAgentInRoom(roomId: string, previousAgentId: string, config: AgentConfig, port?: number): Promise<AgentClient> {
        this.removeAgentFromRoom(roomId, previousAgentId)
        const client = await this.createAgent(config, undefined, port)
        await this.addAgentToRoom(roomId, client)

        if (this._contextEngine) {
            try { this._contextEngine.invalidateRoom(roomId) } catch { /* ignore */ }
        }

        return client
    }

    /**
     * Remove an agent from a room and disconnect it.
     */
    removeAgentFromRoom(roomId: string, agentId: string): void {
        const room = this.rooms.get(roomId)
        if (!room) return

        const client = room.get(agentId)
        if (client) {
            client.disconnect()
            room.delete(agentId)
            logger.info(`[AgentClients] ${client.name} left room: ${roomId}`)

            // Invalidate context engine cache for this agent
            if (this._contextEngine) {
                try { this._contextEngine.invalidateRoom(roomId) } catch { /* ignore */ }
            }
        }

        if (room.size === 0) {
            this.rooms.delete(roomId)
        }
    }

    /**
     * Get all agents in a room.
     */
    getAgents(roomId: string): AgentClient[] {
        const room = this.rooms.get(roomId)
        return room ? Array.from(room.values()) : []
    }

    /**
     * Get a specific agent in a room.
     */
    getAgent(roomId: string, agentId: string): AgentClient | undefined {
        return this.rooms.get(roomId)?.get(agentId)
    }

    /**
     * Get all room IDs that have agents.
     */
    getRoomIds(): string[] {
        return Array.from(this.rooms.keys())
    }

    /**
     * Send a message from a specific agent in a room.
     */
    async sendMessage(roomId: string, agentId: string, content: string): Promise<string> {
        const client = this.getAgent(roomId, agentId)
        if (!client) {
            throw new Error(`Agent "${agentId}" not found in room "${roomId}"`)
        }
        return client.sendMessage(roomId, content)
    }

    /**
     * Broadcast a message from all agents in a room.
     */
    async broadcastFromRoom(roomId: string, content: string): Promise<string[]> {
        const agents = this.getAgents(roomId)
        return Promise.all(agents.map((agent) => agent.sendMessage(roomId, content)))
    }

    /**
     * Disconnect all agents in a room.
     */
    disconnectRoom(roomId: string): void {
        const room = this.rooms.get(roomId)
        if (!room) return

        room.forEach((client) => client.disconnect())
        this.rooms.delete(roomId)
        logger.info(`[AgentClients] All agents disconnected from room: ${roomId}`)

        // Invalidate context engine cache for this room
        if (this._contextEngine) {
            try { this._contextEngine.invalidateRoom(roomId) } catch { /* ignore */ }
        }
    }

    /**
     * Disconnect all agents in all rooms.
     */
    disconnectAll(): void {
        this.rooms.forEach((room) => {
            room.forEach((client) => client.disconnect())
        })
        this.rooms.clear()
        logger.info('[AgentClients] All agents disconnected')
    }

    /**
     * Set gateway manager for all existing and future agents.
     */
    setGatewayManager(manager: GatewayManager): void {
        this._gatewayManager = manager
        this.rooms.forEach((room) => {
            room.forEach((client) => client.setGatewayManager(manager))
        })
    }

    /**
     * Set context engine for all existing and future agents.
     */
    setContextEngine(engine: any): void {
        this._contextEngine = engine
        this.rooms.forEach((room) => {
            room.forEach((client) => client.setContextEngine(engine))
        })
    }

    /**
     * Set message storage for all existing and future agents.
     */
    setStorage(storage: any): void {
        this._storage = storage
        this.rooms.forEach((room) => {
            room.forEach((client) => client.setStorage(storage))
        })
    }


    /**
     * Server-side: parse @mentions and forward to matching agents directly.
     * If the room is already processing (compressing/replying), queue the mention.
     */
    async processMentions(roomId: string, msg: { content: string; senderName: string; senderId: string; timestamp: number }): Promise<void> {
        if (!this._gatewayManager) return

        const content = msg.content.toLowerCase()
        const agents = this.getAgents(roomId)
        let mentioned = agents.filter(a => content.includes(`@${a.name.toLowerCase()}`))
        if (content.includes('@全部') || content.includes('@all')) {
            mentioned = agents
        }
        if (mentioned.length === 0) return

        logger.debug(`[AgentClients] ${mentioned.map(a => a.name).join(', ')} mentioned by ${msg.senderName}`)

        for (const agent of mentioned) {
            this._processAgentMention(roomId, agent, msg, { suppressBusyNotice: false }).catch((err) => {
                logger.error(`[AgentClients] error processing mention for ${agent.name}: ${err.message}`)
            })
        }
    }

    async triggerWorkflowRole(
        roomId: string,
        roleName: string,
        msg: { content: string; senderName: string; senderId: string; timestamp: number },
    ): Promise<boolean> {
        if (!this._gatewayManager) return false

        const normalizedRoleName = String(roleName || '').trim()
        if (!normalizedRoleName) return false

        const agent = this.getAgents(roomId).find((item) => item.name === normalizedRoleName)
        if (!agent) return false

        await this._processAgentMention(roomId, agent, msg, { suppressBusyNotice: true })
        return true
    }

    /**
     * Process a single agent mention with status reporting and queue drain.
     */
    private async _processAgentMention(
        roomId: string,
        agent: AgentClient,
        msg: { content: string; senderName: string; senderId: string; timestamp: number },
        options: { suppressBusyNotice?: boolean } = {},
    ): Promise<void> {
        const agentKey = `${roomId}:${agent.name}`
        if (this._processingRooms.has(agentKey)) {
            if (!options.suppressBusyNotice) {
                try {
                    await agent.sendMessage(
                        roomId,
                        this._describeAgentBusyState(roomId, agent.name),
                    )
                } catch {
                    // ignore busy notice failures
                }
            }
            // Queue for this specific agent
            let queue = this._mentionQueue.get(agentKey)
            if (!queue) {
                queue = []
                this._mentionQueue.set(agentKey, queue)
            }
            queue.push({ agent, msg })
            logger.debug(`[AgentClients] agent ${agent.name} is processing, queued mention in room ${roomId}`)
            return
        }

        this._processingRooms.add(agentKey)
        const onStatus = (status: 'compressing' | 'replying' | 'ready') => {
            agent.emitContextStatus(roomId, status)
            logger.debug(`[AgentClients] room ${roomId} agent ${agent.name} status: ${status}`)
        }

        try {
            await agent.replyToMention(roomId, msg, onStatus)
        } finally {
            this._processingRooms.delete(agentKey)
            await this._drainQueue(agentKey, roomId)
        }
    }

    /**
     * Drain queued mentions for a room after processing completes.
     */
    private async _drainQueue(agentKey: string, roomId: string): Promise<void> {
        const queue = this._mentionQueue.get(agentKey)
        if (!queue || queue.length === 0) return

        this._mentionQueue.delete(agentKey)
        logger.debug(`[AgentClients] draining ${queue.length} queued mention(s) for ${agentKey}`)

        // Process the last queued mention only (most recent, discards stale intermediate ones)
        const last = queue[queue.length - 1]
        this._processAgentMention(roomId, last.agent, last.msg, { suppressBusyNotice: false }).catch((err) => {
            logger.error(`[AgentClients] error processing queued mention: ${err.message}`)
        })
    }

    private _getCurrentStageRole(roomId: string, workflowConfig?: WorkflowRoomConfig | null): string | null {
        if (!workflowConfig || workflowConfig.mode !== 'stage-gated') return null
        const stages = Array.isArray(workflowConfig.stages) ? workflowConfig.stages : []
        if (stages.length === 0) return null
        const messages = this._storage?.getMessages?.(roomId, 200) || []
        const agentNames = new Set((this._storage?.getRoomAgents?.(roomId) || []).map((agent: any) => String(agent?.name || '')))
        const ownerName = workflowConfig.ownerUserName?.trim()
        const approvedCount = messages.filter((msg: any) => {
            const content = String(msg?.content || '')
            const senderName = String(msg?.senderName || '')
            if (agentNames.has(senderName)) return false
            const fromOwner = ownerName ? senderName === ownerName : true
            return fromOwner && /(确认|批准|approve|approved|继续下一阶段|进入下一阶段)/i.test(content)
        }).length
        const stage = stages[Math.min(approvedCount, stages.length - 1)] || stages[0]
        return this._getAssignedAgentName(roomId, stage?.assignedAgentId) || stage?.roleName || null
    }

    private _getCurrentGraphRole(roomId: string, workflowConfig?: WorkflowRoomConfig | null): string | null {
        const currentNodeId = this._storage?.getWorkflowRunState?.(roomId)?.currentNodeId
        const nodes = workflowConfig?.graph?.nodes || []
        if (!currentNodeId || nodes.length === 0) return null
        const node = nodes.find((item: any) => item.id === currentNodeId)
        if (!node) return null
        return this._getAssignedAgentName(roomId, node.properties?.assignedAgentId) || String(node.properties?.roleName || '')
    }

    private _getAssignedAgentName(roomId: string, assignedAgentId?: string): string {
        const normalizedId = String(assignedAgentId || '').trim()
        if (!normalizedId) return ''
        const agent = (this._storage?.getRoomAgents?.(roomId) || [])
            .find((item: any) => String(item?.id || '') === normalizedId)
        return String(agent?.name || agent?.profile || '').trim()
    }
}
