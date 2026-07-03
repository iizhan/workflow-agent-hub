import Router from '@koa/router'
import type { GroupChatServer } from '../../services/hermes/group-chat'
import { projectService, type ProjectPermissionConfig } from '../../services/hermes/project'
import {
    deleteWorkflowTemplate,
    getWorkflowTemplate,
    listWorkflowTemplates,
    saveWorkflowTemplate,
} from '../../services/hermes/group-chat/workflow-templates'

export const groupChatRoutes = new Router()

let chatServer: GroupChatServer | null = null

export function setGroupChatServer(server: GroupChatServer) {
    chatServer = server
}

export function getGroupChatServer(): GroupChatServer | null {
    return chatServer
}

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function stringifyValue(value: unknown): string {
    if (value == null) return ''
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return JSON.stringify(value)
}

type LooseRecord = Record<string, any>

function asRecord(value: unknown): LooseRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as LooseRecord) : {}
}

function asArray(value: unknown): LooseRecord[] {
    return Array.isArray(value) ? value.map((item) => asRecord(item)) : []
}

function summarizeWorkflowConfigDiff(previous: any, next: any): string[] {
    const previousConfig = asRecord(previous)
    const nextConfig = asRecord(next)
    const changes: string[] = []
    const prevMode = stringifyValue(previousConfig.mode)
    const nextMode = stringifyValue(nextConfig.mode)
    if (prevMode !== nextMode) changes.push(`协作模式：${prevMode || '未设置'} -> ${nextMode || '未设置'}`)

    const prevOwnerRole = stringifyValue(previousConfig.ownerRoleName)
    const nextOwnerRole = stringifyValue(nextConfig.ownerRoleName)
    if (prevOwnerRole !== nextOwnerRole) changes.push(`主理人角色：${prevOwnerRole || '未设置'} -> ${nextOwnerRole || '未设置'}`)

    const prevOwnerName = stringifyValue(previousConfig.ownerUserName)
    const nextOwnerName = stringifyValue(nextConfig.ownerUserName)
    if (prevOwnerName !== nextOwnerName) changes.push(`主理人名称：${prevOwnerName || '未设置'} -> ${nextOwnerName || '未设置'}`)

    const prevStages = asArray(previousConfig.stages)
    const nextStages = asArray(nextConfig.stages)
    const prevById = new Map<string, LooseRecord>(prevStages.map((stage) => [String(stage.id || ''), stage]))
    const nextById = new Map<string, LooseRecord>(nextStages.map((stage) => [String(stage.id || ''), stage]))
    const addedStages: string[] = []
    const removedStages: string[] = []
    const updatedStages: string[] = []

    for (const [id, stage] of nextById) {
        if (!id) continue
        const prev = prevById.get(id)
        if (!prev) {
            addedStages.push(String(stage?.name || id))
            continue
        }
        const stageChanges: string[] = []
        if (stringifyValue(prev.name) !== stringifyValue(stage.name)) stageChanges.push('名称')
        if (stringifyValue(prev.roleName) !== stringifyValue(stage.roleName)) stageChanges.push('角色')
        if (stringifyValue(prev.deliverable) !== stringifyValue(stage.deliverable)) stageChanges.push('产物')
        if (Boolean(prev.needsAdminConfirm) !== Boolean(stage.needsAdminConfirm)) stageChanges.push('确认规则')
        if (stringifyValue(prev.prompt) !== stringifyValue(stage.prompt)) stageChanges.push('提示词')
        if (stageChanges.length > 0) {
            updatedStages.push(`${String(stage?.name || id)}（${stageChanges.join('、')}）`)
        }
    }

    for (const [id, stage] of prevById) {
        if (!id || nextById.has(id)) continue
        removedStages.push(String(stage?.name || id))
    }

    if (addedStages.length > 0) changes.push(`新增阶段：${addedStages.join('、')}`)
    if (removedStages.length > 0) changes.push(`移除阶段：${removedStages.join('、')}`)
    if (updatedStages.length > 0) changes.push(`阶段更新：${updatedStages.join('；')}`)

    const prevGraphNodes = asArray(asRecord(previousConfig.graph).nodes)
    const nextGraphNodes = asArray(asRecord(nextConfig.graph).nodes)
    if (prevGraphNodes.length !== nextGraphNodes.length) {
        changes.push(`流程节点数：${prevGraphNodes.length} -> ${nextGraphNodes.length}`)
    }

    return changes
}

