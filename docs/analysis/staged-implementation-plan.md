# 应用中心化产品分阶段实施规划

## 1. 本轮目的

在目标、边界、对象模型、信息架构、页面结构、状态规则和迁移策略已经明确之后，这一轮进入真正面向研发落地的阶段。

本文件只解决一个问题：

> 现有系统接下来到底该按什么顺序改，第一阶段要做哪些具体交付，分别落到哪些实现层。

本文件不会直接进入代码实现细节，但会尽量把规划压到当前真实代码结构上，保证后续可以直接转任务。

## 2. 当前实现落点梳理

结合当前前端与服务端代码，第一阶段最关键的实现触点已经比较明确：

### 前端全局壳层

- `packages/client/src/App.vue`
- `packages/client/src/components/layout/AppSidebar.vue`
- `packages/client/src/stores/hermes/app.ts`
- `packages/client/src/router/index.ts`
- `packages/client/src/constants/branding.ts`

### 当前最接近未来应用工作台的页面与能力

- `packages/client/src/views/hermes/GroupChatView.vue`
- `packages/client/src/components/hermes/group-chat/GroupChatPanel.vue`
- `packages/client/src/components/hermes/group-chat/CreateRoomForm.vue`
- `packages/client/src/stores/hermes/group-chat.ts`
- `packages/client/src/api/hermes/group-chat.ts`

### 当前已可复用的服务端基础

- `packages/server/src/routes/hermes/group-chat.ts`
- `packages/server/src/routes/hermes/projects.ts`
- `packages/server/src/services/hermes/group-chat/index.ts`
- `packages/server/src/services/hermes/project/index.ts`
- `packages/server/src/db/hermes/schemas.ts`

这意味着第一阶段完全可以建立在现有代码之上，不需要先做系统级翻修。

## 3. 实施总原则

后续实施必须遵守以下原则：

- 先切工作主线，再慢慢整理技术债
- 先新建应用入口，再逐步降级旧入口
- 先建立应用视图模型，再考虑数据库抽象
- 先把弹窗能力上收为应用分区，再考虑彻底拆组件
- 先完成前台可感知的产品切换，再做深层数据重构

换句话说，第一阶段的成功标准不是“结构最优雅”，而是：

- 用户已经能以应用为第一入口工作
- 现有能力没有被破坏
- 研发后续有稳定的拆解基础

## 4. 分阶段总览

建议把接下来的实施拆成四个阶段：

### Phase 0：壳层对齐与实施准备

目标：

- 把新的产品入口与旧入口关系先铺好
- 建立新的路由、导航和命名承接层
- 不动深层业务逻辑

### Phase 1：应用中心化第一可用版本

目标：

- 让用户第一次真正从 `Applications` 进入系统
- 让应用列表、应用详情过渡页、创建应用入口上线
- 让现有 `Room` 能以 `Application` 视图被消费

### Phase 2：应用详情能力拆分

目标：

- 把当前 `GroupChatPanel` 里的重弹窗能力逐步拆成应用内正式分区
- 让 `Projects / Agents / Workflow / Artifacts / Collaboration` 分层更清晰

### Phase 3：数据与接口语义升级

目标：

- 逐步引入更清晰的 `applications / runs / artifacts` 语义接口
- 视稳定度决定是否新增独立持久层

## 5. Phase 0 规划

## 5.1 目标

Phase 0 不是给用户看的完整新产品，而是后续所有实施的基座。

它要先解决三件事：

- 新工作台的路由壳要有地方挂
- 新导航要有位置长出来
- 新旧概念要先分层，不再全部堆在 `Hermes` 旧导航下

## 5.2 建议交付

### 交付 1：新增工作台路由域

在 `packages/client/src/router/index.ts` 中新增新入口路由域，例如：

- `/workbench/applications`
- `/workbench/applications/:applicationId`
- `/workbench/runs`
- `/workbench/resources`
- `/workbench/system`

要求：

- 旧 `/hermes/*` 路由全部保留
- 新旧入口可并行访问
- 默认登录后跳转策略开始向 `Applications` 倾斜

### 交付 2：重组侧边栏信息架构

