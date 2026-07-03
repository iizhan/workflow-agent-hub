# 功能规格说明：新品牌下的应用中心化通用项目执行工作台

**功能目录**: `specs/001-application-centric-platform`  
**创建日期**: 2026-05-27  
**状态**: 草稿  
**原始需求**: 将当前仓库对应的旧产品从功能型控制台升级为以应用为中心的通用项目执行平台，支持代码开发、PPT 制作、文档编写、研究分析等不同场景；未来产品不再沿用 `Hermes Web UI` 命名，并在本轮规划中一并纳入界面风格重做，同时把每轮设计结论沉淀到需求分析。

## 1. 业务背景与目标

- 业务背景：当前产品已经具备聊天、群聊、项目绑定、工作流、技能、模型、网关等能力，但这些能力分散在多个页面，用户难以理解如何围绕一个真实项目持续工作。
- 本次目标：先完成目标定义、成功标准、非目标和边界澄清，再定义一套以“应用”为核心的产品模型，统一项目、机器人、工作流、技能、模型与产物的关系，并把品牌命名方向和界面风格升级一并纳入规划。
- 非目标：本阶段不直接实现全部代码重构、不一次性替换现有群聊体系、不在本轮引入完整的远程连接器和发布能力，也不在未确认新品牌名之前直接做大规模品牌替换。

## 2. 用户场景与验收

### 场景 1 - 创建一个代码开发应用（优先级：P1）

用户希望创建一个面向具体仓库的应用，在其中绑定项目、配置机器人和工作流，随后围绕该项目持续执行需求、设计、开发和测试。

**为什么优先**：这是当前产品最接近现有能力、商业价值最高、最容易落地的主场景。

**独立验收方式**：产品文档能够明确“应用、项目、机器人、工作流、模型、网关”的关系，并形成可执行的阶段路线图。

**验收场景**：

1. **Given** 当前系统已有项目绑定、群聊和工作流能力，**When** 团队评审新架构，**Then** 能明确应用是新的顶层业务容器，且项目、机器人、工作流都挂载在应用之下。

---

### 场景 2 - 创建一个文档或 PPT 应用（优先级：P1）

用户希望接入一个非代码型项目目录，例如报告目录或 PPT 资料目录，并让多个机器人通过工作流产出文档或演示材料。

**为什么优先**：这决定产品是否真的是“通用项目执行平台”，而不是只服务于开发场景。

**独立验收方式**：产品模型能够解释非代码场景如何接入项目、如何定义产物、如何复用机器人和工作流。

**验收场景**：

1. **Given** 一个研究报告目录或演示文稿目录，**When** 用户创建应用并绑定该目录，**Then** 系统模型应允许通过相同的 Application / Project / Agent / Workflow / Artifact 抽象承载该场景。

## 3. 业务规则与边界

- 规则 1：应用是顶层业务容器，用户应优先面向应用工作，而不是先理解底层系统对象。
- 规则 2：机器人不是模型，模型只是机器人执行时采用的策略之一。
- 规则 3：网关负责执行，不承担业务编排语义。
- 规则 4：项目不限定为代码仓库，也可以是文档、PPT、研究资料或混合目录。
- 规则 5：品牌和界面风格升级属于本轮规划范围，但具体品牌名和完整视觉系统应在目标确认后细化。
- 边界 1：短期内可将现有 Room 视为 Application 的前身，但长期不应继续把群聊房间当成唯一业务容器。
- 边界 2：本阶段以目标、边界、路线图为主，不直接承诺所有连接器和高风险写操作能力。
- 边界 3：视觉重构应服务于新的产品定位，而不是单纯换皮。

## 4. 异常与边界场景

