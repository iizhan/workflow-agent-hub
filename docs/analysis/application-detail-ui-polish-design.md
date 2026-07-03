# Application Detail UI 收口设计

## 1. 本轮目的

在应用详情的主要正式分区已经全部接通之后，这一轮不再扩模块，而是回到产品完成度。

目标是先解决三个问题：

- 应用详情头部是否像真正的工作台头部
- Overview 是否真正承担导航驾驶舱职责
- 分区导航和内容卡片是否已经形成统一节奏

## 2. 本轮判断

虽然 `Projects / Agents / Workflow / Artifacts / Runs / Collaboration` 都已经接入，但此前页面仍然更像：

- 功能分区集合
- 旧系统能力的重组页

还不够像：

- 一个有清晰主线的应用工作台

## 3. 本轮收口重点

### 3.1 Header 产品化

本轮把头部从“标题 + 按钮”提升为：

- hero copy
- primary / secondary actions
- project / agents / workflow / run 四个摘要位

这样用户进入详情后，第一眼就能理解：

- 这是哪个应用
- 当前主要状态是什么
- 哪几个关键骨架是否到位

### 3.2 Overview 驾驶舱化

本轮在 `Overview` 中补了一层 `Recommended Next Moves`，让页面不只解释状态，还更明确地引导：

- 去完善 workflow
- 去检查 artifacts
- 去进入 collaboration

### 3.3 Section Nav 与整体视觉节奏统一

本轮对 section nav 和内容区做了更明显的工作台化处理：

- sticky nav
- 更轻的玻璃感背景
- 更统一的卡片背景与层级
- 更明确的页面氛围底纹

## 4. 本轮工程落点

本轮主要更新：

- `components/workbench/ApplicationHeader.vue`
- `components/workbench/ApplicationOverviewPanel.vue`
- `components/workbench/ApplicationSectionNav.vue`
- `views/workbench/ApplicationDetailView.vue`

## 5. 当前最重要的判断

这一轮的价值不在于新增功能，而在于把“已经接好的模块”组织成更完整、更可读、更像一个产品的工作台页面。

这会直接决定后续品牌升级和更深层协作重构时，用户是否已经能感知到新产品形态。
