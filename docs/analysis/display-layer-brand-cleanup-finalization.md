# 显示层品牌清理收口设计

## 1. 本轮目的

在应用工作台、旧模块 page shell、品牌配置层和多语言高曝光入口已经逐步完成迁移之后，本轮继续收口剩余的前台显示层品牌残留点。

本轮重点不是做运行时重命名，而是进一步降低用户在高曝光入口看到旧前台产品表达的概率。

## 2. 当前问题判断

在前几轮之后，仍然存在几类会直接影响统一感知的残留点：

- 登录页主标题仍直接显示旧前台全名
- 浏览器页签标题对 `workbench.runs / resources / system` 覆盖不完整
- 聊天空状态和助手头像的 `alt` 文案仍依赖旧品牌短名
- 中英文及其他语言包中仍有 `Web UI / OPC gateway` 一类高曝光前台描述

这些点虽然不影响运行时能力，但会持续强化“旧控制台”的感受。

## 3. 本轮设计结论

### 3.1 显示层继续优先使用中性工作台语义

本轮继续沿用前几轮确认的原则：

- 登录页强调 `Workspace Login`
- 页签标题强调 `Applications / Execution / Assets / Operations`
- 网关提示强调 `execution gateway`
- 会话范围强调 `workspace sessions`

### 3.2 品牌常量可以先中性收口，但不触碰运行时契约

为了让显示层更统一，本轮将 `BRAND_FULL_NAME` 收口为 `OPC Workspace`。

但本轮明确不迁移：

- `hermes-web-ui` CLI/package 名
- `~/.hermes-web-ui` 数据目录
- `/hermes/*` 路由前缀
- 后端 Hermes 命名空间

### 3.3 多语言剩余高曝光点应一并清理

如果只处理中英文，其他语言入口仍会暴露旧前台术语，因此本轮将 `ja / ko / pt / fr / es / de` 中剩余的会话范围和 profile 提示一并收口。

## 4. 本轮工程落点

本轮主要更新：

- `packages/client/src/constants/branding.ts`
- `packages/client/src/composables/useBranding.ts`
- `packages/client/src/views/LoginView.vue`
- `packages/client/src/components/hermes/chat/MessageList.vue`
- `packages/client/src/components/hermes/chat/HistoryMessageList.vue`
- `packages/client/src/components/hermes/chat/MessageItem.vue`
- `packages/client/src/App.vue`
- `packages/client/src/i18n/locales/en.ts`
- `packages/client/src/i18n/locales/zh.ts`
- `packages/client/src/i18n/locales/ja.ts`
- `packages/client/src/i18n/locales/ko.ts`
- `packages/client/src/i18n/locales/pt.ts`
- `packages/client/src/i18n/locales/fr.ts`
- `packages/client/src/i18n/locales/es.ts`
- `packages/client/src/i18n/locales/de.ts`

## 5. 本轮结果

- 登录、页签、聊天空状态、头像辅助文本和系统提示已经更稳定地落到统一工作台语言
- 应用工作台与旧模块过渡壳之间的品牌割裂进一步收窄
- 显示层品牌迁移与运行时契约迁移的边界更清楚了

## 6. 下一阶段建议

1. 继续扫前端其余可见旧词，但仅限显示层
2. 评估 `BRAND_NAME` 是否也需要在未来品牌确认后一起迁移
3. 在新正式品牌确定后，再单独规划运行时契约迁移方案
