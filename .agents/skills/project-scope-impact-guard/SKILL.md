---
name: project-scope-impact-guard
description: Lock the smallest safe scope for project work before implementation. Use after requirement confirmation and before editing files.
---

# Project Scope Impact Guard

Use this skill after requirement confirmation and before implementation.

## Workflow

1. Summarize the confirmed request in one line.
2. Propose the smallest safe implementation scope in terms of directories and functional areas.
3. Separate:
   - direct impact
   - possible ripple impact
   - out-of-scope but nearby areas
4. Highlight template-vs-project boundaries when both reusable assets and live project code may be touched.
5. Ask the user to confirm the scope before editing when expansion would be non-obvious.

## Output Format

- `建议锁定范围`
- `直接影响`
- `可能联动`
- `范围外风险`
- `确认后动作`
