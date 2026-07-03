---
name: project-hermes-domain-boundaries
description: Guard Hermes Web UI product and architecture boundaries. Use when requests touch gateways, backend services, channels/providers, models, profiles, group chat Agents, workflow templates, workflow stages, approvals, project binding, or project-write execution.
---

# Hermes Domain Boundaries

Use this skill before implementation whenever a change touches Hermes product concepts or user-facing wording.

## Boundary Rules

- `AI 网关`: profile 对应的运行态和进程管理，不是脱离 profile 的独立业务实体。
- `系统后端服务`: Web UI / API / BFF 自身运行层，不能和 AI 网关混在同一个新增或绑定流程里。
- `渠道/provider`: 模型来源、密钥、base URL、渠道级启停集合。
- `模型`: 渠道下的具体可选模型，支持软启用/禁用。
- `profile`: 网关运行态和默认模型绑定的承载对象。
- `群聊 Agent`: 房间内机器人成员，拥有昵称、头像、职责、profile/model 选择。
- `流程阶段`: 编排中的节点，应绑定已添加的群聊 Agent，并保留旧字段兼容。
- `项目绑定`: 群聊关联真实本地仓库的能力，不能被当作普通聊天产物。

## UX Rules

- 不要在同一页面重复放置语义相同的设置入口。
- 群设置和系统设置必须区分层级。
- 网关管理、模型管理、绑定关系可以同页，但必须通过清晰分区或 tabs 区隔职责。
- “已选中”只表示详情面板当前对象，不表示启用、运行中或默认路由。
- 启用/禁用类操作使用 switch button，并在改变真实状态前二次确认。
- 用户需要审核时，优先暴露待审核产物和下一步动作，而不是只显示流程状态。

## Execution Rules

- 群聊流程完成后，如果节点职责是开发，应推动真实项目文件写入，而不是只生成说明文档。
- `project-write` 必须明确目标路径、写入模式和风险；已有文件优先最小增量修改，禁止模板式整文件覆盖。
- 当 UI 文案或流程入口会影响用户理解时，同步更新 `需求分析` 中的产品结论。

## Output Checklist

- 是否区分了 AI 网关和系统后端服务？
- 是否区分了渠道/provider 和模型？
- 是否说明了 profile、网关、模型、群聊 Agent 的绑定关系？
- 是否避免了重复设置入口和重复选择态？
- 是否覆盖了空态、禁用态、审核态、错误态和误触风险？
