import { Server, Socket, Namespace } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { homedir } from 'os'
import { join, resolve, relative, dirname } from 'path'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { getToken } from '../../../services/auth'
import { logger } from '../../../services/logger'
import { getDb } from '../../../db'
import { AgentClients } from './agent-clients'
import { ContextEngine } from '../context-engine/compressor'
import { rememberRoomMessageMemories } from '../memory-extractor'
import { SessionDeleter } from '../session-deleter'
import { projectService } from '../project'

// ─── Types ────────────────────────────────────────────────────

interface ChatMessage {
    id: string
    roomId: string
    senderId: string
    senderName: string
    content: string
    timestamp: number
}

interface RoomAgent {
    id: string
    roomId: string
    agentId: string
    profile: string
    name: string
    description: string
    avatar: string
    systemPrompt: string
    model: string
    temperature: number | null
    invited: number
}

interface RoomAgentConfig {
    profile: string
    name?: string
    description?: string
    avatar?: string
    systemPrompt?: string
    model?: string
    temperature?: number | null
    invited?: boolean
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
    stages?: WorkflowStageConfig[]
    version?: number
    editor?: {
        type?: 'logicflow'
        viewport?: { x?: number; y?: number; zoom?: number }
    }
    graph?: {
        nodes?: WorkflowGraphNode[]
        edges?: WorkflowGraphEdge[]
    }
    runtime?: {
        startNodeId?: string
        artifactRootDir?: string
        allowManualJump?: boolean
    }
}

interface WorkflowGraphNode {
    id: string
    type: string
    text?: string | { value?: string }
    x?: number
    y?: number
    properties?: Record<string, any>
}

interface WorkflowGraphEdge {
    id: string
    type?: string
    sourceNodeId: string
    targetNodeId: string
    text?: string | { value?: string }
    properties?: Record<string, any>
}

