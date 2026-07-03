import { mkdir, readdir, readFile, writeFile, unlink, rm, access } from 'fs/promises'
import { existsSync } from 'fs'
import { join, extname } from 'path'
import { getWebUiPath } from '../../../utils/webui-home'

export interface GroupChatWorkflowAgentTemplate {
    profile: string
    name?: string
    description?: string
    avatar?: string
    systemPrompt?: string
    model?: string
    temperature?: number | null
    invited?: boolean
}

export interface GroupChatWorkflowTemplate {
    id: string
    name: string
    description?: string
    workflowPrompt: string
    workflowConfig?: {
        mode?: 'freeform' | 'stage-gated'
        ownerRoleName?: string
        ownerUserName?: string
        version?: number
        stages?: Array<{
            id: string
            name: string
            roleName: string
            assignedAgentId?: string
            deliverable: string
            needsAdminConfirm: boolean
            prompt?: string
        }>
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
    agents: GroupChatWorkflowAgentTemplate[]
    tags?: string[]
    updatedAt?: number
    readme?: string
    iconDataUrl?: string
    iconFileName?: string
    sourceType?: 'json' | 'package'
}

const TEMPLATE_DIR = getWebUiPath('group-chat-workflows')
const ICON_CANDIDATES = ['icon.svg', 'icon.png', 'icon.jpg', 'icon.jpeg', 'icon.webp']

function slugify(input: string): string {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || `workflow-${Date.now().toString(36)}`
}

function mimeFromExtension(fileName: string): string {
    const ext = extname(fileName).toLowerCase()
    if (ext === '.svg') return 'image/svg+xml'
    if (ext === '.png') return 'image/png'
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
    if (ext === '.webp') return 'image/webp'
    return 'application/octet-stream'
}

function sanitizeTemplate(
    input: Partial<GroupChatWorkflowTemplate>,
    fallbackId?: string,
    sourceType: 'json' | 'package' = 'json',
): GroupChatWorkflowTemplate {
    const id = slugify(input.id || fallbackId || input.name || '')
    const name = String(input.name || id).trim()
    const workflowPrompt = String(input.workflowPrompt || '').trim()
    const agents = Array.isArray(input.agents)
        ? input.agents
            .filter(agent => agent && typeof agent.profile === 'string' && agent.profile.trim())
            .map(agent => ({
                profile: agent.profile.trim(),
                name: agent.name?.trim() || undefined,
                description: agent.description?.trim() || undefined,
                avatar: agent.avatar?.trim() || undefined,
                systemPrompt: agent.systemPrompt?.trim() || undefined,
                model: agent.model?.trim() || undefined,
                temperature: typeof agent.temperature === 'number' ? agent.temperature : null,
                invited: agent.invited !== false,
            }))
        : []

    if (!name) throw new Error('Workflow template name is required')
    if (!workflowPrompt) throw new Error('Workflow template prompt is required')

    return {
        id,
        name,
        description: input.description?.trim() || '',
        workflowPrompt,
        workflowConfig: input.workflowConfig && typeof input.workflowConfig === 'object'
            ? {
                mode: input.workflowConfig.mode === 'stage-gated' ? 'stage-gated' : 'freeform',
                ownerRoleName: String(input.workflowConfig.ownerRoleName || '').trim() || undefined,
                ownerUserName: String(input.workflowConfig.ownerUserName || '').trim() || undefined,
                version: typeof input.workflowConfig.version === 'number' ? input.workflowConfig.version : undefined,
                stages: Array.isArray(input.workflowConfig.stages)
                    ? input.workflowConfig.stages
                        .filter(stage => stage && typeof stage.id === 'string')
                        .map(stage => ({
                            id: String(stage.id || '').trim(),
                            name: String(stage.name || '').trim(),
                            roleName: String(stage.roleName || '').trim(),
                            assignedAgentId: String(stage.assignedAgentId || '').trim() || undefined,
                            deliverable: String(stage.deliverable || '').trim(),
                            needsAdminConfirm: stage.needsAdminConfirm !== false,
                            prompt: String(stage.prompt || '').trim() || undefined,
                        }))
                    : [],
                editor: input.workflowConfig.editor && typeof input.workflowConfig.editor === 'object'
                    ? JSON.parse(JSON.stringify(input.workflowConfig.editor))
                    : undefined,
                graph: input.workflowConfig.graph && typeof input.workflowConfig.graph === 'object'
                    ? JSON.parse(JSON.stringify(input.workflowConfig.graph))
                    : undefined,
                runtime: input.workflowConfig.runtime && typeof input.workflowConfig.runtime === 'object'
                    ? JSON.parse(JSON.stringify(input.workflowConfig.runtime))
                    : undefined,
            }
            : undefined,
        agents,
        tags: Array.isArray(input.tags) ? input.tags.map(tag => String(tag).trim()).filter(Boolean) : [],
        updatedAt: typeof input.updatedAt === 'number' ? input.updatedAt : Date.now(),
        readme: input.readme?.trim() || '',
        iconDataUrl: input.iconDataUrl || '',
        iconFileName: input.iconFileName || '',
        sourceType,
    }
}

async function ensureTemplateDir(): Promise<void> {
    await mkdir(TEMPLATE_DIR, { recursive: true })
}

function jsonTemplatePath(id: string): string {
    return join(TEMPLATE_DIR, `${slugify(id)}.json`)
}

function packageDirPath(id: string): string {
    return join(TEMPLATE_DIR, slugify(id))
}

async function fileExists(path: string): Promise<boolean> {
    try {
        await access(path)
        return true
    } catch {
        return false
    }
}

async function readOptionalText(path: string): Promise<string> {
    try {
        return await readFile(path, 'utf-8')
    } catch {
        return ''
    }
}

async function readOptionalIcon(dirPath: string): Promise<{ iconDataUrl?: string; iconFileName?: string }> {
    for (const fileName of ICON_CANDIDATES) {
        const path = join(dirPath, fileName)
        try {
            const bytes = await readFile(path)
            return {
                iconDataUrl: `data:${mimeFromExtension(fileName)};base64,${bytes.toString('base64')}`,
                iconFileName: fileName,
            }
        } catch {
            // Continue searching other icon names.
        }
    }
    return {}
}

async function loadJsonTemplate(fileName: string): Promise<GroupChatWorkflowTemplate | null> {
    try {
        const raw = await readFile(join(TEMPLATE_DIR, fileName), 'utf-8')
        return sanitizeTemplate(JSON.parse(raw), fileName.replace(/\.json$/, ''), 'json')
    } catch {
        return null
    }
}

async function loadPackageTemplate(dirName: string): Promise<GroupChatWorkflowTemplate | null> {
    const dirPath = join(TEMPLATE_DIR, dirName)
    const workflowPath = join(dirPath, 'workflow.json')
    try {
        const raw = await readFile(workflowPath, 'utf-8')
        const readme = await readOptionalText(join(dirPath, 'README.md'))
        const icon = await readOptionalIcon(dirPath)
        return sanitizeTemplate({ ...JSON.parse(raw), readme, ...icon }, dirName, 'package')
    } catch {
        return null
    }
}

async function writePackageTemplate(template: GroupChatWorkflowTemplate): Promise<void> {
    const dirPath = packageDirPath(template.id)
    await mkdir(dirPath, { recursive: true })

    const persistable = {
        id: template.id,
        name: template.name,
        description: template.description,
        workflowPrompt: template.workflowPrompt,
        workflowConfig: template.workflowConfig,
        agents: template.agents,
        tags: template.tags,
        updatedAt: Date.now(),
    }

    await writeFile(join(dirPath, 'workflow.json'), JSON.stringify(persistable, null, 2) + '\n', 'utf-8')

    const readmePath = join(dirPath, 'README.md')
    if (template.readme) {
        await writeFile(readmePath, template.readme.trim() + '\n', 'utf-8')
    } else {
        await unlink(readmePath).catch(() => undefined)
    }

    for (const iconFileName of ICON_CANDIDATES) {
        await unlink(join(dirPath, iconFileName)).catch(() => undefined)
    }

    if (template.iconDataUrl) {
        const match = template.iconDataUrl.match(/^data:([^;]+);base64,(.+)$/)
        if (match) {
            const mime = match[1]
            const payload = match[2]
            const ext = mime === 'image/svg+xml' ? 'svg'
                : mime === 'image/png' ? 'png'
                    : mime === 'image/jpeg' ? 'jpg'
                        : mime === 'image/webp' ? 'webp'
                            : 'bin'
            const fileName = template.iconFileName || `icon.${ext}`
            await writeFile(join(dirPath, fileName), Buffer.from(payload, 'base64'))
        }
    }
}

async function migrateLegacyJsonTemplate(id: string, extras?: { readme?: string; iconSvg?: string }): Promise<void> {
    const jsonPath = jsonTemplatePath(id)
    if (!(await fileExists(jsonPath))) return

    const existingPackage = await loadPackageTemplate(id)
    if (existingPackage) {
        await unlink(jsonPath).catch(() => undefined)
        return
    }

    const legacy = await loadJsonTemplate(`${id}.json`)
    if (!legacy) return

    await writePackageTemplate(sanitizeTemplate({
        ...legacy,
        readme: extras?.readme || legacy.readme,
        iconDataUrl: extras?.iconSvg
            ? `data:image/svg+xml;base64,${Buffer.from(extras.iconSvg).toString('base64')}`
            : legacy.iconDataUrl,
        iconFileName: extras?.iconSvg ? 'icon.svg' : legacy.iconFileName,
    }, id, 'package'))

    await unlink(jsonPath).catch(() => undefined)
}

interface SeedWorkflowStageSpec {
    key: string
    name: string
    roleName: string
    deliverable: string
    prompt: string
    artifactDir: string
    artifactFileName: string
    artifactFormat?: string
}

function buildLinearStageGatedWorkflow(
    stages: SeedWorkflowStageSpec[],
    options?: {
        startText?: string
        endText?: string
        ownerRoleName?: string
        ownerUserName?: string
        artifactRootDir?: string
        allowManualJump?: boolean
        version?: number
    },
): NonNullable<GroupChatWorkflowTemplate['workflowConfig']> {
    const ownerRoleName = String(options?.ownerRoleName || '管理员').trim() || '管理员'
    const startText = String(options?.startText || '发起需求').trim() || '发起需求'
    const endText = String(options?.endText || '流程完成').trim() || '流程完成'
    const artifactRootDir = String(options?.artifactRootDir || '.hermes/group-chat-artifacts/${roomId}').trim()
        || '.hermes/group-chat-artifacts/${roomId}'
    const startNodeId = 'start-linear-flow'
    const endNodeId = 'end-linear-flow'

    const nodes: Array<Record<string, any>> = [
        { id: startNodeId, type: 'bpmn:startEvent', x: 120, y: 220, text: startText, properties: { workflowNodeType: 'start' } },
    ]
    const edges: Array<Record<string, any>> = []

    let currentX = 360
    stages.forEach((stage, index) => {
        const taskNodeId = `node-${stage.key}`
        const approvalNodeId = `approval-${stage.key}`
        const nextStage = stages[index + 1]

        nodes.push({
            id: taskNodeId,
            type: 'bpmn:userTask',
            x: currentX,
            y: 220,
            text: stage.name,
            properties: {
                workflowNodeType: 'role-task',
                roleName: stage.roleName,
                triggerMode: 'manual',
                handoffMode: 'manual',
                requiresAdminConfirm: false,
                requiresArtifact: true,
                artifactDir: stage.artifactDir,
                artifactFileName: stage.artifactFileName,
                artifactFormat: stage.artifactFormat || 'md',
            },
        })
        nodes.push({
            id: approvalNodeId,
            type: 'bpmn:exclusiveGateway',
            x: currentX + 210,
            y: 220,
            text: `${stage.roleName} 审批`,
            properties: {
                workflowNodeType: 'approval',
                roleName: ownerRoleName,
                branchConditionType: 'approve',
                branchConditionValue: stage.key,
            },
        })

        if (index === 0) {
            edges.push({ id: `edge-start-${stage.key}`, type: 'bpmn:sequenceFlow', sourceNodeId: startNodeId, targetNodeId: taskNodeId, properties: { branchConditionType: 'always' } })
        }
        edges.push({ id: `edge-${stage.key}-to-approval`, type: 'bpmn:sequenceFlow', sourceNodeId: taskNodeId, targetNodeId: approvalNodeId, properties: { branchConditionType: 'always' } })
        edges.push({ id: `edge-${stage.key}-reject`, type: 'bpmn:sequenceFlow', sourceNodeId: approvalNodeId, targetNodeId: taskNodeId, properties: { branchConditionType: 'reject' } })
        edges.push({
            id: `edge-${stage.key}-approve-${nextStage ? nextStage.key : 'end'}`,
            type: 'bpmn:sequenceFlow',
            sourceNodeId: approvalNodeId,
            targetNodeId: nextStage ? `node-${nextStage.key}` : endNodeId,
            properties: { branchConditionType: 'approve' },
        })

        currentX += 440
    })

    nodes.push({
        id: endNodeId,
        type: 'bpmn:endEvent',
        x: Math.max(3000, currentX),
        y: 220,
        text: endText,
        properties: { workflowNodeType: 'end' },
    })

    return {
        version: options?.version || 1,
        mode: 'stage-gated',
        ownerRoleName,
        ownerUserName: String(options?.ownerUserName || '').trim(),
        stages: stages.map(stage => ({
            id: stage.key,
            name: stage.name,
            roleName: stage.roleName,
            deliverable: stage.deliverable,
            needsAdminConfirm: true,
            prompt: stage.prompt,
        })),
        editor: { type: 'logicflow', viewport: { x: 0, y: 0, zoom: 0.8 } },
        graph: { nodes, edges },
        runtime: {
            startNodeId,
            artifactRootDir,
            allowManualJump: options?.allowManualJump === true,
        },
    }
}

async function seedPackageTemplateIfMissing(
    template: GroupChatWorkflowTemplate,
    extras: {
        readme: string
        iconSvg: string
    },
): Promise<void> {
    const workflowFile = join(packageDirPath(template.id), 'workflow.json')
    if (existsSync(workflowFile)) return

    await writePackageTemplate({
        ...template,
        readme: extras.readme,
        iconDataUrl: `data:image/svg+xml;base64,${Buffer.from(extras.iconSvg).toString('base64')}`,
        iconFileName: 'icon.svg',
    })
}

async function seedTemplates(): Promise<void> {
    await ensureTemplateDir()
    const productReviewDir = packageDirPath('product-review')
    const productReviewWorkflowFile = join(productReviewDir, 'workflow.json')
    const productReviewTemplate: GroupChatWorkflowTemplate = sanitizeTemplate({
        id: 'product-review',
        name: '产品评审工作流',
        description: '产品经理澄清需求，架构师评估风险，最终沉淀验收标准和行动项。',
        workflowPrompt: [
            '这是一个产品评审工作流。',
            '协作顺序：1. 产品经理先澄清用户价值、范围边界和验收标准；2. 架构师评估技术风险、依赖和落地方案；3. 最后输出明确行动项。',
            '所有 agent 都应避免泛泛而谈，必须给出可执行结论。',
        ].join('\n'),
        agents: [
            {
                profile: 'localhost-qwen3-4b',
                name: '产品经理',
                description: '负责需求澄清、用户价值和验收标准',
                avatar: 'product-manager',
                systemPrompt: '你是严谨的产品经理。优先澄清目标用户、业务价值、范围边界、验收标准和优先级。',
                temperature: 0.3,
                invited: true,
            },
            {
                profile: 'localhost-qwen3-4b',
                name: '架构师',
                description: '负责技术方案、系统边界和风险评估',
                avatar: 'architect',
                systemPrompt: '你是务实的架构师。关注系统边界、数据流、失败模式、依赖风险和可落地方案。',
                temperature: 0.2,
                invited: true,
            },
        ],
        tags: ['product', 'review'],
        updatedAt: Date.now(),
    }, 'product-review', 'package')

    const productReviewReadme = [
        '# 产品评审工作流',
        '',
        '- 产品经理先澄清需求范围和验收标准',
        '- 架构师再评估技术风险和实现路径',
        '- 最终沉淀行动项',
    ].join('\n')

    const productReviewIconSvg = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">',
        '<rect width="64" height="64" rx="18" fill="#0F766E"/>',
        '<path d="M18 22h28M18 32h20M18 42h14" stroke="#F8FAFC" stroke-width="5" stroke-linecap="round"/>',
        '<circle cx="48" cy="42" r="6" fill="#F59E0B"/>',
        '</svg>',
    ].join('')