在 `packages/client/src/components/layout/AppSidebar.vue` 中完成第一轮导航重组：

- 新增 `Applications / Runs / Resources / System`
- 旧 `Conversation / Agent / Monitoring / System` 旧分组降级为兼容入口或二级入口
- 全局快捷卡片不再优先突出网关和设置，而要逐步改成工作入口

### 交付 3：新增应用视图模型承接层

第一阶段不要直接让页面继续读 `RoomInfo`。

建议新增一层前端聚合模型：

- `ApplicationSummary`
- `ApplicationDetail`
- `ApplicationStatus`

这层模型先由现有 `Room + Project + Agent + Workflow Run` 聚合得到。

作用：

- 先把产品语义改对
- 降低后续拆分数据库与接口时的改动范围

## 5.3 验收标准

- 新工作台路由可访问
- 新导航层级成立
- 旧入口仍可正常使用
- 后续 Phase 1 页面不再必须直接依赖 `Room` 命名

## 6. Phase 1 规划

## 6.1 目标

Phase 1 是第一个真正面向用户可见的产品切换点。

它要回答：

- 用户现在进系统后，能不能先看到“应用”
- 用户能不能以应用方式继续使用现有能力
- 用户能不能不用理解 `Room` 也能完成创建和进入

## 6.2 建议交付

### 交付 1：应用列表页

建议新增应用列表页，优先做成目录页，而不是复杂控制台。

核心来源：

- 现有房间列表
- 现有主项目绑定信息
- 现有 Agent 数
- 现有工作流运行状态

最小字段：

- 应用名
- 场景类型
- 目标摘要
- 主项目
- Agent 数
- 最近运行状态
- 最近更新时间

当前实现建议：

- 前端新建应用列表页视图
- store 层新增 `listApplications()` 聚合逻辑
- 可先调用现有 `listRooms()` 再补拉项目/运行态

### 交付 2：应用详情过渡页

建议第一版不要直接重写一套复杂详情。

可以先做一个新的应用详情壳页面，内部挂接现有工作台能力：

- 头部：应用名、场景、主操作
- 本地导航：Overview / Projects / Agents / Workflow / Artifacts / Collaboration
- 主内容：先复用 `GroupChatView` 或 `GroupChatPanel` 的现有能力块

目标不是一次性拆干净，而是先让用户“进入的是应用详情页，而不是群聊页”。

### 交付 3：创建应用向导第一版

基于 `CreateRoomForm.vue` 做包装，不完全重写。

新增步骤语义：

1. 选择场景
2. 填写应用基础信息
3. 绑定项目
4. 配置角色
5. 选择工作流模板

建议：

- 第一步和外层步骤容器为新增
- 后面步骤尽量复用现有房间创建、项目绑定、Agent 与 Workflow 逻辑

### 交付 4：应用状态推导规则落地

应用状态不能继续隐含在房间细节里。

Phase 1 就应把这层规则做出来：

- `draft`
- `setup_required`
- `ready`
- `running`
- `waiting_review`
- `failed`
- `completed`

推导来源：

- 是否有项目绑定
- 是否有 Agent
- 是否有 Workflow
- 是否存在正在运行的工作流
- 是否存在待审批节点

## 6.3 Phase 1 依赖关系

Phase 1 最重要的依赖不是数据库，而是前端聚合层和页面壳。

推荐顺序：

1. 路由壳
2. 导航壳
3. 应用视图模型
4. 应用列表页
5. 应用详情过渡页
6. 创建应用向导
7. 状态映射与文案

## 6.4 Phase 1 验收标准

- 登录后主入口可以进入 `Applications`
- 用户可以创建一个应用并进入应用详情
- 用户可以在不理解 `Room` 的前提下完成项目绑定与基础配置
- 应用详情可以继续复用现有协作、项目、Agent、Workflow、Artifact 能力
- 旧群聊页仍可继续访问，作为兼容入口

## 7. Phase 2 规划

## 7.1 目标

Phase 2 的重点不再是“有没有应用入口”，而是把过渡壳真正拆成稳定结构。

要解决的问题：

