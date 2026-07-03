# 应用级 Settings Workspace 落地设计

## 1. 本轮目的

在应用详情页已经具备 `Projects / Agents / Workflow / Artifacts / Runs / Collaboration` 等正式分区后，`Settings` 仍然停留在占位提示状态。

这会直接影响两个判断：

- 用户会觉得应用详情还没闭环
- 应用级配置边界仍不够清楚

因此本轮优先把 `Settings` 从占位区升级为正式工作区。

## 2. 当前问题判断

虽然系统层已经有 `Settings` 页面，但应用详情里的 `Settings` 不应等同于系统设置页。

应用级 `Settings` 更适合回答：

- 这个应用当前用什么 invite/身份上下文
- 这个应用的压缩策略是什么
- 这个应用的流程 owner 是谁
- 这个应用的主项目绑定到哪里

如果这一层一直缺位，应用对象就仍然不完整。

## 3. 本轮设计结论

### 3.1 首版先做“应用级配置摘要”，而不是一口气做全量编辑器

当前阶段最合理的方式不是立即重做一套应用设置编辑器，而是先把应用级关键配置整理成正式摘要区：

- Access
- Compression
- Workflow Control
- Project Context

这样能先把应用对象补完整，同时不与现有系统设置和协作配置链路冲突。

### 3.2 迁移期仍允许“查看在应用内，深度编辑在旧模块”

因为当前真实编辑链路仍分布在：

- collaboration runtime
- system settings

所以首版 `Settings Workspace` 的角色是：

- 展示当前应用的关键配置状态
- 解释这些配置分别归属于哪一层
- 为后续真正的应用级编辑器留出生长空间

## 4. 本轮工程落点

本轮主要更新：

- `packages/client/src/types/workbench/application.ts`
- `packages/client/src/api/workbench/applications.ts`
- `packages/client/src/views/workbench/ApplicationDetailView.vue`
- `packages/client/src/components/workbench/settings/ApplicationSettingsWorkspace.vue`

## 5. 本轮结果

- `Settings` 已经从占位提示升级成正式分区
- 应用详情页的信息结构更完整了
- 应用对象的“配置边界”开始变得可见

## 6. 下一阶段建议

1. 继续把详情页中的高曝光硬编码文案收入口径统一层
2. 评估应用级 settings 中哪些项应支持直接编辑
3. 在应用层与系统层之间逐步建立更清楚的配置归属关系
