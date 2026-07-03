# Application Settings Role Baseline Governance

## Context

After application settings gained editable access, compression, flow guardrails, and project execution permissions, the next likely expansion area was application-level model governance.

But the current system does not yet expose a clean dedicated backend contract for a standalone application model-routing policy.

At the same time, the existing room runtime already has a stable persisted concept for reusable default agents:

- saved default role composition
- saved model selection per role
- saved temperature and prompt settings per role

That makes default-agent baseline a better near-term control-surface candidate than inventing a parallel application settings protocol.

## Objective

Lift reusable default role composition into `Application Settings` as an application governance control:

- save the current live role team as the startup baseline
- re-apply the saved baseline to restore a working role cast
- surface the saved role and model summary directly in settings

## Why This Belongs In Settings

The detailed editing of a role still belongs in the dedicated `Agents` workspace.

But the question of:

- what starter team this application should boot with
- which pinned models are part of that starting team

is a governance concern at application scope.

That makes it a good fit for settings.

## Scope Chosen

This round adds:

- saved baseline summary in application detail mapping
- settings actions to save current roles as baseline
- settings actions to apply the saved baseline
- model summary visibility for the saved starter team

This round does not add:

- a brand new application model-routing schema
- full per-role editing in settings
- skill/resource binding policy
- branch or release governance

## What Changed

### Application detail mapping

`mapRoomAggregateToApplicationDetail` now parses `defaultAgentsJson` and exposes:

- saved role count
- invited-by-default count
- saved role names
- saved pinned model list

### Settings state layer

`useApplicationSettingsWorkspace` now:

- computes whether a saved role baseline exists
- exposes save/apply actions for the baseline
- refreshes application and active-room state after updates

### Settings UI

`ApplicationSettingsWorkspace` now includes a `Role Baseline` card that:

- explains the product meaning of the baseline
- shows the saved role and model summary
- lets operators save the current role team
- lets operators apply the saved baseline back into the application

## Product Meaning

This round gives application settings a reusable execution-baseline control that works across multiple scenarios:

- code delivery
- document writing
- PPT production
- research analysis

The same application can now preserve a known-good starter cast instead of rebuilding the role team manually.

## Boundary

The important boundary remains:

- settings governs defaults and guardrails
- agents workspace edits role details
- workflow workspace edits orchestration structure

This keeps settings useful without turning it into another detailed editor.

## Recommended Next Step

The next strong candidate is still application-level resource defaults, but only if a similarly stable backend bridge already exists.

If not, the safer path is to continue exposing existing reusable runtime defaults before inventing new application-specific persistence contracts.
