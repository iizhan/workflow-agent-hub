# 前端品牌配置层初始化设计

## 1. 本轮目的

在品牌迁移分层和展示层文案收口之后，本轮继续把前台品牌表达从“零散常量引用”推进到“可扩展品牌配置层”。

目标是让后续品牌调整不再需要逐页查找字符串，而是通过统一配置驱动：

- 页面标题
- workbench hero 文案
- 空状态文案
- 基础品牌承诺表达

## 2. 当前问题判断

虽然客户端已经有 `branding.ts`，但此前主要只覆盖：

- `BRAND_NAME`
- `BRAND_FULL_NAME`
- `BRAND_LOGO_PATH`

这仍然不够，因为 workbench 的核心产品表达还散落在页面内部硬编码。

如果后续确定新品牌定位或要继续改语气，仍然需要手动改多个页面组件。

## 3. 本轮设计结论

### 3.1 品牌层不应只包含名字和 logo

前台品牌配置层至少还应覆盖：

- tagline
- product promise
- workbench 顶层 hero 文案
- 空状态核心文案
- 页面标题规则

这样才能真正承担前台产品语言的收口职责。

### 3.2 页面标题同步是品牌层的重要组成

品牌统一不只是看得到的 logo 和标题，还包括浏览器页签语义。

因此本轮新增的标题同步策略，优先覆盖：

- 应用列表
- 创建应用
- 应用详情
- 登录页

后续可继续逐步扩展到更多旧模块页面。

## 4. 本轮工程落点

本轮主要更新：

- `packages/client/src/constants/branding.ts`
- `packages/client/src/composables/useBranding.ts`
- `packages/client/src/App.vue`
- `views/workbench/ApplicationsView.vue`
- `views/workbench/ApplicationCreateView.vue`
- `components/workbench/ApplicationEmptyState.vue`

## 5. 下一阶段建议

品牌配置层已经有了第一版骨架，下一阶段建议继续：

1. 将更多页面标题纳入统一规则
2. 将聊天空状态、登录说明等品牌感文案进一步接入配置层
3. 逐步评估是否把导航文案也部分纳入品牌配置，而不是只放在 i18n 文案中
