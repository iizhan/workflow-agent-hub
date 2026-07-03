# Workbench Workspace 视觉基线扩展设计

## 1. 本轮目的

在完成 workbench 核心页面统一与全局视觉基线收敛后，本轮继续把统一范围从入口页推进到各个 workspace 分区内部。

重点不是新增业务能力，而是确保用户从：

- 应用列表
- 应用创建
- 应用详情总览
- Projects / Agents / Collaboration 等分区

之间切换时，始终处于同一套产品工作台语言中。

## 2. 当前问题判断

虽然应用主链路已经统一，但子工作区内部仍有一批重复实现：

- section card
- 柔和信息面板
- key-value summary card
- empty state
- eyebrow 标题

如果这些模式继续各自分散存在，会让 workbench 出现“首页已经产品化、子页还偏后台配置页”的断层感。

## 3. 本轮设计结论

### 3.1 workbench 统一不应只停留在外壳层

真正的产品统一，不只是：

- 首页 hero 统一
- 详情头部统一

还要覆盖 workspace 内的二级结构。

因此本轮把统一粒度继续下沉到：

- panel
- soft block
- kv card
- empty state
- section title

这些可高频复用的子结构。

### 3.2 子模块允许不同信息结构，但应共享相同容器语言

本轮不要求 Projects、Agents、Collaboration 完全长得一样。

要求的是：

- 相同层级的容器拥有相同视觉语义
- 用户可以一眼识别“这是一级信息面板、这是二级信息块、这是空状态提示”

这样平台才能承载更多场景，而不是每个模块像单独拼出来的页面。

## 4. 本轮工程落点

本轮主要更新：

- `packages/client/src/styles/global.scss`
- `views/workbench/ApplicationDetailView.vue`
- `components/workbench/projects/ApplicationProjectsWorkspace.vue`
- `components/workbench/projects/ApplicationProjectSummaryCard.vue`
- `components/workbench/projects/ApplicationProjectReadinessCard.vue`
- `components/workbench/projects/ApplicationProjectExplorerCard.vue`
- `components/workbench/agents/ApplicationAgentsWorkspace.vue`
- `components/workbench/agents/ApplicationAgentOverviewCard.vue`
- `components/workbench/collaboration/ApplicationCollaborationWorkspace.vue`
- `components/workbench/collaboration/ApplicationCollaborationSummaryCard.vue`
- `components/workbench/collaboration/ApplicationCollaborationGuideCard.vue`

## 5. 下一阶段建议

在 workspace 级视觉基线已经铺开后，下一阶段适合并行推进两条线：

1. 品牌更名与命名迁移层设计
2. 继续把其余 workspace 子卡片收敛进共享设计系统

这样既不会过早牵动仓库级重命名，也能持续提升当前产品可用感和完成度。
