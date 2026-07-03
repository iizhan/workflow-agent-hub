# Projects 与 Agents Workspace 实现设计

## 1. 本轮目的

这一轮只解决两个问题：

- `Projects Workspace` 具体怎么实现
- `Agents Workspace` 具体怎么实现

目标不是再补模块定义，而是把它们拆到足够指导开发的层级：

- 当前已有能力怎么复用
- 新增哪些前端适配层
- 页面结构怎么组织
- 关键交互如何串起来
- 第一版按什么顺序落地最稳

## 2. 当前系统的可复用基础

## 2.1 Projects 现有能力

当前系统已经具备完整的一组项目能力：

- `bindLocalProject()`
- `bindRoomProject()`
- `getRoomProject()`
- `getProjectDetail()`
- `listProjectFiles()`
- `getProjectFileContent()`
- `getProjectGitStatus()`
- `getProjectGitBranches()`
- `listProjects()`

这些能力已经被 `group-chat store` 封装为：

- `loadRoomProject()`
- `attachLocalProjectToRoom()`
- `attachExistingProjectToRoom()`
- `loadAvailableProjects()`
- `loadProjectFiles()`
- `openProjectFile()`
- `loadProjectGitStatus()`
- `loadProjectGitBranches()`

也就是说，`Projects Workspace` 不需要补底层接口，重点是把这些能力从 `GroupChatPanel` 的项目弹窗里提炼成应用内正式分区。

## 2.2 Agents 现有能力

当前系统已经具备完整的一组角色能力：

- `listAgents()`
- `addAgent()`
- `updateAgent()`
- `removeAgent()`
- `saveDefaultAgents()`
- `applyDefaultAgents()`

这些能力已经被 `group-chat store` 封装为：

- `loadAgents()`
- `addAgentToRoom()`
- `updateAgentInRoom()`
- `removeAgentFromRoom()`
- `saveCurrentAgentsAsDefault()`
- `applyRoomDefaultAgents()`

而且 `GroupChatPanel` 已经具备：

- Agent 表单状态
- 编辑/新增流程
- 模型来源选择
- 角色删除保护
- 与 workflow 角色对齐校验

所以 `Agents Workspace` 也不需要先补新后端，而应先把现有 Agent 流程正式化为应用内分区。

## 3. 实现原则

这两个分区的实现必须遵守三条原则：

- 不直接让 `ApplicationDetailView` 自己拼所有旧 API
- 不把 `group-chat store` 扩成新产品总 store
- 不复制一套和 `GroupChatPanel` 完全分叉的逻辑

正确方向应该是：

- `applications store` 继续持有应用级摘要和详情
- 新增轻量的 workspace adapter / composable
- 复用 `group-chat store` 的项目与 Agent 能力作为运行时来源

## 4. Projects Workspace 实现设计

## 4.1 页面职责

`Projects Workspace` 在 P1 首版只做一件事：

把“当前应用的真实项目上下文”正式呈现出来，并允许用户补绑或重绑项目。

首版不承担完整文件管理器职责。

## 4.2 推荐页面结构

建议在 `ApplicationDetailView` 的 `projects` 分区下拆成三个区块：

### 区块 1：Primary Project Summary

展示：

- 项目名称
- 项目描述
- source type
- 本地路径
- 当前分支
- Git 是否启用

### 区块 2：Project Readiness

展示：

- 是否已绑定主项目
- 是否检测到 Git
- 权限摘要：
  - `R`
  - `W`
  - `C`
  - `P`
- artifact root 是否可推断

### 区块 3：Project Actions

提供：

- 绑定已有项目
- 绑定本地项目
- 查看文件树
- 查看 Git 摘要

## 4.3 数据模型建议

当前不要直接把 `RoomProjectResult` 暴露给页面。

建议新增一个应用内项目视图模型：

```ts
interface ApplicationProjectSummary {
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
```

如果需要页面内文件预览，再补：

```ts
interface ApplicationProjectExplorerState {
  currentPath: string
  entries: ProjectTreeEntry[]
  currentFile: ProjectFileContentResult | null
  gitStatus: ProjectGitStatusResult | null
  gitBranches: ProjectGitBranchResult | null
}
```

## 4.4 推荐实现层次

