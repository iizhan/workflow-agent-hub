# Artifacts Workspace 实现设计

## 1. 本轮目的

这一轮聚焦把 `Artifacts Workspace` 从协作面板中的附属弹窗能力，提升为应用详情页中的正式分区。

目标是先解决三个问题：

- 用户能否在应用层看到当前真实产物
- 用户能否稳定浏览和预览产物
- 用户能否理解产物与 workflow 运行态之间的关系

## 2. 当前可复用基础

当前系统已经具备完整的产物读取能力：

- 房间产物列表接口
- 房间产物内容读取接口
- `group-chat store` 中的 artifacts state
- `GroupChatPanel.vue` 中已经存在的产物目录浏览与内容预览交互

因此首版 `Artifacts Workspace` 不需要先补新的后端能力。

## 3. 页面职责

`Artifacts Workspace` 首版负责：

- 展示产物根目录与当前目录上下文
- 展示当前目录下的产物文件和目录
- 支持进入目录、返回上级、预览文件内容
- 关联当前 workflow run 状态和当前节点

它暂时不负责：

- 产物审批操作
- 产物版本对比
- 产物下载中心
- 复杂的多格式渲染器

## 4. 首版推荐结构

首版页面拆成两层：

### 4.1 Artifacts Overview

展示：

- artifact root
- 当前目录
- 总条目数
- 文件数
- 目录数
- 最近一个产物名
- 当前 run status
- 当前 workflow 节点

### 4.2 Artifacts Browser

提供：

- 左侧目录 / 文件列表
- 返回上级
- 刷新
- 右侧内容预览

## 5. 首版实现策略

与前面的 `Projects / Agents / Workflow` 一样，本轮仍采用：

- `applications store` 继续负责应用摘要
- `group-chat store` 继续负责 room 级 artifacts runtime
- 新增 `useApplicationArtifactsWorkspace()` 作为应用分区适配层

## 6. 新增适配层职责

`useApplicationArtifactsWorkspace()` 负责：

- 确保 room ready
- 拉取当前 artifacts 列表
- 拉取当前 workflow run state
- 将产物列表与当前文件预览映射成应用视图模型
- 处理进入目录、返回上级、刷新

## 7. 本轮工程落点

本轮新增：

- `composables/workbench/useApplicationArtifactsWorkspace.ts`
- `components/workbench/artifacts/ApplicationArtifactsSummaryCard.vue`
- `components/workbench/artifacts/ApplicationArtifactsBrowserCard.vue`
- `components/workbench/artifacts/ApplicationArtifactsWorkspace.vue`

并更新：

- `types/workbench/application.ts`
- `views/workbench/ApplicationDetailView.vue`

## 8. 当前最重要的判断

`Artifacts Workspace` 的首版价值，不是马上做成完整资产管理器，而是先让“产物”从协作过程的附属结果，升级为应用内正式可见、可浏览、可定位的资产分区。
