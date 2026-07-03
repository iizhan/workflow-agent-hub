import {
  bindLocalProject,
  bindRoomProject,
  createRoom,
  getRoomDetail,
  getRoomProject,
  getRoomWorkflowState,
  listProjects,
  listRoomArtifacts,
  listRoomWorkflowArtifacts,
  listRooms,
  listWorkflowTemplates,
  type AgentConfigInput,
  type GroupChatArtifactEntry,
  type RoomAgent,
  type RoomInfo,
  type RoomProjectResult,
  type WorkflowArtifactRecordSummary,
  type WorkflowExecutionNodeState,
  type WorkflowExecutionRunState,
  type WorkflowNodeRunState,
  type WorkflowRoomConfig,
} from '@/api/hermes/group-chat'
import type {
  ApplicationCreateInput,
  ApplicationCreateOptions,
  ApplicationDetail,
  ApplicationNextAction,
  ApplicationScenario,
  ApplicationSectionKey,
  ApplicationStatus,
  ApplicationSummary,
} from '@/types/workbench/application'

const APPLICATION_SECTIONS: ApplicationSectionKey[] = [
  'overview',
  'projects',
  'agents',
  'workflow',
  'artifacts',
  'runs',
  'collaboration',
  'settings',
]

interface RoomAggregateInput {
  room: RoomInfo
  roomProject: RoomProjectResult | null
  agents: RoomAgent[]
  workflowRun: WorkflowExecutionRunState | null
  workflowNodeRuns: WorkflowNodeRunState[]
  currentNode: WorkflowExecutionNodeState | null
  artifactEntries?: GroupChatArtifactEntry[]
  workflowArtifacts?: WorkflowArtifactRecordSummary[]
  latestMessageAt?: number | null
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function parseWorkflowConfig(json?: string): WorkflowRoomConfig | null {
  if (!json) return null
  try {
    return JSON.parse(json) as WorkflowRoomConfig
  } catch {
    return null
  }
}

function normalizeText(value?: string | null): string {
  return String(value || '').trim()
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const text = normalizeText(value)
    const key = text.toLowerCase()
    if (!text || seen.has(key)) continue
    seen.add(key)
    result.push(text)
  }
  return result
}

function parseDefaultAgents(json?: string): AgentConfigInput[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed as AgentConfigInput[] : []
  } catch {
    return []
  }
}

function pickGoalSummary(room: RoomInfo, roomProject: RoomProjectResult | null): string | null {
  const candidates = [
    roomProject?.project.description,
    room.workflowPrompt,
    room.workflowName,
  ]
  for (const candidate of candidates) {
    const value = normalizeText(candidate)
    if (value) return value
  }
  return null
}

function inferScenario(room: RoomInfo, roomProject: RoomProjectResult | null): {
  scenario: ApplicationScenario
  source: 'inferred' | 'fallback'
} {
  const text = [
    room.presetKey,
    room.workflowName,
    room.workflowPrompt,
    roomProject?.project.name,
    roomProject?.project.description,
  ]
    .map(normalizeText)
    .join(' ')
    .toLowerCase()

  const matches = (patterns: string[]) => patterns.some(pattern => text.includes(pattern))

  if (matches(['ppt', 'slide', 'slides', 'deck', 'presentation'])) {
    return { scenario: 'ppt', source: 'inferred' }
  }
  if (matches(['research', 'analysis', 'study', 'insight'])) {
    return { scenario: 'research', source: 'inferred' }
  }
  if (matches(['document', 'doc', 'report', 'manual', 'article', 'prd'])) {
    return { scenario: 'document', source: 'inferred' }
  }
  if (
    roomProject?.project.gitEnabled ||
    matches(['code', 'dev', 'frontend', 'backend', 'qa', 'test', 'repo'])
  ) {
    return { scenario: 'code', source: 'inferred' }
  }
  return { scenario: 'general', source: 'fallback' }
}

