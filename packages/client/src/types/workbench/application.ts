export type ApplicationScenario =
  | 'general'
  | 'code'
  | 'document'
  | 'ppt'
  | 'research'

export type ApplicationStatus =
  | 'draft'
  | 'setup_required'
  | 'ready'
  | 'running'
  | 'waiting_review'
  | 'failed'
  | 'completed'

export type ApplicationSectionKey =
  | 'overview'
  | 'projects'
  | 'agents'
  | 'workflow'
  | 'artifacts'
  | 'runs'
  | 'collaboration'
  | 'settings'

export interface ApplicationNextAction {
  key:
    | 'bind_project'
    | 'configure_agents'
    | 'configure_workflow'
    | 'start_first_run'
    | 'open_current_run'
    | 'review_pending_artifacts'
    | 'inspect_failure'
    | 'view_artifacts'
  label: string
  targetSection: ApplicationSectionKey
  targetAction?: string | null
}

export interface ApplicationSummary {
  id: string
  sourceRoomId: string
  name: string
  scenario: ApplicationScenario
  scenarioSource: 'inferred' | 'fallback'
  goalSummary: string | null
  status: ApplicationStatus
  statusReason: string | null
  primaryProjectName: string | null
  primaryProjectId: string | null
  agentCount: number
  workflowEnabled: boolean
  workflowName: string | null
  hasPendingReview: boolean
  hasActiveRun: boolean
  lastRunAt: number | null
  updatedAt: number | null
  nextAction: ApplicationNextAction | null
}

export interface ApplicationDetail {
  id: string
  sourceRoomId: string
  name: string
  scenario: ApplicationScenario
  scenarioSource: 'inferred' | 'fallback'
  goalSummary: string | null
  status: ApplicationStatus
  statusReason: string | null
  sections: ApplicationSectionKey[]
  primaryProject: {
    id: string
    name: string
    description: string | null
    sourceType: string
    localPath: string | null
    gitEnabled: boolean
    currentBranch: string | null
  } | null
  agents: {
    total: number
    invited: number
    names: string[]
  }
  workflow: {
    enabled: boolean
    name: string | null
    mode: 'freeform' | 'stage-gated' | 'unknown'
    stageCount: number
    startNodeConfigured: boolean
  }
  run: {
    status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | null
    currentNodeTitle: string | null
    startedAt: number | null
    updatedAt: number | null
    hasPendingReview: boolean
  }
  artifacts: {
    count: number | null
    latestTitle: string | null
  }
  settings: {
    inviteCode: string | null
    userName: string | null
    userDescription: string | null
    compression: {
      triggerTokens: number | null
      maxHistoryTokens: number | null
      tailMessageCount: number | null
    }
    workflowOwnerName: string | null
    workflowOwnerRoleName: string | null
    workflowMode: 'freeform' | 'stage-gated' | 'unknown'
    projectBound: boolean
    projectLocalPath: string | null
    defaultAgentBaseline: {
      roleCount: number
      invitedCount: number
      roles: string[]
      models: string[]
    }
  }
  nextAction: ApplicationNextAction | null
}

export interface ApplicationProjectSummary {
  projectId: string | null
  bindingId: string | null
  name: string | null
  description: string | null
  sourceType: string | null
  localPath: string | null
  repoUrl: string | null
  gitEnabled: boolean
  currentBranch: string | null
  defaultBranch: string | null
  permissions: {
    allowRead: boolean
    allowWrite: boolean
    allowCommit: boolean
    allowPush: boolean
    pushRequireApproval: boolean
  } | null
}

export interface ApplicationProjectTreeEntry {
  name: string
  path: string
  relativePath: string
  type: 'file' | 'directory'
  size: number
  updatedAt: number
}

export interface ApplicationProjectFilePreview {
  relativePath: string
  fileName: string
  content: string
  language: string
}

