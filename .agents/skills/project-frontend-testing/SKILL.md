---
name: project-frontend-testing
description: Validate Hermes Web UI frontend changes. Use after UI, interaction, route, store, model selector, gateway page, group chat, or workflow editor changes.
---

# Project Frontend Testing

This skill adapts `/Users/bing/MySelf/AI/SKILLS/Agents/project-root/skills/skill-frontend-testing.md` for Hermes Web UI.

## Checklist

- Normal user path renders and completes.
- Loading state is visible or safely handled.
- Empty state is meaningful.
- API error or unavailable service has a clear message.
- Disabled channel/model/profile/Agent states cannot be accidentally selected.
- Destructive or status-changing switches use confirmation when required.
- Repeated clicks or duplicate submits are guarded.
- Responsive layout remains usable on narrow screens.
- i18n/user-facing labels match the intended product boundary.

## Suggested Commands

- Type and reference check: `pnpm exec vue-tsc -b`
- Full production check: `pnpm build`
- Targeted tests: `pnpm test -- <test name or path>` when an existing or new test applies.

## Browser Verification

When the changed route is known, use the in-app browser to verify the local route:

- Gateway/model/binding page: `#/hermes/gateways`
- Group chat page: `#/hermes/group-chat`
- Settings page: `#/hermes/settings`

## Report

- `测试范围`
- `自动化检查`
- `浏览器走查`
- `未覆盖项`
- `剩余风险`
