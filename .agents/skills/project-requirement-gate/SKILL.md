---
name: project-requirement-gate
description: Analyze project requests before implementation. Use when a user describes a feature, bug, refactor, integration, or workflow update and Codex must first summarize the request in Chinese, list constraints, define acceptance criteria, identify impacted modules, and wait for explicit confirmation before editing files.
---

# Project Requirement Gate

Use this skill before implementation unless the current thread already contains a confirmed and unambiguous requirement statement.

## Workflow

1. Restate the request in Chinese in one short paragraph.
2. Extract the business goal and expected user-visible outcome.
3. List explicit constraints from the user and important assumptions.
4. Map the request to impacted areas such as application code, configs, scripts, docs, workflow files, CI, or templates.
5. Define concrete acceptance criteria.
6. List ambiguities or risky assumptions.
7. Stop and ask for confirmation before editing if those ambiguities materially affect scope, data, permissions, user flow, or delivery behavior.

## Output Format

- `需求目标`
- `已知约束`
- `影响模块`
- `验收标准`
- `待确认项`
- `下一步建议`