- 当项目不是 Git 仓库而只是普通目录时，系统仍应允许作为项目接入。
- 当一个应用需要多个项目时，系统应先支持一个主项目，后续再扩展附属项目。
- 当机器人、技能和工作流之间能力冲突时，应优先以应用级配置为准，再落到机器人级覆盖。
- 当模型或网关不可用时，应用仍应保留其配置和历史产物，不因运行时异常失去业务上下文。
- 当新品牌名尚未确定时，产品文档与设计稿应先使用中性占位称呼，避免继续强化旧名称。

## 5. 功能需求

- **FR-001**：系统必须引入 `Application` 作为顶层业务容器，用于组织项目、机器人、工作流、技能、模型策略和产物。
- **FR-002**：系统必须支持把代码目录、文档目录、PPT 目录、研究目录等统一抽象为 `Project`。
- **FR-003**：系统必须把机器人定义为“角色 + 技能 + 模型策略 + 权限范围”的执行单元，而不是单一模型实例。
- **FR-004**：系统必须允许工作流挂载到应用层，并驱动机器人围绕项目执行任务。
- **FR-005**：系统必须保留网关、Provider、Model 的系统基础设施属性，不与应用业务层混淆。
- **FR-006**：系统必须用统一的 `Artifact` 抽象承载代码、文档、报告、PPT 大纲、测试报告等不同产物。
- **FR-007**：系统必须支持未来扩展连接器，以适配本地目录、远程仓库和其他资产来源。
- **FR-008**：系统必须把品牌命名升级与界面风格重构纳入产品规划范围，并明确它们服务于新的产品定位。
- **FR-009**：系统必须把本轮产品边界、路线图和确认结论同步沉淀到需求分析资产。

## 6. 关键对象

- **Application**：业务工作台，绑定项目、机器人、工作流、技能、模型策略和运行历史。
- **Project**：真实资产源，可以是代码仓库、文档目录、PPT 目录、研究资料目录等。
- **Agent**：执行角色，包含角色定位、提示词、模型策略、技能集和权限范围。
- **Workflow**：执行流转定义，决定不同角色如何接力、审批、产生产物。
- **Skill**：可复用能力单元，支持全局、应用级和机器人级作用域。
- **Gateway**：运行时执行基础设施，负责承接调用链路。
- **Artifact**：执行结果实体，统一承载不同类型的输出物。
- **Run**：一次应用级任务执行，关联会话、执行状态和产物沉淀。
- **Room**：现有系统中的协作空间对象，短期保留，长期不再作为顶层业务容器。

## 7. 成功标准

- **SC-001**：团队能够用一页产品边界文档清楚解释新产品中应用、项目、机器人、工作流、模型和网关的关系。
- **SC-002**：代码开发、文档写作、PPT 制作至少三类场景都能被同一套对象模型解释。
- **SC-003**：品牌升级、导航重构和视觉设计都能够回扣到同一套产品目标，而不是独立漂移。
- **SC-004**：后续迭代可以基于本规格继续拆分页面、数据模型和阶段计划，而不需要重新定义顶层概念。
- **SC-005**：团队能够明确说出当前阶段不做什么，并据此拒绝超出边界的实现诉求。

## 8. 假设与依赖

- 假设 1：现有群聊、项目绑定、工作流模板、技能浏览等能力将继续保留并被逐步重构，而不是废弃重做。
- 假设 2：Hermes 网关与现有模型管理能力仍然是平台执行基础设施。
- 假设 3：需求分析目录将作为本项目产品边界和长期规划的沉淀位置之一。
- 假设 4：新品牌名将在后续规划阶段确认，但本轮已经明确不再沿用 `Hermes Web UI`。

## 9. 待澄清事项

- 后续正式对外命名应使用“应用”“工作台”还是“空间”？
- `Room` 与 `Application` 在数据库与前端路由层是演进替换还是长期并存？
- 第一批优先支持的非代码连接器具体是本地文档目录、远程 Git，还是云文档平台？

## 10. 阶段边界补充