function summarizeAgentDiff(previous: any, next: any): string[] {
    const changes: string[] = []
    if (stringifyValue(previous.profile) !== stringifyValue(next.profile)) changes.push(`profile：${stringifyValue(previous.profile) || '未设置'} -> ${stringifyValue(next.profile) || '未设置'}`)
    if (stringifyValue(previous.name) !== stringifyValue(next.name)) changes.push(`角色名称：${stringifyValue(previous.name) || '未设置'} -> ${stringifyValue(next.name) || '未设置'}`)
    if (stringifyValue(previous.description) !== stringifyValue(next.description)) changes.push('角色描述已更新')
    if (stringifyValue(previous.avatar) !== stringifyValue(next.avatar)) changes.push('头像已更新')
    if (stringifyValue(previous.systemPrompt) !== stringifyValue(next.systemPrompt)) changes.push('角色提示词已更新')
    if (stringifyValue(previous.model) !== stringifyValue(next.model)) changes.push(`模型：${stringifyValue(previous.model) || '默认'} -> ${stringifyValue(next.model) || '默认'}`)
    if (Number(previous.temperature ?? NaN) !== Number(next.temperature ?? NaN)) changes.push(`temperature：${previous.temperature ?? '默认'} -> ${next.temperature ?? '默认'}`)
    if (Boolean(previous.invited) !== Boolean(next.invited)) changes.push(Boolean(next.invited) ? '已设为邀请成员' : '已取消邀请')
    return changes
}

function buildSystemNotice(title: string, items: string[], suffix = '请所有 AI 和房间成员按最新配置执行。'): string {
    const lines = [`【系统通知】${title}`]
    for (const item of items) lines.push(`- ${item}`)
    if (suffix) lines.push(suffix)
    return lines.join('\n')
}

function normalizeRoleName(value: unknown): string {
    return stringifyValue(value).toLowerCase()
}

function collectWorkflowRequirements(workflowConfig: any): Array<{ label: string; roleName: string; assignedAgentId: string }> {
    const config = asRecord(workflowConfig)
    const displayByKey = new Map<string, { label: string; roleName: string; assignedAgentId: string }>()
    const pushRequirement = (roleNameValue: unknown, assignedAgentIdValue?: unknown) => {
        const roleName = stringifyValue(roleNameValue)
        const assignedAgentId = stringifyValue(assignedAgentIdValue)
        if (!roleName && !assignedAgentId) return
        const key = assignedAgentId ? `agent:${assignedAgentId}` : `role:${normalizeRoleName(roleName)}`
        if (!key || displayByKey.has(key)) return
        displayByKey.set(key, {
            label: roleName || assignedAgentId,
            roleName,
            assignedAgentId,
        })
    }

    for (const stage of asArray(config.stages)) {
        pushRequirement(stage.roleName, stage.assignedAgentId)
    }

    const graph = asRecord(config.graph)
    for (const node of asArray(graph.nodes)) {
        const properties = asRecord(node.properties)
        const nodeType = stringifyValue(properties.workflowNodeType)
        if (nodeType === 'role-task' || nodeType === 'artifact-review') {
            pushRequirement(properties.roleName, properties.assignedAgentId)
        }
    }

    return Array.from(displayByKey.values())
}

function collectWorkflowRoleNames(workflowConfig: any): string[] {
    return collectWorkflowRequirements(workflowConfig).map(item => item.label)
}

function collectAgentRoleNames(agents: Array<{ name?: string; profile?: string }>): string[] {
    const displayByKey = new Map<string, string>()
    for (const agent of agents) {
        const label = stringifyValue(agent?.name || agent?.profile)
        if (!label) continue
        const key = normalizeRoleName(label)
        if (!key || displayByKey.has(key)) continue
        displayByKey.set(key, label)
    }
    return Array.from(displayByKey.values())
}

function analyzeWorkflowAgentAlignment(
    workflowConfig: any,
    agents: Array<{ id?: string; name?: string; profile?: string }>,
): {
    requiredRoles: string[]
    agentRoles: string[]
    missingRoles: string[]
    unusedAgentRoles: string[]
} {
    const requiredItems = collectWorkflowRequirements(workflowConfig)
    const requiredRoles = requiredItems.map(item => item.label)
    const agentRoles = collectAgentRoleNames(agents)
    const requiredRoleKeys = new Set(requiredRoles.map(role => normalizeRoleName(role)))
    const agentRoleKeys = new Set(agentRoles.map(role => normalizeRoleName(role)))
    const agentIds = new Set(agents.map(agent => stringifyValue(agent?.id)))
    const assignedAgentIds = new Set(requiredItems.map(item => item.assignedAgentId).filter(Boolean))
    return {
        requiredRoles,
        agentRoles,
        missingRoles: requiredItems
            .filter(item => item.assignedAgentId
                ? !agentIds.has(item.assignedAgentId)
                : !agentRoleKeys.has(normalizeRoleName(item.roleName || item.label)))
            .map(item => item.label),
        unusedAgentRoles: agents
            .filter(agent => !assignedAgentIds.has(stringifyValue(agent?.id)))
            .map(agent => stringifyValue(agent?.name || agent?.profile))
            .filter(role => role && !requiredRoleKeys.has(normalizeRoleName(role))),
    }
}

