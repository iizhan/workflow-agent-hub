<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LogicFlow from '@logicflow/core'
import '@logicflow/core/dist/index.css'
import '@logicflow/extension/lib/index.css'
import { BpmnElement, Menu, MiniMap, SelectionSelect } from '@logicflow/extension'
import { NButton, NInput, NInputNumber, NSelect, NSwitch } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { RoomAgent, WorkflowRoomConfig } from '@/api/hermes/group-chat'

type WorkflowNodeType = 'start' | 'role-task' | 'approval' | 'artifact-review' | 'branch' | 'end'

type WorkflowNodeProperties = {
    workflowNodeType?: WorkflowNodeType
    roleName?: string
    assignedAgentId?: string
    triggerMode?: 'auto' | 'manual'
    handoffMode?: 'auto' | 'manual'
    requiresAdminConfirm?: boolean
    requiresArtifact?: boolean
    artifactDir?: string
    artifactFileName?: string
    artifactFormat?: 'md' | 'json' | 'yaml' | 'txt'
    promptOverride?: string
    systemPromptOverride?: string
    modelOverride?: string
    temperatureOverride?: number | null
    branchConditionType?: 'always' | 'approve' | 'reject' | 'keyword' | 'artifact-exists'
    branchConditionValue?: string
}

type WorkflowElementData = {
    id?: string
    type?: string
    text?: { value?: string } | string
    properties?: WorkflowNodeProperties
    sourceNodeId?: string
    targetNodeId?: string
}

type LogicFlowGraphPayload = {
    nodes: Array<Record<string, any>>
    edges: Array<Record<string, any>>
}

const props = defineProps<{
    modelValue: WorkflowRoomConfig
    agents?: RoomAgent[]
}>()

const emit = defineEmits<{
    'update:modelValue': [value: WorkflowRoomConfig]
}>()

const { t } = useI18n()
const canvasRef = ref<HTMLDivElement | null>(null)
const logicflowRef = ref<LogicFlow | null>(null)
const selectedElementId = ref<string | null>(null)
const selectedElementType = ref<'node' | 'edge' | null>(null)
const selectedElement = ref<WorkflowElementData | null>(null)
const isSyncingFromProps = ref(false)
const currentGraphSnapshot = ref('')

const nodeTypeOptions = computed(() => [
    { label: t('groupChat.workflowEditorNodeTypes.start'), value: 'bpmn:startEvent' },
    { label: t('groupChat.workflowEditorNodeTypes.roleTask'), value: 'bpmn:userTask' },
    { label: t('groupChat.workflowEditorNodeTypes.approval'), value: 'bpmn:exclusiveGateway' },
    { label: t('groupChat.workflowEditorNodeTypes.artifactReview'), value: 'bpmn:serviceTask' },
    { label: t('groupChat.workflowEditorNodeTypes.end'), value: 'bpmn:endEvent' },
])

const triggerModeOptions = computed(() => [
    { label: t('groupChat.workflowEditorTriggerModes.auto'), value: 'auto' },
    { label: t('groupChat.workflowEditorTriggerModes.manual'), value: 'manual' },
])

const artifactFormatOptions = computed(() => [
    { label: t('groupChat.workflowEditorArtifactFormats.markdown'), value: 'md' },
    { label: t('groupChat.workflowEditorArtifactFormats.json'), value: 'json' },
    { label: t('groupChat.workflowEditorArtifactFormats.yaml'), value: 'yaml' },
    { label: t('groupChat.workflowEditorArtifactFormats.text'), value: 'txt' },
])

const branchConditionTypeOptions = computed(() => [
    { label: t('groupChat.workflowEditorConditions.always'), value: 'always' },
    { label: t('groupChat.workflowEditorConditions.approve'), value: 'approve' },
    { label: t('groupChat.workflowEditorConditions.reject'), value: 'reject' },
    { label: t('groupChat.workflowEditorConditions.keyword'), value: 'keyword' },
    { label: t('groupChat.workflowEditorConditions.artifactExists'), value: 'artifact-exists' },
])