- 当前阶段优先产出目标、成功标准、非目标与阶段边界，不进入完整信息架构和实现方案。
- 在领域模型未完成前，不应直接承诺具体页面结构或数据库迁移方式。
- 在品牌方向未明确前，不应直接进行大规模视觉替换。

## 11. 信息架构补充

- 顶层导航建议调整为 `Applications / Runs / Resources / System`。
- `Project / Agent / Workflow / Artifact / Run` 应作为应用内主分区组织。
- `Room / Group Chat` 长期应并入应用内 `Collaboration` 视图。
- `Gateways / Models / Providers / Profiles / Channels` 应退居系统管理层。

## 12. 品牌与界面补充

- 需建立项目级 `DESIGN.md` 作为后续 UI 的视觉源文件。
- 首页应以应用入口、最近运行、最近产物和模板作为主内容，而不是系统配置卡片。
- 应用列表页和应用详情页是新品牌最重要的核心页面。
- 应用详情页应内含 `Overview / Projects / Agents / Workflow / Artifacts / Runs / Collaboration / Settings`。

## 13. 页面级线框补充

- 首页的主任务是进入已有应用、创建新应用和继续最近一次工作。
- 应用列表页应展示名称、目标摘要、主项目、角色数、最近运行与产物状态。
- 应用详情页头部主操作聚焦在 `Start Run / Open Workflow / View Artifacts`。
- `Overview` 必须承担“下一步推荐”职责。
- `Projects` 不再是群聊弹窗附属能力，而是应用内正式分区。

## 14. 状态与交互补充

- 应用生命周期建议统一为：`empty / draft / setup_required / ready / running / waiting_review / blocked / failed / completed`。
- 未绑定项目、未配置 Agent、未配置 Workflow 时，系统应阻止直接开始运行，并提供明确跳转入口。
- 待审批、待确认产物、失败运行都必须有清晰的状态说明和修复动作。
- 空状态不是占位图，而是下一步引导。

## 15. 创建向导补充

- 创建应用建议采用 5 步向导：场景选择、定义应用、绑定项目、配置角色、选择流程并完成。
- 当前已有房间创建、项目绑定、Agent 配置、Workflow 配置能力，应尽量复用并重组成向导，而不是完全重写。
- 首次创建应优先达成“最小可运行闭环”，而不是一次性暴露全部高级设置。

## 16. 澄清记录

- 2026-05-27：用户确认产品目标应支持任意项目、任意场景，不局限于程序开发。
- 2026-05-27：用户确认本轮先进行产品边界拆分、能力规划与设计思考，不立即进入具体实现。
- 2026-05-27：用户确认未来产品不再沿用 `Hermes Web UI` 名称，并要求将界面风格重做纳入本轮规划考虑。
- 2026-05-27：用户要求研发流程回到“先定目标，再定成功标准和边界，再谈设计和下一步”。
- 2026-05-27：本轮领域模型校验确认 `Application` 应成为新的顶层业务容器，`Room` 需降级为协作空间语义。
- 2026-05-27：本轮信息架构设计确认 `Applications` 应成为产品默认第一入口。
- 2026-05-27：本轮品牌与界面结构设计确认需要建立新的项目级视觉基线，并以应用首页与应用详情页作为核心品牌承载页面。
- 2026-05-27：本轮页面级设计确认首页、应用列表页、应用详情页是后续优先落地的第一批核心页面。
- 2026-05-27：本轮状态系统设计确认关键状态与下一步引导必须在第一批核心页面中优先落地。
- 2026-05-27：用户要求后续设计必须对照当前已有系统，不做与现状脱节的抽象方案。
- 2026-05-27：本轮迁移策略设计确认应采用“先做应用视图与新入口、再做数据与接口抽象”的渐进迁移方式，不直接推翻现有 `Room / Group Chat` 能力。

## 17. 迁移策略补充

