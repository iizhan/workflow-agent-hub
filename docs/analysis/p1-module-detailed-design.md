# P1 模块详细设计

## 1. 本轮目的

这一轮只聚焦 P1 的四个高优模块：

- `Applications Home`
- `Application Overview`
- `Projects Workspace`
- `Agents Workspace`

目标不是再谈方向，而是把这四个模块拆到足够接近研发实现的层级：

- 页面职责
- 最小数据需求
- 关键交互动作
- 当前可复用基础
- 首版边界

## 2. P1 总体设计原则

P1 设计必须遵守以下约束：

- 不假设后端已经有独立 `applications` 持久层
- 不要求一次性重写 `group-chat` 内核
- 不要求所有分区都做成完整编辑器
- 优先让用户能顺着一条稳定主线持续工作
- 优先把旧能力重新组织成新体验，而不是重新发明

## 3. P1 模块总览

### 3.1 模块关系

P1 四个模块并不是并列孤立页面，而是一条连续主线：

1. 用户从 `Applications Home` 进入或创建应用
2. 用户在 `Application Overview` 理解当前状态和下一步
3. 用户进入 `Projects Workspace` 补足真实资产上下文
4. 用户进入 `Agents Workspace` 补足角色分工
5. 后续再进入 `Workflow / Collaboration`

### 3.2 P1 要解决的主问题

P1 必须优先解决：

- 用户不知道从哪个应用继续开始
- 用户不知道当前应用还差什么
- 用户不知道真实项目接入是否完成
- 用户不知道谁在这个应用里负责什么

## 4. Applications Home

## 4.1 页面职责

`Applications Home` 是 P1 的默认首页。

它承担四个职责：

- 作为默认工作入口
- 展示当前可继续的应用
- 帮助用户快速筛选和定位应用
- 提供创建新应用入口

它不承担：

- 应用内深度配置
- 运行过程追踪
- 协作消息处理

## 4.2 当前页面基础

当前已有基础页面：

- `views/workbench/ApplicationsView.vue`
- `components/workbench/ApplicationCard.vue`
- `components/workbench/ApplicationEmptyState.vue`

这说明首页目录结构已经有起点，不需要从零开始。

## 4.3 最小数据需求

P1 首页继续消费 `ApplicationSummary` 即可。

必须可见的字段：

- `id`
- `name`
- `scenario`
- `goalSummary`
- `status`
- `statusReason`
- `primaryProjectName`
- `agentCount`
- `workflowEnabled`
- `workflowName`
- `hasPendingReview`
- `hasActiveRun`
- `lastRunAt`

### 数据来源

- 主来源：`applications store`
- 聚合来源：`Room -> ApplicationSummary` 映射层

## 4.4 关键交互

P1 首页最关键的交互只有五类：

- 搜索应用
- 按场景筛选
- 按状态筛选
- 打开应用详情
- 创建新应用

### 交互要求

- 搜索必须能覆盖应用名、目标摘要、主项目名
- 状态筛选必须优先帮助用户定位：
  - `setup_required`
  - `running`
  - `waiting_review`
  - `failed`
- 空结果必须给出明确恢复动作，而不是只显示“没有数据”

## 4.5 首版需要补强的地方

虽然已有页面骨架，但 P1 首版还应补强：

- 最近更新时间文案
- 应用状态说明更明确
- 卡片 CTA 更聚焦
- 更明显的“继续工作”语义

### 建议新增的首页文案重点

- `Continue application`
- `Needs setup`
- `Waiting review`
- `Run in progress`

## 4.6 首版不做

- 跨应用运行趋势图
- 复杂排序器
- 应用收藏系统
- 自定义标签系统

## 5. Application Overview

## 5.1 页面职责

`Application Overview` 是应用详情的默认分区。

它负责：

- 解释当前应用是什么状态
- 告诉用户当前缺什么
- 告诉用户下一步去哪
- 给用户一个稳定的“应用控制面板”

它不负责：

- 直接承载完整项目管理
- 直接承载完整角色编辑
- 替代协作面板

## 5.2 当前页面基础

当前已有基础：

- `views/workbench/ApplicationDetailView.vue`
- `components/workbench/ApplicationHeader.vue`
- `components/workbench/ApplicationOverviewPanel.vue`
- `components/workbench/ApplicationSectionNav.vue`