interface WorkflowRunState {
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

interface WorkflowNodeRunState {
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

interface WorkflowArtifactRecord {
    id: string
    roomId: string
    nodeId: string
    runNumber: number
    filePath: string
    relativePath: string
    format: string
    title: string
    summary: string
    createdBy: string
    createdAt: number
    confirmedBy: string
    confirmedAt: number
}

interface WorkflowRunHistoryRecord {
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

function normalizeString(value: unknown): string {
    if (value == null) return ''
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return ''
}

function normalizeRoleKey(value: unknown): string {
    return normalizeString(value).toLowerCase()
}

function truncateSummary(value: unknown, max = 140): string {
    const normalized = normalizeString(value).replace(/\s+/g, ' ')
    if (!normalized) return ''
    if (normalized.length <= max) return normalized
    return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function isSystemSenderId(value: unknown): boolean {
    const normalized = normalizeString(value)
    return normalized === 'system' || normalized.startsWith('system-')
}

function looksLikeClarificationRequest(content: string): boolean {
    const normalized = normalizeString(content)
    if (!normalized) return false

    if (/正在处理|先排队|处理完成后会继续响应|当前流程节点|当前负责角色是/.test(normalized)) {
        return true
    }

    const questionMarks = (normalized.match(/[?？]/g) || []).length
    const hasClarificationLanguage = /(请问|确认一下|先确认|需要先确认|需要.*澄清|请.*补充|请.*明确|还需要|哪种场景|哪个方案|选择方案|A\.|B\.|C\.|D\.|A。|B。|C。|D。|方案 A|方案 B|option a|option b|clarify|clarification|which|please confirm|need more)/i.test(normalized)
    const hasDeliverableLanguage = /(PRD|需求文档|设计方案|系统设计|技术方案|测试报告|交付物|产出内容|验收标准|接口设计|数据模型|实施方案|文件变更|<<<FILE:|# .+)/i.test(normalized)

    return hasClarificationLanguage && (questionMarks > 0 || !hasDeliverableLanguage)
}

function collectWorkflowRoleRequirements(workflowConfig: WorkflowRoomConfig | null): Array<{ label: string; roleName: string; assignedAgentId: string }> {
    const requirements = new Map<string, { label: string; roleName: string; assignedAgentId: string }>()
    const pushRequirement = (roleNameValue: unknown, assignedAgentIdValue?: unknown) => {
        const roleName = normalizeString(roleNameValue)
        const assignedAgentId = normalizeString(assignedAgentIdValue)
        if (!roleName && !assignedAgentId) return
        const key = assignedAgentId ? `agent:${assignedAgentId}` : `role:${normalizeRoleKey(roleName)}`
        if (!key || requirements.has(key)) return
        requirements.set(key, {
            label: roleName || assignedAgentId,
            roleName,
            assignedAgentId,
        })
    }

    for (const stage of workflowConfig?.stages || []) {
        pushRequirement(stage.roleName, stage.assignedAgentId)
    }

    for (const node of workflowConfig?.graph?.nodes || []) {
        const nodeType = normalizeString(node.properties?.workflowNodeType)
        if (nodeType !== 'role-task' && nodeType !== 'artifact-review') continue
        pushRequirement(node.properties?.roleName, node.properties?.assignedAgentId)
    }

    return Array.from(requirements.values())
}

function analyzeWorkflowAgentAlignment(
    workflowConfig: WorkflowRoomConfig | null,
    agents: Array<{ id?: string; name?: string; profile?: string }>,
): { missingRoles: string[] } {
    const requirements = collectWorkflowRoleRequirements(workflowConfig)
    const agentIds = new Set(agents.map(agent => normalizeString(agent.id)).filter(Boolean))
    const agentRoleKeys = new Set(
        agents
            .map(agent => normalizeRoleKey(agent.name || agent.profile))
            .filter(Boolean),
    )

    return {
        missingRoles: requirements
            .filter(item => item.assignedAgentId
                ? !agentIds.has(item.assignedAgentId)
                : !agentRoleKeys.has(normalizeRoleKey(item.roleName || item.label)))
            .map(item => item.label),
    }
}

function buildWorkflowMismatchMessage(missingRoles: string[]): string {
    return `当前流程缺少以下角色对应的 AI：${missingRoles.join('、')}。请先补齐角色，或让角色名称与流程中的“负责角色”保持一致。`
}

interface RoomInfo {
    id: string
    name: string
    inviteCode: string | null
    isSystemPreset: number
    isActive: number
    presetKey: string
    workflowName: string
    workflowPrompt: string
    workflowConfigJson: string
    defaultAgentsJson: string
    triggerTokens: number
    maxHistoryTokens: number
    tailMessageCount: number
    runSequence: number
    totalTokens: number
}

interface PresetRoomSeed {
    id: string
    presetKey: string
    name: string
    inviteCode: string
    workflow: {
        workflowName: string
        workflowPrompt: string
        workflowConfig: WorkflowRoomConfig
    }
    compression?: { triggerTokens?: number; maxHistoryTokens?: number; tailMessageCount?: number }
    agents: RoomAgentConfig[]
}

export interface GroupChatArtifactEntry {
    name: string
    path: string
    relativePath: string
    type: 'file' | 'directory'
    size: number
    updatedAt: number
}

interface GroupChatArtifactTreeSummary {
    totalEntryCount: number
    totalFileCount: number
    totalDirectoryCount: number
    latestFileName: string
    unlinkedFileCount: number
}

function normalizePresetAgentKey(config: { profile?: string; name?: string }): string {
    return `${String(config.name || '').trim() || String(config.profile || '').trim()}::${String(config.profile || '').trim()}`
}

function summarizeArtifactTree(rootDir: string): GroupChatArtifactTreeSummary {
    return summarizeArtifactTreeWithLinks(rootDir, new Set<string>())
}

function summarizeArtifactTreeWithLinks(rootDir: string, linkedRelativePaths: Set<string>): GroupChatArtifactTreeSummary {
    const summary: GroupChatArtifactTreeSummary = {
        totalEntryCount: 0,
        totalFileCount: 0,
        totalDirectoryCount: 0,
        latestFileName: '',
        unlinkedFileCount: 0,
    }
    let latestFileUpdatedAt = 0

    const walk = (dir: string) => {
        const entries = readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
            const fullPath = join(dir, entry.name)
            const entryStat = statSync(fullPath)
            summary.totalEntryCount += 1
            if (entry.isDirectory()) {
                summary.totalDirectoryCount += 1
                walk(fullPath)
                continue
            }
            summary.totalFileCount += 1
            const relativePath = relative(rootDir, fullPath) || ''
            if (!linkedRelativePaths.has(relativePath)) {
                summary.unlinkedFileCount += 1
            }
            if (entryStat.mtimeMs >= latestFileUpdatedAt) {
                latestFileUpdatedAt = entryStat.mtimeMs
                summary.latestFileName = entry.name
            }
        }
    }

    walk(rootDir)
    return summary
}

type PresetWorkflowTaskSpec = {
    key: string
    roleName: string
    nodeName: string
    deliverable: string
    prompt: string
    artifactDir: string
    artifactFileName: string
    executionMode?: 'artifact' | 'project-write'
}

function createRoleTaskNode(spec: PresetWorkflowTaskSpec, x: number, y: number): WorkflowGraphNode {
    return {
        id: `node-${spec.key}`,
        type: 'bpmn:userTask',
        x,
        y,
        text: spec.nodeName,
        properties: {
            workflowNodeType: 'role-task',
            roleName: spec.roleName,
            triggerMode: 'manual',
            handoffMode: 'manual',
            requiresAdminConfirm: false,
            requiresArtifact: true,
            artifactDir: spec.artifactDir,
            artifactFileName: spec.artifactFileName,
            artifactFormat: 'md',
            promptOverride: spec.prompt,
            executionMode: spec.executionMode || 'artifact',
        },
    }
}

function createApprovalNode(spec: PresetWorkflowTaskSpec, x: number, y: number): WorkflowGraphNode {
    return {
        id: `approval-${spec.key}`,
        type: 'bpmn:exclusiveGateway',
        x,
        y,
        text: `${spec.nodeName}审批`,
        properties: {
            workflowNodeType: 'approval',
            roleName: '管理员',
            branchConditionType: 'approve',
            branchConditionValue: spec.key,
        },
    }
}

function createFlowEdge(id: string, sourceNodeId: string, targetNodeId: string, branchConditionType: 'always' | 'approve' | 'reject' = 'always'): WorkflowGraphEdge {
    return {
        id,
        type: 'bpmn:sequenceFlow',
        sourceNodeId,
        targetNodeId,
        properties: {
            branchConditionType,
        },
    }
}

const OPC_RD_WORKFLOW_TASKS: PresetWorkflowTaskSpec[] = [
    {
        key: 'prd',
        roleName: '需求分析师',
        nodeName: 'PM / 需求分析师产出 PRD',
        deliverable: 'PRD、业务目标、范围边界、业务规则、验收标准',
        prompt: '你现在负责产出本需求的 PRD。请围绕业务目标、用户价值、范围边界、核心流程、异常场景、业务规则和验收标准给出结构化产物，明确需要主理人审核的关键点。',
        artifactDir: '01-prd',
        artifactFileName: 'prd.md',
    },
    {
        key: 'ui-design',
        roleName: '设计师',
        nodeName: 'UI 产出设计方案',
        deliverable: '页面结构、交互流程、关键状态、文案与设计约束',
        prompt: '请基于已确认 PRD 产出设计方案，重点说明页面结构、用户操作流程、关键状态、异常提示、信息层级和设计约束。当前阶段先输出设计说明，设计稿后续补充。',
        artifactDir: '02-ui-design',
        artifactFileName: 'ui-design.md',
    },
    {
        key: 'architecture',
        roleName: '架构师',
        nodeName: '架构产出技术选型与系统设计',
        deliverable: '技术选型、系统设计、模块边界、数据流、风险与方案',
        prompt: '请基于已确认 PRD 与 UI 方案，输出技术选型、系统设计、模块边界、核心数据流、依赖关系、风险点、降级策略与实施建议。',
        artifactDir: '03-architecture',
        artifactFileName: 'system-design.md',
    },
    {
        key: 'backend',
        roleName: '后端开发',
        nodeName: '后端产出 API / 服务代码方案',
        deliverable: '接口契约、服务拆分、数据模型、核心服务实现与联调说明',
        prompt: '请基于已确认方案输出后端交付内容。若当前房间已绑定可写项目，请直接给出真实代码变更，并严格使用代码文件块格式：<<<FILE:path/to/file>>>\n文件内容\n<<<END FILE>>>。至少提供一份需要写入项目的代码文件，再补充接口设计、数据模型、服务逻辑、测试点与联调约束说明。',
        artifactDir: '04-backend',
        artifactFileName: 'backend-delivery.md',
        executionMode: 'project-write',
    },
    {
        key: 'frontend',
        roleName: '前端开发',
        nodeName: '前端产出多端交付代码方案',
        deliverable: '页面实现、组件拆分、状态管理、多端适配、联调与验收说明',
        prompt: '请基于已确认 UI 与后端接口方案输出前端交付内容。若当前房间已绑定可写项目，请直接给出真实代码变更，并严格使用代码文件块格式：<<<FILE:path/to/file>>>\n文件内容\n<<<END FILE>>>。至少提供一份需要写入项目的代码文件，再补充页面拆解、组件设计、状态管理、多端适配、联调步骤与测试关注点。',
        artifactDir: '05-frontend',
        artifactFileName: 'frontend-delivery.md',
        executionMode: 'project-write',
    },
    {
        key: 'qa',
        roleName: 'QA',
        nodeName: 'QA 产出测试与测试报告',
        deliverable: '测试方案、测试用例、执行结果、风险评估与测试报告',
        prompt: '请基于已确认交付方案输出 QA 测试产物，包含测试范围、测试环境、测试用例、执行结果、遗留风险、上线建议与测试报告。',
        artifactDir: '06-qa',
        artifactFileName: 'test-report.md',
    },
]

function buildOpcRdWorkflowStages(): WorkflowStageConfig[] {
    return OPC_RD_WORKFLOW_TASKS.map((task) => ({
        id: task.key,
        name: task.nodeName,
        roleName: task.roleName,
        deliverable: task.deliverable,
        needsAdminConfirm: true,
        prompt: task.prompt,
    }))
}

function buildOpcRdWorkflowConfig(): WorkflowRoomConfig {
    const startNode: WorkflowGraphNode = {
        id: 'start-opc-rd',
        type: 'bpmn:startEvent',
        x: 120,
        y: 220,
        text: '发起需求',
        properties: {
            workflowNodeType: 'start',
        },
    }
    const endNode: WorkflowGraphNode = {
        id: 'end-opc-rd',
        type: 'bpmn:endEvent',
        x: 3000,
        y: 220,
        text: '研发流程完成',
        properties: {
            workflowNodeType: 'end',
        },
    }
    const nodes: WorkflowGraphNode[] = [startNode]
    const edges: WorkflowGraphEdge[] = []

    OPC_RD_WORKFLOW_TASKS.forEach((task, index) => {
        const taskX = 360 + index * 440
        const approvalX = taskX + 210
        nodes.push(createRoleTaskNode(task, taskX, 220))
        nodes.push(createApprovalNode(task, approvalX, 220))

        if (index === 0) {
            edges.push(createFlowEdge('edge-start-prd', startNode.id, `node-${task.key}`))
        }

        edges.push(createFlowEdge(`edge-${task.key}-to-approval`, `node-${task.key}`, `approval-${task.key}`))
        edges.push(createFlowEdge(`edge-${task.key}-reject`, `approval-${task.key}`, `node-${task.key}`, 'reject'))

        const nextTask = OPC_RD_WORKFLOW_TASKS[index + 1]
        if (nextTask) {
            edges.push(createFlowEdge(`edge-${task.key}-approve-next`, `approval-${task.key}`, `node-${nextTask.key}`, 'approve'))
        } else {
            edges.push(createFlowEdge(`edge-${task.key}-approve-end`, `approval-${task.key}`, endNode.id, 'approve'))
        }
    })

    nodes.push(endNode)

    return {
        version: 4,
        mode: 'stage-gated',
        ownerRoleName: '管理员',
        ownerUserName: '',
        stages: buildOpcRdWorkflowStages(),
        editor: {
            type: 'logicflow',
            viewport: { x: 0, y: 0, zoom: 0.8 },
        },
        graph: {
            nodes,
            edges,
        },
        runtime: {
            startNodeId: startNode.id,
            artifactRootDir: '.hermes/group-chat-artifacts/${roomId}',
            allowManualJump: false,
        },
    }
}

const OPC_RD_WORKFLOW_STAGES: WorkflowStageConfig[] = buildOpcRdWorkflowStages()

const PRESET_ROOM_SEEDS: PresetRoomSeed[] = [
    {
        id: 'preset-opc-rd-team',
        presetKey: 'opc-rd-team',
        name: 'OPC 研发工作组',
        inviteCode: 'OPC-RD',
        workflow: {
            workflowName: 'OPC 研发协作流',
            workflowPrompt: [
                '这是一个企业研发团队工作流，不是自由讨论群。',
                '标准流程为：发起需求 -> PM/需求分析师产出 PRD -> UI 设计 -> 架构技术选型与系统设计 -> 后端交付 -> 前端交付 -> QA 测试与测试报告。',
                '每个角色都必须产出明确交付物，并进入主理人审批节点。',
                '主理人审批通过后才允许流转到下一角色；如果审批驳回，必须根据驳回意见返回前一节点补充修正。',
                '请严格基于当前节点职责输出，不要越级替其他角色完成工作。',
                '最终目标是把需求推进到可评审、可开发、可联调、可测试的完成状态。',
            ].join('\n'),
            workflowConfig: buildOpcRdWorkflowConfig(),
        },
        compression: {
            triggerTokens: 120000,
            maxHistoryTokens: 36000,
            tailMessageCount: 30,
        },
        agents: [
            {
                profile: 'localhost-qwen3-4b',
                name: '需求分析师',
                description: '负责以 PM 视角产出 PRD、范围边界、业务规则和验收标准',
                avatar: 'requirements-analyst',
                systemPrompt: '你是企业研发团队里的需求分析师，同时承担 PM 职责。你的输出必须形成可评审的 PRD，包含业务目标、用户价值、范围边界、核心流程、业务规则、异常场景和验收标准。没有主理人确认前，不要进入后续阶段。',
                temperature: 0.2,
                invited: true,
            },
            {
                profile: 'localhost-qwen3-4b',
                name: '架构师',
                description: '负责技术选型、系统设计、系统边界和技术风险',
                avatar: 'architect',
                systemPrompt: '你是企业架构师。只有在 PRD 与 UI 方案确认后才进入工作，输出技术选型、系统边界、模块拆分、数据流、依赖、容量与风险，不要越权代替其他角色。',
                temperature: 0.2,
                invited: true,
            },
            {
                profile: 'localhost-qwen3-4b',
                name: '设计师',
                description: '负责 UI 设计方案、界面结构、交互流程和状态设计',
                avatar: 'designer',
                systemPrompt: '你是企业产品设计师。仅在 PRD 确认后输出 UI 设计方案，内容包括页面结构、操作流程、关键状态、异常提示、交互细节与设计约束。',
                temperature: 0.3,
                invited: true,
            },
            {
                profile: 'localhost-qwen3-4b',
                name: '前端开发',
                description: '负责多端页面交付、组件拆分和前端联调方案',
                avatar: 'frontend-engineer',
                systemPrompt: '你是企业前端开发。只在前置产物确认后输出前端交付方案，包含页面实现、组件拆分、状态管理、多端适配、接口联调点和测试关注点。',
                temperature: 0.2,
                invited: true,
            },
            {
                profile: 'localhost-qwen3-4b',
                name: '后端开发',
                description: '负责接口设计、数据模型和后端实现方案',
                avatar: 'backend-engineer',
                systemPrompt: '你是企业后端开发。只在架构方案确认后输出 API 契约、数据模型、服务逻辑、权限、错误处理、测试点与联调说明。',
                temperature: 0.2,
                invited: true,
            },
            {
                profile: 'localhost-qwen3-4b',
                name: 'QA',
                description: '负责测试方案、测试执行和测试报告',
                avatar: 'qa-engineer',
                systemPrompt: '你是企业 QA。只在前后端交付方案确认后输出测试方案、测试用例、执行结果、遗留风险、上线建议和测试报告。',
                temperature: 0.2,
                invited: true,
            },
            {
                profile: 'localhost-qwen3-4b',
                name: '运维',
                description: '负责部署发布、环境准备、监控告警和回滚预案',
                avatar: 'devops',
                systemPrompt: '你是企业运维工程师。当前作为系统预置成员参与研发协作，需要在涉及部署发布时提供环境准备、监控告警、回滚与发布检查建议。',
                temperature: 0.2,
                invited: true,
            },
        ],
    },
]

interface Member {
    id: string
    userId: string
    name: string
    description: string
    joinedAt: number
    online: boolean
    socketId: string
}

let _tablesEnsured = false

interface PendingSessionDelete {
    session_id: string
    profile_name: string
    status: string
    attempt_count: number
    last_error: string | null
    created_at: number
    updated_at: number
    next_attempt_at: number
}

interface GroupChatSessionProfile {
    session_id: string
    room_id: string
    agent_id: string
    profile_name: string
    created_at: number
}

export interface PendingSessionDeleteDrainResult {
    deleted: string[]
    failed: Array<{ sessionId: string; error: string }>
}

class ChatStorage {
    private db() { return getDb() }

    init(): void {
        if (_tablesEnsured) return
        const db = this.db()
        if (!db) return
        // Tables are now created centrally in initAllHermesTables()
        // Only create indexes here
        try { db.exec('CREATE INDEX IF NOT EXISTS idx_gc_messages_room ON gc_messages(roomId, timestamp)') } catch { /* ignore */ }
        try { db.exec('CREATE INDEX IF NOT EXISTS idx_gc_room_agents_room ON gc_room_agents(roomId)') } catch { /* ignore */ }
        try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_gc_room_members_unique ON gc_room_members(roomId, userId)') } catch { /* ignore */ }
        try { db.exec('CREATE INDEX IF NOT EXISTS idx_gc_pending_session_deletes_profile ON gc_pending_session_deletes(profile_name, status, next_attempt_at, created_at)') } catch { /* ignore */ }
        try { db.exec('CREATE INDEX IF NOT EXISTS idx_gc_session_profiles_profile ON gc_session_profiles(profile_name, created_at)') } catch { /* ignore */ }
        this.backfillWorkflowRunHistoryKickoffSummaries()
        _tablesEnsured = true
    }

    private backfillWorkflowRunHistoryKickoffSummaries(): void {
        const db = this.db()
        if (!db) return

        const rows = (db.prepare(
            `SELECT id, roomId, runNumber, startedAt, endedAt, kickoffSummary, latestMessageExcerpt
             FROM gc_workflow_run_history
             WHERE TRIM(COALESCE(kickoffSummary, '')) = ''
             ORDER BY startedAt ASC`
        ).all() || []) as Array<{
            id: string
            roomId: string
            runNumber: number
            startedAt: number
            endedAt: number
            kickoffSummary: string
            latestMessageExcerpt: string
        }>
        if (rows.length === 0) return

        const agentNamesByRoom = new Map<string, Set<string>>()
        const getAgentNames = (roomId: string): Set<string> => {
            let cached = agentNamesByRoom.get(roomId)
            if (cached) return cached
            cached = new Set(
                this.getRoomAgents(roomId)
                    .map(agent => normalizeString(agent.name))
                    .filter(Boolean),
            )
            agentNamesByRoom.set(roomId, cached)
            return cached
        }

        const selectMessages = db.prepare(
            `SELECT senderId, senderName, content, timestamp
             FROM gc_messages
             WHERE roomId = ? AND timestamp >= ? AND timestamp <= ?
             ORDER BY timestamp ASC
             LIMIT 200`
        )
        const updateKickoff = db.prepare('UPDATE gc_workflow_run_history SET kickoffSummary = ? WHERE id = ?')

        let repaired = 0
        for (const row of rows) {
            const lowerBound = Math.max(0, Number(row.startedAt || 0) - 30_000)
            const upperBound = Number(row.endedAt || 0) > 0 ? Number(row.endedAt) : Date.now()
            const messages = (selectMessages.all(row.roomId, lowerBound, upperBound) || []) as Array<{
                senderId: string
                senderName: string
                content: string
                timestamp: number
            }>
            const agentNames = getAgentNames(row.roomId)
            const kickoffMessage = messages.find((message) => {
                const senderId = normalizeString(message.senderId)
                if (senderId.startsWith('workflow-starter:')) return true
                if (isSystemSenderId(senderId)) return false
                const senderName = normalizeString(message.senderName)
                return senderName ? !agentNames.has(senderName) : true
            })
            const kickoffSummary = truncateSummary(kickoffMessage?.content, 300)
                || truncateSummary(row.latestMessageExcerpt, 300)
            if (!kickoffSummary) continue
            updateKickoff.run(kickoffSummary, row.id)
            repaired += 1
        }

        if (repaired > 0) {
            logger.info(`[GroupChat] backfilled kickoff summaries for ${repaired} workflow history record(s)`)
        }
    }

    saveSessionProfile(sessionId: string, roomId: string, agentId: string, profileName: string): void {
        this.db()?.prepare(
            'INSERT INTO gc_session_profiles (session_id, room_id, agent_id, profile_name, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET room_id = excluded.room_id, agent_id = excluded.agent_id, profile_name = excluded.profile_name'
        ).run(sessionId, roomId, agentId, profileName, Date.now())
    }

    getSessionProfile(sessionId: string): GroupChatSessionProfile | null {
        return (this.db()?.prepare(
            'SELECT session_id, room_id, agent_id, profile_name, created_at FROM gc_session_profiles WHERE session_id = ?'
        ).get(sessionId) as GroupChatSessionProfile | undefined) ?? null
    }

    deleteSessionProfile(sessionId: string): void {
        this.db()?.prepare('DELETE FROM gc_session_profiles WHERE session_id = ?').run(sessionId)
    }

    listPendingSessionDeletes(profileName: string, limit = 50): PendingSessionDelete[] {
        const rows = this.db()?.prepare(
            `SELECT session_id, profile_name, status, attempt_count, last_error, created_at, updated_at, next_attempt_at
             FROM gc_pending_session_deletes
             WHERE profile_name = ? AND status = 'pending' AND next_attempt_at <= ?
             ORDER BY created_at ASC
             LIMIT ?`
        ).all(profileName, Date.now(), limit) || []
        return rows.map((row: any) => ({
            session_id: String(row.session_id || ''),
            profile_name: String(row.profile_name || ''),
            status: String(row.status || 'pending'),
            attempt_count: Number(row.attempt_count || 0),
            last_error: row.last_error == null ? null : String(row.last_error),
            created_at: Number(row.created_at || 0),
            updated_at: Number(row.updated_at || 0),
            next_attempt_at: Number(row.next_attempt_at || 0),
        }))
    }

    enqueuePendingSessionDelete(sessionId: string, profileName: string): void {
        const now = Date.now()
        this.db()?.prepare(
            `INSERT INTO gc_pending_session_deletes (session_id, profile_name, status, attempt_count, last_error, created_at, updated_at, next_attempt_at)
             VALUES (?, ?, 'pending', 0, NULL, ?, ?, 0)
             ON CONFLICT(session_id) DO UPDATE SET
               profile_name = excluded.profile_name,
               status = 'pending',
               updated_at = excluded.updated_at,
               next_attempt_at = 0`
        ).run(sessionId, profileName, now, now)
    }

    claimPendingSessionDeletes(profileName: string, limit = 50): PendingSessionDelete[] {
        const rows = this.listPendingSessionDeletes(profileName, limit)
        if (rows.length === 0) return []
        const now = Date.now()
        const stmt = this.db()?.prepare(
            `UPDATE gc_pending_session_deletes
             SET status = 'processing', updated_at = ?
             WHERE session_id = ? AND status = 'pending'`
        )
        const claimed: PendingSessionDelete[] = []
        for (const row of rows) {
            const result = stmt?.run(now, row.session_id)
            if (result?.changes) {
                claimed.push({ ...row, status: 'processing', updated_at: now })
            }
        }
        return claimed
    }

    markPendingSessionDeleteFailed(sessionId: string, error: string): void {
        const now = Date.now()
        this.db()?.prepare(
            `UPDATE gc_pending_session_deletes
             SET status = 'pending',
                 attempt_count = attempt_count + 1,
                 last_error = ?,
                 updated_at = ?,
                 next_attempt_at = ?
             WHERE session_id = ?`
        ).run(error, now, now + 60_000, sessionId)
    }

    removePendingSessionDelete(sessionId: string): void {
        this.db()?.prepare('DELETE FROM gc_pending_session_deletes WHERE session_id = ?').run(sessionId)
    }

    getPendingDeletedSessionIds(): Set<string> {
        const rows = (this.db()?.prepare(
            `SELECT session_id FROM gc_pending_session_deletes WHERE status IN ('pending', 'processing')`
        ).all() || []) as Array<{ session_id: string }>
        return new Set(rows.map(row => row.session_id))
    }

    // ─── Rooms ────────────────────────────────────────────────

    private roomSelect(): string {
        return 'id, name, inviteCode, isSystemPreset, isActive, presetKey, workflowName, workflowPrompt, workflowConfigJson, defaultAgentsJson, triggerTokens, maxHistoryTokens, tailMessageCount, runSequence, totalTokens'
    }

    getRoom(roomId: string): RoomInfo | undefined {
        return this.db()?.prepare(`SELECT ${this.roomSelect()} FROM gc_rooms WHERE id = ?`).get(roomId) as any
    }

    getRoomByInviteCode(code: string): RoomInfo | undefined {
        return this.db()?.prepare(`SELECT ${this.roomSelect()} FROM gc_rooms WHERE inviteCode = ?`).get(code) as any
    }

    getAllRooms(): RoomInfo[] {
        return (this.db()?.prepare(`SELECT ${this.roomSelect()} FROM gc_rooms ORDER BY id`).all() || []) as any[]
    }

    saveRoom(
        id: string,
        name: string,
        inviteCode?: string,
        config?: { triggerTokens?: number; maxHistoryTokens?: number; tailMessageCount?: number },
        workflow?: { workflowName?: string; workflowPrompt?: string; workflowConfig?: WorkflowRoomConfig },
        defaultAgents?: RoomAgentConfig[],
        options?: { isSystemPreset?: boolean; presetKey?: string },
    ): void {
        this.db()?.prepare(
            'INSERT OR IGNORE INTO gc_rooms (id, name, inviteCode, isSystemPreset, isActive, presetKey, workflowName, workflowPrompt, workflowConfigJson, defaultAgentsJson, triggerTokens, maxHistoryTokens, tailMessageCount, runSequence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
            id,
            name,
            inviteCode || null,
            options?.isSystemPreset ? 1 : 0,
            0,
            options?.presetKey || '',
            workflow?.workflowName || '',
            workflow?.workflowPrompt || '',
            JSON.stringify(workflow?.workflowConfig || {}),
            JSON.stringify(defaultAgents || []),
            config?.triggerTokens ?? 100000,
            config?.maxHistoryTokens ?? 32000,
            config?.tailMessageCount ?? 20,
            0,
        )
    }

    getRoomByPresetKey(presetKey: string): RoomInfo | undefined {
        return this.db()?.prepare(`SELECT ${this.roomSelect()} FROM gc_rooms WHERE presetKey = ?`).get(presetKey) as any
    }

    updateRoomConfig(roomId: string, config: { triggerTokens?: number; maxHistoryTokens?: number; tailMessageCount?: number }): void {
        const sets: string[] = []
        const vals: any[] = []
        if (config.triggerTokens !== undefined) { sets.push('triggerTokens = ?'); vals.push(config.triggerTokens) }
        if (config.maxHistoryTokens !== undefined) { sets.push('maxHistoryTokens = ?'); vals.push(config.maxHistoryTokens) }
        if (config.tailMessageCount !== undefined) { sets.push('tailMessageCount = ?'); vals.push(config.tailMessageCount) }
        if (sets.length === 0) return
        vals.push(roomId)
        this.db()?.prepare(`UPDATE gc_rooms SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
    }

    updateRoomInviteCode(roomId: string, inviteCode: string): void {
        this.db()?.prepare('UPDATE gc_rooms SET inviteCode = ? WHERE id = ?').run(inviteCode, roomId)
    }

    updateRoomActive(roomId: string, isActive: boolean): void {
        this.db()?.prepare('UPDATE gc_rooms SET isActive = ? WHERE id = ?').run(isActive ? 1 : 0, roomId)
    }

    getActiveRoomId(): string | null {
        const row = this.db()?.prepare('SELECT id FROM gc_rooms WHERE isActive = 1 ORDER BY id LIMIT 1').get() as { id?: string } | undefined
        return row?.id || null
    }

    getActiveRooms(): RoomInfo[] {
        return (this.db()?.prepare(`SELECT ${this.roomSelect()} FROM gc_rooms WHERE isActive = 1 ORDER BY id`).all() || []) as any[]
    }

    updateRoomWorkflow(roomId: string, workflow: { workflowName?: string; workflowPrompt?: string }): void {
        this.db()?.prepare('UPDATE gc_rooms SET workflowName = ?, workflowPrompt = ? WHERE id = ?')
            .run(workflow.workflowName || '', workflow.workflowPrompt || '', roomId)
    }

    updateRoomWorkflowConfig(roomId: string, workflowConfig: WorkflowRoomConfig): void {
        this.db()?.prepare('UPDATE gc_rooms SET workflowConfigJson = ? WHERE id = ?')
            .run(JSON.stringify(workflowConfig || {}), roomId)
    }

    replaceRoomAgents(roomId: string, agents: RoomAgentConfig[]): void {
        const db = this.db()
        if (!db) return
        db.prepare('DELETE FROM gc_room_agents WHERE roomId = ?').run(roomId)
        for (const config of agents) {
            this.addRoomAgent(roomId, `${roomId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, config)
        }
    }

    appendMissingRoomAgents(roomId: string, agents: RoomAgentConfig[]): RoomAgent[] {
        const existing = this.getRoomAgents(roomId)
        const existingKeys = new Set(existing.map(agent => normalizePresetAgentKey(agent)))
        const added: RoomAgent[] = []
        for (const config of agents) {
            const key = normalizePresetAgentKey(config)
            if (!config.profile || existingKeys.has(key)) continue
            const created = this.addRoomAgent(roomId, `${roomId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, config)
            existingKeys.add(key)
            added.push(created)
        }
        return added
    }

    getRoomWorkflowConfig(roomId: string): WorkflowRoomConfig | null {
        const row = this.db()?.prepare('SELECT workflowConfigJson FROM gc_rooms WHERE id = ?').get(roomId) as { workflowConfigJson?: string } | undefined
        if (!row?.workflowConfigJson) return null
        try {
            const parsed = JSON.parse(row.workflowConfigJson)
            return parsed && typeof parsed === 'object' ? parsed : null
        } catch {
            return null
        }
    }

    getWorkflowRunState(roomId: string): WorkflowRunState | null {
        return (this.db()?.prepare(
            'SELECT roomId, workflowVersion, runNumber, status, currentNodeId, kickoffSummary, kickoffArtifactPath, startedAt, updatedAt FROM gc_workflow_runs WHERE roomId = ?'
        ).get(roomId) as WorkflowRunState | undefined) ?? null
    }

    saveWorkflowRunState(roomId: string, runState: Partial<WorkflowRunState>): WorkflowRunState | null {
        const now = Date.now()
        const current = this.getWorkflowRunState(roomId)
        const next: WorkflowRunState = {
            roomId,
            workflowVersion: runState.workflowVersion ?? current?.workflowVersion ?? 1,
            runNumber: runState.runNumber ?? current?.runNumber ?? 0,
            status: runState.status ?? current?.status ?? 'idle',
            currentNodeId: runState.currentNodeId ?? current?.currentNodeId ?? '',
            kickoffSummary: runState.kickoffSummary ?? current?.kickoffSummary ?? '',
            kickoffArtifactPath: runState.kickoffArtifactPath ?? current?.kickoffArtifactPath ?? '',
            startedAt: runState.startedAt ?? current?.startedAt ?? now,
            updatedAt: now,
        }
        this.db()?.prepare(
            `INSERT INTO gc_workflow_runs (roomId, workflowVersion, runNumber, status, currentNodeId, kickoffSummary, kickoffArtifactPath, startedAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(roomId) DO UPDATE SET
               workflowVersion = excluded.workflowVersion,
               runNumber = excluded.runNumber,
               status = excluded.status,
               currentNodeId = excluded.currentNodeId,
               kickoffSummary = excluded.kickoffSummary,
               kickoffArtifactPath = excluded.kickoffArtifactPath,
               startedAt = excluded.startedAt,
               updatedAt = excluded.updatedAt`
        ).run(next.roomId, next.workflowVersion, next.runNumber, next.status, next.currentNodeId, next.kickoffSummary, next.kickoffArtifactPath, next.startedAt, next.updatedAt)
        return this.getWorkflowRunState(roomId)
    }

    getWorkflowNodeRun(roomId: string, nodeId: string): WorkflowNodeRunState | null {
        return (this.db()?.prepare(
            'SELECT id, roomId, nodeId, status, actorAgentName, artifactIdsJson, startedAt, completedAt, updatedAt FROM gc_workflow_node_runs WHERE roomId = ? AND nodeId = ? ORDER BY updatedAt DESC LIMIT 1'
        ).get(roomId, nodeId) as WorkflowNodeRunState | undefined) ?? null
    }

    getWorkflowNodeRuns(roomId: string): WorkflowNodeRunState[] {
        return (this.db()?.prepare(
            'SELECT id, roomId, nodeId, status, actorAgentName, artifactIdsJson, startedAt, completedAt, updatedAt FROM gc_workflow_node_runs WHERE roomId = ? ORDER BY updatedAt DESC'
        ).all(roomId) || []) as unknown as WorkflowNodeRunState[]
    }

    clearWorkflowNodeRuns(roomId: string): void {
        this.db()?.prepare('DELETE FROM gc_workflow_node_runs WHERE roomId = ?').run(roomId)
    }

    saveWorkflowNodeRun(roomId: string, nodeId: string, runState: Partial<WorkflowNodeRunState>): WorkflowNodeRunState | null {
        const now = Date.now()
        const current = this.getWorkflowNodeRun(roomId, nodeId)
        const next: WorkflowNodeRunState = {
            id: current?.id || `${roomId}-${nodeId}-${now}`,
            roomId,
            nodeId,
            status: runState.status ?? current?.status ?? 'pending',
            actorAgentName: runState.actorAgentName ?? current?.actorAgentName ?? '',
            artifactIdsJson: runState.artifactIdsJson ?? current?.artifactIdsJson ?? '[]',
            startedAt: runState.startedAt ?? current?.startedAt ?? now,
            completedAt: runState.completedAt ?? current?.completedAt ?? 0,
            updatedAt: now,
        }
        this.db()?.prepare(
            `INSERT INTO gc_workflow_node_runs (id, roomId, nodeId, status, actorAgentName, artifactIdsJson, startedAt, completedAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               status = excluded.status,
               actorAgentName = excluded.actorAgentName,
               artifactIdsJson = excluded.artifactIdsJson,
               startedAt = excluded.startedAt,
               completedAt = excluded.completedAt,
               updatedAt = excluded.updatedAt`
        ).run(next.id, next.roomId, next.nodeId, next.status, next.actorAgentName, next.artifactIdsJson, next.startedAt, next.completedAt, next.updatedAt)
        return this.getWorkflowNodeRun(roomId, nodeId)
    }

    saveWorkflowArtifact(artifact: WorkflowArtifactRecord): WorkflowArtifactRecord {
        this.db()?.prepare(
            `INSERT INTO gc_workflow_artifacts (id, roomId, nodeId, runNumber, filePath, relativePath, format, title, summary, createdBy, createdAt, confirmedBy, confirmedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               runNumber = excluded.runNumber,
               filePath = excluded.filePath,
               relativePath = excluded.relativePath,
               format = excluded.format,
               title = excluded.title,
               summary = excluded.summary,
               createdBy = excluded.createdBy,
               createdAt = excluded.createdAt,
               confirmedBy = excluded.confirmedBy,
               confirmedAt = excluded.confirmedAt`
        ).run(
            artifact.id,
            artifact.roomId,
            artifact.nodeId,
            artifact.runNumber,
            artifact.filePath,
            artifact.relativePath,
            artifact.format,
            artifact.title,
            artifact.summary,
            artifact.createdBy,
            artifact.createdAt,
            artifact.confirmedBy,
            artifact.confirmedAt,
        )
        return artifact
    }

    getWorkflowArtifactsByNode(roomId: string, nodeId: string): WorkflowArtifactRecord[] {
        return (this.db()?.prepare(
            'SELECT id, roomId, nodeId, runNumber, filePath, relativePath, format, title, summary, createdBy, createdAt, confirmedBy, confirmedAt FROM gc_workflow_artifacts WHERE roomId = ? AND nodeId = ? ORDER BY createdAt DESC'
        ).all(roomId, nodeId) || []) as unknown as WorkflowArtifactRecord[]
    }

    listWorkflowArtifacts(roomId: string, limit = 50): WorkflowArtifactRecord[] {
        return (this.db()?.prepare(
            'SELECT id, roomId, nodeId, runNumber, filePath, relativePath, format, title, summary, createdBy, createdAt, confirmedBy, confirmedAt FROM gc_workflow_artifacts WHERE roomId = ? ORDER BY createdAt DESC LIMIT ?'
        ).all(roomId, limit) || []) as unknown as WorkflowArtifactRecord[]
    }

    getWorkflowArtifactByPath(roomId: string, relativePath: string): WorkflowArtifactRecord | null {
        return (this.db()?.prepare(
            'SELECT id, roomId, nodeId, runNumber, filePath, relativePath, format, title, summary, createdBy, createdAt, confirmedBy, confirmedAt FROM gc_workflow_artifacts WHERE roomId = ? AND relativePath = ? ORDER BY createdAt DESC LIMIT 1'
        ).get(roomId, relativePath) as WorkflowArtifactRecord | undefined) ?? null
    }

    saveWorkflowRunHistory(record: WorkflowRunHistoryRecord): WorkflowRunHistoryRecord {
        this.db()?.prepare(
            `INSERT INTO gc_workflow_run_history (
                id, roomId, runNumber, workflowVersion, status, currentNodeId, currentNodeTitle,
                kickoffSummary, kickoffArtifactPath, startedAt, endedAt, completedNodeCount,
                rejectedNodeCount, pendingApprovalCount, totalNodeRuns, latestActorAgentName,
                latestActivityNodeTitle, latestActivityStatus, latestActivityAt,
                latestSystemNoticeExcerpt, latestMessageExcerpt, latestMessageSenderName,
                latestApprovalActorName, latestApprovalAction, latestApprovalStageTitle,
                latestApprovalReason, latestCompletedNodeTitle, latestRejectedNodeTitle,
                latestPendingApprovalNodeTitle, latestArtifactPath, latestArtifactTitle,
                projectId, projectName, projectGitEnabled, projectGitBranch, projectGitRepoUrl,
                projectGitTrackedAt, projectGitAheadCount, projectGitBehindCount,
                projectGitStagedCount, projectGitModifiedCount, projectGitUntrackedCount,
                projectGitChangeCount, projectTouchedFileCount, projectTouchedFilesJson,
                projectGitChangesJson, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                roomId = excluded.roomId,
                runNumber = excluded.runNumber,
                workflowVersion = excluded.workflowVersion,
                status = excluded.status,
                currentNodeId = excluded.currentNodeId,
                currentNodeTitle = excluded.currentNodeTitle,
                kickoffSummary = excluded.kickoffSummary,
                kickoffArtifactPath = excluded.kickoffArtifactPath,
                startedAt = excluded.startedAt,
                endedAt = excluded.endedAt,
                completedNodeCount = excluded.completedNodeCount,
                rejectedNodeCount = excluded.rejectedNodeCount,
                pendingApprovalCount = excluded.pendingApprovalCount,
                totalNodeRuns = excluded.totalNodeRuns,
                latestActorAgentName = excluded.latestActorAgentName,
                latestActivityNodeTitle = excluded.latestActivityNodeTitle,
                latestActivityStatus = excluded.latestActivityStatus,
                latestActivityAt = excluded.latestActivityAt,
                latestSystemNoticeExcerpt = excluded.latestSystemNoticeExcerpt,
                latestMessageExcerpt = excluded.latestMessageExcerpt,
                latestMessageSenderName = excluded.latestMessageSenderName,
                latestApprovalActorName = excluded.latestApprovalActorName,
                latestApprovalAction = excluded.latestApprovalAction,
                latestApprovalStageTitle = excluded.latestApprovalStageTitle,
                latestApprovalReason = excluded.latestApprovalReason,
                latestCompletedNodeTitle = excluded.latestCompletedNodeTitle,
                latestRejectedNodeTitle = excluded.latestRejectedNodeTitle,
                latestPendingApprovalNodeTitle = excluded.latestPendingApprovalNodeTitle,
                latestArtifactPath = excluded.latestArtifactPath,
                latestArtifactTitle = excluded.latestArtifactTitle,
                projectId = excluded.projectId,
                projectName = excluded.projectName,
                projectGitEnabled = excluded.projectGitEnabled,
                projectGitBranch = excluded.projectGitBranch,
                projectGitRepoUrl = excluded.projectGitRepoUrl,
                projectGitTrackedAt = excluded.projectGitTrackedAt,
                projectGitAheadCount = excluded.projectGitAheadCount,
                projectGitBehindCount = excluded.projectGitBehindCount,
                projectGitStagedCount = excluded.projectGitStagedCount,
                projectGitModifiedCount = excluded.projectGitModifiedCount,
                projectGitUntrackedCount = excluded.projectGitUntrackedCount,
                projectGitChangeCount = excluded.projectGitChangeCount,
                projectTouchedFileCount = excluded.projectTouchedFileCount,
                projectTouchedFilesJson = excluded.projectTouchedFilesJson,
                projectGitChangesJson = excluded.projectGitChangesJson,
                updatedAt = excluded.updatedAt`
        ).run(
            record.id,
            record.roomId,
            record.runNumber,
            record.workflowVersion,
            record.status,
            record.currentNodeId,
            record.currentNodeTitle,
            record.kickoffSummary,
            record.kickoffArtifactPath,
            record.startedAt,
            record.endedAt,
            record.completedNodeCount,
            record.rejectedNodeCount,
            record.pendingApprovalCount,
            record.totalNodeRuns,
            record.latestActorAgentName,
            record.latestActivityNodeTitle,
            record.latestActivityStatus,
            record.latestActivityAt,
            record.latestSystemNoticeExcerpt,
            record.latestMessageExcerpt,
            record.latestMessageSenderName,
            record.latestApprovalActorName,
            record.latestApprovalAction,
            record.latestApprovalStageTitle,
            record.latestApprovalReason,
            record.latestCompletedNodeTitle,
            record.latestRejectedNodeTitle,
            record.latestPendingApprovalNodeTitle,
            record.latestArtifactPath,
            record.latestArtifactTitle,
            record.projectId,
            record.projectName,
            record.projectGitEnabled,
            record.projectGitBranch,
            record.projectGitRepoUrl,
            record.projectGitTrackedAt,
            record.projectGitAheadCount,
            record.projectGitBehindCount,
            record.projectGitStagedCount,
            record.projectGitModifiedCount,
            record.projectGitUntrackedCount,
            record.projectGitChangeCount,
            record.projectTouchedFileCount,
            record.projectTouchedFilesJson,
            record.projectGitChangesJson,
            record.updatedAt,
        )
        return record
    }

    listWorkflowRunHistory(roomId: string, limit = 20): WorkflowRunHistoryRecord[] {
        return (this.db()?.prepare(
            `SELECT id, roomId, runNumber, workflowVersion, status, currentNodeId, currentNodeTitle,
                    kickoffSummary, kickoffArtifactPath, startedAt, endedAt, completedNodeCount,
                    rejectedNodeCount, pendingApprovalCount, totalNodeRuns, latestActorAgentName,
                    latestActivityNodeTitle, latestActivityStatus, latestActivityAt,
                    latestSystemNoticeExcerpt, latestMessageExcerpt, latestMessageSenderName,
                    latestApprovalActorName, latestApprovalAction, latestApprovalStageTitle,
                    latestApprovalReason, latestCompletedNodeTitle, latestRejectedNodeTitle,
                    latestPendingApprovalNodeTitle, latestArtifactPath, latestArtifactTitle,
                    projectId, projectName, projectGitEnabled, projectGitBranch, projectGitRepoUrl,
                    projectGitTrackedAt, projectGitAheadCount, projectGitBehindCount,
                    projectGitStagedCount, projectGitModifiedCount, projectGitUntrackedCount,
                    projectGitChangeCount, projectTouchedFileCount, projectTouchedFilesJson,
                    projectGitChangesJson, updatedAt
             FROM gc_workflow_run_history
             WHERE roomId = ?
             ORDER BY runNumber DESC, updatedAt DESC
             LIMIT ?`
        ).all(roomId, limit) || []) as unknown as WorkflowRunHistoryRecord[]
    }

    getWorkflowRunHistoryRecord(roomId: string, runNumber: number): WorkflowRunHistoryRecord | null {
        return (this.db()?.prepare(
            `SELECT id, roomId, runNumber, workflowVersion, status, currentNodeId, currentNodeTitle,
                    kickoffSummary, kickoffArtifactPath, startedAt, endedAt, completedNodeCount,
                    rejectedNodeCount, pendingApprovalCount, totalNodeRuns, latestActorAgentName,
                    latestActivityNodeTitle, latestActivityStatus, latestActivityAt,
                    latestSystemNoticeExcerpt, latestMessageExcerpt, latestMessageSenderName,
                    latestApprovalActorName, latestApprovalAction, latestApprovalStageTitle,
                    latestApprovalReason, latestCompletedNodeTitle, latestRejectedNodeTitle,
                    latestPendingApprovalNodeTitle, latestArtifactPath, latestArtifactTitle,
                    projectId, projectName, projectGitEnabled, projectGitBranch, projectGitRepoUrl,
                    projectGitTrackedAt, projectGitAheadCount, projectGitBehindCount,
                    projectGitStagedCount, projectGitModifiedCount, projectGitUntrackedCount,
                    projectGitChangeCount, projectTouchedFileCount, projectTouchedFilesJson,
                    projectGitChangesJson, updatedAt
             FROM gc_workflow_run_history
             WHERE roomId = ? AND runNumber = ?
             LIMIT 1`
        ).get(roomId, runNumber) as WorkflowRunHistoryRecord | undefined) ?? null
    }

    confirmWorkflowArtifacts(roomId: string, nodeId: string, confirmedBy: string): void {
        this.db()?.prepare(
            'UPDATE gc_workflow_artifacts SET confirmedBy = ?, confirmedAt = ? WHERE roomId = ? AND nodeId = ?'
        ).run(confirmedBy, Date.now(), roomId, nodeId)
    }

    markPresetRoomDeleted(presetKey: string): void {
        this.db()?.prepare(
            'INSERT INTO gc_preset_room_tombstones (presetKey, deletedAt) VALUES (?, ?) ON CONFLICT(presetKey) DO UPDATE SET deletedAt = excluded.deletedAt'
        ).run(presetKey, Date.now())
    }

    isPresetRoomDeleted(presetKey: string): boolean {
        const row = this.db()?.prepare('SELECT presetKey FROM gc_preset_room_tombstones WHERE presetKey = ?').get(presetKey) as { presetKey?: string } | undefined
        return !!row?.presetKey
    }

    getDefaultAgents(roomId: string): RoomAgentConfig[] {
        const row = this.db()?.prepare('SELECT defaultAgentsJson FROM gc_rooms WHERE id = ?').get(roomId) as { defaultAgentsJson?: string } | undefined
        if (!row?.defaultAgentsJson) return []
        try {
            const parsed = JSON.parse(row.defaultAgentsJson)
            return Array.isArray(parsed) ? parsed : []
        } catch {
            return []
        }
    }

    updateDefaultAgents(roomId: string, agents: RoomAgentConfig[]): void {
        this.db()?.prepare('UPDATE gc_rooms SET defaultAgentsJson = ? WHERE id = ?').run(JSON.stringify(agents), roomId)
    }

    updateRoomTotalTokens(roomId: string, tokens: number): void {
        this.db()?.prepare('UPDATE gc_rooms SET totalTokens = ? WHERE id = ?').run(tokens, roomId)
    }

    incrementRoomRunSequence(roomId: string): number {
        this.db()?.prepare('UPDATE gc_rooms SET runSequence = runSequence + 1 WHERE id = ?').run(roomId)
        const row = this.db()?.prepare('SELECT runSequence FROM gc_rooms WHERE id = ?').get(roomId) as { runSequence?: number } | undefined
        return Number(row?.runSequence || 0)
    }

    estimateTokens(text: string): number {
        const cjk = (text.match(/[\u2e80-\u9fff\uac00-\ud7af\u3000-\u303f\uff00-\uffef]/g) || []).length
        const other = text.length - cjk
        return Math.ceil(cjk * 1.5 + other / 4)
    }

    // ─── Messages ─────────────────────────────────────────────

    getMessages(roomId: string, limit = 500): ChatMessage[] {
        const rows = (this.db()?.prepare(
            'SELECT id, roomId, senderId, senderName, content, timestamp FROM gc_messages WHERE roomId = ? ORDER BY timestamp DESC LIMIT ?'
        ).all(roomId, limit) || []) as any[]
        return rows.reverse()
    }

    addMessage(msg: ChatMessage): void {
        this.db()?.prepare(
            'INSERT INTO gc_messages (id, roomId, senderId, senderName, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(msg.id, msg.roomId, msg.senderId, msg.senderName, msg.content, msg.timestamp)
    }

    clearMessages(roomId: string): void {
        this.db()?.prepare('DELETE FROM gc_messages WHERE roomId = ?').run(roomId)
        this.updateRoomTotalTokens(roomId, 0)
    }

    pruneMessages(roomId: string, keep = 500): void {
        const db = this.db()
        if (!db) return
        const count = (db.prepare('SELECT COUNT(*) as c FROM gc_messages WHERE roomId = ?').get(roomId) as any)?.c
        if (count > keep) {
            const cutoff = db.prepare(
                'SELECT timestamp FROM gc_messages WHERE roomId = ? ORDER BY timestamp DESC LIMIT 1 OFFSET ?'
            ).get(roomId, keep - 1) as any
            if (cutoff) {
                const result = db.prepare('DELETE FROM gc_messages WHERE roomId = ? AND timestamp < ?').run(roomId, cutoff.timestamp)
                logger.info(`[GroupChat] pruned ${result.changes} messages from room ${roomId} (had ${count}, keeping ${keep})`)
            }
        }
    }

    // ─── Room Agents ──────────────────────────────────────────

    getRoomAgents(roomId: string): RoomAgent[] {
        return (this.db()?.prepare(
            'SELECT id, roomId, agentId, profile, name, description, avatar, systemPrompt, model, temperature, invited FROM gc_room_agents WHERE roomId = ?'
        ).all(roomId) || []) as unknown as RoomAgent[]
    }

    getRoomAgent(id: string): RoomAgent | null {
        return (this.db()?.prepare(
            'SELECT id, roomId, agentId, profile, name, description, avatar, systemPrompt, model, temperature, invited FROM gc_room_agents WHERE id = ?'
        ).get(id) as RoomAgent | undefined) ?? null
    }

    addRoomAgent(roomId: string, agentId: string, config: RoomAgentConfig): RoomAgent {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
        const agent = {
            id,
            roomId,
            agentId,
            profile: config.profile,
            name: config.name || config.profile,
            description: config.description || '',
            avatar: config.avatar || '',
            systemPrompt: config.systemPrompt || '',
            model: config.model || '',
            temperature: typeof config.temperature === 'number' ? config.temperature : null,
            invited: config.invited ? 1 : 0,
        }
        this.db()?.prepare(
            'INSERT INTO gc_room_agents (id, roomId, agentId, profile, name, description, avatar, systemPrompt, model, temperature, invited) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
            agent.id,
            agent.roomId,
            agent.agentId,
            agent.profile,
            agent.name,
            agent.description,
            agent.avatar,
            agent.systemPrompt,
            agent.model,
            agent.temperature,
            agent.invited,
        )
        return agent
    }

    removeRoomAgent(agentId: string): void {
        this.db()?.prepare('DELETE FROM gc_room_agents WHERE id = ?').run(agentId)
    }

    updateRoomAgent(id: string, config: Partial<RoomAgentConfig>): RoomAgent | null {
        const existing = this.getRoomAgent(id)
        if (!existing) return null

        const next = {
            profile: config.profile ?? existing.profile,
            name: config.name ?? existing.name,
            description: config.description ?? existing.description,
            avatar: config.avatar ?? existing.avatar,
            systemPrompt: config.systemPrompt ?? existing.systemPrompt,
            model: config.model ?? existing.model,
            temperature: config.temperature !== undefined ? config.temperature : existing.temperature,
            invited: config.invited !== undefined ? (config.invited ? 1 : 0) : existing.invited,
        }

        this.db()?.prepare(
            'UPDATE gc_room_agents SET profile = ?, name = ?, description = ?, avatar = ?, systemPrompt = ?, model = ?, temperature = ?, invited = ? WHERE id = ?'
        ).run(
            next.profile,
            next.name,
            next.description,
            next.avatar,
            next.systemPrompt,
            next.model,
            next.temperature,
            next.invited,
            id,
        )
        return this.getRoomAgent(id)
    }

    updateRoomAgentRuntimeId(id: string, agentId: string): RoomAgent | null {
        this.db()?.prepare('UPDATE gc_room_agents SET agentId = ? WHERE id = ?').run(agentId, id)
        return this.getRoomAgent(id)
    }

    // ─── Context Snapshots ──────────────────────────────────

    getContextSnapshot(roomId: string): { roomId: string; summary: string; lastMessageId: string; lastMessageTimestamp: number; updatedAt: number } | null {
        return (this.db()?.prepare(
            'SELECT roomId, summary, lastMessageId, lastMessageTimestamp, updatedAt FROM gc_context_snapshots WHERE roomId = ?'
        ).get(roomId) as any) ?? null
    }

    saveContextSnapshot(roomId: string, summary: string, lastMessageId: string, lastMessageTimestamp: number): void {
        this.db()?.prepare(
            'INSERT INTO gc_context_snapshots (roomId, summary, lastMessageId, lastMessageTimestamp, updatedAt) VALUES (?, ?, ?, ?, ?) ON CONFLICT(roomId) DO UPDATE SET summary = excluded.summary, lastMessageId = excluded.lastMessageId, lastMessageTimestamp = excluded.lastMessageTimestamp, updatedAt = excluded.updatedAt'
        ).run(roomId, summary, lastMessageId, lastMessageTimestamp, Date.now())
    }

    deleteContextSnapshot(roomId: string): void {
        this.db()?.prepare('DELETE FROM gc_context_snapshots WHERE roomId = ?').run(roomId)
    }

    resetWorkflowExecution(roomId: string): void {
        this.db()?.prepare('DELETE FROM gc_workflow_runs WHERE roomId = ?').run(roomId)
        this.db()?.prepare('DELETE FROM gc_workflow_node_runs WHERE roomId = ?').run(roomId)
    }

    deleteRoom(roomId: string): void {
        const db = this.db()
        if (!db) return
        const room = this.getRoom(roomId)
        if (room?.isSystemPreset && room.presetKey) {
            this.markPresetRoomDeleted(room.presetKey)
        }
        db.prepare('DELETE FROM gc_messages WHERE roomId = ?').run(roomId)
        db.prepare('DELETE FROM gc_room_agents WHERE roomId = ?').run(roomId)
        db.prepare('DELETE FROM gc_room_members WHERE roomId = ?').run(roomId)
        db.prepare('DELETE FROM gc_context_snapshots WHERE roomId = ?').run(roomId)
        db.prepare('DELETE FROM gc_workflow_runs WHERE roomId = ?').run(roomId)
        db.prepare('DELETE FROM gc_workflow_node_runs WHERE roomId = ?').run(roomId)
        db.prepare('DELETE FROM gc_workflow_artifacts WHERE roomId = ?').run(roomId)
        db.prepare('DELETE FROM gc_rooms WHERE id = ?').run(roomId)
    }

    // ─── Room Members ──────────────────────────────────────

    getRoomMembers(roomId: string): { id: string; userId: string; name: string; description: string; joinedAt: number }[] {
        return (this.db()?.prepare(
            'SELECT id, userId, userName as name, description, joinedAt FROM gc_room_members WHERE roomId = ? ORDER BY joinedAt'
        ).all(roomId) || []) as unknown as { id: string; userId: string; name: string; description: string; joinedAt: number }[]
    }

    addRoomMember(roomId: string, userId: string, userName: string, description: string): void {
        const existing = this.getMemberByUserId(roomId, userId)
        if (existing) {
            // Update name/description on rejoin, refresh updatedAt
            this.db()?.prepare(
                'UPDATE gc_room_members SET userName = ?, description = ?, updatedAt = ? WHERE roomId = ? AND userId = ?'
            ).run(userName, description, Date.now(), roomId, userId)
            return
        }
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
        const now = Date.now()
        this.db()?.prepare(
            'INSERT INTO gc_room_members (id, roomId, userId, userName, description, joinedAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(id, roomId, userId, userName, description, now, now)
    }

    getMemberByUserId(roomId: string, userId: string): Member | null {
        return (this.db()?.prepare(
            'SELECT id, userId, userName as name, description, joinedAt FROM gc_room_members WHERE roomId = ? AND userId = ?'
        ).get(roomId, userId) as any) ?? null
    }

    updateMemberActivity(roomId: string, userId: string): void {
        this.db()?.prepare(
            'UPDATE gc_room_members SET updatedAt = ? WHERE roomId = ? AND userId = ?'
        ).run(Date.now(), roomId, userId)
    }
}

function getWorkspaceRoot(): string {
    return process.cwd()
}

function sanitizeArtifactPath(input?: string): string {
    return String(input || '').trim() || '.hermes/group-chat-artifacts/${roomId}'
}

function resolveArtifactRoot(roomId: string, workflowConfig?: WorkflowRoomConfig | null): string {
    const template = sanitizeArtifactPath(workflowConfig?.runtime?.artifactRootDir)
    const withRoom = template.replace(/\$\{roomId\}/g, roomId)
    const base = withRoom.startsWith('~')
        ? join(homedir(), withRoom.slice(1))
        : resolve(getWorkspaceRoot(), withRoom)
    return resolve(base)
}

function ensureArtifactRootDir(rootDir: string): void {
    if (!existsSync(rootDir)) {
        mkdirSync(rootDir, { recursive: true })
    }
}

function safeArtifactTarget(rootDir: string, relativePath = ''): string {
    const target = resolve(rootDir, relativePath || '.')
    if (target !== rootDir && !target.startsWith(`${rootDir}/`)) {
        throw new Error('Invalid artifact path')
    }
    return target
}

function extractProjectWriteBlocks(content: string): Array<{ relativePath: string; content: string }> {
    const normalized = String(content || '')
    const pattern = /<<<FILE:([^\n>]+)>>>\n?([\s\S]*?)<<<END FILE>>>/g
    const files: Array<{ relativePath: string; content: string }> = []
    let match: RegExpExecArray | null
    while ((match = pattern.exec(normalized)) !== null) {
        const relativePath = String(match[1] || '').trim()
        const fileContent = String(match[2] || '').replace(/^\n+/, '')
        if (!relativePath) continue
        files.push({
            relativePath,
            content: fileContent.endsWith('\n') ? fileContent : `${fileContent}\n`,
        })
    }
    return files
}

export async function drainPendingSessionDeletes(profileName: string): Promise<PendingSessionDeleteDrainResult> {
    const deleterResult = await SessionDeleter.getInstance().drain(profileName)
    return {
        deleted: deleterResult.deleted,
        failed: deleterResult.failed.map(id => ({ sessionId: id, error: 'unknown' })),
    }
}

// ─── ChatRoom (in-memory, for online members) ─────────────────

class ChatRoom {
    readonly id: string
    name: string
    readonly members = new Map<string, Member>()

    constructor(id: string, name?: string) {
        this.id = id
        this.name = name || id
    }

    addOrUpdateMember(socketId: string, userId: string, name: string, description: string): Member {
        const existing = this.members.get(userId)
        if (existing) {
            existing.name = name
            existing.description = description
            existing.online = true
            existing.socketId = socketId
            return existing
        }
        const member: Member = { id: socketId, userId, name, description, joinedAt: Date.now(), online: true, socketId }
        this.members.set(userId, member)
        return member
    }

    removeMember(socketId: string): void {
        for (const member of this.members.values()) {
            if (member.socketId === socketId) {
                member.online = false
                break
            }
        }
    }

    getMembersList(): Member[] {
        return Array.from(this.members.values())
    }

    getOnlineMemberBySocketId(socketId: string): Member | undefined {
        for (const member of this.members.values()) {
            if (member.socketId === socketId && member.online) return member
        }
        return undefined
    }

    hasOnlineMember(socketId: string): boolean {
        return this.getOnlineMemberBySocketId(socketId) !== undefined
    }
}

// ─── GroupChat Server ────────────────────────────────────────

export class GroupChatServer {
    private io: Server
    private nsp: Namespace
    private storage: ChatStorage
    private rooms = new Map<string, ChatRoom>()
    /** Map: socket.id → persistent userId */
    private socketUserMap = new Map<string, string>()
    /** Map: userId → { name, description } (from auth) */
    private userInfoMap = new Map<string, { name: string; description: string }>()
    readonly agentClients = new AgentClients()
    private _contextEngine: ContextEngine | null = null
    private _restoreScheduled = false
    /** roomId -> (userId -> { userName, timer }) */
    private typingState = new Map<string, Map<string, { userName: string; timer: ReturnType<typeof setTimeout> }>>()
    /** roomId -> (agentName -> { agentName, status }) */
    private contextStatusState = new Map<string, Map<string, { agentName: string; status: string }>>()
    /** roomId -> current auto-trigger token */
    private workflowAutoTriggerState = new Map<string, string>()
    /** roomId:nodeId -> retry count for project-write nodes without file blocks */
    private projectWriteRetryState = new Map<string, number>()

    setGatewayManager(manager: any): void {
        this.agentClients.setGatewayManager(manager)
        if (this._contextEngine && manager) {
            this._contextEngine.setUpstream(manager.getUpstream(''), manager.getApiKey(''))
        }
    }

    constructor(httpServers: HttpServer | HttpServer[]) {
        this.storage = new ChatStorage()
        this.storage.init()
        const servers = Array.isArray(httpServers) ? httpServers : [httpServers]

        this.io = new Server(servers[0], {
            cors: { origin: '*' }
        })
        servers.slice(1).forEach((httpServer) => this.io.attach(httpServer))
        this.nsp = this.io.of('/group-chat')
        this.nsp.use(this.authMiddleware.bind(this))
        this.nsp.on('connection', this.onConnection.bind(this))

        // Restore persisted rooms into memory
        this.storage.getAllRooms().forEach((row) => {
            this.rooms.set(row.id, new ChatRoom(row.id, row.name))
        })
        this.ensurePresetRooms()

        logger.info('[GroupChat] Socket.IO ready at /group-chat')

        // Initialize context engine for group chat compression
        const contextEngine = new ContextEngine({
            messageFetcher: this.storage,
            sessionCleaner: async (sessionId: string) => {
                try {
                    const profile = this.storage.getSessionProfile(sessionId)
                    const profileName = profile?.profile_name || 'default'
                    this.storage.enqueuePendingSessionDelete(sessionId, profileName)
                } catch (err: any) {
                    logger.warn(`[GroupChat] failed to enqueue compression session delete ${sessionId}: ${err.message}`)
                }
            },
        })
        this.agentClients.setContextEngine(contextEngine)
        this.agentClients.setStorage(this.storage)
        this._contextEngine = contextEngine

        // Restore agent connections — call restoreAgents() after server is listening
        this._restoreScheduled = false
    }

    private isPresetRoomOutdated(room: RoomInfo, preset: PresetRoomSeed): boolean {
        try {
            const workflowConfig = room.workflowConfigJson ? JSON.parse(room.workflowConfigJson) : {}
            const version = Number(workflowConfig?.version || 0)
            const graphNodes = Array.isArray(workflowConfig?.graph?.nodes) ? workflowConfig.graph.nodes : []
            const defaultAgents = room.defaultAgentsJson ? JSON.parse(room.defaultAgentsJson) : []
            const hasQa = Array.isArray(defaultAgents) && defaultAgents.some((agent: any) => String(agent?.name || '') === 'QA')
            const activeAgents = this.storage.getRoomAgents(room.id)
            const activeHasQa = activeAgents.some((agent) => agent.name === 'QA')
            return version < 4 || graphNodes.length === 0 || !hasQa || !activeHasQa
        } catch {
            return true
        }
    }

    private async syncPresetRoom(room: RoomInfo, preset: PresetRoomSeed): Promise<void> {
        this.storage.updateRoomInviteCode(room.id, preset.inviteCode)
        this.storage.updateRoomConfig(room.id, {
            triggerTokens: preset.compression?.triggerTokens,
            maxHistoryTokens: preset.compression?.maxHistoryTokens,
            tailMessageCount: preset.compression?.tailMessageCount,
        })
        const shouldResetWorkflow = this.isPresetRoomOutdated(room, preset)
        if (shouldResetWorkflow) {
            this.storage.updateRoomWorkflow(room.id, {
                workflowName: preset.workflow.workflowName,
                workflowPrompt: preset.workflow.workflowPrompt,
            })
            this.storage.updateRoomWorkflowConfig(room.id, preset.workflow.workflowConfig)
        }

        const savedDefaults = this.storage.getDefaultAgents(room.id)
        const mergedDefaultMap = new Map<string, RoomAgentConfig>()
        for (const config of preset.agents) {
            mergedDefaultMap.set(normalizePresetAgentKey(config), { ...config })
        }
        for (const config of savedDefaults) {
            mergedDefaultMap.set(normalizePresetAgentKey(config), { ...config })
        }
        const mergedDefaultAgents = Array.from(mergedDefaultMap.values())
        this.storage.updateDefaultAgents(room.id, mergedDefaultAgents)

        const addedAgents = this.storage.appendMissingRoomAgents(room.id, preset.agents)
        if (!room.isActive) {
            this.agentClients.disconnectRoom(room.id)
            return
        }
        for (const agent of addedAgents) {
            try {
                const client = await this.agentClients.createAgent({
                    profile: agent.profile,
                    name: agent.name,
                    description: agent.description,
                    avatar: agent.avatar,
                    systemPrompt: agent.systemPrompt,
                    model: agent.model,
                    temperature: agent.temperature,
                    invited: agent.invited,
                })
                await this.agentClients.addAgentToRoom(room.id, client)
                this.storage.updateRoomAgentRuntimeId(agent.id, client.agentId)
            } catch (err: any) {
                logger.error(`[GroupChat] failed to connect synced preset agent ${agent.name} in room ${room.id}: ${err.message}`)
            }
        }

        if (shouldResetWorkflow) {
            this.storage.saveWorkflowRunState(room.id, {
                workflowVersion: preset.workflow.workflowConfig.version || 4,
                status: 'idle',
                currentNodeId: '',
                startedAt: 0,
            })
        }
    }

    private ensurePresetRooms(): void {
        for (const preset of PRESET_ROOM_SEEDS) {
            if (this.storage.isPresetRoomDeleted(preset.presetKey)) continue
            const existing = this.storage.getRoomByPresetKey(preset.presetKey) || this.storage.getRoom(preset.id)
            if (existing) {
                if (!this.rooms.has(existing.id)) {
                    this.rooms.set(existing.id, new ChatRoom(existing.id, existing.name))
                }
                if (this.isPresetRoomOutdated(existing, preset)) {
                    this.syncPresetRoom(existing, preset).catch((err) => {
                        logger.error(`[GroupChat] failed to sync preset room ${preset.name}: ${err.message}`)
                    })
                }
                continue
            }

            this.storage.saveRoom(
                preset.id,
                preset.name,
                preset.inviteCode,
                preset.compression,
                {
                    workflowName: preset.workflow.workflowName,
                    workflowPrompt: preset.workflow.workflowPrompt,
                    workflowConfig: preset.workflow.workflowConfig,
                },
                preset.agents,
                { isSystemPreset: true, presetKey: preset.presetKey },
            )
            this.storage.appendMissingRoomAgents(preset.id, preset.agents)
            this.rooms.set(preset.id, new ChatRoom(preset.id, preset.name))
            logger.info(`[GroupChat] seeded preset room ${preset.name}`)
        }
    }

    getIO(): Server {
        return this.io
    }

    getStorage(): ChatStorage {
        return this.storage
    }

    getContextEngine(): ContextEngine | null {
        return this._contextEngine || null
    }

    getRoomRuntimeSummary(roomId: string): {
        roomId: string
        isActive: boolean
        onlineAgents: number
        totalAgents: number
    } {
        const room = this.storage.getRoom(roomId)
        const totalAgents = this.storage.getRoomAgents(roomId).length
        const onlineAgents = room?.isActive ? this.agentClients.getAgents(roomId).length : 0
        return {
            roomId,
            isActive: Boolean(room?.isActive),
            onlineAgents,
            totalAgents,
        }
    }

    async activateRoom(roomId: string): Promise<void> {
        const targetRoom = this.storage.getRoom(roomId)
        if (!targetRoom) {
            throw new Error('Room not found')
        }

        const activeRooms = this.storage.getActiveRooms()
        for (const room of activeRooms) {
            if (room.id === roomId) continue
            this.storage.updateRoomActive(room.id, false)
            this.agentClients.disconnectRoom(room.id)
            this.clearRoomRuntimeState(room.id)
        }

        this.storage.updateRoomActive(roomId, true)
        await this.restoreRoomAgents(roomId, true)
        this.publishSystemNotice(roomId, '【系统通知】当前群聊已激活。此房间的机器人已上线，其它群聊机器人已离线待机。')
    }

    deactivateRoom(roomId: string): void {
        this.storage.updateRoomActive(roomId, false)
        this.agentClients.disconnectRoom(roomId)
        this.clearRoomRuntimeState(roomId)
        this.publishSystemNotice(roomId, '【系统通知】当前群聊已停用。此房间的机器人已离线待机，后续可再次激活恢复。')
    }

    getRoomIds(): string[] {
        return Array.from(this.rooms.keys())
    }

    getCurrentWorkflowNode(roomId: string): WorkflowGraphNode | null {
        const workflowConfig = this.storage.getRoomWorkflowConfig(roomId)
        const nodes = workflowConfig?.graph?.nodes || []
        if (nodes.length === 0) return null
        const runState = this.storage.getWorkflowRunState(roomId)
        const nodeId = runState?.currentNodeId || workflowConfig?.runtime?.startNodeId || nodes[0]?.id
        return nodes.find(node => node.id === nodeId) || null
    }

    private getWorkflowNodeById(roomId: string, nodeId: string): WorkflowGraphNode | null {
        if (!nodeId) return null
        const workflowConfig = this.storage.getRoomWorkflowConfig(roomId)
        const nodes = workflowConfig?.graph?.nodes || []
        return nodes.find(node => node.id === nodeId) || null
    }

    private getAssignedWorkflowAgentName(roomId: string, assignedAgentId?: string): string {
        const normalizedId = String(assignedAgentId || '').trim()
        if (!normalizedId) return ''
        const agent = this.storage.getRoomAgents(roomId).find(item => String(item.id || '') === normalizedId)
        return String(agent?.name || agent?.profile || '').trim()
    }

    private getWorkflowNodeTitle(node: WorkflowGraphNode | null | undefined): string {
        if (!node) return ''
        return typeof node.text === 'string' ? node.text : node.text?.value || node.id
    }

    private getWorkflowPreviousNodeId(roomId: string, nodeId: string): string {
        if (!nodeId) return ''
        const workflowConfig = this.storage.getRoomWorkflowConfig(roomId)
        const edges = workflowConfig?.graph?.edges || []
        const incomingEdge = edges.find(edge =>
            edge.targetNodeId === nodeId
            && String(edge.properties?.branchConditionType || 'always') === 'always',
        ) || edges.find(edge => edge.targetNodeId === nodeId)
        return incomingEdge?.sourceNodeId || ''
    }

    private getWorkflowActorLabel(senderName: string, roleName?: string): string {
        const normalizedSender = String(senderName || '').trim()
        const normalizedRole = String(roleName || '').trim()
        if (normalizedSender && !/^User-[a-z0-9]+$/i.test(normalizedSender)) {
            return normalizedSender
        }
        return normalizedRole || normalizedSender || '当前处理人'
    }

    private describeWorkflowNextStep(roomId: string, nextNodeId: string): string {
        if (!nextNodeId) return '当前流程已完成，你现在可以继续直接 @ 任意机器人补充讨论。'

        const nextNode = this.getWorkflowNodeById(roomId, nextNodeId)
        if (!nextNode) return '当前流程已继续推进。'

        const nextType = String(nextNode.properties?.workflowNodeType || '')
        const nextTitle = this.getWorkflowNodeTitle(nextNode)
        const nextRole = String(nextNode.properties?.roleName || '').trim()

        if (nextType === 'approval') {
            return `下一步等待 @${nextRole || '管理员'} 审核「${nextTitle || '当前产出'}」。`
        }
        if (nextType === 'end') {
            return '当前流程已完成，你现在可以继续直接 @ 任意机器人补充讨论。'
        }
        if (nextRole) {
            return `下一步由 @${nextRole} 处理「${nextTitle || '下一节点'}」。`
        }
        if (nextTitle) {
            return `下一步进入「${nextTitle}」。`
        }
        return '当前流程已继续推进。'
    }

    private getWorkflowRunStatusForNextNode(roomId: string, nextNodeId: string): WorkflowRunState['status'] {
        if (!nextNodeId) return 'completed'
        const nextNode = this.getWorkflowNodeById(roomId, nextNodeId)
        const nextType = String(nextNode?.properties?.workflowNodeType || '')
        return nextType === 'end' ? 'completed' : 'running'
    }

    getWorkflowExecutionState(roomId: string): { run: WorkflowRunState | null; currentNode: WorkflowGraphNode | null; nodeRuns: WorkflowNodeRunState[] } {
        return {
            run: this.storage.getWorkflowRunState(roomId),
            currentNode: this.getCurrentWorkflowNode(roomId),
            nodeRuns: this.storage.getWorkflowNodeRuns(roomId),
        }
    }

    getWorkflowRunHistory(roomId: string, limit = 20): WorkflowRunHistoryRecord[] {
        return this.storage.listWorkflowRunHistory(roomId, limit)
    }

    private ensureWorkflowRunHasSequence(roomId: string, run?: WorkflowRunState | null): WorkflowRunState | null {
        const current = run || this.storage.getWorkflowRunState(roomId)
        if (!current) return null
        if (current.runNumber > 0) return current

        const runNumber = this.storage.incrementRoomRunSequence(roomId)
        return this.storage.saveWorkflowRunState(roomId, {
            workflowVersion: current.workflowVersion,
            runNumber,
            status: current.status,
            currentNodeId: current.currentNodeId,
            kickoffSummary: current.kickoffSummary,
            kickoffArtifactPath: current.kickoffArtifactPath,
            startedAt: current.startedAt,
        })
    }

    private syncWorkflowRunHistory(
        roomId: string,
        statusOverride?: string,
        overrides?: {
            latestApprovalActorName?: string
            latestApprovalAction?: string
            latestApprovalStageTitle?: string
            latestApprovalReason?: string
        },
    ): void {
        const run = this.ensureWorkflowRunHasSequence(roomId, this.storage.getWorkflowRunState(roomId))
        if (!run?.runNumber) return

        const currentNode = this.getCurrentWorkflowNode(roomId)
        const nodeRuns = this.storage.getWorkflowNodeRuns(roomId)
        const latestArtifact = this.storage.listWorkflowArtifacts(roomId, 100).find(item => item.runNumber === run.runNumber)
        const finalStatus = statusOverride || run.status
        const previousHistory = this.storage.getWorkflowRunHistoryRecord(roomId, run.runNumber)
        const latestNodeRun = nodeRuns[0] || null
        const runMessages = this.storage.getMessages(roomId, 500)
            .filter(item => item.timestamp >= (run.startedAt || 0))
        const kickoffMessage = runMessages.find((item) => {
            const senderId = normalizeString(item.senderId)
            if (senderId.startsWith('workflow-starter:')) return true
            return this.isHumanRoomMessage(roomId, item)
        }) || null
        const latestSystemNotice = runMessages
            .slice()
            .reverse()
            .find(item => isSystemSenderId(item.senderId) && truncateSummary(item.content))
        const latestVisibleMessage = runMessages
            .slice()
            .reverse()
            .find(item => !isSystemSenderId(item.senderId) && truncateSummary(item.content))
        const latestApprovalNodeRun = nodeRuns.find(item => {
            const node = this.getWorkflowNodeById(roomId, item.nodeId)
            return String(node?.properties?.workflowNodeType || '') === 'approval'
              && (item.status === 'completed' || item.status === 'rejected')
        }) || null
        const latestCompletedNodeRun = nodeRuns.find(item => item.status === 'completed') || null
        const latestRejectedNodeRun = nodeRuns.find(item => item.status === 'rejected') || null
        const latestPendingApprovalNodeRun = nodeRuns.find(item => item.status === 'waiting_approval') || null
        const latestApprovalStageTitle = latestApprovalNodeRun
            ? this.getWorkflowNodeTitle(
                this.getWorkflowNodeById(roomId, this.getWorkflowPreviousNodeId(roomId, latestApprovalNodeRun.nodeId)),
            ) || this.getWorkflowNodeTitle(this.getWorkflowNodeById(roomId, latestApprovalNodeRun.nodeId))
            : ''
        const latestActivityAt = Math.max(
            latestNodeRun?.updatedAt || 0,
            latestSystemNotice?.timestamp || 0,
            latestVisibleMessage?.timestamp || 0,
            run.updatedAt || 0,
        )
        const kickoffSummary = truncateSummary(run.kickoffSummary, 300)
            || truncateSummary(kickoffMessage?.content, 300)
            || previousHistory?.kickoffSummary
            || ''
        const projectGitSnapshot = projectService.getRoomProjectRunGitSnapshot(roomId, run.startedAt || 0)

        this.storage.saveWorkflowRunHistory({
            id: `${roomId}:run:${run.runNumber}`,
            roomId,
            runNumber: run.runNumber,
            workflowVersion: run.workflowVersion,
            status: finalStatus,
            currentNodeId: run.currentNodeId || '',
            currentNodeTitle: this.getWorkflowNodeTitle(currentNode),
            kickoffSummary,
            kickoffArtifactPath: run.kickoffArtifactPath || '',
            startedAt: run.startedAt || 0,
            endedAt: finalStatus === 'completed' || finalStatus === 'failed' || finalStatus === 'cancelled' ? Date.now() : 0,
            completedNodeCount: nodeRuns.filter(item => item.status === 'completed').length,
            rejectedNodeCount: nodeRuns.filter(item => item.status === 'rejected').length,
            pendingApprovalCount: nodeRuns.filter(item => item.status === 'waiting_approval').length,
            totalNodeRuns: nodeRuns.length,
            latestActorAgentName: latestNodeRun?.actorAgentName || '',
            latestActivityNodeTitle: this.getWorkflowNodeTitle(this.getWorkflowNodeById(roomId, latestNodeRun?.nodeId || '')),
            latestActivityStatus: latestNodeRun?.status || '',
            latestActivityAt,
            latestSystemNoticeExcerpt: truncateSummary(latestSystemNotice?.content),
            latestMessageExcerpt: truncateSummary(latestVisibleMessage?.content),
            latestMessageSenderName: latestVisibleMessage?.senderName || '',
            latestApprovalActorName: overrides?.latestApprovalActorName
                ?? latestApprovalNodeRun?.actorAgentName
                ?? previousHistory?.latestApprovalActorName
                ?? '',
            latestApprovalAction: overrides?.latestApprovalAction
                ?? ((latestApprovalNodeRun?.status === 'rejected'
                    ? 'rejected'
                    : latestApprovalNodeRun?.status === 'completed'
                      ? 'approved'
                      : '') || previousHistory?.latestApprovalAction || ''),
            latestApprovalStageTitle: overrides?.latestApprovalStageTitle
                ?? latestApprovalStageTitle
                ?? previousHistory?.latestApprovalStageTitle
                ?? '',
            latestApprovalReason: overrides?.latestApprovalReason
                ?? previousHistory?.latestApprovalReason
                ?? '',
            latestCompletedNodeTitle: this.getWorkflowNodeTitle(this.getWorkflowNodeById(roomId, latestCompletedNodeRun?.nodeId || '')),
            latestRejectedNodeTitle: this.getWorkflowNodeTitle(this.getWorkflowNodeById(roomId, latestRejectedNodeRun?.nodeId || '')),
            latestPendingApprovalNodeTitle: this.getWorkflowNodeTitle(this.getWorkflowNodeById(roomId, latestPendingApprovalNodeRun?.nodeId || '')),
            latestArtifactPath: latestArtifact?.relativePath || '',
            latestArtifactTitle: latestArtifact?.title || '',
            projectId: projectGitSnapshot?.projectId || '',
            projectName: projectGitSnapshot?.projectName || '',
            projectGitEnabled: projectGitSnapshot?.gitEnabled ? 1 : 0,
            projectGitBranch: projectGitSnapshot?.currentBranch || '',
            projectGitRepoUrl: projectGitSnapshot?.repoUrl || '',
            projectGitTrackedAt: projectGitSnapshot?.trackedAt || 0,
            projectGitAheadCount: projectGitSnapshot?.aheadCount || 0,
            projectGitBehindCount: projectGitSnapshot?.behindCount || 0,
            projectGitStagedCount: projectGitSnapshot?.stagedCount || 0,
            projectGitModifiedCount: projectGitSnapshot?.modifiedCount || 0,
            projectGitUntrackedCount: projectGitSnapshot?.untrackedCount || 0,
            projectGitChangeCount: projectGitSnapshot?.changeCount || 0,
            projectTouchedFileCount: projectGitSnapshot?.touchedFiles.length || 0,
            projectTouchedFilesJson: JSON.stringify(projectGitSnapshot?.touchedFiles || []),
            projectGitChangesJson: JSON.stringify(projectGitSnapshot?.changes || []),
            updatedAt: Date.now(),
        })
    }

    async startWorkflowRun(
        roomId: string,
        payload?: {
            actorName?: string
            content?: string
            summary?: string
            artifactPath?: string
        },
    ): Promise<{
        run: WorkflowRunState | null
        currentNode: WorkflowGraphNode | null
        nodeRuns: WorkflowNodeRunState[]
        runtime: {
            roomId: string
            isActive: boolean
            onlineAgents: number
            totalAgents: number
        }
        kickoffMessage: ChatMessage | null
    }> {
        const room = this.storage.getRoom(roomId)
        if (!room) {
            const err: any = new Error('房间不存在')
            err.status = 404
            throw err
        }

        const workflowConfig = this.storage.getRoomWorkflowConfig(roomId)
        if (!workflowConfig?.graph?.nodes?.length) {
            const err: any = new Error('当前房间未配置工作流')
            err.status = 409
            throw err
        }

        const agents = this.storage.getRoomAgents(roomId)
        const alignment = analyzeWorkflowAgentAlignment(workflowConfig, agents)
        if (alignment.missingRoles.length > 0) {
            const err: any = new Error(buildWorkflowMismatchMessage(alignment.missingRoles))
            err.status = 409
            err.details = alignment
            throw err
        }

        const existingRun = this.storage.getWorkflowRunState(roomId)
        const hasPendingApproval = this.storage.getWorkflowNodeRuns(roomId).some(nodeRun => nodeRun.status === 'waiting_approval')
        if (hasPendingApproval) {
            const err: any = new Error('当前流程仍有待审批节点，请先完成审核或取消本轮执行')
            err.status = 409
            throw err
        }

        if (existingRun && existingRun.status !== 'completed' && existingRun.status !== 'failed') {
            const err: any = new Error('当前已有进行中的执行，请先继续当前执行或取消后再重新开始')
            err.status = 409
            throw err
        }

        if (existingRun) {
            this.storage.clearWorkflowNodeRuns(roomId)
            this.workflowAutoTriggerState.delete(roomId)
        }

        if (!room.isActive) {
            await this.activateRoom(roomId)
        }

        const actorName = String(payload?.actorName || workflowConfig.ownerUserName || workflowConfig.ownerRoleName || '应用主理人').trim() || '应用主理人'
        const kickoffSummary = String(payload?.summary || '').trim()
        const kickoffArtifactPath = String(payload?.artifactPath || '').trim()
        const runNumber = this.storage.incrementRoomRunSequence(roomId)
        const kickoffContent = String(payload?.content || '').trim() || [
            `请启动应用「${room.name}」的本轮执行。`,
            kickoffSummary ? `本轮执行说明：${kickoffSummary}` : '',
            kickoffArtifactPath ? `请基于已有产物继续推进：${kickoffArtifactPath}` : '',
            room.workflowPrompt ? `执行目标：${room.workflowPrompt}` : '',
            '请严格按照当前工作流从起始节点开始推进，并在每个节点产出对应结果。',
        ].filter(Boolean).join('\n')

        const startNodeId = workflowConfig?.runtime?.startNodeId || workflowConfig?.graph?.nodes?.[0]?.id || ''
        this.storage.saveWorkflowRunState(roomId, {
            workflowVersion: workflowConfig?.version || 1,
            runNumber,
            status: 'running',
            currentNodeId: startNodeId,
            kickoffSummary,
            kickoffArtifactPath,
            startedAt: Date.now(),
        })

        const kickoffMessage: ChatMessage = {
            id: this.generateId(),
            roomId,
            senderId: `workflow-starter:${roomId}`,
            senderName: actorName,
            content: kickoffContent,
            timestamp: Date.now(),
        }

        this.persistAndEmitMessage(kickoffMessage)
        this.maybeAdvanceWorkflow(roomId, kickoffMessage)
        this.syncWorkflowRunHistory(roomId)

        return {
            ...this.getWorkflowExecutionState(roomId),
            runtime: this.getRoomRuntimeSummary(roomId),
            kickoffMessage,
        }
    }

    cancelWorkflowExecution(
        roomId: string,
        payload?: {
            actorName?: string
            reason?: string
        },
    ): { run: WorkflowRunState | null; currentNode: WorkflowGraphNode | null; nodeRuns: WorkflowNodeRunState[] } {
        const room = this.storage.getRoom(roomId)
        if (!room) {
            const err: any = new Error('房间不存在')
            err.status = 404
            throw err
        }

        const workflowConfig = this.storage.getRoomWorkflowConfig(roomId)
        if (!workflowConfig?.graph?.nodes?.length) {
            const err: any = new Error('当前房间未配置工作流')
            err.status = 409
            throw err
        }

        const run = this.storage.getWorkflowRunState(roomId)
        if (!run) {
            const err: any = new Error('当前没有进行中的需求流程')
            err.status = 409
            throw err
        }

        if (run.status === 'completed') {
            const err: any = new Error('当前流程已完成，无需取消')
            err.status = 409
            throw err
        }

        const ownerUserName = String(workflowConfig.ownerUserName || '').trim()
        const actorName = String(payload?.actorName || ownerUserName || '').trim()
        if (ownerUserName && actorName !== ownerUserName) {
            const err: any = new Error(`只有 @${ownerUserName} 可以取消当前需求流程`)
            err.status = 403
            throw err
        }

        this.syncWorkflowRunHistory(roomId, 'cancelled')
        this.storage.resetWorkflowExecution(roomId)
        this.clearRoomRuntimeState(roomId)

        const actorLabel = actorName || '管理员'
        const reason = String(payload?.reason || '').trim()
        this.publishSystemNotice(
            roomId,
            [
                `【流程进展】${actorLabel} 已取消当前这轮需求流程。`,
                reason ? `原因：${reason}` : '',
                '房间和历史消息会保留；你可以直接发送新的需求，系统会重新开启一轮流程。',
            ].filter(Boolean).join('\n'),
        )

        return this.getWorkflowExecutionState(roomId)
    }

    clearRoomMessages(
        roomId: string,
        payload?: {
            actorName?: string
        },
    ): { cleared: boolean } {
        const room = this.storage.getRoom(roomId)
        if (!room) {
            const err: any = new Error('房间不存在')
            err.status = 404
            throw err
        }

        const workflowConfig = this.storage.getRoomWorkflowConfig(roomId)
        const ownerUserName = String(workflowConfig?.ownerUserName || '').trim()
        const actorName = String(payload?.actorName || ownerUserName || '').trim()
        if (ownerUserName && actorName && actorName !== ownerUserName) {
            const err: any = new Error(`只有 @${ownerUserName} 可以清空当前群消息`)
            err.status = 403
            throw err
        }

        this.storage.clearMessages(roomId)
        this.clearRoomRuntimeState(roomId)
        return { cleared: true }
    }

    async submitWorkflowApproval(
        roomId: string,
        payload: {
            action: 'approve' | 'reject'
            actorName?: string
            reason?: string
        },
    ): Promise<{ run: WorkflowRunState | null; currentNode: WorkflowGraphNode | null; nodeRuns: WorkflowNodeRunState[] }> {
        const room = this.storage.getRoom(roomId)
        if (!room) {
            const err: any = new Error('房间不存在')
            err.status = 404
            throw err
        }

        const workflowConfig = this.storage.getRoomWorkflowConfig(roomId)
        if (!workflowConfig?.graph?.nodes?.length) {
            const err: any = new Error('当前房间未配置工作流')
            err.status = 409
            throw err
        }

        const run = this.ensureWorkflowRunStarted(roomId)
        const currentNode = this.getCurrentWorkflowNode(roomId)
        if (!run?.currentNodeId || !currentNode) {
            const err: any = new Error('当前流程尚未开始')
            err.status = 409
            throw err
        }

        const currentType = String(currentNode.properties?.workflowNodeType || '')
        const currentNodeRun = this.storage.getWorkflowNodeRun(roomId, currentNode.id)
        const isApprovalNode = currentType === 'approval'
        const isLegacyPendingApproval = (currentType === 'role-task' || currentType === 'artifact-review')
            && currentNodeRun?.status === 'waiting_approval'
        if (!isApprovalNode && !isLegacyPendingApproval) {
            const err: any = new Error('当前节点不在待审批状态')
            err.status = 409
            throw err
        }

        const action = payload.action === 'reject' ? 'reject' : 'approve'
        const reason = String(payload.reason || '').trim()
        if (action === 'reject' && !reason) {
            const err: any = new Error('驳回时请填写原因')
            err.status = 400
            throw err
        }

        const ownerUserName = String(workflowConfig.ownerUserName || '').trim()
        const currentRoleName = String(isApprovalNode ? currentNode.properties?.roleName || workflowConfig.ownerRoleName || '管理员' : workflowConfig.ownerRoleName || '管理员')
        const actorName = String(payload.actorName || ownerUserName || currentRoleName).trim() || currentRoleName
        if (ownerUserName && actorName !== ownerUserName) {
            const err: any = new Error(`只有 @${ownerUserName} 可以执行当前审批`)
            err.status = 403
            throw err
        }

        const sourceNodeId = isApprovalNode ? this.getWorkflowPreviousNodeId(roomId, currentNode.id) : currentNode.id
        const sourceNode = this.getWorkflowNodeById(roomId, sourceNodeId)
        const nextNodeId = isApprovalNode
            ? this.resolveNextWorkflowNodeId(roomId, currentNode.id, action)
                || this.resolveNextWorkflowNodeId(roomId, currentNode.id, 'complete')
            : action === 'reject'
                ? this.resolveNextWorkflowNodeId(roomId, currentNode.id, 'reject') || currentNode.id
                : this.resolveNextWorkflowNodeId(roomId, currentNode.id, 'complete')
        const previousTitle = this.getWorkflowNodeTitle(sourceNode) || this.getWorkflowNodeTitle(currentNode)
        const actorLabel = this.getWorkflowActorLabel(actorName, currentRoleName)

        if (sourceNodeId) {
            if (action === 'approve') {
                this.storage.confirmWorkflowArtifacts(roomId, sourceNodeId, actorName)
            }
            this.storage.saveWorkflowNodeRun(roomId, sourceNodeId, {
                status: action === 'reject' ? 'rejected' : 'completed',
                actorAgentName: this.storage.getWorkflowNodeRun(roomId, sourceNodeId)?.actorAgentName || actorName,
                completedAt: Date.now(),
            })
        }

        if (isApprovalNode) {
            this.storage.saveWorkflowNodeRun(roomId, currentNode.id, {
                status: action === 'reject' ? 'rejected' : 'completed',
                actorAgentName: actorName,
                completedAt: Date.now(),
            })
        }
        this.storage.saveWorkflowRunState(roomId, {
            status: this.getWorkflowRunStatusForNextNode(roomId, nextNodeId),
            currentNodeId: nextNodeId,
        })

        if (action === 'reject') {
            const reasonSuffix = reason ? `原因：${reason}。` : ''
            this.publishSystemNotice(
                roomId,
                `【流程进展】@${actorLabel} 已驳回「${previousTitle}」。${reasonSuffix}${this.describeWorkflowNextStep(roomId, nextNodeId)}`,
            )
            await this.autoTriggerActiveWorkflowNode(roomId, {
                senderName: actorName,
                senderId: 'system-workflow',
                content: `「${previousTitle}」已被驳回。${reason ? `驳回原因：${reason}\n` : ''}请根据审核意见修正后重新提交。`,
            })
        } else {
            this.publishSystemNotice(
                roomId,
                `【流程进展】@${actorLabel} 已审核通过「${previousTitle}」。${this.describeWorkflowNextStep(roomId, nextNodeId)}`,
            )
            await this.autoTriggerActiveWorkflowNode(roomId, {
                senderName: actorName,
                senderId: 'system-workflow',
                content: `请开始处理当前节点：${this.getWorkflowNodeTitle(this.getWorkflowNodeById(roomId, nextNodeId)) || nextNodeId}`,
            })
        }

        this.syncWorkflowRunHistory(roomId, undefined, {
            latestApprovalActorName: actorName,
            latestApprovalAction: action === 'reject' ? 'rejected' : 'approved',
            latestApprovalStageTitle: previousTitle,
            latestApprovalReason: action === 'reject' ? reason : '',
        })

        return this.getWorkflowExecutionState(roomId)
    }

    private buildNodeArtifactTarget(roomId: string, node: WorkflowGraphNode): { rootDir: string; filePath: string; relativePath: string; format: string } | null {
        const workflowConfig = this.storage.getRoomWorkflowConfig(roomId)
        const rootDir = resolveArtifactRoot(roomId, workflowConfig)
        ensureArtifactRootDir(rootDir)
        const artifactDir = String(node.properties?.artifactDir || '').trim()
        const artifactFileName = String(node.properties?.artifactFileName || '').trim()
        const format = String(node.properties?.artifactFormat || 'md').trim() || 'md'
        if (!artifactFileName) return null

        const relativeDir = artifactDir.replace(/^\/+|\/+$/g, '')
        const relativePath = relativeDir ? `${relativeDir}/${artifactFileName}` : artifactFileName
        const filePath = safeArtifactTarget(rootDir, relativePath)
        mkdirSync(dirname(filePath), { recursive: true })
        return { rootDir, filePath, relativePath, format }
    }

    private buildArtifactContent(node: WorkflowGraphNode, msg: ChatMessage): string {
        const nodeTitle = typeof node.text === 'string' ? node.text : node.text?.value || node.id
        const roleName = String(node.properties?.roleName || msg.senderName || '')
        const prompt = String(node.properties?.promptOverride || '').trim()
        return [
            `# ${nodeTitle}`,
            '',
            `- 房间: ${msg.roomId}`,
            `- 角色: ${roleName}`,
            `- 产出人: ${msg.senderName}`,
            `- 时间: ${new Date(msg.timestamp).toLocaleString('zh-CN', { hour12: false })}`,
            prompt ? `- 节点要求: ${prompt}` : '',
            '',
            '## 产出内容',
            '',
            msg.content.trim(),
            '',
        ].filter(Boolean).join('\n')
    }

    private applyProjectWritesForNode(roomId: string, node: WorkflowGraphNode, msg: ChatMessage): Array<{ relativePath: string; fileName: string }> {
        const executionMode = String(node.properties?.executionMode || 'artifact')
        if (executionMode !== 'project-write') return []
        const files = extractProjectWriteBlocks(msg.content)
        if (files.length === 0) return []
        try {
            return projectService.writeProjectFiles(roomId, msg.senderName, files)
        } catch (err: any) {
            logger.warn(`[GroupChat] failed to write project files for room ${roomId}: ${err.message}`)
            return []
        }
    }

    private persistNodeArtifact(roomId: string, node: WorkflowGraphNode, msg: ChatMessage): string[] {
        if (!node.properties?.requiresArtifact) return []
        const target = this.buildNodeArtifactTarget(roomId, node)
        if (!target) return []

        const content = this.buildArtifactContent(node, msg)
        writeFileSync(target.filePath, content, 'utf-8')
        projectService.syncRoomArtifactToProject(roomId, target.relativePath, content)

        const nodeTitle = typeof node.text === 'string' ? node.text : node.text?.value || node.id
        const artifactId = `${roomId}-${node.id}-${Date.now().toString(36)}`
        const runNumber = this.storage.getWorkflowRunState(roomId)?.runNumber || 0
        this.storage.saveWorkflowArtifact({
            id: artifactId,
            roomId,
            nodeId: node.id,
            runNumber,
            filePath: target.filePath,
            relativePath: target.relativePath,
            format: target.format,
            title: nodeTitle,
            summary: msg.content.slice(0, 180),
            createdBy: msg.senderName,
            createdAt: Date.now(),
            confirmedBy: '',
            confirmedAt: 0,
        })
        return [artifactId]
    }

    getArtifactRootInfo(roomId: string): { rootDir: string; exists: boolean } {
        const workflowConfig = this.storage.getRoomWorkflowConfig(roomId)
        const rootDir = resolveArtifactRoot(roomId, workflowConfig)
        return { rootDir, exists: existsSync(rootDir) }
    }

    listArtifacts(roomId: string, relativePath = ''): {
        rootDir: string
        currentPath: string
        entries: GroupChatArtifactEntry[]
        summary: GroupChatArtifactTreeSummary
    } {
        const workflowConfig = this.storage.getRoomWorkflowConfig(roomId)
        const rootDir = resolveArtifactRoot(roomId, workflowConfig)
        ensureArtifactRootDir(rootDir)
        const targetDir = safeArtifactTarget(rootDir, relativePath)
        const stats = statSync(targetDir)
        if (!stats.isDirectory()) {
            throw new Error('Artifact path is not a directory')
        }

        const entries = readdirSync(targetDir, { withFileTypes: true })
            .map((entry) => {
                const fullPath = join(targetDir, entry.name)
                const entryStat = statSync(fullPath)
                return {
                    name: entry.name,
                    path: fullPath,
                    relativePath: relative(rootDir, fullPath) || '',
                    type: entry.isDirectory() ? 'directory' as const : 'file' as const,
                    size: entryStat.size,
                    updatedAt: entryStat.mtimeMs,
                }
            })
            .sort((a, b) => {
                if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
                return a.name.localeCompare(b.name)
            })
        const linkedRelativePaths = new Set(
            this.storage.listWorkflowArtifacts(roomId, 500)
                .map(item => String(item.relativePath || '').trim())
                .filter(Boolean),
        )
        const summary = linkedRelativePaths.size > 0
            ? summarizeArtifactTreeWithLinks(rootDir, linkedRelativePaths)
            : summarizeArtifactTree(rootDir)

        return {
            rootDir,
            currentPath: relative(rootDir, targetDir) || '',
            entries,
            summary,
        }
    }

    readArtifact(roomId: string, relativePath: string): { rootDir: string; relativePath: string; fileName: string; content: string; language: string } {
        const workflowConfig = this.storage.getRoomWorkflowConfig(roomId)
        const rootDir = resolveArtifactRoot(roomId, workflowConfig)
        ensureArtifactRootDir(rootDir)
        const targetPath = safeArtifactTarget(rootDir, relativePath)
        const stats = statSync(targetPath)
        if (!stats.isFile()) {
            throw new Error('Artifact path is not a file')
        }

        const content = readFileSync(targetPath, 'utf-8')
        const ext = targetPath.split('.').pop()?.toLowerCase() || ''
        const language = ext === 'md' ? 'markdown'
            : ext === 'json' ? 'json'
                : ext === 'yaml' || ext === 'yml' ? 'yaml'
                    : ext === 'ts' || ext === 'tsx' ? 'typescript'
                        : ext === 'js' || ext === 'jsx' ? 'javascript'
                            : ext === 'py' ? 'python'
                                : ext === 'java' ? 'java'
                                    : ext === 'go' ? 'go'
                                        : ext === 'rs' ? 'rust'
                                            : ext === 'css' ? 'css'
                                                : ext === 'html' ? 'html'
                                                    : 'text'

        return {
            rootDir,
            relativePath: relative(rootDir, targetPath),
            fileName: targetPath.split('/').pop() || targetPath,
            content,
            language,
        }
    }

    private resolveNextWorkflowNodeId(roomId: string, currentNodeId: string, outcome: 'approve' | 'reject' | 'complete' = 'complete'): string {
        const workflowConfig = this.storage.getRoomWorkflowConfig(roomId)
        const edges = workflowConfig?.graph?.edges || []
        const matched = edges.find(edge => {
            if (edge.sourceNodeId !== currentNodeId) return false
            const conditionType = String(edge.properties?.branchConditionType || 'always')
            if (conditionType === 'always' && outcome === 'complete') return true
            if (conditionType === 'approve' && outcome === 'approve') return true
            if (conditionType === 'reject' && outcome === 'reject') return true
            return false
        })
        return matched?.targetNodeId || ''
    }

    private ensureWorkflowRunStarted(
        roomId: string,
        kickoff?: {
            summary?: string
            artifactPath?: string
        },
    ): WorkflowRunState | null {
        const workflowConfig = this.storage.getRoomWorkflowConfig(roomId)
        const nodes = workflowConfig?.graph?.nodes || []
        if (nodes.length === 0) return null
        const current = this.storage.getWorkflowRunState(roomId)
        if (current?.currentNodeId) {
            if ((kickoff?.summary && !current.kickoffSummary) || (kickoff?.artifactPath && !current.kickoffArtifactPath)) {
                return this.ensureWorkflowRunHasSequence(roomId, this.storage.saveWorkflowRunState(roomId, {
                    kickoffSummary: kickoff?.summary || current.kickoffSummary,
                    kickoffArtifactPath: kickoff?.artifactPath || current.kickoffArtifactPath,
                }))
            }
            return this.ensureWorkflowRunHasSequence(roomId, current)
        }
        const startNodeId = workflowConfig?.runtime?.startNodeId || nodes[0]?.id || ''
        const nextRun = this.storage.saveWorkflowRunState(roomId, {
            workflowVersion: workflowConfig?.version || 1,
            runNumber: this.storage.incrementRoomRunSequence(roomId),
            status: 'running',
            currentNodeId: startNodeId,
            kickoffSummary: kickoff?.summary || current?.kickoffSummary || '',
            kickoffArtifactPath: kickoff?.artifactPath || current?.kickoffArtifactPath || '',
            startedAt: Date.now(),
        })
        this.syncWorkflowRunHistory(roomId)
        return nextRun
    }

    private isHumanRoomMessage(roomId: string, msg: ChatMessage): boolean {
        if (msg.senderId === 'system') return false
        const agentNames = new Set(
            this.storage.getRoomAgents(roomId)
                .map(agent => String(agent.name || '').trim())
                .filter(Boolean),
        )
        return !agentNames.has(String(msg.senderName || '').trim())
    }

    private maybeRestartWorkflowForNewRound(roomId: string, msg: ChatMessage): boolean {
        const workflowConfig = this.storage.getRoomWorkflowConfig(roomId)
        if (!workflowConfig?.graph?.nodes?.length) return false
        if (!this.isHumanRoomMessage(roomId, msg)) return false

        const run = this.storage.getWorkflowRunState(roomId)
        if (!run || run.status !== 'completed') return false

        this.storage.resetWorkflowExecution(roomId)
        this.publishSystemNotice(
            roomId,
            '【流程进展】检测到新的用户需求，系统已自动开启新一轮流程。',
        )
        logger.info(`[GroupChat] workflow auto-restarted for new round in room ${roomId}`)
        return true
    }

    private contentMentionsRoomAgent(roomId: string, content: string): boolean {
        const normalizedContent = String(content || '').toLowerCase()
        if (normalizedContent.includes('@全部') || normalizedContent.includes('@all')) return true
        return this.storage.getRoomAgents(roomId).some((agent) => {
            const name = String(agent.name || '').trim().toLowerCase()
            return name ? normalizedContent.includes(`@${name}`) : false
        })
    }

    private async maybeRouteWorkflowContinuation(roomId: string, msg: ChatMessage): Promise<boolean> {
        const workflowConfig = this.storage.getRoomWorkflowConfig(roomId)
        if (!workflowConfig?.graph?.nodes?.length) return false
        if (!this.isHumanRoomMessage(roomId, msg)) return false
        if (this.contentMentionsRoomAgent(roomId, msg.content)) return false

        const run = this.storage.getWorkflowRunState(roomId)
        if (!run?.currentNodeId || run.status === 'completed') return false

        const currentNode = this.getWorkflowNodeById(roomId, run.currentNodeId)
        const currentType = String(currentNode?.properties?.workflowNodeType || '')
        if (currentType !== 'role-task' && currentType !== 'artifact-review') return false

        const roleName = this.getAssignedWorkflowAgentName(roomId, currentNode?.properties?.assignedAgentId)
            || String(currentNode?.properties?.roleName || '').trim()
        if (!roleName) return false

        this.publishSystemNotice(
            roomId,
            `【流程进展】已收到你的补充说明，系统会继续交给当前负责角色 @${roleName} 处理「${this.getWorkflowNodeTitle(currentNode) || '当前节点'}」。`,
        )
        const triggered = await this.agentClients.triggerWorkflowRole(roomId, roleName, {
            senderName: msg.senderName,
            senderId: msg.senderId,
            content: msg.content,
            timestamp: msg.timestamp,
        })
        if (!triggered) {
            this.publishSystemNotice(
                roomId,
                `【状态提醒】当前负责角色 @${roleName} 暂时不在线，补充说明已留在现场。请先激活当前群聊或检查对应 Gateway 后再继续。`,
            )
        }
        return true
    }

    private async autoTriggerActiveWorkflowNode(
        roomId: string,
        payload: {
            senderName: string
            senderId: string
            content: string
        },
    ): Promise<void> {
        const run = this.storage.getWorkflowRunState(roomId)
        if (!run?.currentNodeId || run.status === 'completed') return

        const currentNode = this.getWorkflowNodeById(roomId, run.currentNodeId)
        if (!currentNode) return

        const currentType = String(currentNode.properties?.workflowNodeType || '')
        if (currentType !== 'role-task' && currentType !== 'artifact-review') return

        const roleName = this.getAssignedWorkflowAgentName(roomId, currentNode.properties?.assignedAgentId) || String(currentNode.properties?.roleName || '').trim()
        if (!roleName) return

        const autoTriggerKey = `${run.currentNodeId}:${run.updatedAt}`
        if (this.workflowAutoTriggerState.get(roomId) === autoTriggerKey) return
        this.workflowAutoTriggerState.set(roomId, autoTriggerKey)

        try {
            const triggered = await this.agentClients.triggerWorkflowRole(roomId, roleName, {
                content: String(payload.content || '').trim() || `请开始处理当前节点：${this.getWorkflowNodeTitle(currentNode) || currentNode.id}`,
                senderName: String(payload.senderName || '').trim() || '系统通知',
                senderId: String(payload.senderId || '').trim() || 'system-workflow',
                timestamp: Date.now(),
            })
            if (!triggered) {
                logger.warn(`[GroupChat] failed to auto-trigger workflow role ${roleName} in room ${roomId}: agent not available`)
            } else {
                logger.info(`[GroupChat] auto-triggered workflow role ${roleName} for node ${run.currentNodeId} in room ${roomId}`)
            }
        } catch (err: any) {
            logger.error(`[GroupChat] auto-trigger workflow role ${roleName} failed in room ${roomId}: ${err.message}`)
        }
    }

    private maybeAdvanceWorkflow(roomId: string, msg: ChatMessage): void {
        const workflowConfig = this.storage.getRoomWorkflowConfig(roomId)
        if (!workflowConfig?.graph?.nodes?.length) return

        const run = this.ensureWorkflowRunStarted(roomId, {
            summary: this.isHumanRoomMessage(roomId, msg) ? truncateSummary(msg.content, 300) : '',
        })
        if (!run?.currentNodeId) return

        const currentNode = this.getCurrentWorkflowNode(roomId)
        if (!currentNode) return

        const currentType = String(currentNode.properties?.workflowNodeType || '')
        const currentText = typeof currentNode.text === 'string' ? currentNode.text : currentNode.text?.value || currentNode.id
        const currentRoleName = String(currentNode.properties?.roleName || '')

        if (currentType === 'start') {
            const nextNodeId = this.resolveNextWorkflowNodeId(roomId, currentNode.id, 'complete')
            if (nextNodeId) {
                this.storage.saveWorkflowNodeRun(roomId, currentNode.id, {
                    status: 'completed',
                    actorAgentName: msg.senderName,
                    completedAt: Date.now(),
                })
                this.storage.saveWorkflowRunState(roomId, {
                    status: this.getWorkflowRunStatusForNextNode(roomId, nextNodeId),
                    currentNodeId: nextNodeId,
                })
                this.publishSystemNotice(
                    roomId,
                    `【流程进展】当前流程已启动。${this.describeWorkflowNextStep(roomId, nextNodeId)}`,
                )
                this.autoTriggerActiveWorkflowNode(roomId, {
                    senderName: msg.senderName,
                    senderId: msg.senderId,
                    content: msg.content,
                }).catch((err) => {
                    logger.error(`[GroupChat] autoTriggerActiveWorkflowNode error: ${err.message}`)
                })
            }
            this.syncWorkflowRunHistory(roomId)
            return
        }

        if (currentType === 'end') {
            return
        }

        if (currentType === 'approval') {
            return
        }

        if (currentType === 'role-task' || currentType === 'artifact-review') {
            if (currentRoleName && msg.senderName !== currentRoleName) return
            const executionMode = String(currentNode.properties?.executionMode || 'artifact')
            if (currentNode.properties?.requiresArtifact && executionMode !== 'project-write' && looksLikeClarificationRequest(msg.content)) {
                this.storage.saveWorkflowNodeRun(roomId, currentNode.id, {
                    status: 'running',
                    actorAgentName: msg.senderName,
                    artifactIdsJson: '[]',
                    completedAt: 0,
                })
                this.publishSystemNotice(
                    roomId,
                    [
                        `【流程进展】@${msg.senderName} 正在澄清「${currentText}」，当前节点不会自动流转到审批。`,
                        '请你补充确认后，系统会继续交给当前负责角色处理；只有输出正式交付物后才会进入审批或下一节点。',
                    ].join('\n'),
                )
                this.syncWorkflowRunHistory(roomId)
                return
            }
            const roomProject = projectService.getRoomPrimaryProject(roomId)
            const writableProjectWriteNode = executionMode === 'project-write' && Boolean(roomProject?.project) && Boolean(roomProject?.binding?.allowWrite)
            const writtenProjectFiles = this.applyProjectWritesForNode(roomId, currentNode, msg)
            if (writableProjectWriteNode && writtenProjectFiles.length === 0) {
                const retryKey = `${roomId}:${currentNode.id}`
                const retryCount = (this.projectWriteRetryState.get(retryKey) || 0) + 1
                this.projectWriteRetryState.set(retryKey, retryCount)
                this.storage.saveWorkflowNodeRun(roomId, currentNode.id, {
                    status: 'running',
                    actorAgentName: msg.senderName,
                    artifactIdsJson: '[]',
                    completedAt: 0,
                })
                this.publishSystemNotice(
                    roomId,
                    [
                        `【代码校验】@${msg.senderName} 本轮没有输出有效文件块，节点暂不推进。`,
                        retryCount <= 2
                            ? '系统已要求该角色重新输出至少 1 个真实文件块，格式必须是 <<<FILE:path/to/file>>> ... <<<END FILE>>>。'
                            : '已连续多次未输出有效文件块，请人工介入或重新触发该节点。',
                    ].join('\n'),
                )
                if (retryCount <= 2) {
                    void this.agentClients.triggerWorkflowRole(roomId, currentRoleName, {
                        content: '上一次输出没有包含任何有效文件块。请只输出真实代码或配置文件，不要输出文档说明。至少给出 1 个文件块，格式必须严格是 <<<FILE:path/to/file>>>\\n文件内容\\n<<<END FILE>>>。',
                        senderName: '系统通知',
                        senderId: 'system-project-write-retry',
                        timestamp: Date.now(),
                    })
                }
                this.syncWorkflowRunHistory(roomId)
                return
            }
            this.projectWriteRetryState.delete(`${roomId}:${currentNode.id}`)
            const artifactIds = this.persistNodeArtifact(roomId, currentNode, msg)
            const nextNodeId = this.resolveNextWorkflowNodeId(roomId, currentNode.id, 'complete')
            const nextNode = this.getWorkflowNodeById(roomId, nextNodeId)
            const nextNodeType = String(nextNode?.properties?.workflowNodeType || '')
            const needsConfirm = !!currentNode.properties?.requiresAdminConfirm || nextNodeType === 'approval'
            const runNextNodeId = needsConfirm
                ? (nextNodeType === 'approval' && nextNodeId ? nextNodeId : currentNode.id)
                : nextNodeId
            const submittedToApprovalNode = needsConfirm && nextNodeType === 'approval' && nextNodeId
            this.storage.saveWorkflowNodeRun(roomId, currentNode.id, {
                status: submittedToApprovalNode ? 'completed' : needsConfirm ? 'waiting_approval' : 'completed',
                actorAgentName: msg.senderName,
                artifactIdsJson: JSON.stringify(artifactIds),
                completedAt: submittedToApprovalNode || !needsConfirm ? Date.now() : 0,
            })
            this.storage.saveWorkflowRunState(roomId, {
                status: this.getWorkflowRunStatusForNextNode(roomId, runNextNodeId),
                currentNodeId: runNextNodeId,
            })
            if (needsConfirm && nextNodeType === 'approval' && nextNodeId) {
                this.storage.saveWorkflowNodeRun(roomId, nextNodeId, {
                    status: 'waiting_approval',
                    actorAgentName: String(nextNode?.properties?.roleName || workflowConfig.ownerUserName || workflowConfig.ownerRoleName || '管理员'),
                    completedAt: 0,
                })
            }
            if (!needsConfirm) {
                this.storage.confirmWorkflowArtifacts(roomId, currentNode.id, msg.senderName)
            }
            this.publishSystemNotice(
                roomId,
                needsConfirm
                    ? `【流程进展】@${msg.senderName} 已提交「${currentText}」，当前等待审核。${nextNodeType === 'approval' ? this.describeWorkflowNextStep(roomId, nextNodeId) : '请管理员在当前流程卡片中审核通过或驳回。'}`
                    : `【流程进展】@${msg.senderName} 已完成「${currentText}」。${this.describeWorkflowNextStep(roomId, nextNodeId)}`,
            )
            if (writtenProjectFiles.length > 0) {
                this.publishSystemNotice(
                    roomId,
                    `【代码变更】@${msg.senderName} 已将以下文件写入绑定项目：${writtenProjectFiles.map(file => file.relativePath).join('、')}`,
                )
            }
            if (!needsConfirm) {
                this.autoTriggerActiveWorkflowNode(roomId, {
                    senderName: msg.senderName,
                    senderId: msg.senderId,
                    content: `请继续处理下一节点：${this.getWorkflowNodeTitle(this.getWorkflowNodeById(roomId, nextNodeId)) || nextNodeId}`,
                }).catch((err) => {
                    logger.error(`[GroupChat] autoTriggerActiveWorkflowNode error: ${err.message}`)
                })
            }
            this.syncWorkflowRunHistory(roomId)
            logger.debug(`[GroupChat] workflow node ${currentText} updated for room ${roomId}`)
        }
    }

    // ─── Restore Agents ─────────────────────────────────────────

    /**
     * Restore persisted agent connections. Safe to call multiple times;
     * will only execute once.
     */
    async restoreWhenReady(): Promise<void> {
        if (this._restoreScheduled) return
        this._restoreScheduled = true
        await this.restoreAgents()
    }

    private async restoreAgents(): Promise<void> {
        const rooms = this.storage.getAllRooms()
        let total = 0

        for (const room of rooms) {
            if (!room.isActive) {
                this.agentClients.disconnectRoom(room.id)
                continue
            }
            total += await this.restoreRoomAgents(room.id)
        }

        if (total > 0) {
            logger.info(`[GroupChat] Restored ${total} agent(s) across ${rooms.length} room(s)`)
        }
    }

    private async restoreRoomAgents(roomId: string, forceReconnect = false): Promise<number> {
        if (forceReconnect) {
            this.agentClients.disconnectRoom(roomId)
        }
        const existingOnline = this.agentClients.getAgents(roomId)
        if (existingOnline.length > 0 && !forceReconnect) return existingOnline.length

        const agents = this.storage.getRoomAgents(roomId)
        let restored = 0
        for (const agent of agents) {
            try {
                const client = await this.agentClients.createAgent({
                    profile: agent.profile,
                    name: agent.name,
                    description: agent.description,
                    avatar: agent.avatar,
                    systemPrompt: agent.systemPrompt,
                    model: agent.model,
                    temperature: agent.temperature,
                    invited: agent.invited,
                })
                await this.agentClients.addAgentToRoom(roomId, client)
                this.storage.updateRoomAgentRuntimeId(agent.id, client.agentId)
                restored += 1
            } catch (err: any) {
                logger.error(`[GroupChat] Failed to restore agent ${agent.name} in room ${roomId}: ${err.message}`)
            }
        }
        return restored
    }

    private clearRoomRuntimeState(roomId: string): void {
        this.contextStatusState.delete(roomId)
        this.typingState.delete(roomId)
        this.workflowAutoTriggerState.delete(roomId)
    }

    // ─── Auth ───────────────────────────────────────────────────

    private async authMiddleware(socket: Socket, next: (err?: Error) => void): Promise<void> {
        const authToken = await getToken()
        const token = socket.handshake.auth.token || socket.handshake.query.token || ''
        if (authToken) {
            if (token !== authToken) {
                return next(new Error('Unauthorized'))
            }
        }
        next()
    }

    // ─── Connection ─────────────────────────────────────────────

    private onConnection(socket: Socket): void {
        const auth = socket.handshake.auth as { userId?: string; name?: string; description?: string }
        const userId = auth.userId || socket.id
        const userName = auth.name || `User-${userId.slice(0, 6)}`
        const description = auth.description || ''

        this.socketUserMap.set(socket.id, userId)
        this.userInfoMap.set(userId, { name: userName, description })

        logger.debug(`[GroupChat] Connected: ${userName} (socket=${socket.id}, user=${userId})`)

        socket.on('join', (data: { roomId?: string; name?: string }, ack?: (response?: unknown) => void) => this.handleJoin(socket, data, ack))
        socket.on('message', (data: { roomId?: string; content: string }, ack?: (response?: unknown) => void) => this.handleMessage(socket, data, ack))
        socket.on('typing', (data: { roomId?: string }) => this.handleTyping(socket, data))
        socket.on('stop_typing', (data: { roomId?: string }) => this.handleStopTyping(socket, data))
        socket.on('context_status', (data: { roomId?: string; agentName?: string; status?: string }) => this.handleContextStatus(socket, data))
        socket.on('disconnect', () => this.handleDisconnect(socket))
    }

    // ─── Handlers ───────────────────────────────────────────────

    private handleJoin(socket: Socket, data: { roomId?: string; name?: string; description?: string }, ack?: (res: any) => void): void {
        const socketId = socket.id
        const userId = this.socketUserMap.get(socketId) || socketId
        const userInfo = this.userInfoMap.get(userId) || { name: `User-${userId.slice(0, 6)}`, description: '' }
        const userName = data.name || userInfo.name
        const description = data.description || userInfo.description

        // Update stored user info
        this.userInfoMap.set(userId, { name: userName, description })

        const roomId = data.roomId || 'general'
        let room = this.rooms.get(roomId)
        if (!room) {
            room = new ChatRoom(roomId)
            this.rooms.set(roomId, room)
            this.storage.saveRoom(roomId, roomId)
        }

        // Persist member to SQLite
        this.storage.addRoomMember(roomId, userId, userName, description)

        // Add to in-memory online members (keyed by userId)
        room.addOrUpdateMember(socketId, userId, userName, description)
        socket.join(roomId)

        socket.to(roomId).emit('member_joined', {
            roomId,
            memberId: userId,
            memberName: userName,
            members: room.getMembersList(),
        })

        // Load history from SQLite
        const messages = this.storage.getMessages(roomId)
        const agents = this.storage.getRoomAgents(roomId)

        ack?.({
            roomId,
            roomName: room.name,
            members: room.getMembersList(),
            messages,
            agents,
            rooms: this.getRoomIds(),
            typingUsers: this.getTypingUsers(roomId),
            contextStatuses: this.getContextStatuses(roomId),
        })

        logger.debug(`[GroupChat] ${userName} (user=${userId}) joined room: ${roomId}`)
    }

    private handleMessage(socket: Socket, data: { roomId?: string; content: string }, ack?: (res: any) => void): void {
        const socketId = socket.id
        const roomId = data.roomId || 'general'
        const room = this.rooms.get(roomId)
        const runStateBeforeMessage = this.storage.getWorkflowRunState(roomId)
        const hadActiveWorkflowBeforeMessage = !!runStateBeforeMessage
            && runStateBeforeMessage.status !== 'completed'
            && runStateBeforeMessage.status !== 'failed'

        if (!room || !room.hasOnlineMember(socketId)) {
            ack?.({ error: 'Not in room' })
            return
        }

        const member = room.getOnlineMemberBySocketId(socketId)
        const userId = member?.userId || socketId
        const userName = member?.name || `User-${socketId.slice(0, 6)}`

        const msg: ChatMessage = {
            id: this.generateId(),
            roomId,
            senderId: userId,
            senderName: userName,
            content: data.content,
            timestamp: Date.now(),
        }

        this.storage.addMessage(msg)
        this.storage.pruneMessages(roomId)

        if (msg.content.trim()) {
            const roomProfiles = Array.from(new Set(
                (this.storage.getRoomAgents(roomId) || [])
                    .map(agent => String(agent.profile || '').trim())
                    .filter(Boolean),
            ))
            const memoryProfiles = roomProfiles.length > 0 ? roomProfiles : [undefined]
            for (const profileName of memoryProfiles) {
                void rememberRoomMessageMemories(msg.content, {
                    profileName,
                    roomId,
                    userId,
                }).catch((err) => {
                    logger.warn(err, `[GroupChat] failed to auto-write room memory for room ${roomId}`)
                })
            }
        }

        // Recalculate total tokens for the room
        const messages = this.storage.getMessages(roomId)
        const totalTokens = this.storage.estimateTokens(messages.map(m => m.content + m.senderName).join(''))
        this.storage.updateRoomTotalTokens(roomId, totalTokens)

        this.nsp.to(roomId).emit('message', msg)
        this.nsp.to(roomId).emit('room_updated', { roomId, totalTokens })
        ack?.({ id: msg.id })

        const restartedForNewRound = this.maybeRestartWorkflowForNewRound(roomId, msg)
        this.maybeAdvanceWorkflow(roomId, msg)

        const mentionNotice = this.buildMentionDeliveryNotice(roomId, msg.content)
        if (mentionNotice) {
            this.publishSystemNotice(roomId, mentionNotice)
            if (mentionNotice.includes('请先激活当前群聊')) {
                return
            }
        }

        if (hadActiveWorkflowBeforeMessage && !restartedForNewRound) this.maybeRouteWorkflowContinuation(roomId, msg).catch((err) => {
            logger.error(`[GroupChat] maybeRouteWorkflowContinuation error: ${err.message}`)
        })

        // Server-side @mention routing — parse mentions and invoke agents directly
        if (!restartedForNewRound) this.agentClients.processMentions(roomId, {
            content: msg.content,
            senderName: msg.senderName,
            senderId: msg.senderId,
            timestamp: msg.timestamp,
        }).catch((err) => {
            logger.error(`[GroupChat] processMentions error: ${err.message}`)
        })
    }

    private buildMentionDeliveryNotice(roomId: string, content: string): string {
        const normalizedContent = String(content || '').toLowerCase()
        if (!normalizedContent) return ''

        let persistedAgents = this.storage.getRoomAgents(roomId)
        if (persistedAgents.length === 0) return ''

        const workflowConfig = this.storage.getRoomWorkflowConfig(roomId)
        const runState = this.storage.getWorkflowRunState(roomId)
        const currentNode = this.getCurrentWorkflowNode(roomId)
        const activeRoleName = this.getAssignedWorkflowAgentName(roomId, currentNode?.properties?.assignedAgentId) || String(currentNode?.properties?.roleName || '').trim()
        const currentType = String(currentNode?.properties?.workflowNodeType || '')
        if ((workflowConfig?.mode === 'stage-gated' || workflowConfig?.graph?.nodes?.length) && runState?.status && runState.status !== 'completed' && activeRoleName && (currentType === 'role-task' || currentType === 'artifact-review')) {
            persistedAgents = persistedAgents.filter((agent) => agent.name === activeRoleName)
        }

        const mentionedAll = normalizedContent.includes('@全部') || normalizedContent.includes('@all')
        const mentionedAgents = mentionedAll
            ? persistedAgents
            : persistedAgents.filter((agent) => {
                const name = String(agent.name || '').trim()
                return name ? normalizedContent.includes(`@${name.toLowerCase()}`) : false
            })
        if (mentionedAgents.length === 0) return ''

        const roomInfo = this.storage.getRoom(roomId)
        if (!roomInfo?.isActive) {
            return '【状态提醒】当前群聊处于离线待机状态，被 @ 的机器人现在不会响应。请先激活当前群聊，让本群机器人全部上线后再继续对话。'
        }

        const onlineAgentNames = new Set(this.agentClients.getAgents(roomId).map(agent => agent.name))
        const offlineMentioned = mentionedAgents.filter(agent => !onlineAgentNames.has(agent.name))
        if (offlineMentioned.length === 0) return ''

        const names = offlineMentioned.map(agent => `@${agent.name}`).join('、')
        if (onlineAgentNames.size === 0) {
            return `【状态提醒】当前群聊虽然已激活，但机器人还没有成功上线。${names} 暂时无法响应，请到“网关”或“日志”页检查启动情况。`
        }

        return `【状态提醒】${names} 当前不在线，暂时无法响应。你可以先检查对应 Gateway，或稍后重试。`
    }

    private persistAndEmitMessage(msg: ChatMessage): ChatMessage {
        this.storage.addMessage(msg)
        this.storage.pruneMessages(msg.roomId)

        const messages = this.storage.getMessages(msg.roomId)
        const totalTokens = this.storage.estimateTokens(messages.map(m => m.content + m.senderName).join(''))
        this.storage.updateRoomTotalTokens(msg.roomId, totalTokens)

        this.nsp.to(msg.roomId).emit('message', msg)
        this.nsp.to(msg.roomId).emit('room_updated', { roomId: msg.roomId, totalTokens })
        return msg
    }

    publishSystemNotice(roomId: string, content: string, senderName = '系统通知'): ChatMessage | null {
        const normalized = String(content || '').trim()
        if (!normalized) return null

        const msg: ChatMessage = {
            id: this.generateId(),
            roomId,
            senderId: 'system',
            senderName,
            content: normalized,
            timestamp: Date.now(),
        }

        return this.persistAndEmitMessage(msg)
    }

    private handleTyping(socket: Socket, data: { roomId?: string }): void {
        const roomId = data.roomId || 'general'
        const userId = this.socketUserMap.get(socket.id) || socket.id
        const userName = this.userInfoMap.get(userId)?.name || `User-${socket.id.slice(0, 6)}`

        // Track typing state for rejoin recovery
        let roomTyping = this.typingState.get(roomId)
        if (!roomTyping) {
            roomTyping = new Map()
            this.typingState.set(roomId, roomTyping)
        }
        const existing = roomTyping.get(userId)
        if (existing) clearTimeout(existing.timer)
        roomTyping.set(userId, {
            userName,
            timer: setTimeout(() => {
                roomTyping!.delete(userId)
                if (roomTyping!.size === 0) this.typingState.delete(roomId)
            }, 30000),
        })

        socket.to(roomId).emit('typing', {
            roomId,
            userId,
            userName,
        })
    }

    private handleStopTyping(socket: Socket, data: { roomId?: string }): void {
        const roomId = data.roomId || 'general'
        const userId = this.socketUserMap.get(socket.id) || socket.id

        // Remove from typing state
        const roomTyping = this.typingState.get(roomId)
        if (roomTyping) {
            const entry = roomTyping.get(userId)
            if (entry) clearTimeout(entry.timer)
            roomTyping.delete(userId)
            if (roomTyping.size === 0) this.typingState.delete(roomId)
        }

        socket.to(roomId).emit('stop_typing', {
            roomId,
            userId,
        })
    }

    private handleContextStatus(socket: Socket, data: { roomId?: string; agentName?: string; status?: string }): void {
        const roomId = data.roomId || 'general'
        const agentName = data.agentName || ''
        const status = data.status || ''

        if (!agentName) return

        let roomStatuses = this.contextStatusState.get(roomId)
        if (!roomStatuses) {
            roomStatuses = new Map()
            this.contextStatusState.set(roomId, roomStatuses)
        }

        if (status === 'ready') {
            roomStatuses.delete(agentName)
            if (roomStatuses.size === 0) this.contextStatusState.delete(roomId)
        } else {
            roomStatuses.set(agentName, { agentName, status })
        }

        // Relay to all other sockets in the room
        socket.to(roomId).emit('context_status', {
            roomId,
            agentName,
            status,
        })
    }

    private handleDisconnect(socket: Socket): void {
        const socketId = socket.id
        const userId = this.socketUserMap.get(socketId)
        const userName = userId ? this.userInfoMap.get(userId)?.name : undefined

        logger.debug(`[GroupChat] Disconnected: ${userName || socketId} (socket=${socketId}, user=${userId || socketId})`)

        // Clean up typing state for this socket
        for (const [roomId, roomTyping] of this.typingState) {
            const entry = roomTyping.get(userId || socketId)
            if (entry) {
                clearTimeout(entry.timer)
                roomTyping.delete(userId || socketId)
                if (roomTyping.size === 0) this.typingState.delete(roomId)
            }
        }

        this.leaveAllRooms(socket, socketId)
        this.socketUserMap.delete(socketId)
        // Don't delete userInfoMap — it persists across reconnects
    }

    // ─── Helpers ────────────────────────────────────────────────

    private getTypingUsers(roomId: string): Array<{ userId: string; userName: string }> {
        const roomTyping = this.typingState.get(roomId)
        if (!roomTyping) return []
        return Array.from(roomTyping.entries()).map(([userId, entry]) => ({ userId, userName: entry.userName }))
    }

    private getContextStatuses(roomId: string): Array<{ agentName: string; status: string }> {
        const roomStatuses = this.contextStatusState.get(roomId)
        if (!roomStatuses) return []
        return Array.from(roomStatuses.values())
    }

    private leaveAllRooms(socket: Socket, socketId: string): void {
        this.rooms.forEach((room, rid) => {
            if (room.hasOnlineMember(socketId)) {
                const member = room.getOnlineMemberBySocketId(socketId)
                room.removeMember(socketId)
                socket.leave(rid)
                this.nsp.to(rid).emit('member_left', {
                    roomId: rid,
                    memberId: member?.userId || socketId,
                    memberName: member?.name || `User-${socketId.slice(0, 6)}`,
                    members: room.getMembersList(),
                })
            }
        })
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    }
}