- 迁移原则 1：第一阶段优先重组现有能力，不优先大规模重构底层数据表。
- 迁移原则 2：`Application` 在第一阶段可以是对现有 `Room` 的业务包装，前端和产品表达统一使用应用语义。
- 迁移原则 3：现有 `GroupChatPanel`、项目绑定、Agent 配置、工作流编辑、产物浏览与运行状态能力均应优先复用。
- 迁移原则 4：旧的 `/hermes/*` 路由短期保留，新产品应新增以应用为中心的工作台路由，不立刻硬切旧用户。
- 迁移原则 5：应用详情第一阶段可以先基于现有群聊工作台重组为过渡壳，再逐步拆分成 `Overview / Projects / Agents / Workflow / Artifacts / Runs / Collaboration`。
- 迁移原则 6：第一阶段不优先承诺多项目、远程 Git、复杂权限和高风险自动写入能力。

## 18. 第一阶段实现建议

- 先新增应用中心化导航壳与首页入口。
- 先基于现有房间列表映射出应用列表页。
- 先基于现有房间详情与群聊面板重组出应用详情过渡页。
- 先把房间创建包装为应用创建向导第一版。
- 后续再逐步把项目、角色、工作流从弹窗能力升级为应用内正式分区。

## 19. 分阶段实施补充

- 实施阶段 1：壳层对齐与应用入口铺设，优先落路由、侧边栏和应用视图模型。
- 实施阶段 2：应用中心化第一可用版本，优先落应用列表、应用详情过渡页、创建应用向导和状态映射。
- 实施阶段 3：应用详情能力拆分，逐步把 `Projects / Agents / Workflow / Artifacts / Collaboration` 从重弹窗和大组件中拆成正式分区。
- 实施阶段 4：数据与接口语义升级，视稳定度再决定是否引入独立 `applications` 持久层与新 API 语义。

## 20. 当前推荐的第一批开发顺序

- 先新建 `Applications` 路由域。
- 先重组 `AppSidebar` 进入应用中心化信息架构。
- 先增加 `Application` 前端视图模型与 `Room -> Application` 映射层。
- 先做应用列表页。
- 先做应用详情过渡页。
- 先包装房间创建为创建应用向导。
- 最后补齐应用状态推导与空状态引导。

## 21. 澄清记录补充

- 2026-05-27：本轮分阶段实施规划确认第一阶段优先改前端壳、导航和应用聚合层，而不是优先改数据库与底层接口。

## 22. Phase 1 研发拆解补充

- Phase 1 应新增独立的 `Application` 前端视图模型，不直接让新页面继续消费 `RoomInfo`。
- Phase 1 应新增 `applications` 聚合层与 store，负责应用目录和详情摘要。
- 现有 `group-chat store` 在 Phase 1 中应继续承担协作运行时职责，不应被扩展成应用目录主 store。
- 应用详情页在 Phase 1 中应采用“新壳 + 旧协作内核”的过渡方式，优先落 `Overview` 与 `Collaboration`。
- 创建应用向导在 Phase 1 中应优先包装现有 `CreateRoomForm`，而不是完全重写创建链路。

## 23. 当前推荐的 Phase 1 文件级任务

- 新增 `views/workbench/ApplicationsView.vue`
- 新增 `views/workbench/ApplicationDetailView.vue`
- 新增 `views/workbench/ApplicationCreateView.vue`
- 新增 `components/workbench/ApplicationCard.vue`
- 新增 `components/workbench/ApplicationHeader.vue`
- 新增 `components/workbench/ApplicationSectionNav.vue`
- 新增 `components/workbench/ApplicationCreateWizard.vue`
- 新增 `types/workbench/application.ts`
- 新增 `api/workbench/applications.ts`
- 新增 `stores/workbench/applications.ts`
- 修改 `router/index.ts`
- 修改 `components/layout/AppSidebar.vue`
- 修改 `i18n` 侧边栏与应用页文案

## 24. 澄清记录补充