function inferWorkflowTemplateScenario(workflow: {
  id: string
  name: string
  description?: string
  tags?: string[]
}): ApplicationScenario | null {
  const text = [
    workflow.id,
    workflow.name,
    workflow.description,
    ...(workflow.tags || []),
  ]
    .map(normalizeText)
    .join(' ')
    .toLowerCase()

  const matches = (patterns: string[]) => patterns.some(pattern => text.includes(pattern))

  if (matches(['ppt', 'slide', 'slides', 'deck', 'presentation'])) return 'ppt'
  if (matches(['research', 'analysis', 'study', 'insight'])) return 'research'
  if (matches(['document', 'doc', 'writing', 'report', 'manual', 'article', 'knowledge'])) return 'document'
  if (matches(['code', 'dev', 'frontend', 'backend', 'qa', 'repo', 'rd', 'engineering'])) return 'code'
  if (matches(['general', 'starter', 'quickstart'])) return 'general'
  return null
}

function extractArtifactDirectories(workflowConfig?: WorkflowRoomConfig | null): string[] {
  const directories = new Set<string>()
  for (const node of workflowConfig?.graph?.nodes || []) {
    const raw = normalizeText(String(node?.properties?.artifactDir || ''))
    if (raw) directories.add(raw)
  }
  return Array.from(directories)
}

const SCENARIO_TEMPLATE_RECOMMENDATIONS: Partial<Record<ApplicationScenario, string>> = {
  code: 'code-delivery',
  document: 'document-production',
  ppt: 'ppt-storytelling',
  research: 'research-analysis',
  general: 'product-review',
}

function isWorkflowEnabled(room: RoomInfo, config: WorkflowRoomConfig | null): boolean {
  if (normalizeText(room.workflowName) || normalizeText(room.workflowPrompt)) return true
  if ((config?.stages || []).length > 0) return true
  if ((config?.graph?.nodes || []).length > 0) return true
  return false
}

function hasPendingReview(nodeRuns: WorkflowNodeRunState[]): boolean {
  return nodeRuns.some(nodeRun => nodeRun.status === 'waiting_approval')
}

function deriveApplicationStatus(input: RoomAggregateInput): {
  status: ApplicationStatus
  statusReason: string | null
} {
  const workflowEnabled = isWorkflowEnabled(input.room, parseWorkflowConfig(input.room.workflowConfigJson))
  const projectReady = !!input.roomProject?.project.id
  const agentsReady = input.agents.length > 0
  const pendingReview = hasPendingReview(input.workflowNodeRuns)
  const runStatus = input.workflowRun?.status || null

  if (runStatus === 'failed') {
    return { status: 'failed', statusReason: 'Recent run failed' }
  }
  if (pendingReview) {
    return { status: 'waiting_review', statusReason: 'Pending approvals require review' }
  }
  if (runStatus === 'running' || runStatus === 'paused') {
    return { status: 'running', statusReason: 'A workflow run is currently active' }
  }
  if (!projectReady) {
    return { status: 'setup_required', statusReason: 'Primary project is not configured yet' }
  }
  if (!agentsReady) {
    return { status: 'setup_required', statusReason: 'No active agents are configured yet' }
  }
  if (!workflowEnabled) {
    return { status: 'setup_required', statusReason: 'Workflow is not configured yet' }
  }
  if (runStatus === 'completed') {
    return { status: 'completed', statusReason: 'Latest run completed successfully' }
  }
  return { status: 'ready', statusReason: 'Ready for the next run' }
}