const normalizedConfig = computed<WorkflowRoomConfig>(() => ({
    version: props.modelValue?.version || 2,
    mode: props.modelValue?.mode || 'freeform',
    ownerRoleName: props.modelValue?.ownerRoleName || t('groupChat.workflowEditorDefaultOwnerRole'),
    ownerUserName: props.modelValue?.ownerUserName || '',
    stages: props.modelValue?.stages || [],
    editor: {
        type: 'logicflow',
        viewport: props.modelValue?.editor?.viewport || { x: 0, y: 0, zoom: 1 },
    },
    graph: {
        nodes: props.modelValue?.graph?.nodes || [],
        edges: props.modelValue?.graph?.edges || [],
    },
    runtime: {
        startNodeId: props.modelValue?.runtime?.startNodeId || '',
        artifactRootDir: props.modelValue?.runtime?.artifactRootDir || '.hermes/group-chat-artifacts/${roomId}',
        allowManualJump: !!props.modelValue?.runtime?.allowManualJump,
    },
}))

function mapBpmnTypeToWorkflowNodeType(type?: string): WorkflowNodeType {
    if (type === 'bpmn:startEvent') return 'start'
    if (type === 'bpmn:endEvent') return 'end'
    if (type === 'bpmn:userTask') return 'role-task'
    if (type === 'bpmn:exclusiveGateway') return 'approval'
    if (type === 'bpmn:serviceTask') return 'artifact-review'
    return 'branch'
}

function ensureNodeProperties(element: WorkflowElementData): WorkflowNodeProperties {
    return {
        workflowNodeType: mapBpmnTypeToWorkflowNodeType(element.type),
        triggerMode: 'manual',
        handoffMode: 'manual',
        requiresAdminConfirm: false,
        requiresArtifact: false,
        artifactDir: '',
        artifactFileName: '',
        artifactFormat: 'md',
        promptOverride: '',
        systemPromptOverride: '',
        modelOverride: '',
        temperatureOverride: null,
        branchConditionType: 'always',
        branchConditionValue: '',
        ...(element.properties || {}),
    }
}

function getElementTextValue(element: WorkflowElementData | null): string {
    if (!element?.text) return ''
    return typeof element.text === 'string' ? element.text : element.text.value || ''
}

function buildGraphData(config: WorkflowRoomConfig) {
    const nodes = config.graph?.nodes?.length
        ? config.graph.nodes
        : [
            { id: 'start-node', type: 'bpmn:startEvent', x: 120, y: 180, text: t('groupChat.workflowEditorNodeTypes.start'), properties: { workflowNodeType: 'start' } },
            { id: 'task-node', type: 'bpmn:userTask', x: 340, y: 180, text: t('groupChat.workflowEditorNodeTypes.roleTask'), properties: { workflowNodeType: 'role-task', roleName: t('groupChat.workflowEditorDefaultTaskRole'), triggerMode: 'manual', handoffMode: 'manual', requiresAdminConfirm: true, requiresArtifact: true, artifactFormat: 'md' } },
            { id: 'end-node', type: 'bpmn:endEvent', x: 580, y: 180, text: t('groupChat.workflowEditorNodeTypes.end'), properties: { workflowNodeType: 'end' } },
        ]
    const edges = config.graph?.edges?.length
        ? config.graph.edges
        : [
            { id: 'edge-start-task', type: 'bpmn:sequenceFlow', sourceNodeId: 'start-node', targetNodeId: 'task-node' },
            { id: 'edge-task-end', type: 'bpmn:sequenceFlow', sourceNodeId: 'task-node', targetNodeId: 'end-node' },
        ]
    return { nodes, edges } as LogicFlowGraphPayload
}

function createGraphSnapshot(graph?: { nodes?: Array<Record<string, any>>; edges?: Array<Record<string, any>> } | null): string {
    return JSON.stringify({
        nodes: graph?.nodes || [],
        edges: graph?.edges || [],
    })
}

