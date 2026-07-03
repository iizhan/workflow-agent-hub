---
name: project-tech-solution
description: Produce a Hermes Web UI technical solution before complex implementation. Use when a requirement affects multiple layers, introduces a page/module, changes workflow execution, touches routing/API/store/service boundaries, or has unclear UX/state rules.
---

# Project Tech Solution

This skill adapts `/Users/bing/MySelf/AI/SKILLS/Agents/project-root/skills/skill-tech-solution.md` for Hermes Web UI.

## When To Use

- New page or complete module.
- Changes touching route, view, component, API, store, backend route/controller/service, or scripts at the same time.
- Workflow, approval, project-write, gateway/model/channel/profile binding changes.
- Complex UI state, permissions, disabled states, or product boundary questions.
- Refactors touching common layout, request client, shared UI, build, config, or auth.

## Required Inputs

- User requirement or PRD.
- Existing project context from `AGENTS.md`, `CLAUDE.md`, `需求分析/项目分析.md`, and relevant source files.
- Hermes domain boundary checks from `$project-hermes-domain-boundaries` when applicable.

## Output Structure

- `背景与目标`
- `需求范围`
- `非目标`
- `现状调研`
- `影响目录`
- `UI 与交互方案`
- `数据流与 API 方案`
- `状态管理方案`
- `兼容性与迁移`
- `风险点`
- `实现拆分`
- `验收标准`
- `待确认项`

## Quality Bar

- Every decision must cite a current file, current product rule, or confirmed user requirement.
- Do not invent new framework, routing, request, state, or UI systems unless explicitly requested.
- Cover loading, empty, error, disabled, confirmation, duplicate-submit, stale data, and rollback behavior when relevant.
- Keep the plan directly implementable, not a high-level essay.
