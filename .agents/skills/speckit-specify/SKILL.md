---
name: speckit-specify
description: Create or update a feature specification under `specs/` using spec-kit workflow.
---

# Spec Kit Specify

Use this skill after the requirement analysis is confirmed.

## Workflow

1. First run `$project-requirement-gate`.
2. Wait for explicit user confirmation when the requirement still affects scope or acceptance.
3. Run `bash .specify/scripts/bash/create-new-feature.sh "<feature name>"` when a new feature directory is needed.
4. Follow `.specify/templates/spec-template.md` to write or update `specs/<feature>/spec.md`.
5. Keep the spec business-oriented and outcome-oriented.