function emitGraphChange() {
    const lf = logicflowRef.value
    if (!lf || isSyncingFromProps.value) return
    const graph = lf.getGraphData() as { nodes?: Array<Record<string, any>>; edges?: Array<Record<string, any>> }
    const nextSnapshot = createGraphSnapshot(graph)
    if (nextSnapshot === currentGraphSnapshot.value) return
    currentGraphSnapshot.value = nextSnapshot
    emit('update:modelValue', {
        ...normalizedConfig.value,
        graph: {
            nodes: graph.nodes || [],
            edges: graph.edges || [],
        },
    })
}

function syncSelectionFromGraph() {
    const lf = logicflowRef.value
    if (!lf || !selectedElementId.value) return
    selectedElement.value = (lf.getDataById(selectedElementId.value) as WorkflowElementData | undefined) || null
}

function selectElement(id: string, type: 'node' | 'edge') {
    selectedElementId.value = id
    selectedElementType.value = type
    syncSelectionFromGraph()
}

function clearSelection() {
    selectedElementId.value = null
    selectedElementType.value = null
    selectedElement.value = null
}

function initializeLogicFlow() {
    if (!canvasRef.value) return
    LogicFlow.use(BpmnElement)
    LogicFlow.use(Menu)
    LogicFlow.use(MiniMap)
    LogicFlow.use(SelectionSelect)
    const lf = new LogicFlow({
        container: canvasRef.value,
        grid: true,
        keyboard: { enabled: true },
        stopScrollGraph: false,
        stopMoveGraph: false,
    })
    logicflowRef.value = lf

    lf.on('node:click', ({ data }: any) => {
        const element = data as WorkflowElementData
        selectElement(String(element.id || ''), 'node')
    })
    lf.on('edge:click', ({ data }: any) => {
        const element = data as WorkflowElementData
        selectElement(String(element.id || ''), 'edge')
    })
    lf.on('blank:click', () => clearSelection())
    lf.on('graph:updated', () => {
        syncSelectionFromGraph()
        emitGraphChange()
    })
    const initialGraph = buildGraphData(normalizedConfig.value)
    currentGraphSnapshot.value = createGraphSnapshot(initialGraph)
    lf.render(initialGraph as any)
    nextTick(() => {
        emitGraphChange()
    })
}

function reloadGraphFromProps() {
    const lf = logicflowRef.value
    if (!lf) return
    isSyncingFromProps.value = true
    try {
        const nextGraph = buildGraphData(normalizedConfig.value)
        currentGraphSnapshot.value = createGraphSnapshot(nextGraph)
        lf.render(nextGraph as any)
        clearSelection()
    } finally {
        nextTick(() => {
            isSyncingFromProps.value = false
        })
    }
}

function addNode(type: string) {
    const lf = logicflowRef.value
    if (!lf) return
    const baseX = 180 + Math.round(Math.random() * 120)
    const baseY = 120 + Math.round(Math.random() * 220)
    const label = nodeTypeOptions.value.find(item => item.value === type)?.label || t('groupChat.workflowEditorDefaultNode')
    const node = lf.addNode({
        type,
        x: baseX,
        y: baseY,
        text: label,
        properties: {
            workflowNodeType: mapBpmnTypeToWorkflowNodeType(type),
            triggerMode: 'manual',
            handoffMode: 'manual',
            requiresAdminConfirm: false,
            requiresArtifact: type === 'bpmn:userTask',
            artifactFormat: 'md',
        },
    })
    if (node?.id) {
        lf.selectElementById(node.id)
        selectElement(node.id, 'node')
    }
}

function deleteSelectedElement() {
    const lf = logicflowRef.value
    if (!lf || !selectedElementId.value) return
    lf.deleteElement(selectedElementId.value)
    clearSelection()
    emitGraphChange()
}