- 2026-05-27：本轮 Phase 1 研发拆解确认新应用聚合层与旧群聊运行时应分层，而不是把 `group-chat store` 继续扩成新产品主 store。

## 25. Phase 1 页面与数据结构补充

- `ApplicationSummary` 应作为应用列表和首页最近应用的最小视图模型，字段只保留列表当前需要消费的信息。
- `ApplicationDetail` 应作为应用详情头部、Overview 和分区导航的最小视图模型，不直接承载消息流和文件树。
- Phase 1 中 `goalSummary` 与 `scenario` 允许来自前端推导或为空，不要求假设后端已存在稳定持久层字段。
- 应用列表页首版应优先做目录视图，最小支持搜索、场景筛选、状态筛选和创建入口。
- 应用详情页首版应优先做 `Overview + Collaboration`，其他分区先以摘要卡和 CTA 形式出现。

## 26. Room 映射补充

- 前端应集中提供 `mapRoomAggregateToApplicationSummary()` 与 `mapRoomAggregateToApplicationDetail()` 映射函数。
- `Room -> Application` 映射输入应至少包含：房间基础信息、项目绑定、Agent 列表、工作流运行态、节点运行态。
- 当项目、运行态或产物补拉失败时，应用列表与详情应允许降级显示，而不是整体不可用。

## 27. 下一阶段功能模块补充

- 下一阶段功能设计应围绕八个模块推进：
  - `Applications Home`
  - `Application Overview`
  - `Projects Workspace`
  - `Agents Workspace`
  - `Workflow Workspace`
  - `Artifacts Workspace`
  - `Runs Workspace`
  - `Collaboration Workspace`
- `Applications Home` 的目标是帮助用户继续已有工作、创建新应用、发现阻塞应用，而不是只做目录卡片。
- `Application Overview` 必须承担“当前状态解释 + 下一步推荐”职责。
- `Projects Workspace` 应把当前项目绑定、文件上下文、Git 状态和权限摘要从群聊附属能力升级为应用内正式分区。
- `Agents Workspace` 应把角色分工、技能与模型策略的配置收回应用内，而不是继续主要依附于底层模型页。
- `Workflow Workspace` 应把当前工作流模板、节点分工、审批点和产物要求提升为应用内正式主线。
- `Artifacts Workspace` 应把产物从“协作过程附属结果”升级为应用主视图资产。
- `Runs Workspace` 应把运行记录、失败状态、待审批状态和运行到产物的关系集中表达出来。
- `Collaboration Workspace` 在第一阶段应继续复用现有 `GroupChatPanel`，重点是放回应用详情正确位置，而不是立即重写协作内核。

## 28. Workflow Workspace 补充

- `Workflow Workspace` 第一阶段应优先把房间内已有 workflow 配置能力正式提升为应用内分区。
- 第一阶段 `Workflow Workspace` 至少应包含：
  - workflow 概览
  - workflow 运行态摘要
  - workflow 模板选择与应用
  - workflow 可视化编辑与保存
- 第一阶段 `Workflow Workspace` 不应先重写协作聊天内核，而应复用：
  - `group-chat store`
  - `updateRoomWorkflowConfig`
  - `getRoomWorkflowState`
  - `listWorkflowTemplates`
  - `LogicFlowWorkflowEditor`
- `Workflow Workspace` 必须显式展示 workflow 角色覆盖情况，帮助用户在应用层识别流程角色缺口。
- 模板应用能力应支持两种路径：
  - 只应用 workflow 编排
  - 应用 workflow 编排并补齐 starter agents

## 29. Artifacts Workspace 补充

- `Artifacts Workspace` 第一阶段应优先把房间内已有 artifact 浏览能力提升为应用内正式分区。
- 第一阶段 `Artifacts Workspace` 至少应包含：
  - 产物根目录与当前目录上下文
  - 产物目录浏览
  - 产物文件内容预览
  - 与当前 workflow run 的关联摘要