    if (!existsSync(productReviewWorkflowFile)) {
        if (existsSync(jsonTemplatePath('product-review'))) {
            await migrateLegacyJsonTemplate('product-review', { readme: productReviewReadme, iconSvg: productReviewIconSvg })
        } else {
            await writePackageTemplate({
                ...productReviewTemplate,
                readme: productReviewReadme,
                iconDataUrl: `data:image/svg+xml;base64,${Buffer.from(productReviewIconSvg).toString('base64')}`,
                iconFileName: 'icon.svg',
            })
        }
    }

    const opcRdDir = packageDirPath('opc-rd-team')
    const opcRdWorkflowFile = join(opcRdDir, 'workflow.json')
    const opcRdTemplate: GroupChatWorkflowTemplate = sanitizeTemplate({
        id: 'opc-rd-team',
        name: 'OPC 研发协作流',
        description: '标准研发团队工作流，覆盖 PRD、UI、架构、前后端、QA 与主理人审批打回。',
        workflowPrompt: [
            '这是一个企业研发团队工作流，不是自由讨论群。',
            '标准流程为：发起需求 -> PM/需求分析师产出 PRD -> UI 设计 -> 架构技术选型与系统设计 -> 后端交付 -> 前端交付 -> QA 测试与测试报告。',
            '每个角色都必须产出明确交付物，并进入主理人审批节点。',
            '主理人审批通过后才允许流转到下一角色；如果审批驳回，必须根据驳回意见返回前一节点补充修正。',
        ].join('\n'),
        workflowConfig: {
            version: 3,
            mode: 'stage-gated',
            ownerRoleName: '管理员',
            ownerUserName: '',
            stages: [
                { id: 'prd', name: 'PM / 需求分析师产出 PRD', roleName: '需求分析师', deliverable: 'PRD、业务目标、范围边界、业务规则、验收标准', needsAdminConfirm: true, prompt: '围绕业务目标、用户价值、范围边界、核心流程、异常场景、业务规则和验收标准产出结构化 PRD。' },
                { id: 'ui-design', name: 'UI 产出设计方案', roleName: '设计师', deliverable: '页面结构、交互流程、关键状态、文案与设计约束', needsAdminConfirm: true, prompt: '基于已确认 PRD 产出 UI 设计方案，重点说明页面结构、流程和关键状态。' },
                { id: 'architecture', name: '架构产出技术选型与系统设计', roleName: '架构师', deliverable: '技术选型、系统设计、模块边界、数据流、风险与方案', needsAdminConfirm: true, prompt: '基于已确认 PRD 与 UI 方案输出系统设计与技术选型。' },
                { id: 'backend', name: '后端产出 API / 服务代码方案', roleName: '后端开发', deliverable: '接口契约、服务拆分、数据模型、核心服务实现与联调说明', needsAdminConfirm: true, prompt: '输出后端交付内容，包含 API 设计、数据模型、服务逻辑和联调约束。' },
                { id: 'frontend', name: '前端产出多端交付代码方案', roleName: '前端开发', deliverable: '页面实现、组件拆分、状态管理、多端适配、联调与验收说明', needsAdminConfirm: true, prompt: '输出前端交付内容，包含页面实现、组件拆分、多端适配和联调步骤。' },
                { id: 'qa', name: 'QA 产出测试与测试报告', roleName: 'QA', deliverable: '测试方案、测试用例、执行结果、风险评估与测试报告', needsAdminConfirm: true, prompt: '输出 QA 测试产物，包含测试用例、执行结果、遗留风险与测试报告。' },
            ],
            editor: { type: 'logicflow', viewport: { x: 0, y: 0, zoom: 0.8 } },
            graph: {
                nodes: [
                    { id: 'start-opc-rd', type: 'bpmn:startEvent', x: 120, y: 220, text: '发起需求', properties: { workflowNodeType: 'start' } },
                    { id: 'node-prd', type: 'bpmn:userTask', x: 360, y: 220, text: 'PM / 需求分析师产出 PRD', properties: { workflowNodeType: 'role-task', roleName: '需求分析师', triggerMode: 'manual', handoffMode: 'manual', requiresAdminConfirm: false, requiresArtifact: true, artifactDir: '01-prd', artifactFileName: 'prd.md', artifactFormat: 'md' } },
                    { id: 'approval-prd', type: 'bpmn:exclusiveGateway', x: 570, y: 220, text: 'PRD 审批', properties: { workflowNodeType: 'approval', roleName: '管理员', branchConditionType: 'approve', branchConditionValue: 'prd' } },
                    { id: 'node-ui-design', type: 'bpmn:userTask', x: 800, y: 220, text: 'UI 产出设计方案', properties: { workflowNodeType: 'role-task', roleName: '设计师', triggerMode: 'manual', handoffMode: 'manual', requiresAdminConfirm: false, requiresArtifact: true, artifactDir: '02-ui-design', artifactFileName: 'ui-design.md', artifactFormat: 'md' } },
                    { id: 'approval-ui-design', type: 'bpmn:exclusiveGateway', x: 1010, y: 220, text: 'UI 设计审批', properties: { workflowNodeType: 'approval', roleName: '管理员', branchConditionType: 'approve', branchConditionValue: 'ui-design' } },
                    { id: 'node-architecture', type: 'bpmn:userTask', x: 1240, y: 220, text: '架构产出技术选型与系统设计', properties: { workflowNodeType: 'role-task', roleName: '架构师', triggerMode: 'manual', handoffMode: 'manual', requiresAdminConfirm: false, requiresArtifact: true, artifactDir: '03-architecture', artifactFileName: 'system-design.md', artifactFormat: 'md' } },
                    { id: 'approval-architecture', type: 'bpmn:exclusiveGateway', x: 1450, y: 220, text: '架构审批', properties: { workflowNodeType: 'approval', roleName: '管理员', branchConditionType: 'approve', branchConditionValue: 'architecture' } },
                    { id: 'node-backend', type: 'bpmn:userTask', x: 1680, y: 220, text: '后端产出 API / 服务代码方案', properties: { workflowNodeType: 'role-task', roleName: '后端开发', triggerMode: 'manual', handoffMode: 'manual', requiresAdminConfirm: false, requiresArtifact: true, artifactDir: '04-backend', artifactFileName: 'backend-delivery.md', artifactFormat: 'md' } },
                    { id: 'approval-backend', type: 'bpmn:exclusiveGateway', x: 1890, y: 220, text: '后端审批', properties: { workflowNodeType: 'approval', roleName: '管理员', branchConditionType: 'approve', branchConditionValue: 'backend' } },
                    { id: 'node-frontend', type: 'bpmn:userTask', x: 2120, y: 220, text: '前端产出多端交付代码方案', properties: { workflowNodeType: 'role-task', roleName: '前端开发', triggerMode: 'manual', handoffMode: 'manual', requiresAdminConfirm: false, requiresArtifact: true, artifactDir: '05-frontend', artifactFileName: 'frontend-delivery.md', artifactFormat: 'md' } },
                    { id: 'approval-frontend', type: 'bpmn:exclusiveGateway', x: 2330, y: 220, text: '前端审批', properties: { workflowNodeType: 'approval', roleName: '管理员', branchConditionType: 'approve', branchConditionValue: 'frontend' } },
                    { id: 'node-qa', type: 'bpmn:userTask', x: 2560, y: 220, text: 'QA 产出测试与测试报告', properties: { workflowNodeType: 'role-task', roleName: 'QA', triggerMode: 'manual', handoffMode: 'manual', requiresAdminConfirm: false, requiresArtifact: true, artifactDir: '06-qa', artifactFileName: 'test-report.md', artifactFormat: 'md' } },
                    { id: 'approval-qa', type: 'bpmn:exclusiveGateway', x: 2770, y: 220, text: 'QA 审批', properties: { workflowNodeType: 'approval', roleName: '管理员', branchConditionType: 'approve', branchConditionValue: 'qa' } },
                    { id: 'end-opc-rd', type: 'bpmn:endEvent', x: 3000, y: 220, text: '研发流程完成', properties: { workflowNodeType: 'end' } },
                ],
                edges: [
                    { id: 'edge-start-prd', type: 'bpmn:sequenceFlow', sourceNodeId: 'start-opc-rd', targetNodeId: 'node-prd', properties: { branchConditionType: 'always' } },
                    { id: 'edge-prd-to-approval', type: 'bpmn:sequenceFlow', sourceNodeId: 'node-prd', targetNodeId: 'approval-prd', properties: { branchConditionType: 'always' } },
                    { id: 'edge-prd-reject', type: 'bpmn:sequenceFlow', sourceNodeId: 'approval-prd', targetNodeId: 'node-prd', properties: { branchConditionType: 'reject' } },
                    { id: 'edge-prd-approve-next', type: 'bpmn:sequenceFlow', sourceNodeId: 'approval-prd', targetNodeId: 'node-ui-design', properties: { branchConditionType: 'approve' } },
                    { id: 'edge-ui-to-approval', type: 'bpmn:sequenceFlow', sourceNodeId: 'node-ui-design', targetNodeId: 'approval-ui-design', properties: { branchConditionType: 'always' } },
                    { id: 'edge-ui-reject', type: 'bpmn:sequenceFlow', sourceNodeId: 'approval-ui-design', targetNodeId: 'node-ui-design', properties: { branchConditionType: 'reject' } },
                    { id: 'edge-ui-approve-next', type: 'bpmn:sequenceFlow', sourceNodeId: 'approval-ui-design', targetNodeId: 'node-architecture', properties: { branchConditionType: 'approve' } },
                    { id: 'edge-architecture-to-approval', type: 'bpmn:sequenceFlow', sourceNodeId: 'node-architecture', targetNodeId: 'approval-architecture', properties: { branchConditionType: 'always' } },
                    { id: 'edge-architecture-reject', type: 'bpmn:sequenceFlow', sourceNodeId: 'approval-architecture', targetNodeId: 'node-architecture', properties: { branchConditionType: 'reject' } },
                    { id: 'edge-architecture-approve-next', type: 'bpmn:sequenceFlow', sourceNodeId: 'approval-architecture', targetNodeId: 'node-backend', properties: { branchConditionType: 'approve' } },
                    { id: 'edge-backend-to-approval', type: 'bpmn:sequenceFlow', sourceNodeId: 'node-backend', targetNodeId: 'approval-backend', properties: { branchConditionType: 'always' } },
                    { id: 'edge-backend-reject', type: 'bpmn:sequenceFlow', sourceNodeId: 'approval-backend', targetNodeId: 'node-backend', properties: { branchConditionType: 'reject' } },
                    { id: 'edge-backend-approve-next', type: 'bpmn:sequenceFlow', sourceNodeId: 'approval-backend', targetNodeId: 'node-frontend', properties: { branchConditionType: 'approve' } },
                    { id: 'edge-frontend-to-approval', type: 'bpmn:sequenceFlow', sourceNodeId: 'node-frontend', targetNodeId: 'approval-frontend', properties: { branchConditionType: 'always' } },
                    { id: 'edge-frontend-reject', type: 'bpmn:sequenceFlow', sourceNodeId: 'approval-frontend', targetNodeId: 'node-frontend', properties: { branchConditionType: 'reject' } },
                    { id: 'edge-frontend-approve-next', type: 'bpmn:sequenceFlow', sourceNodeId: 'approval-frontend', targetNodeId: 'node-qa', properties: { branchConditionType: 'approve' } },
                    { id: 'edge-qa-to-approval', type: 'bpmn:sequenceFlow', sourceNodeId: 'node-qa', targetNodeId: 'approval-qa', properties: { branchConditionType: 'always' } },
                    { id: 'edge-qa-reject', type: 'bpmn:sequenceFlow', sourceNodeId: 'approval-qa', targetNodeId: 'node-qa', properties: { branchConditionType: 'reject' } },
                    { id: 'edge-qa-approve-end', type: 'bpmn:sequenceFlow', sourceNodeId: 'approval-qa', targetNodeId: 'end-opc-rd', properties: { branchConditionType: 'approve' } },
                ],
            },
            runtime: {
                startNodeId: 'start-opc-rd',
                artifactRootDir: '.hermes/group-chat-artifacts/${roomId}',
                allowManualJump: false,
            },
        },
        agents: [
            { profile: 'localhost-qwen3-4b', name: '需求分析师', description: '负责以 PM 视角产出 PRD、范围边界、业务规则和验收标准', avatar: 'requirements-analyst', systemPrompt: '你是企业研发团队里的需求分析师，同时承担 PM 职责。你的输出必须形成可评审的 PRD。', temperature: 0.2, invited: true },
            { profile: 'localhost-qwen3-4b', name: '设计师', description: '负责 UI 设计方案、界面结构、交互流程和状态设计', avatar: 'designer', systemPrompt: '你是企业产品设计师。仅在 PRD 确认后输出 UI 设计方案。', temperature: 0.3, invited: true },
            { profile: 'localhost-qwen3-4b', name: '架构师', description: '负责技术选型、系统设计、系统边界和技术风险', avatar: 'architect', systemPrompt: '你是企业架构师。只有在 PRD 与 UI 方案确认后才进入工作。', temperature: 0.2, invited: true },
            { profile: 'localhost-qwen3-4b', name: '后端开发', description: '负责接口设计、数据模型和后端实现方案', avatar: 'backend-engineer', systemPrompt: '你是企业后端开发。只在架构方案确认后输出 API 契约、数据模型与服务逻辑。', temperature: 0.2, invited: true },
            { profile: 'localhost-qwen3-4b', name: '前端开发', description: '负责多端页面交付、组件拆分和前端联调方案', avatar: 'frontend-engineer', systemPrompt: '你是企业前端开发。只在前置产物确认后输出前端交付方案。', temperature: 0.2, invited: true },
            { profile: 'localhost-qwen3-4b', name: 'QA', description: '负责测试方案、测试执行和测试报告', avatar: 'qa-engineer', systemPrompt: '你是企业 QA。只在前后端交付方案确认后输出测试方案与测试报告。', temperature: 0.2, invited: true },
        ],
        tags: ['rd', 'workflow', 'approval', 'prd', 'qa'],
        updatedAt: Date.now(),
    }, 'opc-rd-team', 'package')