export interface ApplicationProjectExplorerState {
  currentPath: string
  entries: ApplicationProjectTreeEntry[]
  currentFile: ApplicationProjectFilePreview | null
  gitStatus: {
    gitEnabled: boolean
    currentBranch: string
    defaultBranch: string
    repoUrl: string
    aheadCount: number
    behindCount: number
    staged: string[]
    modified: string[]
    untracked: string[]
  } | null
  gitBranches: {
    currentBranch: string
    localBranches: string[]
    remoteBranches: string[]
    defaultBranch: string
  } | null
}

export interface ApplicationAgentSummary {
  id: string
  profile: string
  name: string
  description: string | null
  avatar: string | null
  systemPromptEnabled: boolean
  model: string | null
  temperature: number | null
  invited: boolean
}

export interface ApplicationAgentWorkspaceSummary {
  total: number
  invitedCount: number
  namedRoles: string[]
  workflowMissingRoles: string[]
}

export interface ApplicationWorkflowSummary {
  enabled: boolean
  workflowName: string | null
  workflowPrompt: string | null
  mode: 'freeform' | 'stage-gated'
  stageCount: number
  graphNodeCount: number
  graphEdgeCount: number
  startNodeConfigured: boolean
  ownerRoleName: string | null
  ownerUserName: string | null
  artifactRootDir: string | null
  allowManualJump: boolean
}

export interface ApplicationWorkflowTemplateSummary {
  id: string
  name: string
  description: string | null
  agentCount: number
  tagCount: number
  sourceType: 'json' | 'package' | 'unknown'
  updatedAt: number | null
}

export interface ApplicationWorkflowRunSummary {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed'
  currentNodeTitle: string | null
  currentNodeRoleName: string | null
  currentNodeType: string | null
  startedAt: number | null
  updatedAt: number | null
  pendingApprovalCount: number
  completedNodeCount: number
  totalNodeRuns: number
}

export interface ApplicationWorkflowRoleAlignment {
  requiredRoles: string[]
  assignedRoles: string[]
  missingRoles: string[]
  unusedRoles: string[]
}

export interface ApplicationArtifactEntry {
  name: string
  path: string
  relativePath: string
  type: 'file' | 'directory'
  size: number
  updatedAt: number
  sourceRunNumber: number | null
}

export interface ApplicationArtifactPreview {
  rootDir: string
  relativePath: string
  fileName: string
  content: string
  language: string
  sourceRunNumber: number | null
}

export interface ApplicationArtifactsSummary {
  rootDir: string | null
  currentPath: string
  totalEntries: number
  fileCount: number
  directoryCount: number
  latestArtifactName: string | null
  registeredArtifactCount: number
  latestRegisteredArtifactTitle: string | null
  unlinkedFileCount: number
  workflowArtifactRootDir: string | null
  runStatus: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | null
  currentNodeTitle: string | null
}

export interface ApplicationArtifactsGitChange {
  relativePath: string
  displayPath: string
  kind: 'staged' | 'modified' | 'untracked' | 'mixed' | 'conflicted'
  staged: boolean
  modified: boolean
  untracked: boolean
  conflicted: boolean
}

export interface ApplicationArtifactsGitState {
  hasProject: boolean
  projectName: string | null
  projectLocalPath: string | null
  gitEnabled: boolean
  currentBranch: string | null
  aheadCount: number
  behindCount: number
  changeCount: number
  stagedCount: number
  modifiedCount: number
  untrackedCount: number
  changes: ApplicationArtifactsGitChange[]
  selectedPath: string | null
  selectedDisplayPath: string | null
  selectedKind: ApplicationArtifactsGitChange['kind'] | null
  selectedContent: string
  selectedContentMode: 'diff' | 'text' | 'binary' | 'empty'
  selectedTruncated: boolean
}

export interface ApplicationRunNode {
  id: string
  nodeId: string
  status: 'pending' | 'running' | 'waiting_approval' | 'completed' | 'rejected' | 'skipped'
  actorAgentName: string | null
  artifactIds: string[]
  startedAt: number | null
  completedAt: number | null
  updatedAt: number | null
}

export interface ApplicationRunArtifactOption {
  [key: string]: unknown
  label: string
  value: string
  type?: 'option'
  title: string | null
  createdAt: number | null
}

