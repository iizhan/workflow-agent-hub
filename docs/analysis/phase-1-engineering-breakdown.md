# Phase 1 研发任务拆解

## 1. 本轮目的

前面已经完成：

- 产品目标定义
- 边界与成功标准
- 领域模型
- 信息架构
- 页面与状态设计
- 迁移策略
- 分阶段实施规划

这一轮继续往下压，只做一件事：

> 把 `Phase 1` 直接拆成工程可执行的研发任务清单。

本文件重点回答：

- 需要新增哪些页面文件
- 需要新增哪些类型定义
- 需要新增哪些 store / adapter
- 现有哪些组件和 store 继续复用
- 哪些文件必须先改
- 第一阶段任务之间的依赖顺序是什么

## 2. Phase 1 的工程目标

`Phase 1` 的目标不是完成最终版新产品，而是完成第一个可运行、可感知、可继续演进的“应用中心化入口”。

如果这一阶段做对，用户会得到以下变化：

- 登录后先进入 `Applications`
- 能看到应用列表，而不是旧功能页
- 能进入新的应用详情壳
- 能通过创建应用向导开始工作
- 即使底层仍映射到 `Room`，用户也不必先理解 `Room`

## 3. 当前工程现实判断

基于当前代码，`Phase 1` 应遵守一个非常重要的实现判断：

- `group-chat store` 继续负责“协作运行时”
- 新的 `applications store` 负责“应用目录与详情聚合”

原因是：

- 当前 `useGroupChatStore()` 已经深度绑定房间加入、消息流、Socket、工作流运行态和项目浏览
- 如果直接把它强行扩成应用目录主 store，会继续把 `Room` 语义扩散到新产品主线
- 更合理的做法是：
  - 新建 `Application` 视图模型与聚合层
  - 保留 `group-chat store` 作为应用详情中的 `Collaboration` 运行时底层

这会成为 `Phase 1` 的核心工程边界。

## 4. 推荐新增的目录与文件

## 4.1 页面层

建议新增：

- `packages/client/src/views/workbench/ApplicationsView.vue`
- `packages/client/src/views/workbench/ApplicationDetailView.vue`
- `packages/client/src/views/workbench/ApplicationCreateView.vue`

可选占位页：

- `packages/client/src/views/workbench/RunsView.vue`
- `packages/client/src/views/workbench/ResourcesView.vue`
- `packages/client/src/views/workbench/SystemView.vue`

说明：

- `ApplicationsView.vue` 负责应用列表
- `ApplicationDetailView.vue` 负责应用详情过渡壳
- `ApplicationCreateView.vue` 负责创建应用向导第一版
- `Runs / Resources / System` 即使先不做完整内容，也建议先建立路由壳，避免后面再次改导航结构

## 4.2 组件层

建议新增：

- `packages/client/src/components/workbench/ApplicationCard.vue`
- `packages/client/src/components/workbench/ApplicationHeader.vue`
- `packages/client/src/components/workbench/ApplicationSectionNav.vue`
- `packages/client/src/components/workbench/ApplicationEmptyState.vue`
- `packages/client/src/components/workbench/ApplicationCreateWizard.vue`
- `packages/client/src/components/workbench/ApplicationOverviewPanel.vue`

说明：

- `ApplicationCard` 用于列表页卡片
- `ApplicationHeader` 用于详情页头部
- `ApplicationSectionNav` 用于应用内二级导航
- `ApplicationCreateWizard` 包装现有 `CreateRoomForm`
- `ApplicationOverviewPanel` 用于 `Overview` 摘要与下一步推荐

## 4.3 类型定义层

当前 `packages/client/src/api/hermes/group-chat.ts` 里已经有很多 `Room* / Project* / Workflow*` 类型，但没有独立的产品级应用视图模型。

建议新增：

- `packages/client/src/types/workbench/application.ts`

建议定义：

- `ApplicationScenario`
- `ApplicationStatus`
- `ApplicationSummary`
- `ApplicationDetail`
- `ApplicationSectionKey`
- `ApplicationNextAction`

建议约束：

- 这层类型不直接暴露 `RoomInfo`
- 如果需要保留底层引用，可只保留 `sourceRoomId`

## 4.4 聚合适配层

建议新增：

- `packages/client/src/api/workbench/applications.ts`

作用不是新增真正后端，而是先做前端语义适配层。

