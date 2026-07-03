# 应用详情主链路文案收口设计

## 1. 本轮目的

在应用级 `Settings` 分区已经正式落地之后，应用详情主链路仍然保留多处偏开发中的英文硬编码。

这些内容虽然不影响功能，但会持续削弱“这是完整产品页”的感受，因此需要优先收口。

## 2. 当前问题判断

高曝光问题集中在四块：

- section 导航标签
- header hero 的统计标签与 CTA
- overview 卡片的标题与引导语
- detail overview 下方四张摘要卡的标题与按钮

这些位置都是用户进入应用详情后第一眼会看到的内容。

## 3. 本轮设计结论

### 3.1 导航标签应更贴近真实工作语义

本轮将部分导航从通用对象名收口为更像工作过程的表达：

- `Projects` -> `Project Context`
- `Agents` -> `Agent Team`
- `Workflow` -> `Execution Flow`
- `Artifacts` -> `Outputs`
- `Runs` -> `Run State`

### 3.2 Header 与 Overview 应强调“执行工作台”，而不是“对象总览页”

Hero 与 overview 区不应只是罗列状态，而应帮助用户理解：

- 当前应用是否准备好了
- 下一步去哪里推进
- 项目、角色、流程和运行状态分别代表什么

## 4. 本轮工程落点

本轮主要更新：

- `packages/client/src/components/workbench/ApplicationSectionNav.vue`
- `packages/client/src/components/workbench/ApplicationHeader.vue`
- `packages/client/src/components/workbench/ApplicationOverviewPanel.vue`
- `packages/client/src/views/workbench/ApplicationDetailView.vue`

## 5. 本轮结果

- 应用详情页的首屏语言更接近完整产品化表达
- overview 与 section 导航之间的语义更加一致
- 应用详情主链路已经比此前更像真正的“执行工作台”

## 6. 下一阶段建议

1. 继续收口 `runs / artifacts / projects / agents` 子工作区中的高曝光硬编码
2. 逐步补充统一的 workbench 文案配置层，而不是每个组件各写一套
3. 在完成文案收口后，再继续推进细节交互和视觉层优化