function buildWorkflowMismatchMessage(missingRoles: string[]): string {
    return `当前流程缺少以下角色对应的 AI：${missingRoles.join('、')}。请先补齐角色，或让角色名称与流程中的“负责角色”保持一致。`
}

// Workflow templates ("plugin-like" local library)
groupChatRoutes.get('/api/hermes/group-chat/workflows', async (ctx) => {
    ctx.body = { workflows: await listWorkflowTemplates() }
})

groupChatRoutes.get('/api/hermes/group-chat/workflows/:id', async (ctx) => {
    const workflow = await getWorkflowTemplate(ctx.params.id)
    if (!workflow) {
        ctx.status = 404
        ctx.body = { error: 'Workflow template not found' }
        return
    }
    ctx.body = { workflow }
})

groupChatRoutes.post('/api/hermes/group-chat/workflows', async (ctx) => {
    const workflow = await saveWorkflowTemplate(ctx.request.body as any)
    ctx.body = { workflow }
})

groupChatRoutes.delete('/api/hermes/group-chat/workflows/:id', async (ctx) => {
    await deleteWorkflowTemplate(ctx.params.id)
    ctx.body = { success: true }
})

// Create room
groupChatRoutes.post('/api/hermes/group-chat/rooms', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const { name, inviteCode, agents, compression, workflow } = ctx.request.body as {
        name?: string
        inviteCode?: string
        agents?: { profile: string; name?: string; description?: string; avatar?: string; systemPrompt?: string; model?: string; temperature?: number | null; invited?: boolean }[]
        compression?: { triggerTokens?: number; maxHistoryTokens?: number; tailMessageCount?: number }
        workflow?: { workflowName?: string; workflowPrompt?: string; workflowConfig?: any }
    }
    if (!name || !inviteCode) {
        ctx.status = 400
        ctx.body = { error: 'name and inviteCode are required' }
        return
    }

    const createAlignment = analyzeWorkflowAgentAlignment(workflow?.workflowConfig, agents || [])
    if (createAlignment.missingRoles.length > 0) {
        ctx.status = 409
        ctx.body = {
            error: buildWorkflowMismatchMessage(createAlignment.missingRoles),
            details: createAlignment,
        }
        return
    }

    const roomId = generateId()
    const storage = chatServer.getStorage()
    storage.saveRoom(roomId, name, inviteCode, compression, workflow, agents)

    // Save agents to DB and auto-connect via Socket.IO
    const addedAgents = []
    for (const a of agents || []) {
        const agentId = generateId()
        const agent = storage.addRoomAgent(roomId, agentId, a)
        addedAgents.push(agent)

        try {
            const client = await chatServer.agentClients.createAgent({
                profile: agent.profile,
                name: agent.name,
                description: agent.description,
                avatar: agent.avatar,
                systemPrompt: agent.systemPrompt,
                model: agent.model,
                temperature: agent.temperature,
                invited: agent.invited,
            })
            await chatServer.agentClients.addAgentToRoom(roomId, client)
        } catch (err: any) {
            console.error(`[GroupChat] Failed to connect agent ${a.profile} to room ${roomId}: ${err.message}`)
        }
    }

    const room = storage.getRoom(roomId)
    ctx.body = { room, agents: addedAgents }
})

// Get room detail and messages
groupChatRoutes.get('/api/hermes/group-chat/rooms/:roomId', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const room = chatServer.getStorage().getRoom(ctx.params.roomId)
    if (!room) {
        ctx.status = 404
        ctx.body = { error: 'Room not found' }
        return
    }

    const messages = chatServer.getStorage().getMessages(ctx.params.roomId)
    const agents = chatServer.getStorage().getRoomAgents(ctx.params.roomId)
    const members = chatServer.getStorage().getRoomMembers(ctx.params.roomId)
    ctx.body = { room, messages, agents, members }
})

// List rooms
groupChatRoutes.get('/api/hermes/group-chat/rooms', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const rooms = chatServer.getStorage().getAllRooms()
    ctx.body = { rooms }
})

groupChatRoutes.get('/api/hermes/group-chat/rooms/:roomId/runtime', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const room = chatServer.getStorage().getRoom(ctx.params.roomId)
    if (!room) {
        ctx.status = 404
        ctx.body = { error: 'Room not found' }
        return
    }

    ctx.body = { runtime: chatServer.getRoomRuntimeSummary(ctx.params.roomId) }
})

groupChatRoutes.put('/api/hermes/group-chat/rooms/:roomId/activation', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const roomId = ctx.params.roomId
    const room = chatServer.getStorage().getRoom(roomId)
    if (!room) {
        ctx.status = 404
        ctx.body = { error: 'Room not found' }
        return
    }

    const { active } = ctx.request.body as { active?: boolean }
    if (active) {
        await chatServer.activateRoom(roomId)
    } else {
        chatServer.deactivateRoom(roomId)
    }

    ctx.body = {
        room: chatServer.getStorage().getRoom(roomId),
        runtime: chatServer.getRoomRuntimeSummary(roomId),
    }
})