建议新增一层轻量适配，而不是让页面直接碰 `group-chat store` 全部状态。

推荐新增：

- `components/workbench/projects/ApplicationProjectSummaryCard.vue`
- `components/workbench/projects/ApplicationProjectReadinessCard.vue`
- `components/workbench/projects/ApplicationProjectExplorerCard.vue`
- `composables/workbench/useApplicationProjectWorkspace.ts`

其中 `useApplicationProjectWorkspace.ts` 负责：

- 确保当前 room 已加载
- 调用 `loadRoomProject()`
- 暴露绑定方法
- 暴露文件浏览和 Git 摘要状态

## 4.5 关键交互流

### 场景 A：查看当前项目

1. 用户进入 `ApplicationDetailView?section=projects`
2. 页面根据 `applicationId` 确保 room 级项目数据已加载
3. 显示主项目摘要和 readiness

### 场景 B：绑定已有项目

1. 用户点击 `Bind Existing Project`
2. 拉取 `availableProjects`
3. 选择项目
4. 调用 `attachExistingProjectToRoom()`
5. 刷新 project summary
6. 提示回到 `Overview` 继续检查状态

### 场景 C：绑定本地项目

1. 用户点击 `Bind Local Project`
2. 输入路径、可选名称和描述
3. 调用 `attachLocalProjectToRoom()`
4. 刷新 project summary
5. 自动补拉 Git 状态与文件树

### 场景 D：查看文件与 Git 摘要

1. 用户点击 `Browse Files` 或 `View Git Summary`
2. 在当前页展开二级卡片或抽屉
3. 调用 `loadProjectFiles()` / `loadProjectGitStatus()` / `loadProjectGitBranches()`

## 4.6 P1 推荐 UI 策略

P1 不建议一上来做完整独立文件工作台。

更稳的方式是：

- 先摘要化
- 再做按需展开
- 先只读
- 先不引入复杂写操作

## 4.7 首版边界

P1 首版先不做：

- 多项目
- 项目排序
- 权限可视化编辑器
- 代码在线修改
- commit / push 操作入口

## 5. Agents Workspace 实现设计

## 5.1 页面职责

`Agents Workspace` 首版的目标不是做“智能体市场”，而是把当前应用内的角色结构讲清楚并可编辑。

它负责：

- 展示角色列表
- 展示每个角色的职责摘要
- 展示角色和 profile/model 的关系
- 提供增删改入口

## 5.2 推荐页面结构

建议在 `agents` 分区下拆成三个区块：

### 区块 1：Agent Overview

展示：

- 总角色数
- 已配置角色数
- 是否存在 workflow 缺失角色

### 区块 2：Agent Cards

每张卡片展示：

- 名称
- 描述
- profile
- model
- 自定义 prompt 是否启用
- invited / enabled 状态

### 区块 3：Agent Actions

提供：

- Add Agent
- Edit Agent
- Remove Agent
- Apply Default Agents
- Save Current Agents as Default

## 5.3 数据模型建议

当前不要把 `RoomAgent` 原始结构直接散落在页面里。

建议新增：

```ts
interface ApplicationAgentSummary {
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
```

再增加页面级聚合摘要：

```ts
interface ApplicationAgentWorkspaceSummary {
  total: number
  invitedCount: number
  namedRoles: string[]
  workflowMissingRoles: string[]
}
```

## 5.4 推荐实现层次

建议新增：

- `components/workbench/agents/ApplicationAgentOverviewCard.vue`
- `components/workbench/agents/ApplicationAgentCard.vue`
- `components/workbench/agents/ApplicationAgentFormModal.vue`
- `composables/workbench/useApplicationAgentWorkspace.ts`

其中 `useApplicationAgentWorkspace.ts` 负责：

- `loadAgents(roomId)`
- 组装 `ApplicationAgentSummary[]`
- 暴露新增、编辑、删除
- 复用 workflow 角色对齐校验

## 5.5 关键交互流

### 场景 A：查看角色结构

1. 用户进入 `agents`
2. 页面加载 `loadAgents(roomId)`
3. 展示 overview 和 agent cards
4. 如果 workflow 缺角色，显示 warning

### 场景 B：新增角色

