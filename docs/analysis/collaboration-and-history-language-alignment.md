# 协作与历史入口产品语言对齐设计

## 1. 本轮目的

在登录、工作台标题、聊天空状态和系统页说明已经基本收口之后，本轮继续处理协作与历史入口中仍然偏旧的产品语言。

重点不是改动群聊运行时能力，而是减少用户在导航、页头和关键状态提示中继续感知到“旧功能模块”的割裂。

## 2. 当前问题判断

在上一轮显示层品牌清理之后，仍然存在几类高曝光残留：

- 侧边栏继续显示 `Group Chat`
- 协作入口仍带有 `(beta)` 标记
- 历史页仍展示 `Hermes History`
- 协作页面内有一批运行状态文案直接硬编码在组件里

这些点会让新工作台的产品语言和旧协作运行时之间持续出现断层。

## 3. 本轮设计结论

### 3.1 协作入口应强调“协作工作区”而非功能型群聊

当前产品虽然仍基于 room/group-chat 运行时，但前台入口更适合使用：

- `Collaboration`
- `Collaboration Workspace`
- `协作`
- `协作工作区`

这样既不否定底层房间模型，也更贴合应用中心化工作台语义。

### 3.2 历史入口应强调运行时历史，而不是 Hermes 品牌名

对于历史页，用户更关心这是“按来源归档的运行记录”，而不是 Hermes 这个运行时名字本身。

因此入口名称和说明优先收口到：

- `Runtime History`
- `运行时历史`

### 3.3 组件内高曝光状态文案应继续转向 i18n/config 驱动

`GroupChatPanel` 内部还有多处高曝光状态直接写死：

- 激活/停用工作区
- 在线/待机状态
- 工作流未配置提示
- 工作区设置 / 清空消息 / 网关 / 系统设置按钮

这类文案如果不继续抽离，后续再做品牌或产品语言迁移时成本会持续升高。

## 4. 本轮工程落点

本轮主要更新：

- `packages/client/src/constants/branding.ts`
- `packages/client/src/components/layout/AppSidebar.vue`
- `packages/client/src/views/hermes/HistoryView.vue`
- `packages/client/src/components/hermes/group-chat/GroupChatPanel.vue`
- `packages/client/src/i18n/locales/en.ts`
- `packages/client/src/i18n/locales/zh.ts`

## 5. 本轮结果

- 侧边栏、历史页和协作页头的产品语言更接近同一套工作台表达
- `(beta)` 这类已经过时的入口标识被移除
- 协作运行时的高曝光状态提示进一步进入 i18n 管理
- 新工作台与旧协作内核之间的体验断层继续缩小

## 6. 下一阶段建议

1. 继续扫协作运行时中剩余的高曝光硬编码文案
2. 再逐步决定哪些 `groupChat` 域文案需要演进为 `collaboration` 语义
3. 保持底层 room/group-chat 运行时命名暂不迁移，避免前后端语义失配