// Get room by invite code
groupChatRoutes.get('/api/hermes/group-chat/rooms/join/:code', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const room = chatServer.getStorage().getRoomByInviteCode(ctx.params.code)
    if (!room) {
        ctx.status = 404
        ctx.body = { error: 'Room not found' }
        return
    }

    ctx.body = { room }
})

// Update room invite code
groupChatRoutes.put('/api/hermes/group-chat/rooms/:roomId/invite-code', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const { inviteCode } = ctx.request.body as { inviteCode?: string }
    if (!inviteCode) {
        ctx.status = 400
        ctx.body = { error: 'inviteCode is required' }
        return
    }

    chatServer.getStorage().updateRoomInviteCode(ctx.params.roomId, inviteCode)
    ctx.body = { success: true }
})

// Add agent to room
groupChatRoutes.post('/api/hermes/group-chat/rooms/:roomId/agents', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const { profile, name, description, avatar, systemPrompt, model, temperature, invited } = ctx.request.body as {
        profile?: string
        name?: string
        description?: string
        avatar?: string
        systemPrompt?: string
        model?: string
        temperature?: number | null
        invited?: boolean
        operatorName?: string
    }
    if (!profile) {
        ctx.status = 400
        ctx.body = { error: 'profile is required' }
        return
    }

    // Prevent exact duplicate agent in same room, but allow one profile to back multiple named agents.
    const existing = chatServer.getStorage().getRoomAgents(ctx.params.roomId)
    const nextName = name || profile
    if (existing.find(a => a.profile === profile && a.name === nextName)) {
        ctx.status = 409
        ctx.body = { error: 'Agent already in room' }
        return
    }

    const agentId = generateId()
    const agent = chatServer.getStorage().addRoomAgent(ctx.params.roomId, agentId, {
        profile,
        name,
        description,
        avatar,
        systemPrompt,
        model,
        temperature,
        invited,
    })

    // Auto-connect agent via Socket.IO
    try {
        const client = await chatServer.agentClients.createAgent({
            profile: agent.profile,
            name: agent.name,
            description: agent.description,
            avatar: agent.avatar,
            systemPrompt: agent.systemPrompt,
            model: agent.model,
            temperature: agent.temperature,
            invited: agent.invited,
        })
        await chatServer.agentClients.addAgentToRoom(ctx.params.roomId, client)
    } catch (err: any) {
        console.error(`[GroupChat] Failed to connect agent ${profile} to room ${ctx.params.roomId}: ${err.message}`)
    }

    chatServer.publishSystemNotice(
        ctx.params.roomId,
        buildSystemNotice(
            `新增角色「${agent.name}」`,
            summarizeAgentDiff({}, agent),
            `${ctx.request.body?.operatorName ? `${ctx.request.body.operatorName}` : '系统'} 已将该角色加入当前房间。`,
        ),
    )

    ctx.body = { agent }
})

// List agents in room
groupChatRoutes.get('/api/hermes/group-chat/rooms/:roomId/agents', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const agents = chatServer.getStorage().getRoomAgents(ctx.params.roomId)
    ctx.body = { agents }
})