    const opcRdReadme = [
        '# OPC 研发协作流',
        '',
        '- 发起需求',
        '- PM / 需求分析师产出 PRD',
        '- UI 产出设计方案',
        '- 架构产出技术选型与系统设计',
        '- 后端产出 API / 服务代码方案',
        '- 前端产出多端交付方案',
        '- QA 产出测试与测试报告',
        '- 每一步都需要主理人审批，可驳回回到上一角色修订',
    ].join('\n')

    const opcRdIconSvg = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">',
        '<rect width="64" height="64" rx="18" fill="#1D4ED8"/>',
        '<path d="M18 22h12v20H18z" fill="#DBEAFE"/>',
        '<path d="M34 16h12v32H34z" fill="#93C5FD"/>',
        '<path d="M50 28h-4v20h4" stroke="#F8FAFC" stroke-width="4" stroke-linecap="round"/>',
        '</svg>',
    ].join('')

    if (!existsSync(opcRdWorkflowFile)) {
        await writePackageTemplate({
            ...opcRdTemplate,
            readme: opcRdReadme,
            iconDataUrl: `data:image/svg+xml;base64,${Buffer.from(opcRdIconSvg).toString('base64')}`,
            iconFileName: 'icon.svg',
        })
    }

    const codeDeliveryTemplate: GroupChatWorkflowTemplate = sanitizeTemplate({
        id: 'code-delivery',
        name: '代码交付协作流',
        description: '围绕代码仓库推进方案、实现、验证与交付说明的标准流程。',
        workflowPrompt: [
            '这是一个面向代码交付的多角色执行流。',
            '流程应覆盖需求澄清、实现方案、代码交付、验证与交付说明。',
            '每一步都要输出可继续执行的结果，而不是停留在讨论层。',
        ].join('\n'),
        workflowConfig: buildLinearStageGatedWorkflow([
            {
                key: 'solution',
                name: '需求与实现方案',
                roleName: '需求分析师',
                deliverable: '目标澄清、范围边界、实现方案与验收标准',
                prompt: '先澄清目标、边界、风险和实现方向，形成可执行方案。',
                artifactDir: '01-solution',
                artifactFileName: 'solution.md',
            },
            {
                key: 'implementation',
                name: '代码实现与变更说明',
                roleName: '开发工程师',
                deliverable: '代码实现、关键变更点、接口/模块说明',
                prompt: '基于确认方案给出代码实现与变更说明，明确影响范围。',
                artifactDir: '02-implementation',
                artifactFileName: 'implementation.md',
            },
            {
                key: 'verification',
                name: '测试验证与风险清单',
                roleName: 'QA',
                deliverable: '验证结论、回归范围、遗留风险与建议',
                prompt: '围绕实现内容进行验证说明，沉淀测试结论和风险清单。',
                artifactDir: '03-verification',
                artifactFileName: 'verification.md',
            },
        ], {
            endText: '代码交付完成',
            version: 1,
        }),
        agents: [
            { profile: 'localhost-qwen3-4b', name: '需求分析师', description: '负责目标澄清、范围边界和实现方案', avatar: 'requirements-analyst', systemPrompt: '你是面向交付的需求分析师，必须把目标、范围、验收标准和实现方向讲清楚。', temperature: 0.2, invited: true },
            { profile: 'localhost-qwen3-4b', name: '开发工程师', description: '负责实现方案、代码交付和变更说明', avatar: 'backend-engineer', systemPrompt: '你是务实的开发工程师，输出必须面向真实代码交付。', temperature: 0.2, invited: true },
            { profile: 'localhost-qwen3-4b', name: 'QA', description: '负责验证结论、回归建议和风险清单', avatar: 'qa-engineer', systemPrompt: '你是交付导向的 QA，必须说明验证方式、结果和风险。', temperature: 0.2, invited: true },
        ],
        tags: ['code', 'engineering', 'delivery'],
        updatedAt: Date.now(),
    }, 'code-delivery', 'package')

    await seedPackageTemplateIfMissing(codeDeliveryTemplate, {
        readme: [
            '# 代码交付协作流',
            '',
            '- 需求与实现方案',
            '- 代码实现与变更说明',
            '- 测试验证与风险清单',
            '- 每一步都进入审批，可继续追溯本轮交付结论',
        ].join('\n'),
        iconSvg: [
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">',
            '<rect width="64" height="64" rx="18" fill="#0F172A"/>',
            '<path d="M20 24L12 32l8 8" stroke="#E2E8F0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
            '<path d="M44 24l8 8-8 8" stroke="#38BDF8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
            '<path d="M34 18L30 46" stroke="#94A3B8" stroke-width="4" stroke-linecap="round"/>',
            '</svg>',
        ].join(''),
    })

    const documentProductionTemplate: GroupChatWorkflowTemplate = sanitizeTemplate({
        id: 'document-production',
        name: '文档产出协作流',
        description: '围绕文档、方案、报告等内容生产的整理、撰写、审校流程。',
        workflowPrompt: [
            '这是一个面向文档交付的协作流。',
            '流程应覆盖资料整理、大纲设计、正文撰写和审校定稿。',
            '每一步都必须沉淀成可继续编辑的文档产物。',
        ].join('\n'),
        workflowConfig: buildLinearStageGatedWorkflow([
            {
                key: 'briefing',
                name: '资料整理与写作框架',
                roleName: '内容策划',
                deliverable: '目标说明、资料整理、章节框架与写作策略',
                prompt: '先整理输入资料，搭建清晰的大纲和写作策略。',
                artifactDir: '01-briefing',
                artifactFileName: 'briefing.md',
            },
            {
                key: 'draft',
                name: '正文初稿与结构完善',
                roleName: '撰稿人',
                deliverable: '文档初稿、章节内容、关键论述与待确认点',
                prompt: '基于框架撰写正文初稿，并标清关键论述和待补信息。',
                artifactDir: '02-draft',
                artifactFileName: 'draft.md',
            },
            {
                key: 'review',
                name: '审校定稿与发布建议',
                roleName: '审校人',
                deliverable: '修订意见、定稿建议、发布备注',
                prompt: '对初稿进行审校，给出修订建议和定稿说明。',
                artifactDir: '03-review',
                artifactFileName: 'review.md',
            },
        ], {
            endText: '文档交付完成',
            version: 1,
        }),
        agents: [
            { profile: 'localhost-qwen3-4b', name: '内容策划', description: '负责整理资料、梳理结构和定义写作框架', avatar: 'product-manager', systemPrompt: '你是严谨的内容策划，必须先把目标、受众和章节结构梳理清楚。', temperature: 0.3, invited: true },
            { profile: 'localhost-qwen3-4b', name: '撰稿人', description: '负责正文撰写、结构充实和内容展开', avatar: 'designer', systemPrompt: '你是专业撰稿人，输出要结构完整、表达清晰、可直接进入审校。', temperature: 0.3, invited: true },
            { profile: 'localhost-qwen3-4b', name: '审校人', description: '负责审校、修订建议和定稿说明', avatar: 'qa-engineer', systemPrompt: '你是严格的审校人，要优先发现逻辑、表达和一致性问题。', temperature: 0.2, invited: true },
        ],
        tags: ['document', 'writing', 'content'],
        updatedAt: Date.now(),
    }, 'document-production', 'package')

    await seedPackageTemplateIfMissing(documentProductionTemplate, {
        readme: [
            '# 文档产出协作流',
            '',
            '- 资料整理与写作框架',
            '- 正文初稿与结构完善',
            '- 审校定稿与发布建议',
            '- 适合方案文档、报告、说明文档等内容交付场景',
        ].join('\n'),
        iconSvg: [
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">',
            '<rect width="64" height="64" rx="18" fill="#7C3AED"/>',
            '<rect x="18" y="14" width="28" height="36" rx="4" fill="#F5F3FF"/>',
            '<path d="M24 24h16M24 32h16M24 40h10" stroke="#8B5CF6" stroke-width="4" stroke-linecap="round"/>',
            '</svg>',
        ].join(''),
    })

    const pptStorytellingTemplate: GroupChatWorkflowTemplate = sanitizeTemplate({
        id: 'ppt-storytelling',
        name: 'PPT 叙事交付流',
        description: '围绕演示文稿的叙事、页面结构与讲稿说明形成可交付 deck 方案。',
        workflowPrompt: [
            '这是一个面向 PPT 交付的协作流。',
            '流程应覆盖叙事结构、页面规划和讲稿/演示说明。',
            '每一步都要形成可继续加工的 deck 产物。',
        ].join('\n'),
        workflowConfig: buildLinearStageGatedWorkflow([
            {
                key: 'storyline',
                name: '叙事主线与章节结构',
                roleName: '叙事策划',
                deliverable: '演示目标、受众判断、章节主线与单页节奏',
                prompt: '先定义演示目标、受众和章节主线，明确 deck 结构。',
                artifactDir: '01-storyline',
                artifactFileName: 'storyline.md',
            },
            {
                key: 'slides',
                name: '页面设计与单页内容',
                roleName: '页面设计师',
                deliverable: '单页结构、标题建议、图文布局与内容草案',
                prompt: '把叙事主线展开为页面方案，说明每一页要表达什么。',
                artifactDir: '02-slides',
                artifactFileName: 'slides.md',
            },
            {
                key: 'speaker-notes',
                name: '讲稿与演示备注',
                roleName: '演示审阅人',
                deliverable: '讲稿摘要、演示备注、节奏与风险提醒',
                prompt: '从演示表达角度补讲稿说明、节奏建议和风险提醒。',
                artifactDir: '03-speaker-notes',
                artifactFileName: 'speaker-notes.md',
            },
        ], {
            endText: 'PPT 交付完成',
            version: 1,
        }),
        agents: [
            { profile: 'localhost-qwen3-4b', name: '叙事策划', description: '负责叙事主线、章节结构和演示逻辑', avatar: 'product-manager', systemPrompt: '你是擅长商业表达的叙事策划，先把 deck 主线和节奏定义清楚。', temperature: 0.3, invited: true },
            { profile: 'localhost-qwen3-4b', name: '页面设计师', description: '负责单页结构、内容组织和视觉表达建议', avatar: 'designer', systemPrompt: '你是面向演示场景的页面设计师，重点说明每页表达目标和版式结构。', temperature: 0.3, invited: true },
            { profile: 'localhost-qwen3-4b', name: '演示审阅人', description: '负责讲稿、演示节奏和现场表达建议', avatar: 'qa-engineer', systemPrompt: '你是严格的演示审阅人，关注讲稿节奏、现场表达和信息密度。', temperature: 0.2, invited: true },
        ],
        tags: ['ppt', 'slides', 'deck', 'presentation'],
        updatedAt: Date.now(),
    }, 'ppt-storytelling', 'package')

    await seedPackageTemplateIfMissing(pptStorytellingTemplate, {
        readme: [
            '# PPT 叙事交付流',
            '',
            '- 叙事主线与章节结构',
            '- 页面设计与单页内容',
            '- 讲稿与演示备注',
            '- 适合汇报 deck、方案演示、路演材料等场景',
        ].join('\n'),
        iconSvg: [
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">',
            '<rect width="64" height="64" rx="18" fill="#EA580C"/>',
            '<rect x="14" y="16" width="36" height="24" rx="4" fill="#FFF7ED"/>',
            '<path d="M20 24h12M20 30h18" stroke="#F97316" stroke-width="4" stroke-linecap="round"/>',
            '<path d="M32 40v10M24 50h16" stroke="#FED7AA" stroke-width="4" stroke-linecap="round"/>',
            '</svg>',
        ].join(''),
    })

    const researchAnalysisTemplate: GroupChatWorkflowTemplate = sanitizeTemplate({
        id: 'research-analysis',
        name: '研究分析协作流',
        description: '围绕问题定义、资料搜集、分析归纳和结论建议形成研究交付。',
        workflowPrompt: [
            '这是一个面向研究分析交付的协作流。',
            '流程应覆盖问题定义、资料搜集、分析归纳与结论建议。',
            '每一步都必须沉淀可复查的研究产物。',
        ].join('\n'),
        workflowConfig: buildLinearStageGatedWorkflow([
            {
                key: 'question',
                name: '问题定义与研究框架',
                roleName: '研究策划',
                deliverable: '研究问题、分析框架、假设与信息需求',
                prompt: '先明确研究问题、判断框架和需要补齐的信息。',
                artifactDir: '01-question',
                artifactFileName: 'question.md',
            },
            {
                key: 'evidence',
                name: '资料搜集与证据整理',
                roleName: '资料分析师',
                deliverable: '证据清单、资料摘要、信息来源与可信度说明',
                prompt: '围绕研究框架整理证据、来源和关键信息摘录。',
                artifactDir: '02-evidence',
                artifactFileName: 'evidence.md',
            },
            {
                key: 'insight',
                name: '结论归纳与行动建议',
                roleName: '洞察顾问',
                deliverable: '核心结论、关键洞察、行动建议与局限说明',
                prompt: '基于证据给出结论、洞察和可执行建议，并说明局限。',
                artifactDir: '03-insight',
                artifactFileName: 'insight.md',
            },
        ], {
            endText: '研究交付完成',
            version: 1,
        }),
        agents: [
            { profile: 'localhost-qwen3-4b', name: '研究策划', description: '负责定义研究问题、框架和分析边界', avatar: 'requirements-analyst', systemPrompt: '你是研究策划，先把问题定义、框架和分析边界讲清楚。', temperature: 0.2, invited: true },
            { profile: 'localhost-qwen3-4b', name: '资料分析师', description: '负责搜集资料、整理证据和建立事实基础', avatar: 'architect', systemPrompt: '你是资料分析师，必须按证据组织信息，并保留来源意识。', temperature: 0.2, invited: true },
            { profile: 'localhost-qwen3-4b', name: '洞察顾问', description: '负责归纳结论、提炼洞察和形成建议', avatar: 'product-manager', systemPrompt: '你是洞察顾问，要基于证据形成可执行判断，不空泛结论。', temperature: 0.2, invited: true },
        ],
        tags: ['research', 'analysis', 'insight'],
        updatedAt: Date.now(),
    }, 'research-analysis', 'package')

    await seedPackageTemplateIfMissing(researchAnalysisTemplate, {
        readme: [
            '# 研究分析协作流',
            '',
            '- 问题定义与研究框架',
            '- 资料搜集与证据整理',
            '- 结论归纳与行动建议',
            '- 适合竞品研究、行业分析、用户研究、问题诊断等场景',
        ].join('\n'),
        iconSvg: [
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">',
            '<rect width="64" height="64" rx="18" fill="#065F46"/>',
            '<circle cx="28" cy="28" r="12" fill="#D1FAE5"/>',
            '<path d="M37 37l11 11" stroke="#A7F3D0" stroke-width="5" stroke-linecap="round"/>',
            '<path d="M24 28h8M28 24v8" stroke="#047857" stroke-width="4" stroke-linecap="round"/>',
            '</svg>',
        ].join(''),
    })
}