建议职责：

- 包装 `listRooms()`
- 包装 `getRoomDetail()`
- 包装 `getRoomRuntime()`
- 包装 `listProjects()`
- 做 `Room -> ApplicationSummary / Detail` 的适配输入准备

注意：

- 这一层先不要引入大量业务状态
- 它只负责拉取与拼装原始数据

## 4.5 store 层

建议新增：

- `packages/client/src/stores/workbench/applications.ts`

建议职责：

- `loadApplications()`
- `loadApplicationDetail(applicationId)`
- `createApplication(payload)`
- `deriveApplicationStatus(detail)`
- `setCurrentApplicationSection(section)`

建议状态：

- `applications`
- `currentApplication`
- `currentSection`
- `isLoadingList`
- `isLoadingDetail`
- `isCreating`
- `error`

明确不要做的事：

- 不在这个 store 里接 Socket
- 不在这个 store 里管理消息流
- 不在这个 store 里管理群聊输入态

这些仍然留给 `useGroupChatStore()`

## 5. 现有能力的复用方式

## 5.1 直接复用

以下能力 Phase 1 可直接复用：

- `CreateRoomForm.vue`
- `GroupChatView.vue`
- `GroupChatPanel.vue`
- `useGroupChatStore()`
- `api/hermes/group-chat.ts`
- `api/hermes/projects.ts` 对应的现有项目接口调用

## 5.2 包装复用

以下能力不建议直接裸用，而应通过新壳包装：

### `CreateRoomForm.vue`

包装方式：

- 放进 `ApplicationCreateWizard.vue`
- 作为“定义应用”步骤的底层表单
- 由外层新增“场景选择 / 项目绑定 / 角色配置 / 工作流模板”步骤容器

### `GroupChatView.vue`

包装方式：

- 在 `ApplicationDetailView.vue` 中只作为 `Collaboration` 分区使用
- 不再作为整个应用详情页本身

### `GroupChatPanel.vue`

包装方式：

- Phase 1 里保留为“应用协作运行面板”
- 不要求现在就把里面所有项目、工作流、Agent 弹窗能力拆完
- 但详情页头部、导航、Overview 和空状态不再交给它承载

## 5.3 暂不建议 Phase 1 抽离的部分

以下内容当前耦合较重，Phase 1 不建议强拆：

- `GroupChatPanel.vue` 内部所有弹窗子块
- `useGroupChatStore()` 的 Socket 生命周期
- 现有工作流运行态刷新逻辑
- 房间加入后自动加载项目、产物、运行态的链路

更合理的方式是：

- 先让新壳调旧能力
- Phase 2 再做细拆

## 6. 路由任务拆解

当前文件：

- `packages/client/src/router/index.ts`

建议新增路由名：

- `workbench.applications`
- `workbench.applicationCreate`
- `workbench.applicationDetail`
- `workbench.runs`
- `workbench.resources`
- `workbench.system`

建议新增路径：

- `/workbench/applications`
- `/workbench/applications/new`
- `/workbench/applications/:applicationId`
- `/workbench/runs`
- `/workbench/resources`
- `/workbench/system`

建议路由规则：

- 登录成功后优先跳转 `/workbench/applications`
- 旧 `/hermes/chat` 保留，但不再作为默认第一入口
- `ApplicationDetailView` 通过 `applicationId` 挂载

## 7. 导航任务拆解

当前文件：

- `packages/client/src/components/layout/AppSidebar.vue`
- `packages/client/src/i18n/locales/en.ts`

建议拆成三批改动：

### 任务 1：新增新的导航分组

目标：

- 让 `Applications / Runs / Resources / System` 成为主导航层

### 任务 2：旧导航降级

建议：

- `Group Chat` 转为兼容入口
- `Chat / History / Jobs / Kanban` 不删除，但降为旧功能区或工具区
- `Gateways / Profiles / Settings` 归入 `System`

### 任务 3：补齐 i18n

建议新增文案键：

- `sidebar.applications`
- `sidebar.runsWorkbench`
- `sidebar.resources`
- `sidebar.systemWorkbench`
- `applications.title`
- `applications.emptyTitle`
- `applications.emptyBody`
- `applicationDetail.overview`
- `applicationDetail.projects`
- `applicationDetail.agents`
- `applicationDetail.workflow`
- `applicationDetail.artifacts`
- `applicationDetail.collaboration`