// Update an agent config and reconnect it with the new runtime settings
groupChatRoutes.put('/api/hermes/group-chat/rooms/:roomId/agents/:agentId', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const roomId = ctx.params.roomId
    const persistedId = ctx.params.agentId
    const current = chatServer.getStorage().getRoomAgent(persistedId)
    if (!current || current.roomId !== roomId) {
        ctx.status = 404
        ctx.body = { error: 'Agent not found' }
        return
    }

    const { profile, name, description, avatar, systemPrompt, model, temperature, invited } = ctx.request.body as {
        profile?: string
        name?: string
        description?: string
        avatar?: string
        systemPrompt?: string
        model?: string
        temperature?: number | null
        invited?: boolean
        operatorName?: string
    }

    const nextProfile = profile ?? current.profile
    const nextName = name ?? current.name
    const duplicate = chatServer.getStorage()
        .getRoomAgents(roomId)
        .find(a => a.id !== persistedId && a.profile === nextProfile && a.name === nextName)
    if (duplicate) {
        ctx.status = 409
        ctx.body = { error: 'Agent already in room' }
        return
    }

    const roomWorkflowConfig = chatServer.getStorage().getRoomWorkflowConfig(roomId) || {}
    const nextAgents = chatServer.getStorage()
        .getRoomAgents(roomId)
        .map(agent => agent.id === persistedId
            ? {
                profile: nextProfile,
                name: nextName,
            }
            : {
                profile: agent.profile,
                name: agent.name,
            })
    const nextAlignment = analyzeWorkflowAgentAlignment(roomWorkflowConfig, nextAgents)
    if (nextAlignment.missingRoles.length > 0) {
        ctx.status = 409
        ctx.body = {
            error: buildWorkflowMismatchMessage(nextAlignment.missingRoles),
            details: nextAlignment,
        }
        return
    }

    const agent = chatServer.getStorage().updateRoomAgent(persistedId, {
        profile,
        name,
        description,
        avatar,
        systemPrompt,
        model,
        temperature,
        invited,
    })
    if (!agent) {
        ctx.status = 404
        ctx.body = { error: 'Agent not found' }
        return
    }

    const room = chatServer.getStorage().getRoom(roomId)
    if (room?.isSystemPreset) {
        const defaults = chatServer.getStorage().getDefaultAgents(roomId)
        const fallbackKey = `${current.name}::${current.profile}`
        const nextKey = `${agent.name}::${agent.profile}`
        const nextDefaults = defaults.map((item) => {
            const itemKey = `${item.name || item.profile}::${item.profile}`
            if (itemKey !== fallbackKey && itemKey !== nextKey) return item
            return {
                profile: agent.profile,
                name: agent.name,
                description: agent.description,
                avatar: agent.avatar,
                systemPrompt: agent.systemPrompt,
                model: agent.model,
                temperature: agent.temperature,
                invited: !!agent.invited,
            }
        })
        chatServer.getStorage().updateDefaultAgents(roomId, nextDefaults)
    }

    try {
        const client = await chatServer.agentClients.replaceAgentInRoom(roomId, current.agentId, {
            profile: agent.profile,
            name: agent.name,
            description: agent.description,
            avatar: agent.avatar,
            systemPrompt: agent.systemPrompt,
            model: agent.model,
            temperature: agent.temperature,
            invited: agent.invited,
        })
        // Persist the new runtime agent id so later remove/update calls target the active client.
        chatServer.getStorage().updateRoomAgentRuntimeId(persistedId, client.agentId)
    } catch (err: any) {
        console.error(`[GroupChat] Failed to reconnect updated agent ${agent.profile} in room ${roomId}: ${err.message}`)
    }

    const changes = summarizeAgentDiff(current, agent)
    if (changes.length > 0) {
        chatServer.publishSystemNotice(
            roomId,
            buildSystemNotice(`角色「${current.name}」已更新`, changes, `${ctx.request.body?.operatorName ? `${ctx.request.body.operatorName}` : '系统'} 已同步更新该 AI 的运行参数。`),
        )
    }

    ctx.body = { agent: chatServer.getStorage().getRoomAgent(persistedId) || agent }
})

// Update room workflow template
groupChatRoutes.put('/api/hermes/group-chat/rooms/:roomId/workflow', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const { workflowName, workflowPrompt } = ctx.request.body as { workflowName?: string; workflowPrompt?: string }
    chatServer.getStorage().updateRoomWorkflow(ctx.params.roomId, { workflowName, workflowPrompt })
    const room = chatServer.getStorage().getRoom(ctx.params.roomId)
    ctx.body = { room }
})

groupChatRoutes.get('/api/hermes/group-chat/rooms/:roomId/workflow-config', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const room = chatServer.getStorage().getRoom(ctx.params.roomId)
    if (!room) {
        ctx.status = 404
        ctx.body = { error: 'Room not found' }
        return
    }

    const workflowConfig = chatServer.getStorage().getRoomWorkflowConfig(ctx.params.roomId) || {}
    ctx.body = { workflowConfig }
})