export async function listWorkflowTemplates(): Promise<GroupChatWorkflowTemplate[]> {
    await seedTemplates()
    const entries = await readdir(TEMPLATE_DIR, { withFileTypes: true })
    const templates = new Map<string, GroupChatWorkflowTemplate>()

    for (const entry of entries) {
        const template = entry.isDirectory()
            ? await loadPackageTemplate(entry.name)
            : entry.isFile() && entry.name.endsWith('.json')
                ? await loadJsonTemplate(entry.name)
                : null
        if (!template) continue

        const existing = templates.get(template.id)
        if (!existing || template.sourceType === 'package' || (template.updatedAt || 0) > (existing.updatedAt || 0)) {
            templates.set(template.id, template)
        }
    }

    return Array.from(templates.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

export async function getWorkflowTemplate(id: string): Promise<GroupChatWorkflowTemplate | null> {
    await seedTemplates()
    const pkg = await loadPackageTemplate(slugify(id))
    if (pkg) return pkg

    const json = await loadJsonTemplate(`${slugify(id)}.json`)
    return json
}

export async function saveWorkflowTemplate(input: Partial<GroupChatWorkflowTemplate>): Promise<GroupChatWorkflowTemplate> {
    await ensureTemplateDir()
    const template = sanitizeTemplate(input, undefined, 'package')
    await writePackageTemplate(template)

    const jsonPath = jsonTemplatePath(template.id)
    if (await fileExists(jsonPath)) {
        await unlink(jsonPath).catch(() => undefined)
    }

    return (await getWorkflowTemplate(template.id)) || template
}

export async function exportWorkflowTemplate(id: string): Promise<GroupChatWorkflowTemplate | null> {
    return getWorkflowTemplate(id)
}

export async function deleteWorkflowTemplate(id: string): Promise<void> {
    const normalized = slugify(id)
    await rm(packageDirPath(normalized), { recursive: true, force: true }).catch(() => undefined)
    await unlink(jsonTemplatePath(normalized)).catch(() => undefined)
}
