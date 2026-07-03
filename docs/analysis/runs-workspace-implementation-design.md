# Runs Workspace 实现设计

## 1. 本轮目的

这一轮聚焦把 `Runs Workspace` 从 overview / workflow / collaboration 三处零散表达中，提升为应用详情页中的正式分区。

目标是先解决三个问题：

- 用户能否在应用层看清当前 run 状态
- 用户能否看见节点执行轨迹
- 用户能否在合适位置完成审批、驳回和取消

## 2. 当前可复用基础

当前系统已经具备完整运行态基础：

- workflow run state
- current node
- node run list
- 审批动作
- 驳回动作
- 取消流程动作

前端现有可复用对象包括：

- `group-chat store` 中的 workflow runtime state
- `submitWorkflowApproval()`
- `cancelWorkflowExecution()`
- `GroupChatPanel.vue` 中已有的审批 / 取消判断逻辑

所以首版 `Runs Workspace` 不需要补新的后端能力。

## 3. 页面职责

`Runs Workspace` 首版负责：

- 展示当前 run 状态
- 展示当前节点与当前角色
- 展示 node run 时间线
- 在待审批时提供 approve / reject
- 在允许时提供 cancel run

它暂时不负责：

- 多轮 run 历史存档中心
- run 对比
- 高级运行调试面板
- 跨应用运行目录

## 4. 首版推荐结构

首版页面拆成两层：

### 4.1 Run Summary

展示：

- run status
- current node
- current role
- started / updated time
- completed / rejected / pending 统计
- approval owner

并提供：

- refresh
- approve
- reject
- cancel

### 4.2 Run Timeline

展示：

- nodeId
- node status
- actor
- updated time
- artifact ids

## 5. 首版实现策略

与前面的分区一致，本轮采用：

- `applications store` 继续负责应用摘要
- `group-chat store` 继续负责 room 级运行态
- 新增 `useApplicationRunsWorkspace()` 作为应用分区适配层

## 6. 新增适配层职责

`useApplicationRunsWorkspace()` 负责：

- 确保 room ready
- 拉取 workflow run state
- 汇总 approval owner / permission 判断
- 将 node runs 映射为应用视图模型
- 处理 approve / reject / cancel

## 7. 本轮工程落点

本轮新增：

- `composables/workbench/useApplicationRunsWorkspace.ts`
- `components/workbench/runs/ApplicationRunSummaryCard.vue`
- `components/workbench/runs/ApplicationRunTimelineCard.vue`
- `components/workbench/runs/ApplicationRunsWorkspace.vue`

并更新：

- `types/workbench/application.ts`
- `views/workbench/ApplicationDetailView.vue`

## 8. 当前最重要的判断

`Runs Workspace` 的首版价值，不是马上做成完整的历史运行中心，而是先把“当前执行现场”从隐性的协作内部状态，提升为应用详情页里可见、可解释、可操作的正式业务分区。