- 第一阶段 `Artifacts Workspace` 应优先复用：
  - `group-chat store` 的 artifacts state
  - `listRoomArtifacts`
  - `getRoomArtifactContent`
- 第一阶段 `Artifacts Workspace` 的目标是把产物正式可见化，而不是先做完整审批、下载、版本治理中心。

## 30. Runs Workspace 补充

- `Runs Workspace` 第一阶段应优先把房间内已有 workflow 运行态正式提升为应用内分区。
- 第一阶段 `Runs Workspace` 至少应包含：
  - 当前 run 状态摘要
  - 当前节点与角色说明
  - 节点运行时间线
  - 审批、驳回、取消等关键动作入口
- 第一阶段 `Runs Workspace` 应优先复用：
  - `group-chat store` 的 workflow runtime state
  - `submitRoomWorkflowApproval`
  - `cancelRoomWorkflowExecution`
- 第一阶段 `Runs Workspace` 的重点是让“执行现场”正式可见，而不是先做完整 run 历史治理系统。

## 31. Collaboration Workspace 壳层补充

- `Collaboration Workspace` 第一阶段不应直接重写协作核心，而应先增加应用级协作壳层。
- 第一阶段协作壳层至少应包含：
  - 协作摘要
  - 为什么进入协作区的解释
  - refresh collaboration context
  - 下方继续承接原 `GroupChatPanel`
- 第一阶段 `Collaboration Workspace` 的重点是先把旧协作核心放回新的应用语义容器中，再决定后续如何继续拆分和重构。

## 32. Application Detail UI 收口补充

- 在应用详情的主要正式分区全部接通后，应追加一轮 UI 收口，而不是立即继续扩功能。
- 这一轮收口至少应覆盖：
  - 应用详情头部 hero 化
  - Overview 驾驶舱化
  - section nav 与内容卡片的统一节奏
- 这一轮的重点是让应用详情从“功能拼接页”转向“工作台页面”。

## 33. Workbench 核心页面视觉统一补充

- 在应用详情完成第一轮收口后，应继续把 `Applications / Create / Detail` 三张核心页面的视觉语言拉齐。
- 这一轮统一至少应覆盖：
  - hero 结构
  - 卡片层次
  - CTA 节奏
  - 引导文案密度
- 这一轮的目标是让用户在三张核心页面之间获得连续的工作台体验。

## 28. 下一阶段模块优先级补充

- P1：
  - `Applications Home`
  - `Application Overview`
  - `Projects Workspace`
  - `Agents Workspace`
- P2：
  - `Workflow Workspace`
  - `Artifacts Workspace`
  - `Runs Workspace`
- P3：
  - `Collaboration Workspace` 的深度重构

## 29. 下一阶段用户痛点补充

- 用户不知道该从哪个应用继续开始。
- 用户不知道当前应用还差什么才能进入可运行状态。
- 用户不知道项目、角色、流程和结果之间的关系。
- 非代码场景用户会觉得系统仍然偏开发工具，而不是通用项目执行平台。

## 30. 澄清记录补充

- 2026-05-27：本轮 Phase 1 页面与数据结构草案确认现有 `RoomInfo` 不具备稳定应用目标摘要字段，因此 `goalSummary` 在第一阶段应允许为空或来自推导。

## 31. P1 模块详细设计补充

- P1 应优先细化并实现四个高优模块：
  - `Applications Home`
  - `Application Overview`
  - `Projects Workspace`
  - `Agents Workspace`
- `Applications Home` 的页面职责是作为默认工作入口，支持继续已有应用、筛选应用和创建新应用，不承担深度配置职责。
- `Application Overview` 的页面职责是解释当前应用状态、暴露准备清单并提供下一步推荐，不承担完整配置编辑职责。
- `Projects Workspace` 的页面职责是把项目绑定、路径、Git 状态、权限摘要和文件上下文正式提升为应用内分区。
- `Agents Workspace` 的页面职责是把角色列表、角色职责、技能与模型策略摘要正式提升为应用内分区。

