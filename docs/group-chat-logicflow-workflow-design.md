# Group Chat Workflow Design with LogicFlow

## 目标

把当前群聊里的“工作流提示词 + 阶段列表”升级成可视化流程编排系统，满足下面几类能力：

- 用可视化方式配置群聊工作流，而不是只写文字描述
- 每个节点明确“下一节点是谁”
- 每个节点支持“自动流转 / 手动确认后流转”
- 每个节点支持“是否必须产出产物”
- 每个节点支持“产物目录、命名规则、格式要求”
- 每个节点支持“执行角色、提示词、模型覆盖、温度覆盖”
- 工作流既能作为系统预置工作组模板，也能作为普通房间自定义配置

## 选型

采用 `LogicFlow` 作为工作流画布与定义层。

原因：

- 它本身就是面向“业务自定义”的流程图编辑框架
- 支持节点/边/插件扩展，适合把“角色节点、审批节点、产物节点”做成业务节点
- 官方提供 `@logicflow/core` 与 `@logicflow/extension`
- 后续如果要做浏览器端执行或转换，也有扩展空间

建议接入包：

- `@logicflow/core`
- `@logicflow/extension`

第一阶段先不引入额外执行引擎，仍由当前 `group-chat` 服务负责运行时调度。

## 总体架构

分成三层：

1. 定义层
   - 用 LogicFlow 维护工作流图
   - 房间保存一份 workflow graph JSON
   - 模板库也保存同样结构

2. 运行时层
   - 群聊服务读取当前房间工作流定义
   - 维护“当前运行到哪个节点”
   - 负责决定谁该响应、是否自动流转、是否等待管理员确认

3. 产物层
   - 节点执行后可生成产物记录
   - 产物写入指定目录
   - 在群聊中可回看、确认、引用

## 工作流定义模型

当前 `workflowConfigJson` 不再只保存简单阶段数组，升级为：

```json
{
  "version": 2,
  "editor": {
    "type": "logicflow",
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  },
  "graph": {
    "nodes": [],
    "edges": []
  },
  "runtime": {
    "startNodeId": "",
    "ownerRoleName": "管理员",
    "ownerUserName": "",
    "artifactRootDir": ".hermes/group-chat-artifacts/${roomId}",
    "allowManualJump": false
  }
}
```

### 节点类型

建议首批支持 6 种节点：

1. `start`
   - 工作流入口

2. `role-task`
   - 某个 agent / 角色负责的执行节点
   - 例如：需求分析师、架构师、前端开发

3. `approval`
   - 管理员或主理人确认节点
   - 例如：需求评审通过、进入开发、允许发布

4. `artifact-review`
   - 对已有产物进行审阅或补充

5. `branch`
   - 条件分支
   - 例如：需求通过 / 驳回重做

6. `end`
   - 工作流完成

### 节点公共属性

```ts
type WorkflowNodeData = {
  id: string
  type: 'start' | 'role-task' | 'approval' | 'artifact-review' | 'branch' | 'end'
  name: string
  description?: string
  position?: { x: number; y: number }
  config: Record<string, any>
}
```

### `role-task` 节点属性

这是核心节点，建议支持：

```ts
type RoleTaskConfig = {
  roleName: string
  agentSelector: {
    mode: 'by-room-agent-name' | 'by-role-tag' | 'by-profile'
    value: string
  }
  triggerMode: 'auto' | 'manual'
  handoffMode: 'auto' | 'manual'
  requiresAdminConfirm: boolean
  requiresArtifact: boolean
  artifactSpec?: {
    enabled: boolean
    category: 'prd' | 'design' | 'frontend' | 'backend' | 'ops' | 'custom'
    dir: string
    fileNamePattern: string
    format: 'md' | 'json' | 'yaml' | 'txt'
    template?: string
    mustBeReferencedInReply?: boolean
  }
  promptOverride?: string
  systemPromptOverride?: string
  modelOverride?: string
  temperatureOverride?: number
  completionRule: {
    mode: 'reply-once' | 'artifact-created' | 'admin-confirmed'
  }
}
```

### `approval` 节点属性