- `GroupChatPanel` 太重
- 多个能力仍是弹窗附属，而不是正式分区
- 应用详情内部层次还不够清晰

## 7.2 建议交付

### 交付 1：Projects 分区独立化

把当前项目弹窗逐步升级为正式页面分区：

- 主项目信息
- 已有项目绑定
- 本地目录接入
- 文件树浏览
- Git 状态与分支

### 交付 2：Agents 分区独立化

把当前 Agent 弹窗与列表独立成正式管理区：

- 角色卡片列表
- 角色职责与提示词
- 默认模型策略
- 是否参与当前工作流

### 交付 3：Workflow 分区独立化

把当前工作流弹窗升级为应用内流程中心：

- 模板选择
- LogicFlow 编辑器
- 节点角色分配
- 运行设置
- 审批流规则

### 交付 4：Artifacts 与 Runs 分区独立化

把产物浏览与运行态从协作区剥离出来：

- 产物列表
- 运行历史
- 当前运行态
- 审批待办

## 7.3 Phase 2 验收标准

- 应用详情的核心能力不再全部依赖一个超大组件弹窗
- `Projects / Agents / Workflow / Artifacts / Collaboration` 各自边界清晰
- 协作区开始只承担协作和推进职责，而不是承载所有配置职责

## 8. Phase 3 规划

## 8.1 目标

当页面主线稳定后，再处理长期语义与数据问题。

这时才值得推动：

- 新接口语义
- 新数据抽象
- 长期兼容清理

## 8.2 建议交付

### 交付 1：新增 `applications` 风格接口层

例如提供兼容包装接口：

- `GET /api/workbench/applications`
- `GET /api/workbench/applications/:id`
- `POST /api/workbench/applications`

实现上先映射现有服务，不急着先拆底层存储。

### 交付 2：Run / Artifact 统一抽象

把当前工作流运行记录逐步抽象成通用 `Run` 视图，便于跨场景支持代码、文档、PPT、研究等任务。

### 交付 3：持久层演进决策

根据前两阶段稳定度，再决定是否新增独立：

- `applications`
- `application_projects`
- `application_agents`
- `application_runs`

## 8.3 Phase 3 验收标准

- 新旧接口共存但边界清楚
- 前端主要业务页不再直接依赖 `group-chat / rooms` 命名
- 是否拆库表可以基于真实复杂度做决策，而不是为了理论优雅

## 9. 建议的任务拆分结构

后续可以按五个工作流并行拆任务：

### 工作流 A：壳层与导航

- 新路由域
- 新侧边栏
- 登录后默认入口
- 兼容入口标识

### 工作流 B：应用聚合模型

- Application summary/detail 类型
- 状态推导逻辑
- Room 到 Application 的映射函数

### 工作流 C：页面与交互

- 应用列表页
- 应用详情过渡页
- 创建应用向导
- 空状态与下一步 CTA

### 工作流 D：现有能力重组

- 项目绑定能力接入应用详情
- Agent 能力接入应用详情
- Workflow 能力接入应用详情
- Artifact / Run 能力接入应用详情

### 工作流 E：长期语义演进

- 新 API 别名
- 新持久层评估
- 旧路由清理计划

## 10. 近期最值得先做的任务清单

如果只看最近一轮实施，建议按这个顺序推进：

1. 新建 `Applications` 路由域
2. 重组 `AppSidebar` 成应用中心化导航
3. 新增 `Application` 前端视图模型与映射层
4. 做应用列表页
5. 做应用详情过渡页
6. 包装 `CreateRoomForm` 成创建应用向导
7. 应用状态映射规则接入列表与详情

这是当前最小但完整的一条落地主线。

## 11. 本轮最终结论

接下来的研发不该再是“继续扩功能页”，而应该是“围绕应用主线重组现有系统”。

第一阶段最重要的不是：

- 换数据库
- 改所有接口
- 重写所有组件

第一阶段最重要的是：

- 做出新的应用入口
- 让应用列表成立
- 让应用详情成立
- 让创建应用入口成立
- 用最小代价把现有群聊能力包进新的产品语义中

只要这一步做成，后面的页面拆分、数据抽象和多场景扩展才有稳定基础。