function updateSelectedText(value: string) {
    const lf = logicflowRef.value
    if (!lf || !selectedElementId.value) return
    lf.updateText(selectedElementId.value, value)
    syncSelectionFromGraph()
}

function updateSelectedProperties(patch: Partial<WorkflowNodeProperties>) {
    const lf = logicflowRef.value
    if (!lf || !selectedElementId.value || selectedElementType.value !== 'node') return
    const nextProperties = {
        ...ensureNodeProperties(selectedElement.value || {}),
        ...patch,
    }
    lf.setProperties(selectedElementId.value, nextProperties)
    syncSelectionFromGraph()
    emitGraphChange()
}

function updateSelectedEdgeProperties(patch: Partial<WorkflowNodeProperties>) {
    const lf = logicflowRef.value
    if (!lf || !selectedElementId.value || selectedElementType.value !== 'edge') return
    const nextProperties = {
        ...ensureNodeProperties(selectedElement.value || {}),
        ...patch,
    }
    lf.setProperties(selectedElementId.value, nextProperties)
    syncSelectionFromGraph()
    emitGraphChange()
}

const selectedNodeProperties = computed(() => ensureNodeProperties(selectedElement.value || {}))
const agentOptions = computed(() =>
    (props.agents || []).map(agent => ({
        label: agent.name || agent.profile,
        value: agent.id,
    })),
)

function updateSelectedAgent(agentId: string | null) {
    const agent = (props.agents || []).find(item => item.id === agentId)
    updateSelectedProperties({
        assignedAgentId: agentId || '',
        roleName: agent ? (agent.name || agent.profile) : '',
    })
}

watch(() => props.modelValue, () => {
    if (!logicflowRef.value || isSyncingFromProps.value) return
    const nextSnapshot = createGraphSnapshot(normalizedConfig.value.graph)
    if (nextSnapshot === currentGraphSnapshot.value) return
    reloadGraphFromProps()
}, { deep: true })

onMounted(() => {
    initializeLogicFlow()
})

onBeforeUnmount(() => {
    logicflowRef.value?.destroy()
    logicflowRef.value = null
})
</script>