## 32. P1 数据与交互补充

- `Applications Home` 在 P1 中继续消费 `ApplicationSummary`，重点字段包括应用名称、场景、目标摘要、状态、主项目、角色数、工作流状态和最近运行时间。
- `Application Overview` 在 P1 中继续消费 `ApplicationDetail`，重点字段包括状态、状态原因、主项目、Agent 摘要、Workflow 摘要、Run 摘要、Artifact 摘要和 `nextAction`。
- `Projects Workspace` 在 P1 中至少需要主项目摘要字段：
  - `id`
  - `name`
  - `description`
  - `sourceType`
  - `localPath`
  - `gitEnabled`
  - `currentBranch`
- `Agents Workspace` 在 P1 中至少需要角色摘要字段：
  - 角色名称
  - 角色描述
  - profile
  - model 摘要
  - invited/enabled 状态
- `Overview -> Projects` 和 `Overview -> Agents` 的引导链路必须清晰，补齐项目或角色后用户应能返回总览重新确认状态。

## 33. P1 首版边界补充

- `Projects Workspace` 在 P1 中不优先承诺：
  - 多项目主从关系
  - 远程仓库 OAuth 接入
  - 在线代码编辑器
  - 自动提交与推送审批中心
- `Agents Workspace` 在 P1 中不优先承诺：
  - 跨应用角色资产库
  - 角色继承体系
  - 复杂权限审批流
- `Applications Home` 和 `Application Overview` 在 P1 中不优先承诺复杂统计图、应用健康评分和业务图谱。

## 34. Projects Workspace 实现补充

- `Projects Workspace` 在 P1 中应优先复用现有项目能力：
  - `bindLocalProject`
  - `bindRoomProject`
  - `getRoomProject`
  - `getProjectDetail`
  - `listProjectFiles`
  - `getProjectGitStatus`
  - `getProjectGitBranches`
- `Projects Workspace` 首版建议拆成三块：
  - 主项目摘要
  - 项目 readiness
  - 项目操作区
- `Projects Workspace` 首版应先支持：
  - 查看当前主项目
  - 绑定已有项目
  - 绑定本地项目
  - 查看文件树摘要
  - 查看 Git 摘要
- `Projects Workspace` 页面不应直接暴露 `RoomProjectResult` 原始结构，建议先映射为应用内项目视图模型。

## 35. Agents Workspace 实现补充

- `Agents Workspace` 在 P1 中应优先复用现有角色能力：
  - `listAgents`
  - `addAgent`
  - `updateAgent`
  - `removeAgent`
  - `saveDefaultAgents`
  - `applyDefaultAgents`
- `Agents Workspace` 首版建议拆成三块：
  - 角色总览
  - 角色卡片列表
  - 角色操作区
- `Agents Workspace` 首版应先支持：
  - 查看角色列表
  - 新增角色
  - 编辑角色
  - 删除角色
  - 默认角色保存与应用
- `Agents Workspace` 应继续复用当前 workflow 角色对齐校验和删除保护逻辑。

## 36. 实现层补充

- `Projects Workspace` 与 `Agents Workspace` 不建议把逻辑直接堆在 `ApplicationDetailView.vue` 中。
- 建议新增 workspace 级 composable 或 adapter：
  - `useApplicationProjectWorkspace()`
  - `useApplicationAgentWorkspace()`
- `applications store` 继续负责应用级摘要；workspace composable 负责 room 级运行时数据装配；组件层只消费整理后的 view model。

## 37. 当前推荐的文件级补充

- 建议新增：
  - `components/workbench/projects/*`
  - `components/workbench/agents/*`
  - `composables/workbench/useApplicationProjectWorkspace.ts`
  - `composables/workbench/useApplicationAgentWorkspace.ts`
