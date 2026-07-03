# 高曝光多语言品牌文案清理设计

## 1. 本轮目的

在 workbench、旧模块 page shell、登录与聊天入口已经逐步迁移之后，本轮继续清理多语言资源中仍然直接暴露旧前台品牌的高曝光文案。

优先处理两类：

- `login.title`
- `chat.emptyState`

因为它们几乎出现在所有语言的高频入口中。

## 2. 当前问题判断

此前虽然英文和中文已经开始往“workspace / assistant”语义迁移，但其他语言包中仍保留：

- `OPC Web UI`
- `OPC Assistant`

这会导致品牌迁移只在部分语言成立，而在其他语言入口上仍暴露旧前台语感。

## 3. 本轮设计结论

### 3.1 先统一高曝光入口，再处理更深层文案

相比全面重写多语言包，更高效的顺序是：

1. 先收口所有语言里的高曝光入口文案
2. 再逐步处理页面内部更深层说明文案

这样能用最小成本先提升整体一致性。

### 3.2 登录与聊天入口应优先使用中性产品表达

本轮统一方向是：

- 登录页标题强调“workspace login”
- 聊天空态强调“assistant”

而不再直接强调旧前台产品名。

## 4. 本轮工程落点

本轮主要更新：

- `packages/client/src/i18n/locales/en.ts`
- `packages/client/src/i18n/locales/zh.ts`
- `packages/client/src/i18n/locales/ja.ts`
- `packages/client/src/i18n/locales/ko.ts`
- `packages/client/src/i18n/locales/pt.ts`
- `packages/client/src/i18n/locales/fr.ts`
- `packages/client/src/i18n/locales/es.ts`
- `packages/client/src/i18n/locales/de.ts`

## 5. 下一阶段建议

在高曝光入口已经清理后，下一阶段可以继续：

1. 清理其余旧品牌前台字样
2. 继续对齐旧模块内部说明文案
3. 评估是否把更多多语言入口表述转为配置驱动而非静态写死
