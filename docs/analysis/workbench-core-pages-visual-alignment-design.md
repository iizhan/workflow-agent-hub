# Workbench 核心页面视觉统一设计

## 1. 本轮目的

这一轮不再只关注 `ApplicationDetail`，而是把 workbench 的三张核心页面一起拉齐：

- `ApplicationsView`
- `ApplicationCreateView`
- `ApplicationDetailView`

目标是让用户在这三页之间切换时，感受到的是同一个产品，而不是三个各自独立的页面实现。

## 2. 本轮判断

此前虽然应用工作台主链路已经接通，但三张核心页面仍存在明显差异：

- 头部表达方式不一致
- 卡片层次不完全统一
- CTA 密度和文案节奏不一致

这会削弱“新产品已经形成”的感知。

## 3. 本轮统一重点

### 3.1 Hero 语言统一

本轮让 `ApplicationsView` 与 `ApplicationCreateView` 也引入更明确的 hero 区，而不再只是普通后台页头。

统一方向包括：

- eyebrow
- 更大的标题
- 更长的工作台型说明文案
- 更清晰的主 CTA

### 3.2 卡片层次统一

本轮统一了：

- 柔和底纹
- 轻玻璃感背景
- 大卡片层次
- hover 抬升反馈

这样 `ApplicationCard`、`CreateWizard` 和 `Detail` 内容区会更像同一套 workbench 视觉。

### 3.3 文案密度统一

本轮加强了文案的“工作引导感”，避免页面只剩下字段标签和按钮。

重点方向是：

- 更少后台话术
- 更多“为什么做这一步”的表达
- 更清晰的下一步心理预期

## 4. 本轮工程落点

本轮主要更新：

- `views/workbench/ApplicationsView.vue`
- `views/workbench/ApplicationCreateView.vue`
- `components/workbench/ApplicationCard.vue`
- `components/workbench/ApplicationCreateWizard.vue`

## 5. 当前最重要的判断

这一轮的价值是把核心三页从“已经可用”进一步推进到“已经开始形成统一产品气质”。

这样下一步继续做 `DESIGN.md` 基线升级、全局变量调整和品牌收口时，页面已经有了统一承接面。