```ts
type ApprovalConfig = {
  approverRoleName?: string
  approverUserName?: string
  actionLabelApprove?: string
  actionLabelReject?: string
  onRejectNodeId?: string
  onApproveNextMode: 'edge' | 'fixed-node'
  nextNodeId?: string
}
```

### 边属性

边不仅是连线，也定义流转规则：

```ts
type WorkflowEdgeData = {
  id: string
  sourceNodeId: string
  targetNodeId: string
  label?: string
  condition?: {
    type: 'always' | 'approve' | 'reject' | 'keyword' | 'artifact-exists'
    value?: string
  }
}
```

## 运行时设计

## 核心原则

- 群聊仍然是执行界面
- LogicFlow 只负责定义流程，不直接替代聊天
- 每个房间最多只有一个“活跃运行实例”
- 当前节点未完成前，后续节点不自动执行

## 运行状态模型

建议新增运行态：

```ts
type WorkflowRunState = {
  roomId: string
  workflowVersion: number
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed'
  currentNodeId: string | null
  startedAt: number
  updatedAt: number
}
```

每个节点还要有单独执行态：

```ts
type WorkflowNodeRunState = {
  roomId: string
  nodeId: string
  status: 'pending' | 'running' | 'waiting_approval' | 'completed' | 'rejected' | 'skipped'
  actorAgentId?: string
  actorName?: string
  startedAt?: number
  completedAt?: number
  artifactIds?: string[]
}
```

## 触发逻辑

### 自动触发

如果节点 `triggerMode = auto`：

- 运行时进入节点后
- 系统自动发一条系统消息
- 自动 `@` 对应 agent
- 把节点说明、产物要求、目录要求拼到本次调用上下文里

### 手动触发

如果节点 `triggerMode = manual`：

- 群里显示“待某角色开始”
- 只有管理员点击“开始节点”或手动 `@` 该角色后才执行

## 流转逻辑

### 自动流转

节点完成后如果 `handoffMode = auto`：

- 运行时根据边找到下一节点
- 若下一节点是 `role-task`，系统自动通知对应 agent
- 若下一节点是 `approval`，系统自动提示管理员确认

### 手动流转

节点完成后如果 `handoffMode = manual`：

- 群里显示“节点已完成，等待进入下一节点”
- 管理员点击“进入下一节点”后继续

## 产物设计

工作流的价值不只是聊天记录，而是“过程产物”。

建议新增产物记录模型：

```ts
type WorkflowArtifact = {
  id: string
  roomId: string
  nodeId: string
  nodeName: string
  roleName: string
  filePath: string
  relativePath: string
  format: 'md' | 'json' | 'yaml' | 'txt'
  title: string
  summary?: string
  createdBy: string
  createdAt: number
  confirmedBy?: string
  confirmedAt?: number
}
```

### 产物目录规则

默认根目录建议：

```text
.hermes/group-chat-artifacts/{roomId}/
```

节点目录支持模板变量：

```text
{artifactRootDir}/{index}-{slug(nodeName)}/
```

例如：

```text
.hermes/group-chat-artifacts/preset-opc-rd-team/01-requirement-analysis/prd.md
.hermes/group-chat-artifacts/preset-opc-rd-team/02-architecture-design/architecture.md
```

### 节点侧配置

每个节点可以配：

- 是否强制产物
- 产物目录
- 文件名规则
- 内容模板
- 是否要求 agent 回复里附带产物引用

### 产物创建方式

首版建议两种：

1. 自动生成
   - agent 回复后，服务端按模板生成文件

2. 手动绑定
   - 管理员在节点面板里选择已有文件作为产物

## 群聊运行时如何结合

当前 `AgentClients.processMentions()` 只做点名路由，后续应升级为：

1. 先看房间是否启用 LogicFlow 工作流
2. 找到当前运行节点
3. 判断本次消息是否允许触发当前节点
4. 组装“节点上下文”
   - 节点名称
   - 节点职责
   - 产物要求
   - 下一节点要求
   - 是否需要管理员确认
5. 只允许当前节点对应角色执行
6. 完成后更新运行态
7. 必要时自动推进到下一个节点

