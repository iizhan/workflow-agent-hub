# Application Settings Flow Guardrails Editability

## Context

After the first editable settings slice shipped, the application workbench could already manage:

- invite code
- carry-forward rules
- manual compression

That made the settings workspace operational, but flow guardrails were still only visible as summary data.

The next useful step was to lift stable workflow-configuration fields into the application settings layer without overlapping with the full flow editor.

## Objective

Add a second editable settings slice for high-level flow guardrails:

- execution mode
- flow owner
- owner role
- output root
- manual jump policy

These controls should live in application settings because they shape how the application runs, even though the detailed topology remains the responsibility of the flow editor.

## Scope Chosen

This round exposes only configuration-layer controls.

Editable:

- flow mode
- owner name
- owner role
- output root directory
- allow manual jump

Still not handled here:

- stage graph editing
- role alignment changes
- flow prompt and topology restructuring

## Why This Boundary

This keeps application settings and the flow editor complementary:

- settings manages operating guardrails
- flow editor manages orchestration structure

That is a cleaner long-term boundary than mixing both into one place.

## What Changed

### Settings state layer

`useApplicationSettingsWorkspace` now:

- loads workflow config directly
- maintains guardrail draft state
- detects dirty state
- saves guardrails through the existing workflow config API

### Settings UI

`ApplicationSettingsWorkspace` now includes an editable flow-control card with:

- execution mode select
- flow owner input
- owner role input
- output root input
- manual jump toggle

The existing project-context card remains read-only.

## Product Meaning

This round upgrades application settings from:

- access + context compression management

to:

- access + context compression + execution guardrail management

That is a meaningful step toward a real application control surface.

## Boundary

This round still avoids turning settings into a second workflow editor.

It intentionally does not expose:

- graph node editing
- stage-level reconfiguration
- template application logic

## Recommended Next Step

The next good settings-focused expansions would be:

- project execution permissions
- application-linked resource defaults
- operator identity editing once collaboration ownership is better separated
