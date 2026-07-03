export const BRAND_NAME = 'Workflow Agent Hub'
export const BRAND_FULL_NAME = 'Workflow Agent Hub'
export const BRAND_LOGO_PATH = '/opc-mark.svg'
export const BRAND_ASSISTANT_AVATAR_PATH = BRAND_LOGO_PATH

export const BRAND_TAGLINE = 'Agent Orchestration Workspace'
export const BRAND_PRODUCT_PROMISE = 'Coordinate agents, workflows, and applications in one place.'
export const BRAND_ASSISTANT_NAME = 'Workflow Agent Assistant'

export const BRAND_WORKBENCH_LABELS = {
  applicationsEyebrow: 'Applications Workspace',
  applicationsTitle: 'Build around real work, not isolated tools',
  applicationsSubtitle:
    'Start from a real application shell, then keep project context, workflow progress, outputs, and collaboration in one place.',
  createEyebrow: 'Create Workspace',
  createTitle: 'Launch a new application shell with the right starting context',
  createSubtitle:
    'Start with a scenario, optionally connect a project and workflow template, then reuse the existing collaboration shell as the first execution surface.',
  emptyEyebrow: 'Applications',
  emptyTitle: 'Build workspaces that move real projects forward.',
  emptyBody:
    'Start with a scenario, connect a real project, and keep all the agents, workflow context, and outputs in one place.',
} as const

export const BRAND_LEGACY_SURFACE_LABELS = {
  modelsEyebrow: 'Runtime Models',
  modelsTitle: 'Manage the model layer that powers execution',
  modelsSubtitle:
    'Review providers, defaults, and runtime model availability in one place before teams and workflows start running.',
  collaborationEyebrow: 'Team Collaboration',
  collaborationTitle: 'Continue execution with the shared collaboration workspace',
  collaborationSubtitle:
    'Use the collaboration runtime when you need live agent coordination, room context, and active execution flow.',
  filesEyebrow: 'Workspace Files',
  filesTitle: 'Inspect and edit project files from the runtime workspace',
  filesSubtitle:
    'Browse the working tree, preview content, and edit the active workspace without leaving the product shell.',
  gatewaysEyebrow: 'Execution Gateways',
  gatewaysTitle: 'Monitor the gateway layer behind models and active profiles',
  gatewaysSubtitle:
    'Track which profiles are online, how models map to execution endpoints, and how live rooms route through the runtime gateway layer.',
  settingsEyebrow: 'Workspace Settings',
  settingsTitle: 'Tune account, model, session, and runtime preferences',
  settingsSubtitle:
    'Keep the workspace healthy by aligning account access, display behavior, memory rules, and model defaults in one place.',
} as const

export const BRAND_LOGIN_COPY = {
  tokenHintCommand: 'npm run dev',
} as const

export const BRAND_CHAT_COPY = {
  emptyStateTitle: 'Ready for your first message',
  emptyStateBody:
    'Choose a model, type a prompt, or create a fresh session to start exploring.',
  historyEmptyState: 'Open a past session to review the conversation and outputs.',
} as const
