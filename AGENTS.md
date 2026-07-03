# Hermes Web UI Agent Workflow

This repository follows the project-level Agent workflow from `/Users/bing/MySelf/AI/SKILLS/Agents`.
Project-local skills live under `.agents/skills`, and `spec-kit` project state lives under `.specify` for specification, plan, and task artifacts.
Spec Kit command entry points are available through `pnpm spec:new`, `pnpm spec:plan`, `pnpm spec:tasks`, `pnpm spec:checklist`, and `pnpm spec:doctor`.

For any request that can change code, config, scripts, docs, product behavior, or delivery behavior, follow this sequence:

1. Use `$project-requirement-gate`.
   Produce a Chinese requirement analysis with goal, constraints, acceptance criteria, impacted modules, and risky assumptions.
   Do not edit files before the current-thread request is understood and explicitly confirmed when the task is still ambiguous.

2. If the task should be tracked, use `$speckit-specify`.
   This creates or updates `specs/<feature>/spec.md`.

3. Use `$project-scope-impact-guard`.
   Lock the smallest safe edit scope and separate direct impact from likely ripple impact.

4. Use `$project-hermes-domain-boundaries` when the request touches gateway, channel/provider, model, group chat, workflow, project binding, or Agent execution.
   Keep AI gateway, backend service gateway, channel/provider, model, profile, room Agent, and workflow stage boundaries explicit.

5. Use `$project-codebase-onboarding` when you are entering an unfamiliar module or need a read-only map of the current codebase before touching it.

6. Use `$project-tech-solution` for complex product, UI, API, workflow, or cross-layer changes.
   Produce a technical plan before implementation when the request affects multiple layers or has unclear state/permission/UX boundaries.

7. If planning artifacts are needed, use `$speckit-plan` and `$speckit-tasks`.
   Use `$speckit-analyze` when artifacts should be reviewed before implementation.

8. Use `$project-code-generation` during implementation.
   Reuse existing pages, components, stores, APIs, services, and tests before creating new abstractions.

9. Use `$project-stack-standards` for work under `packages`.
   If the project also has domain, platform, security, release, or design-system constraints, add project-specific skills under `.agents/skills/` and reference them here.

10. Use `$project-frontend-testing` after frontend UI changes.
   Verify normal, loading, empty, error, disabled, confirmation, and responsive states when applicable.

11. Use `$project-code-review` before merge or delivery to catch bugs, regressions, and missing edge cases.

12. Use `$project-technical-writing` when updating docs, specs, release notes, or user-facing design/flow explanations.

13. Use `$project-security-review` for auth, token, secrets, file writes, gateway, and other high-risk changes.

14. Use `$project-demand-memory` after requirement discussion or product decision changes.
   Append the conclusion, scope, risks, and next step to `需求分析/沟通记录.md`; update `需求分析/项目分析.md` when architecture or product boundaries change.

15. Use `$project-test-and-report` before final delivery.
   Return a Chinese test report with changed scope, commands, results, uncovered areas, and residual risks.

Repository-specific rules:

- Treat environment source files as the source of truth.
- Treat generated runtime config output as generated files: `dist`
- Preserve the existing Vue 3 + TypeScript + Naive UI + Pinia frontend conventions and Koa BFF backend conventions.
- Do not bypass API/store/service layers by putting raw backend contracts directly in Vue page components.
- Product labels must keep user-facing boundaries clear:
  - AI gateway: runtime/profile process management.
  - Backend service gateway: Web UI/API system service boundary.
  - Channel/provider: model source and credential grouping.
  - Model: concrete selectable model under a channel.
  - Group Agent: room member selected by workflow stages.
- Keep workflow assets and business assets layered:
  - workflow assets: `AGENTS.md`, `.agents`, `.specify`, `specs`, `docs`
  - business assets: application code, runtime config, scripts, infrastructure files
- Keep `templates/` generic and reusable across projects.
- Existing user edits are sacred: do not revert unrelated dirty files.