groupChatRoutes.put('/api/hermes/group-chat/rooms/:roomId/workflow-config', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const roomId = ctx.params.roomId
    const room = chatServer.getStorage().getRoom(roomId)
    if (!room) {
        ctx.status = 404
        ctx.body = { error: 'Room not found' }
        return
    }

    const { workflowConfig, workflowName, workflowPrompt, operatorName, workflowTemplateName, changeNote, changeMeta } = ctx.request.body as {
        workflowConfig?: any
        workflowName?: string
        workflowPrompt?: string
        operatorName?: string
        workflowTemplateName?: string
        changeNote?: string
        changeMeta?: {
            summary?: string
            impactScope?: string
            rollbackPlan?: string
            executionNotes?: string
        }
    }
    const previousRoom = chatServer.getStorage().getRoom(roomId)
    const previousConfig = chatServer.getStorage().getRoomWorkflowConfig(roomId) || {}
    const nextWorkflowName = workflowName ?? previousRoom?.workflowName ?? ''
    const nextWorkflowPrompt = workflowPrompt ?? previousRoom?.workflowPrompt ?? ''
    const currentAgents = chatServer.getStorage().getRoomAgents(roomId)
    const workflowAlignment = analyzeWorkflowAgentAlignment(workflowConfig || {}, currentAgents)
    if (workflowAlignment.missingRoles.length > 0) {
        ctx.status = 409
        ctx.body = {
            error: buildWorkflowMismatchMessage(workflowAlignment.missingRoles),
            details: workflowAlignment,
        }
        return
    }
    chatServer.getStorage().updateRoomWorkflow(roomId, { workflowName: nextWorkflowName, workflowPrompt: nextWorkflowPrompt })
    chatServer.getStorage().updateRoomWorkflowConfig(roomId, workflowConfig || {})

    const currentRoom = chatServer.getStorage().getRoom(roomId)
    const nextConfig = chatServer.getStorage().getRoomWorkflowConfig(roomId) || {}
    const changes = [
        ...summarizeWorkflowConfigDiff(previousConfig, nextConfig),
        ...(stringifyValue(previousRoom?.workflowName) !== stringifyValue(nextWorkflowName) ? [`工作流名称：${stringifyValue(previousRoom?.workflowName) || '未设置'} -> ${stringifyValue(nextWorkflowName) || '未设置'}`] : []),
        ...(stringifyValue(previousRoom?.workflowPrompt) !== stringifyValue(nextWorkflowPrompt) ? ['工作流提示词已更新'] : []),
    ]
    if (workflowTemplateName) {
        changes.unshift(`已应用模板：${workflowTemplateName}`)
    }
    const normalizedChangeSummary = String(changeMeta?.summary || changeNote || '').trim()
    const normalizedImpactScope = String(changeMeta?.impactScope || '').trim()
    const normalizedRollbackPlan = String(changeMeta?.rollbackPlan || '').trim()
    const normalizedExecutionNotes = String(changeMeta?.executionNotes || '').trim()
    if (normalizedChangeSummary) {
        changes.push(`变更摘要：${normalizedChangeSummary}`)
    }
    if (normalizedImpactScope) {
        changes.push(`影响范围：${normalizedImpactScope}`)
    }
    if (normalizedRollbackPlan) {
        changes.push(`回滚方式：${normalizedRollbackPlan}`)
    }
    if (normalizedExecutionNotes) {
        changes.push(`执行要求：${normalizedExecutionNotes}`)
    }
    if (changes.length > 0) {
        chatServer.publishSystemNotice(
            roomId,
            buildSystemNotice(
                '工作流配置已更新',
                changes,
                `${operatorName || '系统'} 已将最新流程、角色与提示词同步给房间内所有 AI。`,
            ),
        )
    }

    ctx.body = {
        room: currentRoom,
        workflowConfig: nextConfig,
    }
})

groupChatRoutes.get('/api/hermes/group-chat/rooms/:roomId/workflow-state', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const roomId = ctx.params.roomId
    const room = chatServer.getStorage().getRoom(roomId)
    if (!room) {
        ctx.status = 404
        ctx.body = { error: 'Room not found' }
        return
    }

    ctx.body = chatServer.getWorkflowExecutionState(roomId)
})

groupChatRoutes.get('/api/hermes/group-chat/rooms/:roomId/workflow-artifacts', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const roomId = ctx.params.roomId
    const room = chatServer.getStorage().getRoom(roomId)
    if (!room) {
        ctx.status = 404
        ctx.body = { error: 'Room not found' }
        return
    }

    const limit = Math.max(1, Math.min(Number(ctx.query.limit || 20), 100))
    ctx.body = { artifacts: chatServer.getStorage().listWorkflowArtifacts(roomId, limit) }
})

groupChatRoutes.get('/api/hermes/group-chat/rooms/:roomId/workflow-run-history', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const roomId = ctx.params.roomId
    const room = chatServer.getStorage().getRoom(roomId)
    if (!room) {
        ctx.status = 404
        ctx.body = { error: 'Room not found' }
        return
    }

    const limit = Math.max(1, Math.min(Number(ctx.query.limit || 20), 100))
    ctx.body = { history: chatServer.getWorkflowRunHistory(roomId, limit) }
})

groupChatRoutes.post('/api/hermes/group-chat/rooms/:roomId/start-run', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const roomId = ctx.params.roomId
    const room = chatServer.getStorage().getRoom(roomId)
    if (!room) {
        ctx.status = 404
        ctx.body = { error: 'Room not found' }
        return
    }

    const { actorName, content, summary, artifactPath } = ctx.request.body as {
        actorName?: string
        content?: string
        summary?: string
        artifactPath?: string
    }

    try {
        ctx.body = await chatServer.startWorkflowRun(roomId, {
            actorName,
            content,
            summary,
            artifactPath,
        })
    } catch (err: any) {
        ctx.status = Number(err?.status) || 400
        ctx.body = {
            error: err?.message || 'Failed to start workflow execution',
            details: err?.details,
        }
    }
})

