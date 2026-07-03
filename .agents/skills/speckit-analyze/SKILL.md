---
name: speckit-analyze
description: Review spec-kit artifacts before implementation.
---

# Spec Kit Analyze

Check `spec.md` / `plan.md` / `tasks.md` for scope leaks, hidden assumptions, weak verification plans, and mismatches between business intent and implementation intent.

## Review Focus

- requirement vs. scope mismatch
- missing acceptance criteria
- missing impacted directories
- hidden dependency or migration risk
- validation steps that are too weak for the change size