## 前端设计

## 页面结构

建议在当前群聊工作流配置弹窗里拆成 3 个区域：

1. 基础设置
   - 工作流名称
   - 工作流描述
   - 主理人角色/名称
   - 产物根目录

2. 流程画布
   - LogicFlow 编辑区
   - 左侧节点面板
   - 右侧属性面板

3. 运行预览
   - 当前节点
   - 下一节点
   - 流转方式
   - 产物预览

## LogicFlow 画布建议

### 左侧节点面板

- 开始
- 角色任务
- 审批
- 产物审阅
- 分支
- 结束

### 右侧属性面板

根据节点类型动态显示：

- 节点名称
- 负责角色
- 选择对应 room agent
- 触发方式
- 流转方式
- 是否要求产物
- 产物目录
- 文件模板
- 模型覆盖
- 温度覆盖
- 节点提示词

## 群聊主界面增强

群聊页顶部增加：

- 当前工作流名称
- 当前节点名称
- 当前责任角色
- 节点状态
- 快捷操作

建议按钮：

- `开始节点`
- `确认通过`
- `驳回重做`
- `进入下一节点`
- `查看产物`

## 数据库存储建议

当前 `gc_rooms.workflowConfigJson` 适合继续保留，但只存定义层不够。

建议新增 4 张表：

### `gc_workflow_defs`

- `roomId`
- `version`
- `name`
- `definitionJson`
- `updatedAt`

### `gc_workflow_runs`

- `id`
- `roomId`
- `workflowVersion`
- `status`
- `currentNodeId`
- `startedAt`
- `updatedAt`

### `gc_workflow_node_runs`

- `id`
- `runId`
- `nodeId`
- `status`
- `actorAgentId`
- `actorName`
- `artifactIdsJson`
- `startedAt`
- `completedAt`

### `gc_workflow_artifacts`

- `id`
- `roomId`
- `runId`
- `nodeId`
- `filePath`
- `relativePath`
- `format`
- `title`
- `summary`
- `createdBy`
- `createdAt`
- `confirmedBy`
- `confirmedAt`

## 系统预置“研发工作组”如何映射

`OPC 研发工作组` 不再只是阶段数组，而是默认内置一份 LogicFlow 图：

- `开始`
- `需求分析师`
- `管理员确认`
- `架构师`
- `管理员确认`
- `设计师`
- `管理员确认`
- `前端开发`
- `后端开发`
- `管理员确认`
- `运维`
- `发布确认`
- `结束`

每个角色节点默认带产物要求：

- 需求分析师：`prd.md`
- 架构师：`architecture.md`
- 设计师：`ui-spec.md`
- 前端开发：`frontend-plan.md`
- 后端开发：`backend-plan.md`
- 运维：`release-plan.md`

## 与现有功能的关系

### 保留

- 每个 agent 独立头像
- 每个 agent 独立 system prompt / model / temperature
- 房间默认 agent 组合
- 模板库

### 升级

- `workflowPrompt` 从“说明性文字”退化为可选全局补充说明
- `workflowConfigJson` 升级成 LogicFlow 定义与运行配置

## 实施顺序

### Phase 1

- 接入 `LogicFlow`
- 做工作流画布与节点属性面板
- 保存/加载 workflow graph JSON
- 模板库支持 graph JSON

### Phase 2

- 新增 workflow runtime tables
- 跑通“当前节点 -> 下一节点”
- 支持自动 / 手动流转
- 支持管理员确认节点

### Phase 3

- 支持产物目录与自动生成
- 群聊内查看产物
- 支持驳回重做

### Phase 4

- 支持分支条件
- 支持并行节点
- 支持节点级技能 / 工具 / 执行器扩展

## 实施建议

先不要把 LogicFlow 只当“画图插件”。

更合理的做法是：

- LogicFlow 负责“定义”
- 群聊服务负责“执行”
- 产物系统负责“沉淀”

这样后面你要扩展：

- 研发工作流
- 运营 SOP
- 客服处理流
- 售前方案流

都能复用同一套底层。
