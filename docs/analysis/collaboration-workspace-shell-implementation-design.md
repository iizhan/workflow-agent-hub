# Collaboration Workspace 壳层实现设计

## 1. 本轮目的

这一轮没有直接重写 `GroupChatPanel`，而是先做 `Collaboration Workspace` 的应用级外层壳。

目标是先解决两个问题：

- 为什么用户要进入协作分区
- 用户进入协作分区时，是否能先看到应用级上下文，而不是直接掉进一个旧的大面板

## 2. 当前可复用基础

当前系统已经具备完整协作核心：

- `GroupChatPanel.vue`
- room runtime
- workflow run state
- artifact state
- project state

因此本轮不适合直接重写协作核心，而应先提升它的产品承载方式。

## 3. 页面职责

`Collaboration Workspace` 壳层首版负责：

- 展示协作摘要
- 解释这是“当前应用的实时执行现场”
- 提供 refresh collaboration context
- 把旧 `GroupChatPanel` 放在新的应用语义外壳之内

## 4. 首版推荐结构

首版页面拆成两层：

### 4.1 Collaboration Summary

展示：

- room name
- 当前 run status
- active node
- active role
- member 数
- online agent / total agent
- pending approval 数
- artifact 数
- project 是否已绑定

### 4.2 Collaboration Guide + Live Panel

展示：

- 为什么当前要进入协作区
- 当前协作区承担什么职责
- refresh collaboration context
- 下方继续承接原 `GroupChatPanel`

## 5. 首版实现策略

本轮继续坚持渐进式策略：

- `applications store` 继续负责应用摘要
- `group-chat store` 继续负责 room runtime
- 新增 `useApplicationCollaborationWorkspace()` 作为应用协作壳层适配
- 暂不重写 `GroupChatPanel`

## 6. 新增适配层职责

`useApplicationCollaborationWorkspace()` 负责：

- 确保 room ready
- 拉取 room runtime / workflow / artifacts / project
- 汇总 collaboration summary
- 提供 refresh 能力

## 7. 本轮工程落点

本轮新增：

- `composables/workbench/useApplicationCollaborationWorkspace.ts`
- `components/workbench/collaboration/ApplicationCollaborationSummaryCard.vue`
- `components/workbench/collaboration/ApplicationCollaborationGuideCard.vue`
- `components/workbench/collaboration/ApplicationCollaborationWorkspace.vue`

并更新：

- `types/workbench/application.ts`
- `views/workbench/ApplicationDetailView.vue`

## 8. 当前最重要的判断

`Collaboration Workspace` 的这一轮重点不是“替换旧协作核心”，而是先把旧协作核心放回一个正确的应用语义容器中。

这样后续再继续对 `GroupChatPanel` 做减法、拆分和重构时，产品层已经先稳定了。
