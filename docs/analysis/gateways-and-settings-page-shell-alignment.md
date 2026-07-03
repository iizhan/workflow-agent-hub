# Gateways 与 Settings 页面外壳对齐设计

## 1. 本轮目的

在 `Models / Group Chat / Files` 已完成旧模块 page shell 升级后，本轮继续处理另外两类高频旧模块页面：

- Gateways
- Settings

这两个页面原本已经有自己的 header，但仍保留明显的旧后台页结构，因此需要继续对齐到统一的 page shell 语言。

## 2. 当前问题判断

与前一批旧模块不同，`Gateways` 和 `Settings` 并不是裸面板，而是：

- 有单独 header
- 有自己的说明文字
- 但 header 结构和视觉语义仍与新 workbench 不一致

这类页面如果不处理，会成为“看起来像已经整理过，但仍不属于同一产品”的灰区。

## 3. 本轮设计结论

### 3.1 已有 header 页面也应升级到统一 hero shell

对于这类页面，不需要重写内部模块，只需要把外层改为统一的：

- workbench page background
- hero 区
- 统一标题与说明层
- 内容区 padding 节奏

这样既能保留原有功能内容，又能让页面在视觉和产品语言上与 workbench 接轨。

### 3.2 品牌配置层应继续承接旧模块顶层说明

为了避免旧模块重新出现本地硬编码，本轮继续把：

- Gateways 顶层说明
- Settings 顶层说明

纳入品牌配置层。

## 4. 本轮工程落点

本轮主要更新：

- `packages/client/src/constants/branding.ts`
- `packages/client/src/views/hermes/GatewaysView.vue`
- `packages/client/src/views/hermes/SettingsView.vue`

## 5. 下一阶段建议

在这轮之后，旧模块中高曝光页面的外壳统一已经基本成型。下一阶段更适合：

1. 清理剩余高曝光品牌硬编码点
2. 继续收口旧模块中的局部说明文案
3. 评估是否需要对剩余页面做轻量 hero 对齐或只做标题层统一
