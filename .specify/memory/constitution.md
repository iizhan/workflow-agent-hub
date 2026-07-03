# Hermes Web UI Spec Constitution

## Core Principles

### I. 需求先确认

所有进入实现阶段的需求，必须先完成中文需求分析并得到用户明确确认。
在确认之前，不允许修改代码、配置、脚本、模板、流程文档或生成物。

### II. 范围先锁定

进入技术方案和实现前，必须先反馈本次建议锁定范围。
至少说明直接影响、可能联动、范围外风险，并等待用户确认或调整。
如果实现过程中需要扩大范围，必须暂停并再次确认。

### III. 遵循现有技术栈与产品边界

实现必须遵循 `Vue 3 + TypeScript + Naive UI + Pinia + Koa` 与 `packages` 的实际约定。
如仓库存在配置源文件与生成配置文件，必须明确二者关系，不允许跳过现有配置链路。
涉及 Hermes 核心概念时，必须明确区分 AI 网关、系统后端服务、渠道/provider、模型、profile、群聊 Agent、流程阶段和项目绑定，不能用模糊命名把不同层级混在一起。

### IV. 先最小实现，再验证交付

优先选择最小安全改动，避免无授权的大范围重构。
交付前必须提供与改动规模匹配的验证结果。

### V. 流程资产与业务资产分层维护

流程资产与业务资产必须分层维护：

- 流程资产：`AGENTS.md`、`.agents`、`.specify`、`specs`、`docs`
- 业务资产：应用代码、配置文件、运行脚本、基础设施文件

通用模板与项目业务实现不能混写在同一套规则里。

## Additional Constraints

- 以中文输出需求分析、范围评估、测试报告和交付说明。
- `spec-kit` 在项目中是流程工件层，不替代本地 skills。
- 每轮需求沟通结束后，必须把关键结论追加到 `需求分析/沟通记录.md`。
- 当产品边界、架构图、核心流程或风险判断发生变化时，必须同步更新 `需求分析/项目分析.md`。
- 当团队流程、技术栈、主应用目录或交付要求变化时，必须同步更新：
  - `AGENTS.md`
  - `.agents/skills/*`
  - `.specify/memory/constitution.md`
  - `.specify/templates/*.md`
  - `docs/Codex团队开发说明.md`

## Workflow Gates

### Gate 1: `$speckit-specify`

- 先走 `$project-requirement-gate`
- 用户确认后再创建或更新 `spec.md`
- 规格只描述业务目标、用户场景、边界、验收标准和假设

### Gate 2: `$speckit-plan`

- 先走 `$project-scope-impact-guard`
- 用户确认范围后再创建或更新 `plan.md`
- 技术方案必须写明影响目录、联动项、测试策略和配置影响

### Gate 3: `$speckit-implement`

- 按实际改动区域使用 `$project-stack-standards`
- 涉及 Hermes 领域对象时同步使用 `$project-hermes-domain-boundaries`
- 不得跳过范围边界
- 完成后必须交由 `$project-test-and-report` 收口验证

### Gate 4: `$project-demand-memory`

- 需求沟通、方案确认、产品边界澄清后必须写回 `需求分析`
- 沟通记录写“这轮说清楚了什么”，项目分析写“未来都要遵守什么”

## Governance

- 本文件是项目在 `spec-kit` 工作流中的最高协作约束。
- 当约束变化时，优先保持 `AGENTS.md`、skills、spec 模板和项目说明文档同步。