<template>
    <div class="workflow-editor">
        <div class="workflow-editor__sidebar">
            <div class="workflow-editor__section">
                <div class="workflow-editor__section-title">{{ t('groupChat.workflowEditorNodePanel') }}</div>
                <div class="workflow-editor__tool-list">
                    <NButton v-for="item in nodeTypeOptions" :key="item.value" block secondary @click="addNode(item.value)">
                        {{ item.label }}
                    </NButton>
                </div>
            </div>
            <div class="workflow-editor__section">
                <div class="workflow-editor__section-title">{{ t('groupChat.workflowEditorRuntimeSettings') }}</div>
                <label class="workflow-editor__label">{{ t('groupChat.artifactRootDir') }}</label>
                <NInput
                    :value="normalizedConfig.runtime?.artifactRootDir || ''"
                    :placeholder="t('groupChat.workflowEditorArtifactRootPlaceholder')"
                    @update:value="emit('update:modelValue', { ...normalizedConfig, runtime: { ...normalizedConfig.runtime, artifactRootDir: $event } })"
                />
                <div class="workflow-editor__switch-row">
                    <span>{{ t('groupChat.workflowEditorAllowManualJump') }}</span>
                    <NSwitch
                        :value="!!normalizedConfig.runtime?.allowManualJump"
                        @update:value="emit('update:modelValue', { ...normalizedConfig, runtime: { ...normalizedConfig.runtime, allowManualJump: $event } })"
                    />
                </div>
            </div>
        </div>

        <div class="workflow-editor__canvas-wrap">
            <div ref="canvasRef" class="workflow-editor__canvas" />
        </div>

        <div class="workflow-editor__inspector">
            <div class="workflow-editor__section">
                <div class="workflow-editor__section-title">{{ t('groupChat.workflowEditorProperties') }}</div>
                <div v-if="!selectedElementId" class="workflow-editor__empty">
                    {{ t('groupChat.workflowEditorEmpty') }}
                </div>
                <template v-else>
                    <label class="workflow-editor__label">{{ t('groupChat.workflowEditorName') }}</label>
                    <NInput :value="getElementTextValue(selectedElement)" @update:value="updateSelectedText" />

                    <template v-if="selectedElementType === 'node'">
                        <label class="workflow-editor__label">{{ t('groupChat.workflowEditorNodeType') }}</label>
                        <NInput :value="selectedNodeProperties.workflowNodeType" disabled />

                        <template v-if="selectedNodeProperties.workflowNodeType === 'role-task'">
                            <label class="workflow-editor__label">{{ t('groupChat.workflowEditorAssignedAgent') }}</label>
                            <NSelect
                                :options="agentOptions"
                                :value="selectedNodeProperties.assignedAgentId || null"
                                :placeholder="t('groupChat.workflowStageAgentPlaceholder')"
                                clearable
                                filterable
                                @update:value="updateSelectedAgent"
                            />
                            <p class="workflow-editor__hint">{{ t('groupChat.workflowEditorAssignedAgentHint') }}</p>

                            <label class="workflow-editor__label">{{ t('groupChat.workflowEditorTriggerMode') }}</label>
                            <NSelect :options="triggerModeOptions" :value="selectedNodeProperties.triggerMode" @update:value="updateSelectedProperties({ triggerMode: $event as 'auto' | 'manual' })" />

                            <label class="workflow-editor__label">{{ t('groupChat.workflowEditorHandoffMode') }}</label>
                            <NSelect :options="triggerModeOptions" :value="selectedNodeProperties.handoffMode" @update:value="updateSelectedProperties({ handoffMode: $event as 'auto' | 'manual' })" />

                            <div class="workflow-editor__switch-row">
                                <span>{{ t('groupChat.workflowEditorRequiresAdminConfirm') }}</span>
                                <NSwitch :value="!!selectedNodeProperties.requiresAdminConfirm" @update:value="updateSelectedProperties({ requiresAdminConfirm: $event })" />
                            </div>
                            <div class="workflow-editor__switch-row">
                                <span>{{ t('groupChat.workflowEditorRequiresArtifact') }}</span>
                                <NSwitch :value="!!selectedNodeProperties.requiresArtifact" @update:value="updateSelectedProperties({ requiresArtifact: $event })" />
                            </div>

                            <template v-if="selectedNodeProperties.requiresArtifact">
                                <label class="workflow-editor__label">{{ t('groupChat.workflowEditorArtifactDirectory') }}</label>
                                <NInput :value="selectedNodeProperties.artifactDir || ''" @update:value="updateSelectedProperties({ artifactDir: $event })" />
                                <label class="workflow-editor__label">{{ t('groupChat.workflowEditorArtifactFileName') }}</label>
                                <NInput :value="selectedNodeProperties.artifactFileName || ''" @update:value="updateSelectedProperties({ artifactFileName: $event })" />
                                <label class="workflow-editor__label">{{ t('groupChat.workflowEditorArtifactFormat') }}</label>
                                <NSelect :options="artifactFormatOptions" :value="selectedNodeProperties.artifactFormat" @update:value="updateSelectedProperties({ artifactFormat: $event as 'md' | 'json' | 'yaml' | 'txt' })" />
                            </template>

                            <label class="workflow-editor__label">{{ t('groupChat.workflowEditorNodePrompt') }}</label>
                            <NInput type="textarea" :rows="3" :value="selectedNodeProperties.promptOverride || ''" @update:value="updateSelectedProperties({ promptOverride: $event })" />
                            <label class="workflow-editor__label">{{ t('groupChat.workflowEditorSystemPromptOverride') }}</label>
                            <NInput type="textarea" :rows="3" :value="selectedNodeProperties.systemPromptOverride || ''" @update:value="updateSelectedProperties({ systemPromptOverride: $event })" />
                            <label class="workflow-editor__label">{{ t('groupChat.workflowEditorModelOverride') }}</label>
                            <NInput :value="selectedNodeProperties.modelOverride || ''" @update:value="updateSelectedProperties({ modelOverride: $event })" />
                            <label class="workflow-editor__label">{{ t('groupChat.workflowEditorTemperatureOverride') }}</label>
                            <NInputNumber
                                :value="selectedNodeProperties.temperatureOverride ?? null"
                                :min="0"
                                :max="2"
                                :step="0.1"
                                clearable
                                style="width: 100%"
                                @update:value="updateSelectedProperties({ temperatureOverride: $event as number | null })"
                            />
                        </template>

                        <template v-else-if="selectedNodeProperties.workflowNodeType === 'approval' || selectedNodeProperties.workflowNodeType === 'branch'">
                            <label class="workflow-editor__label">{{ t('groupChat.workflowEditorConditionType') }}</label>
                            <NSelect :options="branchConditionTypeOptions" :value="selectedNodeProperties.branchConditionType" @update:value="updateSelectedProperties({ branchConditionType: $event as any })" />
                            <label class="workflow-editor__label">{{ t('groupChat.workflowEditorConditionValue') }}</label>
                            <NInput :value="selectedNodeProperties.branchConditionValue || ''" @update:value="updateSelectedProperties({ branchConditionValue: $event })" />
                        </template>
                    </template>

                    <template v-else-if="selectedElementType === 'edge'">
                        <label class="workflow-editor__label">{{ t('groupChat.workflowEditorEdgeCondition') }}</label>
                        <NSelect :options="branchConditionTypeOptions" :value="selectedNodeProperties.branchConditionType" @update:value="updateSelectedEdgeProperties({ branchConditionType: $event as any })" />
                        <label class="workflow-editor__label">{{ t('groupChat.workflowEditorConditionValue') }}</label>
                        <NInput :value="selectedNodeProperties.branchConditionValue || ''" @update:value="updateSelectedEdgeProperties({ branchConditionValue: $event })" />
                    </template>

                    <div class="workflow-editor__danger">
                        <NButton type="error" secondary block @click="deleteSelectedElement">{{ t('groupChat.workflowEditorDeleteCurrentElement') }}</NButton>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.workflow-editor {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr) 320px;
    gap: 12px;
    min-height: 520px;
}

