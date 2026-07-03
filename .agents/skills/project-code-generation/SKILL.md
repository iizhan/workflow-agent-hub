---
name: project-code-generation
description: Implement confirmed Hermes Web UI work with tests or verification notes. Use after a requirement or technical solution is confirmed and the scope is ready for code changes.
---

# Project Code Generation

This skill adapts `/Users/bing/MySelf/AI/SKILLS/Agents/project-root/skills/skill-code-generation.md` for Hermes Web UI.

## Pre-Implementation Summary

Before editing substantial code, identify:

- `任务目标`
- `参考文档`
- `复用点`
- `改动点`
- `风险点`
- `自测点`

## Implementation Rules

- Reuse existing Vue components, Pinia stores, API modules, backend controllers, services, and tests before creating new abstractions.
- Keep Vue page orchestration in views, business UI in components, API contracts in `api/hermes`, shared state in stores, backend routes thin, and business logic in services.
- Keep DTO/API shapes and UI view models separated when the backend contract differs from page state.
- Add or update tests when behavior is deterministic and testable in the existing Vitest setup.
- If a change touches Hermes domain objects, apply `$project-hermes-domain-boundaries`.
- If a change touches frontend stack or backend stack, apply `$project-stack-standards`.

## Self Check

- Naming follows current project style.
- TypeScript types are explicit and avoid new `any`.
- Loading, empty, error, disabled, and confirmation states are handled where applicable.
- User-facing copy is consistent with i18n/locales when the current module uses i18n.
- Existing unrelated dirty files are not reverted.
- `需求分析` is updated when product conclusions changed.

## Closeout

After implementation, report:

- `实际修改文件`
- `与方案差异`
- `遗留待确认项`
- `推荐回归路径`
- `是否更新需求分析`