export interface ApplicationRunHistoryItem {
  id: string
  runNumber: number
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  currentNodeTitle: string | null
  kickoffSummary: string | null
  kickoffArtifactPath: string | null
  startedAt: number | null
  endedAt: number | null
  completedNodeCount: number
  rejectedNodeCount: number
  pendingApprovalCount: number
  totalNodeRuns: number
  latestActorAgentName: string | null
  latestActivityNodeTitle: string | null
  latestActivityStatus: 'pending' | 'running' | 'waiting_approval' | 'completed' | 'rejected' | 'skipped' | null
  latestActivityAt: number | null
  latestSystemNoticeExcerpt: string | null
  latestMessageExcerpt: string | null
  latestMessageSenderName: string | null
  latestApprovalActorName: string | null
  latestApprovalAction: 'approved' | 'rejected' | null
  latestApprovalStageTitle: string | null
  latestApprovalReason: string | null
  latestCompletedNodeTitle: string | null
  latestRejectedNodeTitle: string | null
  latestPendingApprovalNodeTitle: string | null
  latestArtifactPath: string | null
  latestArtifactTitle: string | null
  projectGitSnapshot: {
    projectId: string | null
    projectName: string | null
    gitEnabled: boolean
    branch: string | null
    repoUrl: string | null
    trackedAt: number | null
    aheadCount: number
    behindCount: number
    stagedCount: number
    modifiedCount: number
    untrackedCount: number
    changeCount: number
    touchedFileCount: number
    touchedFiles: string[]
    changes: Array<{
      relativePath: string
      displayPath: string
      kind: 'staged' | 'modified' | 'untracked' | 'mixed' | 'conflicted'
      previewContent: string
      previewMode: 'diff' | 'text' | 'binary' | 'empty'
      previewTruncated: boolean
    }>
  } | null
  updatedAt: number | null
}

export interface ApplicationRunSummary {
  runNumber: number | null
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed'
  currentNodeId: string | null
  currentNodeTitle: string | null
  currentNodeRoleName: string | null
  startActionKind: 'first_run' | 'next_run' | 'retry_failed_run'
  startActionLabel: string
  kickoffSummary: string | null
  kickoffArtifactPath: string | null
  approvalRequired: boolean
  approvalOwnerName: string | null
  canCurrentUserApprove: boolean
  canCurrentUserCancel: boolean
  canStartNewRun: boolean
  startedAt: number | null
  updatedAt: number | null
  pendingApprovalCount: number
  completedNodeCount: number
  rejectedNodeCount: number
  totalNodeRuns: number
}

export interface ApplicationCollaborationSummary {
  roomId: string
  roomName: string
  memberCount: number
  onlineAgentCount: number
  totalAgentCount: number
  activeNodeTitle: string | null
  activeRoleName: string | null
  runStatus: 'idle' | 'running' | 'paused' | 'completed' | 'failed'
  pendingApprovalCount: number
  artifactCount: number
  projectBound: boolean
}

export interface ApplicationCreateInput {
  scenario: ApplicationScenario
  name: string
  userName: string
  userDescription?: string
  inviteCode?: string
  compression?: {
    triggerTokens?: number
    maxHistoryTokens?: number
    tailMessageCount?: number
  }
  workflow?: {
    workflowName?: string
    workflowPrompt?: string
    workflowConfig?: Record<string, unknown>
  }
  agents?: Array<{
    profile: string
    name?: string
    description?: string
    avatar?: string
    systemPrompt?: string
    model?: string
    temperature?: number | null
    invited?: boolean
  }>
  existingProjectId?: string | null
  localProject?: {
    name?: string
    description?: string
    localPath: string
  } | null
}

export interface ApplicationCreateOptions {
  projects: Array<{
    id: string
    name: string
    description: string
  }>
  workflowTemplates: Array<{
    id: string
    name: string
    description?: string
    recommendedScenario?: ApplicationScenario | null
    defaultRoles: string[]
    defaultStages: string[]
    artifactDirectories: string[]
  }>
}