function deriveNextAction(
  input: RoomAggregateInput,
  status: ApplicationStatus,
): ApplicationNextAction | null {
  const workflowEnabled = isWorkflowEnabled(input.room, parseWorkflowConfig(input.room.workflowConfigJson))
  if (!input.roomProject?.project.id) {
    return {
      key: 'bind_project',
      label: 'Bind primary project',
      targetSection: 'projects',
    }
  }
  if (input.agents.length === 0) {
    return {
      key: 'configure_agents',
      label: 'Configure agents',
      targetSection: 'agents',
    }
  }
  if (!workflowEnabled) {
    return {
      key: 'configure_workflow',
      label: 'Configure workflow',
      targetSection: 'workflow',
    }
  }
  if (status === 'waiting_review') {
    return {
      key: 'review_pending_artifacts',
      label: 'Review pending approvals',
      targetSection: 'artifacts',
    }
  }
  if (status === 'failed') {
    return {
      key: 'inspect_failure',
      label: 'Inspect failure',
      targetSection: 'runs',
    }
  }
  if (status === 'running') {
    return {
      key: 'open_current_run',
      label: 'Open current collaboration',
      targetSection: 'collaboration',
    }
  }
  if (status === 'completed') {
    return {
      key: 'view_artifacts',
      label: 'Review generated artifacts',
      targetSection: 'artifacts',
    }
  }
  return {
    key: 'start_first_run',
    label: 'Start the first run',
    targetSection: 'collaboration',
  }
}

function deriveUpdatedAt(input: RoomAggregateInput): number | null {
  const values = [
    input.roomProject?.project.updatedAt || 0,
    input.workflowRun?.updatedAt || 0,
    input.latestMessageAt || 0,
  ].filter(value => value > 0)
  return values.length ? Math.max(...values) : null
}

function deriveLastRunAt(input: RoomAggregateInput): number | null {
  const values = [
    input.workflowRun?.startedAt || 0,
    input.workflowRun?.updatedAt || 0,
  ].filter(value => value > 0)
  return values.length ? Math.max(...values) : null
}

function toNodeTitle(currentNode: WorkflowExecutionNodeState | null): string | null {
  if (!currentNode) return null
  const text = currentNode.text
  if (typeof text === 'string') return normalizeText(text) || null
  return normalizeText(text?.value) || null
}

export function mapRoomAggregateToApplicationSummary(input: RoomAggregateInput): ApplicationSummary {
  const workflowConfig = parseWorkflowConfig(input.room.workflowConfigJson)
  const { scenario, source } = inferScenario(input.room, input.roomProject)
  const { status, statusReason } = deriveApplicationStatus(input)

  return {
    id: input.room.id,
    sourceRoomId: input.room.id,
    name: input.room.name,
    scenario,
    scenarioSource: source,
    goalSummary: pickGoalSummary(input.room, input.roomProject),
    status,
    statusReason,
    primaryProjectName: input.roomProject?.project.name || null,
    primaryProjectId: input.roomProject?.project.id || null,
    agentCount: input.agents.length,
    workflowEnabled: isWorkflowEnabled(input.room, workflowConfig),
    workflowName: normalizeText(input.room.workflowName) || null,
    hasPendingReview: hasPendingReview(input.workflowNodeRuns),
    hasActiveRun: input.workflowRun?.status === 'running' || input.workflowRun?.status === 'paused',
    lastRunAt: deriveLastRunAt(input),
    updatedAt: deriveUpdatedAt(input),
    nextAction: deriveNextAction(input, status),
  }
}

