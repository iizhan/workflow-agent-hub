# 登录与聊天入口品牌文案迁移设计

## 1. 本轮目的

在品牌配置层初版已经落地后，本轮继续把高频入口页面纳入迁移范围：

- 登录页
- 聊天主空状态

这两个位置对用户的第一印象影响很大，也最容易暴露“旧品牌前台语言”和“新工作台定位”之间的不一致。

## 2. 当前问题判断

虽然核心 workbench 页面已经在走新的产品语言，但登录和聊天入口仍保留了一些更早期的表达方式：

- 依赖页面内部硬编码
- 仍出现旧的前台品牌字眼
- 文案没有完全对齐“工作台 + 运行时”分层表达

## 3. 本轮设计结论

### 3.1 高曝光入口优先接品牌配置层

相比一次性修改所有语言包，更合理的方式是优先改造高频入口，使它们开始依赖品牌配置层，而不是继续散落在 i18n 或组件内部硬编码。

### 3.2 前台应减少对底层运行时名称的直接暴露

本轮收口原则不是完全隐藏 Hermes / OPC 这类底层名称，而是让用户首先感知到：

- 这是一个工作台
- 底层有运行时
- 网关是执行基础设施

因此把部分“OPC gateway / OPC Assistant / Web UI”式表述，调整成更中性的：

- assistant
- execution gateway
- workspace
- runtime

更符合当前的产品方向。

## 4. 本轮工程落点

本轮主要更新：

- `packages/client/src/constants/branding.ts`
- `packages/client/src/views/LoginView.vue`
- `packages/client/src/components/hermes/chat/MessageList.vue`
- `packages/client/src/i18n/locales/en.ts`
- `packages/client/src/i18n/locales/zh.ts`

## 5. 下一阶段建议

下一阶段可以继续沿同一路径推进：

1. 继续把更多页面标题接入品牌配置层
2. 逐步迁移剩余高曝光入口文案
3. 再评估是否对其他语言包做更系统的品牌收口
