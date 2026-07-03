---
name: project-demand-memory
description: Persist Hermes requirement discussions and product decisions into the repository. Use after requirement conversations, product boundary decisions, architecture changes, workflow changes, or UX decisions.
---

# Project Demand Memory

Use this skill whenever a user requirement discussion reaches a conclusion or changes the project direction.

## Files

- Append chronological discussion summaries to `需求分析/沟通记录.md`.
- Update durable project knowledge in `需求分析/项目分析.md`.
- If a formal feature spec is needed, also create or update `specs/<feature>/spec.md` through `$speckit-specify`.

## What To Record

- 用户原始关注点。
- 本轮确认的产品边界。
- 本轮决定的实现范围。
- 不做什么，以及原因。
- 风险点和后续回归路径。
- 如果涉及架构，补充或更新 Mermaid 架构图。

## Style

- 用中文。
- 写结论，不写流水账。
- 把“未来要遵守的长期规则”放进 `项目分析.md`。
- 把“这轮沟通发生了什么”放进 `沟通记录.md`。
- 不记录敏感 token、账号、密钥、私有地址。

## Required Closeout

Final delivery must mention whether `需求分析` was updated. If not updated, explain why this turn did not produce new requirement memory.