groupChatRoutes.post('/api/hermes/group-chat/rooms/:roomId/workflow-approval', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const roomId = ctx.params.roomId
    const room = chatServer.getStorage().getRoom(roomId)
    if (!room) {
        ctx.status = 404
        ctx.body = { error: 'Room not found' }
        return
    }

    const { action, actorName, reason } = ctx.request.body as {
        action?: 'approve' | 'reject'
        actorName?: string
        reason?: string
    }
    if (action !== 'approve' && action !== 'reject') {
        ctx.status = 400
        ctx.body = { error: 'action must be approve or reject' }
        return
    }

    try {
        ctx.body = await chatServer.submitWorkflowApproval(roomId, {
            action,
            actorName,
            reason,
        })
    } catch (err: any) {
        ctx.status = Number(err?.status) || 400
        ctx.body = { error: err?.message || 'Failed to submit workflow approval' }
    }
})

groupChatRoutes.post('/api/hermes/group-chat/rooms/:roomId/workflow-cancel', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const roomId = ctx.params.roomId
    const room = chatServer.getStorage().getRoom(roomId)
    if (!room) {
        ctx.status = 404
        ctx.body = { error: 'Room not found' }
        return
    }

    const { actorName, reason } = ctx.request.body as {
        actorName?: string
        reason?: string
    }

    try {
        ctx.body = chatServer.cancelWorkflowExecution(roomId, {
            actorName,
            reason,
        })
    } catch (err: any) {
        ctx.status = Number(err?.status) || 400
        ctx.body = { error: err?.message || 'Failed to cancel workflow execution' }
    }
})

groupChatRoutes.post('/api/hermes/group-chat/rooms/:roomId/messages/clear', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const roomId = ctx.params.roomId
    const room = chatServer.getStorage().getRoom(roomId)
    if (!room) {
        ctx.status = 404
        ctx.body = { error: 'Room not found' }
        return
    }

    const { actorName } = ctx.request.body as {
        actorName?: string
    }

    try {
        ctx.body = chatServer.clearRoomMessages(roomId, {
            actorName,
        })
    } catch (err: any) {
        ctx.status = Number(err?.status) || 400
        ctx.body = { error: err?.message || 'Failed to clear room messages' }
    }
})

groupChatRoutes.get('/api/hermes/group-chat/rooms/:roomId/project', async (ctx) => {
    const roomProject = projectService.getRoomPrimaryProject(ctx.params.roomId)
    ctx.body = { roomProject }
})

groupChatRoutes.put('/api/hermes/group-chat/rooms/:roomId/project', async (ctx) => {
    try {
        const { projectId, permissions } = ctx.request.body as {
            projectId?: string
            permissions?: ProjectPermissionConfig
        }
        if (!projectId) {
            ctx.status = 400
            ctx.body = { error: 'projectId is required' }
            return
        }
        const binding = projectService.bindRoomProject(ctx.params.roomId, projectId, permissions)
        const roomProject = projectService.getRoomPrimaryProject(ctx.params.roomId)
        ctx.body = { binding, roomProject }
    } catch (err: any) {
        ctx.status = 400
        ctx.body = { error: err.message || 'Failed to bind project' }
    }
})

groupChatRoutes.get('/api/hermes/group-chat/rooms/:roomId/artifacts', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const roomId = ctx.params.roomId
    const room = chatServer.getStorage().getRoom(roomId)
    if (!room) {
        ctx.status = 404
        ctx.body = { error: 'Room not found' }
        return
    }

    const path = typeof ctx.query.path === 'string' ? ctx.query.path : ''
    try {
        ctx.body = chatServer.listArtifacts(roomId, path)
    } catch (err: any) {
        ctx.status = 400
        ctx.body = { error: err.message || 'Failed to list artifacts' }
    }
})

groupChatRoutes.get('/api/hermes/group-chat/rooms/:roomId/artifacts/content', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const roomId = ctx.params.roomId
    const room = chatServer.getStorage().getRoom(roomId)
    if (!room) {
        ctx.status = 404
        ctx.body = { error: 'Room not found' }
        return
    }

    const path = typeof ctx.query.path === 'string' ? ctx.query.path : ''
    if (!path) {
        ctx.status = 400
        ctx.body = { error: 'path is required' }
        return
    }

    try {
        ctx.body = chatServer.readArtifact(roomId, path)
    } catch (err: any) {
        ctx.status = 400
        ctx.body = { error: err.message || 'Failed to read artifact' }
    }
})

// Save the default agent composition for a room
groupChatRoutes.put('/api/hermes/group-chat/rooms/:roomId/default-agents', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const { agents } = ctx.request.body as {
        agents?: { profile: string; name?: string; description?: string; avatar?: string; systemPrompt?: string; model?: string; temperature?: number | null; invited?: boolean }[]
    }
    const nextAgents = Array.isArray(agents)
        ? agents
        : chatServer.getStorage().getRoomAgents(ctx.params.roomId).map(agent => ({
            profile: agent.profile,
            name: agent.name,
            description: agent.description,
            avatar: agent.avatar,
            systemPrompt: agent.systemPrompt,
            model: agent.model,
            temperature: agent.temperature,
            invited: !!agent.invited,
        }))

    chatServer.getStorage().updateDefaultAgents(ctx.params.roomId, nextAgents)
    const room = chatServer.getStorage().getRoom(ctx.params.roomId)
    ctx.body = { room, agents: nextAgents }
})

