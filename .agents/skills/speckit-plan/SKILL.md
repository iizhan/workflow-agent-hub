---
name: speckit-plan
description: Produce a technical implementation plan from a confirmed spec.
---

# Spec Kit Plan

Use this skill after specification confirmation and scope confirmation.

## Workflow

1. First run `$project-scope-impact-guard`.
2. Wait for explicit scope confirmation when scope is still a live decision.
3. Run `bash .specify/scripts/bash/setup-plan.sh [specs/<feature>]` to ensure the plan file exists.
4. Fill `specs/<feature>/plan.md` using `.specify/templates/plan-template.md`.
5. Reference `$project-stack-standards` and any project-specific extension skills for implementation constraints.