当前实现已经具备：

- 应用头部
- section 导航
- 状态卡
- setup checklist
- summary cards

这意味着 P1 的重点不是再造结构，而是把内容变得更准确、更有指导性。

## 5.3 最小数据需求

Overview 继续消费 `ApplicationDetail`。

P1 重点字段：

- `name`
- `scenario`
- `goalSummary`
- `status`
- `statusReason`
- `primaryProject`
- `agents`
- `workflow`
- `run`
- `artifacts`
- `nextAction`

### 字段用途

- `status / statusReason`：解释当前阶段
- `nextAction`：作为最重要 CTA
- `primaryProject / agents / workflow / run / artifacts`：组成总览摘要

## 5.4 关键交互

Overview 最关键的是引导跳转，而不是复杂编辑。

P1 必须支持：

- 从 `nextAction` 跳到对应分区
- 从 checklist 跳到 `projects / agents / workflow`
- 从 summary card 跳到对应分区
- 从头部主 CTA 跳到：
  - `collaboration`
  - `workflow`
  - `runs`
  - `artifacts`

## 5.5 内容结构建议

P1 `Overview` 建议稳定分成四块：

### 第一块：状态解释

要回答：

- 当前是否可运行
- 当前为什么不是理想状态
- 当前最应该做什么

### 第二块：准备清单

要回答：

- 项目是否接入
- Agent 是否配置
- Workflow 是否完成

### 第三块：业务摘要

要回答：

- 当前主项目是什么
- 当前角色配置如何
- 当前流程处于什么配置程度
- 当前最近运行和产物情况

### 第四块：继续工作入口

要回答：

- 如果用户现在要继续推进，最合适进入哪个分区

## 5.6 首版不做

- 全量业务图谱
- 项目/流程依赖图
- 自动健康评分

## 6. Projects Workspace

## 6.1 页面职责

`Projects Workspace` 是应用内的真实资产入口。

它负责：

- 展示当前主项目
- 解释项目接入状态
- 展示 Git 和目录上下文
- 提供补绑或重绑项目入口

它不负责：

- 完整 IDE 替代
- 复杂多项目编排

## 6.2 当前能力基础

当前系统已经有很强的项目基础：

- `project` service
- `bindLocalProject / bindRoomProject`
- `getProjectDetail`
- `listProjectFiles`
- `getProjectGitStatus`
- `getProjectGitBranches`

问题不在能力缺失，而在没有成为应用内正式分区。

## 6.3 P1 页面职责细化

P1 的 `Projects Workspace` 应至少回答五个问题：

- 这个应用有没有主项目
- 主项目是什么类型
- 项目本地路径在哪里
- Git 是否可用
- 当前项目是否足够支撑执行

## 6.4 最小数据需求

P1 `Projects Workspace` 最小需要：

- `primaryProject.id`
- `primaryProject.name`
- `primaryProject.description`
- `primaryProject.sourceType`
- `primaryProject.localPath`
- `primaryProject.gitEnabled`
- `primaryProject.currentBranch`

如果进入子页面或展开详情，可增补：

- 项目目录树
- Git status 摘要
- 分支列表

## 6.5 页面结构建议

P1 `Projects Workspace` 建议拆三块：

### 第一块：主项目摘要卡

展示：

- 名称
- 描述
- 类型
- 本地路径
- 当前分支

### 第二块：项目状态卡

展示：

- 是否已绑定
- 是否检测到 Git
- 是否允许读写
- 是否存在 artifact root

### 第三块：操作区

提供：

- 绑定已有项目
- 绑定本地项目
- 查看文件结构
- 查看 Git 摘要

## 6.6 关键交互

P1 最关键交互：

- 从应用详情跳到 `Projects`
- 查看主项目摘要
- 进行项目绑定或重绑
- 打开文件浏览入口
- 打开 Git 摘要入口

### P1 建议交互形式

- 先做摘要 + CTA
- 文件树和 Git 详情可以先用抽屉、子卡片或二级面板
- 不强求首版独立做成完整文件管理器

## 6.7 当前复用建议

优先复用：