export function mapRoomAggregateToApplicationDetail(input: RoomAggregateInput): ApplicationDetail {
  const workflowConfig = parseWorkflowConfig(input.room.workflowConfigJson)
  const defaultAgents = parseDefaultAgents(input.room.defaultAgentsJson)
  const { scenario, source } = inferScenario(input.room, input.roomProject)
  const { status, statusReason } = deriveApplicationStatus(input)

  return {
    id: input.room.id,
    sourceRoomId: input.room.id,
    name: input.room.name,
    scenario,
    scenarioSource: source,
    goalSummary: pickGoalSummary(input.room, input.roomProject),
    status,
    statusReason,
    sections: APPLICATION_SECTIONS,
    primaryProject: input.roomProject
      ? {
          id: input.roomProject.project.id,
          name: input.roomProject.project.name,
          description: normalizeText(input.roomProject.project.description) || null,
          sourceType: input.roomProject.project.sourceType,
          localPath: normalizeText(input.roomProject.project.localPath) || null,
          gitEnabled: !!input.roomProject.project.gitEnabled,
          currentBranch: normalizeText(input.roomProject.project.currentBranch) || null,
        }
      : null,
    agents: {
      total: input.agents.length,
      invited: input.agents.filter(agent => !!agent.invited).length,
      names: input.agents.map(agent => agent.name).filter(Boolean),
    },
    workflow: {
      enabled: isWorkflowEnabled(input.room, workflowConfig),
      name: normalizeText(input.room.workflowName) || null,
      mode:
        workflowConfig?.mode === 'freeform' || workflowConfig?.mode === 'stage-gated'
          ? workflowConfig.mode
          : 'unknown',
      stageCount: workflowConfig?.stages?.length || 0,
      startNodeConfigured: !!normalizeText(workflowConfig?.runtime?.startNodeId),
    },
    run: {
      status: input.workflowRun?.status || null,
      currentNodeTitle: toNodeTitle(input.currentNode),
      startedAt: input.workflowRun?.startedAt || null,
      updatedAt: input.workflowRun?.updatedAt || null,
      hasPendingReview: hasPendingReview(input.workflowNodeRuns),
    },
    artifacts: {
      count: Array.isArray(input.workflowArtifacts) ? input.workflowArtifacts.length : null,
      latestTitle: input.workflowArtifacts?.[0]?.title || input.workflowArtifacts?.[0]?.relativePath || null,
    },
    settings: {
      inviteCode: normalizeText(input.room.inviteCode) || null,
      userName: null,
      userDescription: null,
      compression: {
        triggerTokens: input.room.triggerTokens || null,
        maxHistoryTokens: input.room.maxHistoryTokens || null,
        tailMessageCount: input.room.tailMessageCount || null,
      },
      workflowOwnerName: normalizeText(workflowConfig?.ownerUserName) || null,
      workflowOwnerRoleName: normalizeText(workflowConfig?.ownerRoleName) || null,
      workflowMode:
        workflowConfig?.mode === 'freeform' || workflowConfig?.mode === 'stage-gated'
          ? workflowConfig.mode
          : 'unknown',
      projectBound: !!input.roomProject?.project.id,
      projectLocalPath: normalizeText(input.roomProject?.project.localPath) || null,
      defaultAgentBaseline: {
        roleCount: defaultAgents.length,
        invitedCount: defaultAgents.filter(agent => agent.invited !== false).length,
        roles: uniqueValues(defaultAgents.map(agent => agent.name || agent.profile)),
        models: uniqueValues(defaultAgents.map(agent => agent.model)),
      },
    },
    nextAction: deriveNextAction(input, status),
  }
}

async function getRoomAggregate(room: RoomInfo): Promise<RoomAggregateInput> {
  const detailPromise = getRoomDetail(room.id).catch(() => ({
    room,
    messages: [],
    agents: [],
    members: [],
  }))
  const projectPromise = getRoomProject(room.id).catch(() => ({ roomProject: null }))
  const workflowPromise = getRoomWorkflowState(room.id).catch(() => ({
    run: null,
    currentNode: null,
    nodeRuns: [],
  }))

  const [detailResult, projectResult, workflowResult] = await Promise.all([
    detailPromise,
    projectPromise,
    workflowPromise,
  ])

  const latestMessageAt = detailResult.messages.reduce(
    (max, message) => (message.timestamp > max ? message.timestamp : max),
    0,
  )

  return {
    room: detailResult.room || room,
    roomProject: projectResult.roomProject,
    agents: detailResult.agents || [],
    workflowRun: workflowResult.run,
    workflowNodeRuns: workflowResult.nodeRuns || [],
    currentNode: workflowResult.currentNode,
    latestMessageAt: latestMessageAt || null,
  }
}

