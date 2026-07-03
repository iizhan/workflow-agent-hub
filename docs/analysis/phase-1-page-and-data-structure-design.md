# Phase 1 页面与数据结构草案

## 1. 本轮目的

这一轮继续承接 `Phase 1` 研发任务拆解，重点不是再列任务，而是把实现前最容易模糊的三层内容定清楚：

- `ApplicationSummary / ApplicationDetail / ApplicationStatus` 具体字段
- 应用列表页首版到底要展示哪些区块
- 应用详情页首版到底要展示哪些区块
- `Room -> Application` 的前端映射规则如何设计

这份文档的目标是让下一步真正开始写代码时，不再反复争论“字段要不要有”“列表到底放什么”“详情页第一版要不要全做”。

## 2. 当前数据现实约束

基于现有接口和存储结构，Phase 1 必须接受以下现实：

### 2.1 当前直接可用的房间字段有限

当前 `RoomInfo` 可稳定拿到的核心字段主要是：

- `id`
- `name`
- `inviteCode`
- `isActive`
- `presetKey`
- `workflowName`
- `workflowPrompt`
- `workflowConfigJson`
- `defaultAgentsJson`
- `totalTokens`

### 2.2 当前没有稳定的应用目标摘要字段

当前 `gc_rooms` / `RoomInfo` 中没有明确的：

- 应用目标摘要
- 场景类型
- 应用描述
- 应用标签

因此 Phase 1 不能假装这些字段已经存在。

正确做法是：

- 明确允许部分字段为空
- 明确哪些字段来自推导
- 明确哪些字段在 Phase 1 只是前端占位能力

### 2.3 当前项目、Agent、运行态是分散拉取的

应用所需的数据当前分散在几块：

- 房间基础信息：`RoomInfo`
- 项目绑定：`RoomProjectResult`
- Agent 列表：`RoomAgent[]`
- 工作流运行态：`WorkflowExecutionRunState`
- 工作流节点运行态：`WorkflowNodeRunState[]`
- 产物：`GroupChatArtifactEntry[]` 或更细的产物读取结果

这意味着 Phase 1 的 `Application` 模型必须是前端聚合视图模型，而不是直接照搬某一个后端返回。

## 3. Phase 1 的建模原则

Phase 1 的建模必须遵守以下原则：

- 只定义页面当前真的要消费的字段
- 区分“稳定原始字段”和“前端推导字段”
- 允许 `goalSummary / scenario` 在 Phase 1 中不完美
- 不把 `Room` 直接暴露成新产品主对象
- 详情模型优先服务 `Overview` 和 `Collaboration`

## 4. Application 基础类型建议

## 4.1 ApplicationScenario

建议定义：

```ts
type ApplicationScenario =
  | 'general'
  | 'code'
  | 'document'
  | 'ppt'
  | 'research'
```

设计理由：

- 当前真实数据里没有稳定场景字段
- Phase 1 必须允许一个保底值
- `general` 能承接尚未识别和无法推断的历史房间

## 4.2 ApplicationStatus

建议沿用前面状态设计，但在 Phase 1 首版实现中聚焦以下集合：

```ts
type ApplicationStatus =
  | 'draft'
  | 'setup_required'
  | 'ready'
  | 'running'
  | 'waiting_review'
  | 'failed'
  | 'completed'
```

说明：

- `empty` 更适合页面级空状态，不一定作为单个应用状态使用
- `blocked` 可以作为 Phase 1.5 或 Phase 2 再细化

## 4.3 ApplicationSectionKey

建议定义：

```ts
type ApplicationSectionKey =
  | 'overview'
  | 'projects'
  | 'agents'
  | 'workflow'
  | 'artifacts'
  | 'runs'
  | 'collaboration'
  | 'settings'
```

## 5. ApplicationSummary 草案

`ApplicationSummary` 用于应用列表页、首页最近应用卡片、全局跳转入口。

建议结构：

```ts
interface ApplicationSummary {
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
}
```

## 5.1 字段来源说明

### 直接映射

- `id <- room.id`
- `sourceRoomId <- room.id`
- `name <- room.name`
- `workflowName <- room.workflowName || null`
- `workflowEnabled <- !!room.workflowName || !!workflowConfig.stages?.length || !!workflowConfig.graph?.nodes?.length`

### 聚合来源

- `primaryProjectName <- roomProject.project.name`
- `primaryProjectId <- roomProject.project.id`
- `agentCount <- agents.length`
- `hasActiveRun <- workflowRun.status === 'running'`
- `hasPendingReview <- nodeRuns.some(status === 'waiting_approval')`

### 推导来源

- `scenario`
- `goalSummary`
- `status`
- `statusReason`
- `lastRunAt`
- `updatedAt`