.workflow-editor__sidebar,
.workflow-editor__inspector {
    border: 1px solid $border-color;
    border-radius: $radius-md;
    background: rgba(var(--accent-primary-rgb), 0.03);
    padding: 12px;
    overflow: auto;
}

.workflow-editor__canvas-wrap {
    border: 1px solid $border-color;
    border-radius: $radius-md;
    overflow: hidden;
    min-width: 0;
    background: $bg-card;
}

.workflow-editor__canvas {
    height: 520px;
    width: 100%;
}

.workflow-editor__section + .workflow-editor__section {
    margin-top: 16px;
}

.workflow-editor__section-title {
    font-size: 13px;
    font-weight: 600;
    color: $text-primary;
    margin-bottom: 10px;
}

.workflow-editor__tool-list {
    display: grid;
    gap: 8px;
}

.workflow-editor__label {
    display: block;
    font-size: 12px;
    color: $text-secondary;
    margin: 12px 0 6px;
}

.workflow-editor__hint {
    margin: 6px 0 0;
    color: $text-muted;
    font-size: 11px;
    line-height: 1.5;
}

.workflow-editor__switch-row {
    margin-top: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
    color: $text-secondary;
}

.workflow-editor__empty {
    font-size: 12px;
    color: $text-muted;
    padding: 12px;
    border: 1px dashed $border-color;
    border-radius: $radius-sm;
}

.workflow-editor__danger {
    margin-top: 16px;
}

@media (max-width: 1200px) {
    .workflow-editor {
        grid-template-columns: 1fr;
    }

    .workflow-editor__canvas {
        height: 420px;
    }
}
</style>
