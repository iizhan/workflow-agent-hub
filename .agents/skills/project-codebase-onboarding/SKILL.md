---
name: project-codebase-onboarding
description: Read and map unfamiliar Hermes Web UI modules before making changes. Use when a request touches code you have not recently inspected, when the impact area is unclear, or when you need a read-only understanding of the codebase flow.
---

# Project Codebase Onboarding

Use this skill before editing unfamiliar code.

## Workflow

1. Read the relevant docs and current implementation first.
2. Map the call chain, data flow, and ownership boundaries.
3. List the concrete files and modules involved.
4. Identify what is safe to reuse, what is risky, and what remains unknown.
5. Do not modify files in this step unless the user explicitly asks for a quick fix and the scope is already clear.

## Output

- `模块边界`
- `关键调用链`
- `复用点`
- `风险点`
- `待确认项`

