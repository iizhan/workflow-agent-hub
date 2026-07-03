# Resources Workspace And Application Resource Baseline

## Context

The application workbench already had:

- application settings for governance
- application sub-workspaces for projects, agents, workflow, artifacts, and collaboration

But the top-level `Resources` workspace was still a placeholder.

At the same time, the current product already has working shared-resource capabilities:

- skills library
- shared memory surfaces
- active profile selection
- shared model default

The problem is that these capabilities still live at shared profile or system scope, not application scope.

## Objective

Improve the product path without inventing fake application-specific persistence.

This round should:

- make the top-level `Resources` workspace useful
- show what shared resource baseline applications currently inherit
- keep the boundary explicit that editing still happens in reused shared modules

## Boundary Decision

This round intentionally does not create:

- per-application memory persistence
- per-application skill binding persistence
- per-application profile isolation
- a new application resource schema

Why:

- the existing backend already supports global resource management
- it does not yet expose a stable application-specific resource contract
- inventing one only in the UI would create a misleading control surface

## What Changed

### Shared summary composable

A new reusable composable now aggregates:

- active profile
- active profile detail
- default runtime model
- skill counts and source distribution
- memory section coverage and latest update time

This allows both workbench surfaces to speak from the same summary source.

### Application settings

`Application Settings` now includes a `Resource Baseline` card.

It explains:

- which shared profile baseline the current application inherits
- how many skills are currently enabled
- how much shared memory is configured
- where operators should go to edit those shared assets

This keeps settings as a governance surface instead of turning it into another editor.

### Resources workspace

`ResourcesView` now acts as a real shared-resource hub.

It shows:

- active profile and gateway path
- default runtime model baseline
- shared skill-library summary
- shared memory-surface summary
- direct navigation to legacy skills, memory, and profiles modules

## Product Meaning

This round closes an important product gap:

- applications now show inherited resource baseline
- shared resources now have a meaningful home in the workbench IA

That is especially important for multi-scenario positioning, because code, document, PPT, and research applications all need to inherit shared capabilities from somewhere.

## Recommended Next Step

The next safe step is not to force application-specific resource persistence yet.

Instead:

- continue making shared vs application scope visible
- wait for a stable backend contract before introducing application-owned resource defaults
