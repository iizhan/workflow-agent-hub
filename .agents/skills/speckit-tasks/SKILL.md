---
name: speckit-tasks
description: Break a confirmed plan into executable tasks.
---

# Spec Kit Tasks

Use this skill after `spec.md` and `plan.md` are complete.

## Workflow

1. Run `bash .specify/scripts/bash/setup-tasks.sh [specs/<feature>]` to prepare the task file.
2. Read `spec.md` and `plan.md`.
3. Break work into prerequisites, foundational work, implementation work, and verification work.
4. Keep tasks path-aware so reviewers can quickly match each task to real directories or modules.
