# 旧模块页面外壳升级设计

## 1. 本轮目的

在品牌配置层已经逐步覆盖标题、空状态和 workbench hero 之后，本轮继续把部分旧模块从“裸挂功能面板”升级为具备统一产品外壳的页面。

首批优先选择：

- Models
- Group Chat
- Files

原因是这三类页面暴露频率高，但此前最像“旧系统残留页面”。

## 2. 当前问题判断

虽然这些功能本身可用，但此前存在明显断层：

- 页面没有统一 hero 层
- 顶层缺少产品语义说明
- 与新 workbench 页面切换时，观感像跳到了另一套系统

这会削弱整个产品从“旧控制台”向“统一工作台”迁移的完成度。

## 3. 本轮设计结论

### 3.1 旧模块不一定立刻重写，但应先拥有统一 page shell

在完全重构旧模块前，最有效的过渡方式不是立刻动深层业务，而是先为其补齐：

- page background
- hero
- 顶层标题
- 简短说明
- 内容区包裹层

这能显著提升整体一致性，同时保持原有功能逻辑不变。

### 3.2 品牌配置层应继续向旧模块扩展

为了避免又回到页面内部硬编码，本轮为旧模块新增了专门的 surface label 配置，让这些页面的外壳也走统一品牌层，而不是各写各的标题。

## 4. 本轮工程落点

本轮主要更新：

- `packages/client/src/constants/branding.ts`
- `packages/client/src/views/hermes/ModelsView.vue`
- `packages/client/src/views/hermes/GroupChatView.vue`
- `packages/client/src/views/hermes/FilesView.vue`

## 5. 下一阶段建议

下一阶段适合继续推进：

1. `Gateways / Settings` 等已有页头页面的语言与视觉对齐
2. 继续评估哪些旧模块值得补统一 hero，哪些只需标题层收口
3. 在不重写底层功能的前提下，持续把旧模块纳入统一产品外壳