1. 用户点击 `Add Agent`
2. 打开正式 modal
3. 复用当前 `GroupChatPanel` 中已有表单字段：
   - profile
   - name
   - description
   - avatar
   - systemPrompt
   - model
   - temperature
4. 调用 `addAgentToRoom()`
5. 刷新角色摘要

### 场景 C：编辑角色

1. 用户点击某张角色卡的 `Edit`
2. 回填现有角色表单
3. 调用 `updateAgentInRoom()`
4. 保留角色对 workflow 的破坏性校验

### 场景 D：删除角色

1. 用户点击 `Remove`
2. 先做 workflow 缺失角色检查
3. 若会造成新缺口，则阻止删除并提示
4. 否则调用 `removeAgentFromRoom()`

### 场景 E：默认角色能力

1. 用户点击 `Save Current as Default`
2. 调用 `saveCurrentAgentsAsDefault()`
3. 用户点击 `Apply Default Agents`
4. 调用 `applyRoomDefaultAgents()`

## 5.6 当前最值得复用的逻辑

当前 `GroupChatPanel` 里最值钱、最不该重写丢掉的是：

- agent form 状态字段
- 模型 provider 与 model 联动
- workflow 角色缺失校验
- 删除角色保护逻辑

P1 更合理的方式不是复制粘贴全部逻辑，而是逐步提取成：

- `useAgentFormState()`
- `useWorkflowRoleAlignment()`

如果这轮还不想抽这么细，也至少先把逻辑移到 `useApplicationAgentWorkspace.ts`。

## 5.7 首版边界

P1 首版先不做：

- Agent 分组
- Agent 排序拖拽
- 跨应用 Agent 模板库
- 高级权限矩阵

## 6. 推荐的数据装配方式

这两个分区都不建议直接在 `ApplicationDetailView.vue` 里堆逻辑。

推荐方式：

- `applications store` 继续管应用级摘要
- workspace composable 管分区运行时数据
- 组件层只消费整理后的 view model

推荐结构：

```ts
ApplicationDetailView
  -> useApplicationProjectWorkspace(applicationId)
  -> useApplicationAgentWorkspace(applicationId)
```

这样做的好处：

- 不污染 `applications store`
- 不把 `group-chat store` 强绑到页面结构
- 后续可逐步把逻辑从旧群聊区迁出来

## 7. 推荐实现顺序

建议实现顺序如下：

### 第一步：Projects Summary

先把 `projects` 分区从 placeholder 变成正式摘要页。

### 第二步：Agents Summary

再把 `agents` 分区从 placeholder 变成正式角色页。

### 第三步：Project bind actions

把已有绑定项目能力接进应用分区。

### 第四步：Agent add/edit/remove

把已有角色配置能力接进应用分区。

### 第五步：Project explorer & Git detail

最后补文件树和 Git 摘要展开区。

## 8. 文件级建议

如果直接开始实现，建议新增：

- `packages/client/src/components/workbench/projects/ApplicationProjectSummaryCard.vue`
- `packages/client/src/components/workbench/projects/ApplicationProjectReadinessCard.vue`
- `packages/client/src/components/workbench/projects/ApplicationProjectExplorerCard.vue`
- `packages/client/src/components/workbench/agents/ApplicationAgentOverviewCard.vue`
- `packages/client/src/components/workbench/agents/ApplicationAgentCard.vue`
- `packages/client/src/components/workbench/agents/ApplicationAgentFormModal.vue`
- `packages/client/src/composables/workbench/useApplicationProjectWorkspace.ts`
- `packages/client/src/composables/workbench/useApplicationAgentWorkspace.ts`

建议补充的类型：

- `ApplicationProjectSummary`
- `ApplicationProjectExplorerState`
- `ApplicationAgentSummary`
- `ApplicationAgentWorkspaceSummary`

## 9. 本轮结论

### 9.1 Projects 与 Agents 两个分区都不缺底层能力

真正缺的是：

- 正式页面承接
- 轻量适配层
- 与 `Overview` 的引导链路

### 9.2 最稳的实现方式不是重写旧逻辑

而是把 `GroupChatPanel` 里已经验证过的项目和角色操作流逐步提取出来。

### 9.3 这两个分区一旦落下去

应用详情就会从“壳 + 占位卡片”明显升级成“真正可推进工作的业务工作台”。
