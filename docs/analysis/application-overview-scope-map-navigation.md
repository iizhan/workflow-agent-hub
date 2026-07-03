# Application Overview Scope Map Navigation

## Context

The workbench now has usable top-level hubs for:

- Applications
- Runs
- Resources
- System

And application detail already exposes dedicated sub-workspaces for:

- Projects
- Agents
- Workflow
- Outputs
- Runs
- Collaboration
- Settings

But the application overview still mostly guided users only inside the application shell.

That left one recurring ambiguity unresolved:

- which tasks belong to the application itself
- which tasks belong to shared resources
- which tasks belong to system operations

## Objective

Strengthen cross-workspace coherence from the application overview itself.

The overview should help operators answer:

- where should I adjust this application's own guardrails
- where should I inspect inherited shared baselines
- where should I inspect runtime substrate health

## Boundary Decision

This round does not add more editing capability.

It adds clearer routing and scope explanation.

That means:

- application overview remains a guidance surface
- settings remains the application governance surface
- resources remains the shared asset surface
- system remains the operational substrate surface

## What Changed

### Overview scope map

`ApplicationOverviewPanel` now includes a `Scope Map` card with three clear action lanes:

- `Application Settings`
- `Shared Resources`
- `System Control`

Each lane explains:

- what belongs there
- why that scope exists
- where the operator should go next

### Navigation behavior

The card routes users across scopes directly:

- application-owned work returns to in-app settings
- shared scope jumps to the top-level resources workspace
- system scope jumps to the top-level system workspace

## Product Meaning

This round helps the product feel less like a collection of independently improved pages and more like a coherent operating model.

It reinforces the current-stage scope model:

- app-owned
- shared
- system

That is especially important while some capabilities still remain shared rather than application-isolated.

## Verification Note

Build verification passed.

Browser verification confirmed the top-level authenticated application shell was still rendering normally after the overview change.

The in-app browser did not successfully resolve the direct application-detail route during this pass, so the new overview card was validated primarily through code inspection plus successful build verification.

## Recommended Next Step

The next useful consistency round would be to propagate this same scope language into:

- application header quick actions
- settings copy
- resources and system reciprocal entry points