// Apply the saved default agent composition, adding missing profiles to the room
groupChatRoutes.post('/api/hermes/group-chat/rooms/:roomId/default-agents/apply', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const roomId = ctx.params.roomId
    const defaults = chatServer.getStorage().getDefaultAgents(roomId)
    const existing = chatServer.getStorage().getRoomAgents(roomId)
    const added = []

    for (const config of defaults) {
        const nextName = config.name || config.profile
        if (!config.profile || existing.find(a => a.profile === config.profile && a.name === nextName)) continue

        const agentId = generateId()
        const agent = chatServer.getStorage().addRoomAgent(roomId, agentId, config)
        added.push(agent)
        existing.push(agent)

        try {
            const client = await chatServer.agentClients.createAgent({
                profile: agent.profile,
                name: agent.name,
                description: agent.description,
                avatar: agent.avatar,
                systemPrompt: agent.systemPrompt,
                model: agent.model,
                temperature: agent.temperature,
                invited: agent.invited,
            })
            await chatServer.agentClients.addAgentToRoom(roomId, client)
        } catch (err: any) {
            console.error(`[GroupChat] Failed to connect default agent ${agent.profile} to room ${roomId}: ${err.message}`)
        }
    }

    ctx.body = { agents: chatServer.getStorage().getRoomAgents(roomId), added }
})

// Remove agent from room
groupChatRoutes.delete('/api/hermes/group-chat/rooms/:roomId/agents/:agentId', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const agent = chatServer.getStorage().getRoomAgent(ctx.params.agentId)
    const operatorName = String((ctx.request.body as { operatorName?: string } | undefined)?.operatorName || '').trim()
    const roomWorkflowConfig = chatServer.getStorage().getRoomWorkflowConfig(ctx.params.roomId) || {}
    const nextAgents = chatServer.getStorage()
        .getRoomAgents(ctx.params.roomId)
        .filter(item => item.id !== ctx.params.agentId)
        .map(item => ({
            profile: item.profile,
            name: item.name,
        }))
    const nextAlignment = analyzeWorkflowAgentAlignment(roomWorkflowConfig, nextAgents)
    if (nextAlignment.missingRoles.length > 0) {
        ctx.status = 409
        ctx.body = {
            error: buildWorkflowMismatchMessage(nextAlignment.missingRoles),
            details: nextAlignment,
        }
        return
    }
    chatServer.getStorage().removeRoomAgent(ctx.params.agentId)
    chatServer.agentClients.removeAgentFromRoom(ctx.params.roomId, agent?.agentId || ctx.params.agentId)
    if (agent) {
        chatServer.publishSystemNotice(
            ctx.params.roomId,
            buildSystemNotice(`角色「${agent.name}」已移除`, [`该角色不再参与当前房间协作。`], `${operatorName || '系统'} 已同步更新房间成员配置。`),
        )
    }
    ctx.body = { success: true }
})

// Delete room
groupChatRoutes.delete('/api/hermes/group-chat/rooms/:roomId', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const roomId = ctx.params.roomId
    // Disconnect all agents in room
    chatServer.agentClients.disconnectRoom(roomId)
    // Delete all data
    chatServer.getStorage().deleteRoom(roomId)
    ctx.body = { success: true }
})

// Update room compression config
groupChatRoutes.put('/api/hermes/group-chat/rooms/:roomId/config', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const roomId = ctx.params.roomId
    const { triggerTokens, maxHistoryTokens, tailMessageCount } = ctx.request.body as {
        triggerTokens?: number
        maxHistoryTokens?: number
        tailMessageCount?: number
    }

    chatServer.getStorage().updateRoomConfig(roomId, { triggerTokens, maxHistoryTokens, tailMessageCount })
    const room = chatServer.getStorage().getRoom(roomId)
    ctx.body = { room }
})

// Force compress a room's context
groupChatRoutes.post('/api/hermes/group-chat/rooms/:roomId/compress', async (ctx) => {
    if (!chatServer) {
        ctx.status = 503
        ctx.body = { error: 'Group chat not initialized' }
        return
    }

    const roomId = ctx.params.roomId
    if (!chatServer.getStorage().getRoom(roomId)) {
        ctx.status = 404
        ctx.body = { error: 'Room not found' }
        return
    }

    const engine = chatServer.getContextEngine()
    if (!engine) {
        ctx.status = 503
        ctx.body = { error: 'Context engine not available' }
        return
    }

    try {
        const result = await engine.forceCompress(roomId)
        ctx.body = { success: true, summary: result }
    } catch (err: any) {
        ctx.status = 500
        ctx.body = { error: err.message }
    }
})
