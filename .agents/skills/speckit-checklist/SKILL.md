---
name: speckit-checklist
description: Create or update a lightweight requirements checklist for a feature.
---

# Spec Kit Checklist

Use this skill when a concise feature checklist would improve review quality.

## Workflow

1. Read the confirmed requirement or `spec.md`.
2. Focus the checklist on business correctness, boundary conditions, and delivery readiness.
3. Run `bash .specify/scripts/bash/setup-checklist.sh [specs/<feature>] [requirements]` when a checklist file is needed.
4. Write or update `specs/<feature>/checklists/requirements.md`.