## 5.2 goalSummary 的 Phase 1 规则

当前没有稳定持久层字段，因此建议按以下优先级推导：

1. `roomProject.project.description`
2. `room.workflowPrompt`
3. `room.workflowName`
4. `null`

注意：

- 不建议强行把无意义文案填满
- 如果没有足够信息，列表页应允许显示“待补充目标”

## 5.3 scenario 的 Phase 1 规则

当前没有稳定场景字段，建议按保守规则推导：

### 优先级 1：工作流或预设命名识别

若以下字段出现明显场景关键词，可推断：

- `presetKey`
- `workflowName`
- `workflowPrompt`

关键词示例：

- `code / dev / frontend / backend / qa` -> `code`
- `document / prd / report / article / manual` -> `document`
- `ppt / slides / deck / presentation` -> `ppt`
- `research / analysis / study / insight` -> `research`

### 优先级 2：项目信号识别

若已绑定项目：

- `gitEnabled === true`，优先推断为 `code`
- 项目名称或描述中出现 `ppt / slides / deck` 相关词，推断为 `ppt`
- 项目名称或描述中出现 `report / doc / research` 等词，再结合 workflow 词义判断

### 默认兜底

- 无法判断时返回 `general`

### scenarioSource

- 有明确推断依据时：`inferred`
- 完全无法判断时：`fallback`

## 6. ApplicationDetail 草案

`ApplicationDetail` 用于应用详情页头部、Overview、分区导航和跳转建议。

建议结构：

```ts
interface ApplicationDetail {
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
  nextAction: {
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
  } | null
}
```

## 6.1 为什么 Detail 不直接塞入完整消息和文件树

Phase 1 的 `ApplicationDetail` 不应把以下内容混进去：

- 群聊消息流
- 项目文件树内容
- Artifact 文件正文
- 实时 typing 状态

这些都属于：

- `Collaboration` 运行时层
- 或更细的分区内容层

如果现在就把它们塞进 `ApplicationDetail`，新模型很快又会膨胀成另一个 `GroupChatStore`。

## 7. ApplicationStatus 的推导规则

建议采用严格顺序，避免一个应用同时命中多个状态时前端表现混乱。

## 7.1 推导优先级

```text
failed
waiting_review
running
setup_required
draft
ready
completed
```

## 7.2 具体规则

### failed

条件：

- `workflowRun.status === 'failed'`

### waiting_review

条件：

- 任一 `nodeRuns.status === 'waiting_approval'`

### running

条件：

- `workflowRun.status === 'running' || workflowRun.status === 'paused'`

### setup_required

条件：

- 缺主项目
- 或 `agentCount === 0`
- 或没有可用 workflow

### draft

条件：

- 应用刚创建
- 但还没有形成可运行闭环
- 与 `setup_required` 很接近时，建议前端只在首轮创建后短暂使用；否则统一落入 `setup_required`

实现建议：

- Phase 1 可以把 `draft` 作为“新创建但尚未完成向导”的客户端临时状态
- 持久化加载时更建议聚合成 `setup_required`

### ready

条件：

- 有主项目
- 有至少 1 个 Agent
- 有工作流
- 当前没有运行、失败或待审批

### completed

条件：

- 最近一次运行完成
- 且当前没有待审批、失败或正在运行

说明：

- 若缺少可靠的完成时间与产物时间，`completed` 在 Phase 1 可以保守使用

## 7.3 statusReason 的设计

建议给状态补一句简短原因，方便列表页和 Overview 解释：

- `缺少主项目`
- `尚未配置 Agent`
- `尚未配置 Workflow`
- `当前运行等待审批`
- `最近一次运行失败`
- `当前有活跃运行`

## 8. 应用列表页首版结构草案

Phase 1 不建议一上来做复杂视图切换，首版只做一个清晰目录视图即可。

## 8.1 页面最小区块

建议首版只做 5 个区块：

1. 页面头部
2. 搜索与筛选条
3. 主应用列表
4. 空状态
5. 右上角创建入口

## 8.2 页面头部

内容：

- 标题：`Applications`
- 副标题：一句解释这个页的用途
- 主按钮：`Create Application`

## 8.3 搜索与筛选条

Phase 1 最小支持：

- 关键词搜索
- 场景筛选
- 状态筛选
- 最近更新时间排序

不建议 Phase 1 首版就做：

- 复杂 board 视图
- 多 owner 协作筛选
- 高级过滤组合器

## 8.4 应用卡片最小内容

每张卡片建议至少展示：

- 应用名
- 场景标签
- 状态标签
- goalSummary 或占位文案
- 主项目名
- Agent 数
- 下一步提示

建议卡片结构：

