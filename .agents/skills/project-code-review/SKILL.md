---
name: project-code-review
description: Review Hermes Web UI changes for bugs, regressions, edge cases, and design drift. Use before merge or delivery, or when the user asks for a review.
---

# Project Code Review

Use this skill after implementation or when reviewing an existing patch.

## Review Focus

- Correctness of changed behavior.
- Regression risk in nearby modules.
- State, loading, empty, error, and disabled handling.
- Boundary consistency between UI, store, API, and backend service.
- Naming and copy consistency with Hermes product boundaries.
- Missing tests or missing manual verification steps.

## Output

- Findings first, ordered by severity.
- Then open questions or assumptions.
- Then a short summary of the change.