## 8. 页面任务拆解

## 8.1 ApplicationsView

目标：

- 展示应用目录
- 支持进入详情
- 支持创建应用入口

最小内容：

- 页面标题
- 创建应用按钮
- 最近应用 / 全部应用列表
- 空状态

依赖：

- `ApplicationCard.vue`
- `useApplicationsStore()`

## 8.2 ApplicationDetailView

目标：

- 建立新的应用详情壳
- 提供二级导航与主操作
- 逐步挂接现有协作能力

最小内容：

- 应用头部
- 二级导航
- `Overview` 面板
- `Collaboration` 面板

Phase 1 的务实策略：

- `Overview` 走新聚合数据
- `Collaboration` 直接挂 `GroupChatView` 或 `GroupChatPanel`
- `Projects / Agents / Workflow / Artifacts` 先做摘要 + CTA，告诉用户下一步去哪里

## 8.3 ApplicationCreateView

目标：

- 提供创建应用向导第一版

最小步骤：

1. 场景选择
2. 应用基础信息
3. 项目绑定
4. 角色配置
5. 工作流模板

务实建议：

- Step 2 直接包装 `CreateRoomForm`
- 其他步骤优先复用现有数据结构和调用逻辑

## 9. store 与数据流任务拆解

## 9.1 新增 applications store

建议不要把 `useGroupChatStore()` 改成“既管应用目录，又管协作运行时”。

建议新增：

- `useApplicationsStore()`

它负责：

- 拉应用列表
- 拉应用详情摘要
- 计算应用状态
- 管理应用页局部 UI 状态

## 9.2 保留 group-chat store 的职责

`useGroupChatStore()` 继续负责：

- 房间加入
- 消息流
- 成员状态
- Agent 运行态
- 工作流运行态
- 项目文件浏览
- 产物浏览

## 9.3 新旧 store 的衔接方式

建议在详情页采用组合，而不是合并：

- 页面头部和概览读 `useApplicationsStore()`
- `Collaboration` 分区读 `useGroupChatStore()`

这样 Phase 1 可以先完成“产品主线切换”，又不至于把底层实时能力拆坏。

## 10. 任务优先级与顺序

建议按以下顺序实施：

### P1-1 路由与默认入口

- 改 `router/index.ts`
- 新增 workbench 路由
- 登录后默认跳到 `Applications`

### P1-2 导航与 i18n

- 改 `AppSidebar.vue`
- 增加新导航
- 降级旧导航
- 补文案

### P1-3 应用类型与聚合层

- 新增 `types/workbench/application.ts`
- 新增 `api/workbench/applications.ts`
- 新增 `stores/workbench/applications.ts`

### P1-4 应用列表页

- 新增 `ApplicationsView.vue`
- 新增 `ApplicationCard.vue`
- 接通应用聚合 store

### P1-5 应用详情过渡页

- 新增 `ApplicationDetailView.vue`
- 新增 `ApplicationHeader.vue`
- 新增 `ApplicationSectionNav.vue`
- 挂接 `Overview` 和 `Collaboration`

### P1-6 创建应用向导

- 新增 `ApplicationCreateView.vue`
- 新增 `ApplicationCreateWizard.vue`
- 包装现有 `CreateRoomForm.vue`

### P1-7 状态推导与空状态

- 应用状态枚举落地
- Overview 下一步 CTA 落地
- 列表页空状态落地

## 11. Definition Of Done

只有同时满足以下条件，才算 `Phase 1` 任务完成：

- 登录后默认进入 `Applications`
- 导航中 `Applications` 成为第一入口
- 应用列表页可展示从现有房间映射出的应用目录
- 用户可进入新的应用详情页壳
- 用户可通过创建应用向导完成第一版创建
- 应用详情中至少能看到 `Overview` 与 `Collaboration`
- 旧群聊入口仍可兼容访问

## 12. 本轮最终结论

`Phase 1` 最关键的工程决策不是“先改哪个页面”，而是先把职责分对：

- `applications store` 负责产品级应用聚合
- `group-chat store` 负责房间协作运行时

只要这个边界守住，后面的新入口、新页面、新向导都能在现有系统上平稳长出来。

如果这个边界没守住，后续大概率又会把 `Room` 语义继续扩散到新产品主线里。