export async function listApplicationSummaries(): Promise<ApplicationSummary[]> {
  const { rooms } = await listRooms()
  const aggregates = await Promise.all(
    rooms.map(async room => {
      try {
        return await getRoomAggregate(room)
      } catch {
        return {
          room,
          roomProject: null,
          agents: [],
          workflowRun: null,
          workflowNodeRuns: [],
          currentNode: null,
          latestMessageAt: null,
        } satisfies RoomAggregateInput
      }
    }),
  )

  return aggregates
    .map(mapRoomAggregateToApplicationSummary)
    .sort((left, right) => {
      const rightUpdated = right.updatedAt || 0
      const leftUpdated = left.updatedAt || 0
      if (rightUpdated !== leftUpdated) return rightUpdated - leftUpdated
      return left.name.localeCompare(right.name)
    })
}

export async function getApplicationDetail(applicationId: string): Promise<ApplicationDetail> {
  const detailResult = await getRoomDetail(applicationId)
  const [projectResult, workflowResult, artifactResult, workflowArtifactResult] = await Promise.all([
    getRoomProject(applicationId).catch(() => ({ roomProject: null })),
    getRoomWorkflowState(applicationId).catch(() => ({
      run: null,
      currentNode: null,
      nodeRuns: [],
    })),
    listRoomArtifacts(applicationId, '').catch(() => ({
      rootDir: '',
      currentPath: '',
      entries: [],
    })),
    listRoomWorkflowArtifacts(applicationId, 100).catch(() => ({
      artifacts: [],
    })),
  ])

  const latestMessageAt = detailResult.messages.reduce(
    (max, message) => (message.timestamp > max ? message.timestamp : max),
    0,
  )

  return mapRoomAggregateToApplicationDetail({
    room: detailResult.room,
    roomProject: projectResult.roomProject,
    agents: detailResult.agents || [],
    workflowRun: workflowResult.run,
    workflowNodeRuns: workflowResult.nodeRuns || [],
    currentNode: workflowResult.currentNode,
    artifactEntries: artifactResult.entries || [],
    workflowArtifacts: workflowArtifactResult.artifacts || [],
    latestMessageAt: latestMessageAt || null,
  })
}

export async function getApplicationCreateOptions(): Promise<ApplicationCreateOptions> {
  const [projectResult, workflowTemplateResult] = await Promise.all([
    listProjects(),
    listWorkflowTemplates(),
  ])

  return {
    projects: projectResult.projects.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
    })),
    workflowTemplates: workflowTemplateResult.workflows.map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      recommendedScenario:
        (Object.entries(SCENARIO_TEMPLATE_RECOMMENDATIONS).find(([, templateId]) => templateId === workflow.id)?.[0] as ApplicationScenario | undefined)
        || inferWorkflowTemplateScenario(workflow),
      defaultRoles: (workflow.agents || []).map(agent => normalizeText(agent.name || agent.profile)).filter(Boolean),
      defaultStages: (workflow.workflowConfig?.stages || []).map(stage => normalizeText(stage.name || stage.id)).filter(Boolean),
      artifactDirectories: extractArtifactDirectories(workflow.workflowConfig),
    })),
  }
}

export async function createApplication(
  input: ApplicationCreateInput,
): Promise<{ applicationId: string; sourceRoomId: string }> {
  const agents = (input.agents || []).map(agent => ({
    profile: agent.profile,
    name: agent.name,
    description: agent.description,
    avatar: agent.avatar,
    systemPrompt: agent.systemPrompt,
    model: agent.model,
    temperature: agent.temperature ?? null,
    invited: agent.invited ?? true,
  })) satisfies AgentConfigInput[]

  const roomResult = await createRoom({
    name: input.name,
    inviteCode: input.inviteCode || generateInviteCode(),
    agents,
    compression: input.compression,
    workflow: input.workflow,
  })

  const roomId = roomResult.room.id

  if (input.existingProjectId) {
    await bindRoomProject(roomId, input.existingProjectId)
  } else if (input.localProject?.localPath) {
    await bindLocalProject({
      roomId,
      localPath: input.localProject.localPath,
      name: input.localProject.name,
      description: input.localProject.description,
    })
  }

  return {
    applicationId: roomId,
    sourceRoomId: roomId,
  }
}