- 建议补充的应用内类型：
  - `ApplicationProjectSummary`
  - `ApplicationProjectExplorerState`
  - `ApplicationAgentSummary`
  - `ApplicationAgentWorkspaceSummary`

## 38. Workbench 全局设计基线补充

- 在 `Applications / Create / Detail` 三张核心页面完成一轮视觉统一后，应进一步建立 workbench 级共享视觉原语，而不是继续把样式重复堆在各页面组件中。
- 建议在全局样式层补充 workbench token 与 utility class，优先统一：
  - page background
  - hero background
  - shared workbench card
  - interactive card hover
  - scenario/status pill
  - primary/secondary action button
  - stat card
- `ApplicationHeader`、`ApplicationCard`、`ApplicationOverviewPanel`、`ApplicationsView`、`ApplicationCreateView`、`ApplicationCreateWizard` 应优先切到共享样式基线。
- 这一步的目标不是做最终品牌升级，而是先建立品牌可替换层，为后续产品改名和整体风格升级降低成本。

## 39. Workspace 级视觉统一补充

- workbench 的统一不应停留在入口页和详情外壳层，还应继续下沉到各 workspace 的二级容器与信息卡。
- 建议在全局 workbench 样式层继续补充并复用：
  - panel
  - soft block
  - key-value card
  - empty state
  - section title
- `Projects`、`Agents`、`Collaboration` 等 workspace 应优先接入这套二级基线，降低“首页已经产品化、子页仍是后台配置页”的断层感。

## 40. 品牌迁移分层补充

- 新品牌迁移不应直接等同于仓库、CLI、数据目录、路由前缀的全面重命名。
- 建议拆成三层推进：
  - 展示层迁移
  - 产品语言迁移
  - 运行时契约迁移
- 当前阶段优先推进：
  - 前台 UI 品牌常量统一
  - 导航命名与页面说明文案收口
  - 更明确地区分“新产品工作台”和“底层 Hermes runtime”
- 当前阶段不建议直接修改：
  - `hermes-web-ui` CLI 包名
  - `~/.hermes-web-ui` 数据目录
  - `/hermes/*` 路由前缀
  - server 侧 Hermes 运行时模块命名

## 41. 前端品牌配置层补充

- `branding.ts` 不应只承载品牌名称和 logo，还应逐步承载：
  - tagline
  - product promise
  - workbench hero 文案
  - 空状态核心文案
  - 页面标题规则
- 建议新增前端 composable 统一管理浏览器标题同步，优先覆盖：
  - 登录页
  - 应用列表
  - 应用创建
  - 应用详情
- 这样后续调整品牌方向时，可优先改配置层而不是逐页查找硬编码。

## 42. 显示层品牌收口补充

- 在正式新品牌尚未最终确认前，显示层应优先采用 `workspace / workbench / execution` 这类中性产品语义。
- 登录页、浏览器标题、聊天空状态、会话范围提示、网关状态提示等高曝光入口应优先纳入统一品牌配置和多语言收口范围。
- `BRAND_FULL_NAME` 可在显示层先采用中性过渡名，以减少旧前台名称暴露，但不应被误解为运行时契约已经迁移完成。
- `ja / ko / pt / fr / es / de` 等非中英文语言包的高曝光入口，也应与中英文一并清理，避免品牌迁移只在局部成立。

## 43. 运行时契约边界补充

- 当前阶段的品牌迁移仍限定在显示层与产品语言层，不包括 CLI、存储目录、接口前缀和后端模块命名。
- `hermes-web-ui` CLI/package、`~/.hermes-web-ui`、`/hermes/*` 路由以及后端 Hermes 命名空间，在本阶段应继续保留。
- 如果未来要推进运行时契约迁移，应作为独立专题评估兼容性、升级路径和数据迁移成本，而不是夹带在前端换壳过程中完成。
