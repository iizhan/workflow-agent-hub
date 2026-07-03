---
name: project-security-review
description: Review Hermes Web UI changes that touch auth, tokens, secrets, file writes, gateway behavior, or other high-risk paths. Use before delivery when a change may affect trust, data safety, or write scope.
---

# Project Security Review

Use this skill for high-risk areas.

## Review Focus

- Auth and token handling.
- Secret or credential exposure.
- File write scope and path safety.
- Gateway/process control and cross-boundary routing.
- Permission checks and privileged UI actions.
- User data retention and accidental transmission risks.

## Output

- High-risk findings first.
- Then mitigations or required follow-up.
- Then residual risk.

