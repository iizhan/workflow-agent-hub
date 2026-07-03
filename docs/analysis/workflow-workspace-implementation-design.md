# Workflow Workspace 实现设计

## 1. 本轮目的

这一轮聚焦把 `Workflow Workspace` 从 `GroupChatPanel` 内部能力提升为应用详情页中的正式分区。

目标不是重写协作核心，而是回答三个问题：

- 当前系统里哪些工作流能力已经可以直接复用
- 应用级工作流分区第一版应该承接哪些职责
- 怎样在不破坏现有房间运行时的前提下，把工作流配置正式化

## 2. 当前可复用基础

当前系统已经具备比较完整的工作流能力链路：

- 房间工作流配置读取与保存
- 工作流运行态读取
- 节点运行态读取
- 工作流模板列表、读取、保存、删除
- LogicFlow 可视化编辑器
- workflow 与 agent 角色对齐校验
- 审批 / 取消运行等执行控制能力

前端现有可复用对象包括：

- `group-chat store`
- `LogicFlowWorkflowEditor.vue`
- `GroupChatPanel.vue` 中的模板应用与工作流保存流程
- `api/hermes/group-chat.ts` 中的：
  - `getRoomWorkflowState`
  - `updateRoomWorkflowConfig`
  - `listWorkflowTemplates`
  - `getWorkflowTemplate`
  - `saveWorkflowTemplate`

所以首版 `Workflow Workspace` 不需要先补后端基础。

## 3. 页面职责

`Workflow Workspace` 首版负责三件事：

- 解释当前应用工作流配置是否已经成型
- 呈现当前工作流运行态与角色对齐情况
- 提供模板应用与可视化编辑保存入口

它暂时不承担完整的协作聊天过程，也不承担所有运行控制入口。

## 4. 首版推荐结构

首版页面拆成三层：

### 4.1 Workflow Overview

展示：

- workflow 名称
- workflow prompt 摘要
- mode
- stage 数
- graph node / edge 数
- owner
- artifact root

### 4.2 Workflow Runtime

展示：

- 当前 run status
- 当前节点标题
- 当前角色
- pending approval 数
- completed node 数
- 最近更新时间

### 4.3 Workflow Templates + Editor

提供：

- 模板选择
- 应用模板
- 应用模板并同步 starter agents
- 直接编辑 workflow name / prompt
- 直接内嵌 `LogicFlowWorkflowEditor`
- 保存到 room workflow config

## 5. 首版实现策略

本轮选择的策略是：

- `applications store` 继续只负责应用摘要与详情
- `group-chat store` 继续负责房间工作流运行时
- 新增 `useApplicationWorkflowWorkspace()` 作为应用分区适配层

这样可以保证：

- 不把应用 store 做成巨型运行时 store
- 不在 `ApplicationDetailView.vue` 里直接堆旧逻辑
- 不复制一整份完全分叉的工作流实现

## 6. 新增适配层职责

`useApplicationWorkflowWorkspace()` 负责：

- 确保当前 room ready
- 拉取 workflow templates
- 将 room workflow 映射成应用视图模型
- 管理 workflow draft
- 处理模板应用
- 处理保存 workflow config
- 汇总 workflow role alignment

## 7. 本轮工程落点

本轮新增：

- `composables/workbench/useApplicationWorkflowWorkspace.ts`
- `components/workbench/workflow/ApplicationWorkflowOverviewCard.vue`
- `components/workbench/workflow/ApplicationWorkflowRunCard.vue`
- `components/workbench/workflow/ApplicationWorkflowTemplateCard.vue`
- `components/workbench/workflow/ApplicationWorkflowEditorCard.vue`
- `components/workbench/workflow/ApplicationWorkflowWorkspace.vue`

并更新：

- `types/workbench/application.ts`
- `views/workbench/ApplicationDetailView.vue`

## 8. 当前边界

这一版先不做：

- 独立的 workflow template 管理中心
- 模板导入导出 UI
- 审批动作直接在 workflow workspace 内闭环
- 工作流变更草稿缓存系统的完整迁移
- 运行中节点级高级控制

这些能力仍然可以暂时留在 `Collaboration Workspace` 中继续承接。

## 9. 当前最重要的判断

`Workflow Workspace` 的第一阶段价值，不是把所有房间工作流弹窗功能一次性搬平，而是先把“工作流配置”从隐蔽的协作附属功能提升为应用内正式主线。

这样用户在应用层才能真正理解：

- 这个应用如何协作推进
- 哪些角色必须到位
- 当前流程卡在什么节点
- 模板和实际执行编排之间是什么关系