```text
App Name            [Scenario] [Status]
Goal summary or placeholder
Project: xxx
Agents: 3
Next: Configure workflow / Review artifact / Open run
```

## 8.5 空状态

当 `applications.length === 0`：

- 显示一句产品定位
- 显示创建应用主按钮
- 显示 4 个场景入口：
  - Code
  - Document
  - PPT
  - Research

## 9. 应用详情页首版结构草案

Phase 1 的详情页目标不是一次性承载所有深层内容，而是先做“应用主壳 + 下一步引导 + 协作入口”。

## 9.1 页面最小区块

建议首版只做 6 个区块：

1. 应用头部
2. 本地导航
3. Overview 主面板
4. Overview 辅助卡片
5. Collaboration 分区
6. 其他分区占位摘要

## 9.2 应用头部

建议内容：

- 应用名
- 场景标签
- 状态标签
- goalSummary
- 主操作：
  - `Start Run`
  - `Open Workflow`
  - `View Artifacts`

注意：

- 当状态不是 `ready` 时，`Start Run` 应变成解释性 CTA，而不是直接启动

## 9.3 本地导航

首版建议展示全部目标分区，但只把前两层做实：

- `Overview`
- `Projects`
- `Agents`
- `Workflow`
- `Artifacts`
- `Runs`
- `Collaboration`

Phase 1 实际做实程度：

- `Overview`：做实
- `Collaboration`：做实
- 其他：先做摘要与跳转 CTA

## 9.4 Overview 主面板

建议至少包含：

- 当前状态说明
- 下一步推荐动作
- 设置完成度 checklist

建议 checklist：

- 主项目已绑定
- 至少一个 Agent 已启用
- Workflow 已配置

## 9.5 Overview 辅助卡片

建议首版 4 张卡片即可：

- Project Summary
- Agent Summary
- Workflow Summary
- Run Summary

每张卡只回答两件事：

- 当前有无
- 下一步去哪改

## 9.6 Collaboration 分区

这里直接复用现有能力：

- `GroupChatView`
- 或直接挂 `GroupChatPanel`

设计要求：

- 它在视觉和结构上是应用详情里的一个分区
- 不是整个页面本身

## 9.7 其他分区的 Phase 1 表现

`Projects / Agents / Workflow / Artifacts / Runs` 在首版中建议先做：

- 摘要说明
- 当前状态
- 一个主 CTA

例如：

- `Projects`：显示当前主项目 + `Manage Project`
- `Agents`：显示角色数 + `Configure Agents`
- `Workflow`：显示当前流程名 + `Open Workflow`
- `Artifacts`：显示最近产物摘要 + `View Artifacts`
- `Runs`：显示最近运行状态 + `Open Runs`

## 10. Room -> Application 映射函数草案

建议在前端新增两个明确函数，而不是把映射散在页面里：

```ts
mapRoomAggregateToApplicationSummary(input): ApplicationSummary
mapRoomAggregateToApplicationDetail(input): ApplicationDetail
```

## 10.1 输入结构建议

建议先聚合成一个中间输入：

```ts
interface RoomAggregateInput {
  room: RoomInfo
  roomProject: RoomProjectResult | null
  agents: RoomAgent[]
  workflowRun: WorkflowExecutionRunState | null
  workflowNodeRuns: WorkflowNodeRunState[]
  currentNode: WorkflowExecutionNodeState | null
  artifactEntries?: GroupChatArtifactEntry[]
}
```

## 10.2 映射规则建议

### Summary 映射

- 优先轻量
- 不拉取大消息体
- 尽量避免依赖实时协作细节

### Detail 映射

- 为 `Overview` 和详情头部服务
- 不直接承载消息流
- 不直接承载项目文件树

## 10.3 一个重要实现建议

Phase 1 不建议列表页逐个进入房间详情拉所有重数据。

更合理的策略：

- 第一步先拿 `rooms`
- 第二步并发补拉少量必要聚合数据
- 第三步对失败的聚合容忍降级

例如：

- 拉不到项目时，项目字段显示为空
- 拉不到运行态时，状态保守降级

不要因为单个应用补拉失败就让整个列表页不可用

## 11. 本轮最终结论

Phase 1 的页面与数据结构设计，最关键的是“克制”：

- 字段模型只定义当前真的需要消费的字段
- 列表页只做目录，不做万能控制台
- 详情页先做 `Overview + Collaboration`
- `Room -> Application` 映射必须显式、集中、可替换

当前最重要的实现判断是：

- 允许 `scenario / goalSummary` 在 Phase 1 中通过推导或占位存在
- 不为了模型看起来完整，就强行引入当前后端并没有的稳定字段

只要守住这个边界，下一步就可以安心进入真正的界面与代码实现。
