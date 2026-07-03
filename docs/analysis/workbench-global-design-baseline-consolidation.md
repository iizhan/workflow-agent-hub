# Workbench 全局设计基线收敛设计

## 1. 本轮目的

在 `Applications / Create / Detail` 三张核心页面已经完成一轮视觉拉齐后，本轮进一步把重复出现的视觉模式抽成全局 workbench 基线，避免后续继续靠页面内局部样式堆叠。

目标不是只让当前页面更好看，而是让后续的：

- 新工作台分区
- 品牌更名后的界面收口
- 通用卡片与状态表达

都能建立在同一套基础之上。

## 2. 当前问题判断

虽然上一轮已经把核心页面的观感拉近，但样式仍然散落在各个组件内部，主要重复集中在：

- hero 区背景和标题节奏
- 应用卡片与向导卡片的层次表达
- scenario/status pill
- 主次 CTA 按钮
- 统计卡片和轻量信息面板

这会带来两个直接问题：

1. 后续新模块继续复制样式，工作台越做越散。
2. 一旦后面进入品牌改名与主题升级阶段，调整成本会明显上升。

## 3. 本轮设计结论

### 3.1 先沉淀工作台层的视觉原语

在现有全局变量基础上，补充 workbench 级 token 和共享类，优先覆盖：

- 页面背景
- hero 背景
- 通用 workbench 卡片
- 轻交互卡片 hover
- pill
- 状态 pill
- 主次操作按钮
- 统计卡片

这让 workbench 区域开始具备“系统级样式层”，而不只是页面局部实现。

### 3.2 页面继续允许个性，但不再重复造轮子

统一基线不等于所有页面完全一样。

本轮原则是：

- 共性结构进入全局
- 页面特有表达继续保留在局部

例如：

- `ApplicationHeader` 仍保留自己的 hero 排版
- `ApplicationCard` 仍保留列表卡片的局部布局
- 但它们不再各自重复维护 pill、按钮、hover 阴影、底层卡片质感

### 3.3 为品牌升级提前铺路

用户已经明确未来产品不再叫 `Hermes Web UI`，而且界面风格也要一起改。

因此本轮收敛不只是代码整理，更是提前建立“品牌可替换层”：

- 先统一视觉基线
- 再在后续迭代中切品牌语言、配色策略和命名体系

这样改名时不会需要逐页返工。

## 4. 本轮工程落点

本轮主要更新：

- `packages/client/src/styles/variables.scss`
- `packages/client/src/styles/global.scss`
- `components/workbench/ApplicationHeader.vue`
- `components/workbench/ApplicationOverviewPanel.vue`
- `components/workbench/ApplicationCard.vue`
- `views/workbench/ApplicationsView.vue`
- `views/workbench/ApplicationCreateView.vue`
- `components/workbench/ApplicationCreateWizard.vue`

## 5. 这轮之后的价值

这轮完成后，workbench 的核心页面不再只是“看起来差不多”，而是开始共享一套真正可复用的视觉地基。

这会直接支持下一阶段：

- workbench 子模块继续统一
- 品牌更名后的产品语言收口
- 更完整的 DESIGN.md / design system 规范落地
