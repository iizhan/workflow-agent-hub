---
name: project-stack-standards
description: Implement changes using Hermes Web UI stack conventions. Use when editing `packages/client`, `packages/server`, shared scripts, or tests in the Vue 3 + TypeScript + Naive UI + Pinia + Koa application.
---

# Project Stack Standards

Use this skill when the confirmed scope includes `packages`, `scripts`, `tests`, Vite config, TypeScript config, or package scripts.

## Follow The Existing Stack

- Frontend lives under `packages/client` and uses Vue 3, `<script setup lang="ts">`, Naive UI, Pinia, vue-router hash routes, vue-i18n, SCSS, and Vite.
- Backend lives under `packages/server` and uses Koa, thin route modules, controllers, services, and TypeScript.
- Preserve the repository's actual conventions rather than imposing a new structure.
- Prefer the smallest safe change over broad refactors unless the user explicitly asks for a larger cleanup.
- Read existing modules, naming, folder layout, state shape, config loading, and testing style before editing.

## Config Rules

- Treat repository source-of-truth config files as authoritative.
- Treat `dist` as generated output when that path exists in the project.
- Do not hardcode environment values inside feature code when the repository already has a config pipeline.
- Do not edit generated build output or dependency folders.

## Frontend Rules

- Keep page-level orchestration in `packages/client/src/views/hermes/*` and reusable business UI in `packages/client/src/components/hermes/*`.
- Keep API calls in `packages/client/src/api/hermes/*`; do not call raw backend endpoints directly from page templates.
- Keep cross-component state in Pinia stores under `packages/client/src/stores/hermes/*` when the state is shared or reused.
- Use existing Naive UI patterns before adding new primitives.
- Keep i18n copy synchronized when a user-facing label changes.

## Backend Rules

- Keep route files thin under `packages/server/src/routes/hermes/*`.
- Put request handling in controllers and business behavior in services.
- Keep project-write and group-chat execution safeguards close to `packages/server/src/services/hermes/group-chat` and `packages/server/src/services/hermes/project`.
- Do not let workflow execution overwrite existing project files unless the path and write mode are explicit and safe.

## Implementation Rules

- Reuse existing abstractions before creating new ones.
- Keep business rules close to the module that owns them.
- Preserve project language, copy style, and existing delivery conventions.
- For Hermes concepts, also apply `$project-hermes-domain-boundaries`.
- If the project has missing stack-specific rules, update this skill first so future work stays aligned.

## Verification

- Run the lowest-cost meaningful checks that fit the changed area. Default checks are `pnpm exec vue-tsc -b` for type-only frontend/server reference checks and `pnpm build` for full build verification.
- If runtime verification depends on an IDE, simulator, browser, device, or external environment, explain the manual verification path clearly.
