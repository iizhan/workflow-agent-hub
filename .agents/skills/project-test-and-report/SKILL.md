---
name: project-test-and-report
description: Validate project changes before delivery. Use after implementation to run low-cost automated checks, summarize manual verification steps, and provide a Chinese test report.
---

# Project Test And Report

Use this skill before final delivery.

## Workflow

1. Identify the changed areas and their risk level.
2. Run the lowest-cost meaningful checks available for those areas.
3. If runtime verification depends on local tools or external environments, state the exact manual verification path.
4. Summarize results in Chinese.

## Suggested Check

Run: `pnpm build`

## Report Format

- `测试范围`
- `执行命令`
- `结果说明`
- `未覆盖项`
- `剩余风险`