- 现有 `group-chat store` 中项目读取能力
- 现有绑定项目 API
- 现有项目详情接口

P1 最好先做一个应用内 `project summary adapter`，而不是让页面直接拼多接口。

## 6.8 首版不做

- 多项目主从关系
- 远程仓库 OAuth 接入
- 在线代码编辑器
- 自动提交与推送审批中心

## 7. Agents Workspace

## 7.1 页面职责

`Agents Workspace` 是应用的角色配置中心。

它负责：

- 让用户看清有哪些角色
- 让用户理解每个角色负责什么
- 让用户看到角色与模型/技能策略关系
- 提供添加、修改、移除角色入口

它不负责：

- 全平台模型基础设施管理
- 跨应用角色市场

## 7.2 当前能力基础

当前系统已经有：

- `listAgents`
- `addAgent`
- `updateAgent`
- `removeAgent`
- `saveDefaultAgents`
- `applyDefaultAgents`

也就是说，角色运行时和配置能力已经存在，缺的是应用内正式表达。

## 7.3 P1 页面职责细化

P1 `Agents Workspace` 必须让用户回答：

- 这个应用里有几个角色
- 每个角色叫什么
- 每个角色做什么
- 每个角色是否已启用
- 当前角色配置是否足够进入执行

## 7.4 最小数据需求

P1 最小需要：

- Agent 总数
- Agent 名称列表
- Agent 描述摘要
- Agent profile
- Agent model
- Agent invited/enabled 状态

如果短期后端没有统一 summary 接口，可以先由前端聚合：

- `RoomAgent[] -> ApplicationAgentSummary[]`

## 7.5 页面结构建议

P1 `Agents Workspace` 建议拆三块：

### 第一块：角色总览

展示：

- 总角色数
- 已启用角色数
- 是否存在默认执行角色

### 第二块：角色列表

每张角色卡建议展示：

- 名称
- 角色描述
- profile
- model 摘要
- 是否启用

### 第三块：操作区

提供：

- 添加角色
- 编辑角色
- 删除角色
- 从模板或默认配置导入

## 7.6 关键交互

P1 最关键交互：

- 查看角色列表
- 打开角色详情或编辑
- 添加新角色
- 删除角色
- 返回 `Overview`

### P1 交互建议

- 首版可继续复用现有弹窗或表单能力
- 但应用页中必须有正式角色列表页
- 不要继续把角色配置完全藏在创建房间或群聊配置里

## 7.7 当前复用建议

优先复用：

- 当前 Agent API
- 当前房间默认 Agents 配置能力
- 当前创建向导中的模板注入能力

建议新增一个应用内的角色摘要映射层，避免页面直接消费底层原始结构。

## 7.8 首版不做

- 跨应用角色资产库
- 角色继承体系
- 复杂权限审批流

## 8. 四个模块之间的数据与交互衔接

P1 四个模块不是各自独立，而是需要显式衔接：

### 8.1 Home -> Overview

- 用户从应用卡片进入详情
- 详情默认落在 `overview`

### 8.2 Overview -> Projects

- 当没有主项目时，`nextAction` 应直接引导到 `projects`

### 8.3 Overview -> Agents

- 当角色不足时，`nextAction` 或 checklist 应引导到 `agents`

### 8.4 Projects / Agents -> Overview

- 补齐项目或角色后，用户应能明显返回总览确认当前状态已改善

## 9. P1 研发实施建议

如果接下来继续做实现，建议按这个顺序：

1. 先补强 `Applications Home`
2. 再补强 `Application Overview`
3. 再正式落 `Projects Workspace`
4. 再正式落 `Agents Workspace`

原因：

- 前两者决定产品入口是否成立
- 后两者决定应用是否真正摆脱“空壳”

## 10. 本轮结论

### 10.1 P1 的核心不是做更多页面

而是让用户清楚：

- 从哪进入
- 当前状态如何
- 项目是否接好
- 角色是否就位

### 10.2 当前最值得优先做深的不是协作页

而是：

- `Applications Home`
- `Application Overview`
- `Projects Workspace`
- `Agents Workspace`

### 10.3 首版设计必须强调“解释清楚”

P1 的成败，很大程度上取决于用户能不能在这四个模块里快速看懂系统并继续推进工作。
