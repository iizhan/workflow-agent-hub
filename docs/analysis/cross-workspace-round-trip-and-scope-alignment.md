# Cross Workspace Round Trip And Scope Alignment

## Context

The previous pass established the main scope model inside the workbench:

- app-owned
- shared
- system

`Application Overview` now points operators toward the right scope.

But one important gap remained:

- after jumping from an application into `Resources` or `System`, the operator lost the application context
- the top-level workspace had no idea which application triggered the jump
- `Application Header` still behaved more like an internal shortcut bar than a scope-aware control surface
- `Application Settings` still explained the boundary, but did not make escalation paths explicit enough

That meant the scope model existed conceptually, but not yet as a complete navigation loop.

## Objective

Turn scope routing into a full round trip instead of a one-way jump.

Operators should be able to:

- move from an application to shared or system scope without losing context
- understand why they are in that workspace
- return directly to the originating application section
- see the same scope language in `Header`, `Overview`, `Settings`, `Resources`, and `System`

## Boundary Decision

This round is still about navigation and boundary clarity, not deeper ownership changes.

It does not introduce:

- application-owned resource persistence
- application-owned system policies
- duplicated editors inside `Resources` or `System`

The current contract remains:

- `Application Settings` owns application governance
- `Resources` owns shared baseline visibility and shared editing entry points
- `System` owns runtime substrate visibility and infrastructure entry points

## What Changed

### Shared route context helper

A small route helper now standardizes scope-aware query state:

- `applicationId`
- `fromSection`

This avoids ad hoc query construction across multiple workbench surfaces and makes future scope-aware routing easier to extend.

### Application header shortcuts

`ApplicationHeader` now reflects the scope model directly:

- primary action still follows the current application execution path
- secondary actions now route to:
  - `Application Settings`
  - `Shared Resources`
  - `System Control`

This makes the header a scope-aware control strip instead of a second copy of internal section shortcuts.

### Settings scope strip

`Application Settings` now exposes a three-lane scope strip:

- `App-Owned`
- `Shared Scope`
- `System Scope`

This makes escalation paths visible before the operator starts editing.

It also reinforces that:

- governance changes happen here
- shared baseline edits happen in `Resources`
- runtime substrate investigation happens in `System`

### Context-aware shared/system banners

Both top-level `Resources` and `System` now detect when they were opened from an application.

When context is present, each workspace shows:

- the originating application name
- the originating application section
- a short explanation of why the operator is here
- a direct return action back to the originating application section
- a direct action back to application overview

### Cross-workspace context preservation

When moving:

- `Application -> Resources`
- `Application -> System`
- `Resources -> System`
- `System -> Resources`

the same application context is preserved.

That turns the top-level workspaces into contextual extensions of the application journey instead of isolated destinations.

## Product Meaning

This round makes the workbench feel more like one operating model and less like several improved screens living beside each other.

The main product gain is not new capability.

It is reduced ambiguity.

Operators can now more easily tell:

- what belongs to the application
- what belongs to shared defaults
- what belongs to runtime infrastructure
- how to leave one scope and return to the correct application touchpoint

That matters especially because the current platform is still in a migration phase where many real capabilities remain shared rather than fully application-isolated.

## Verification Note

Build verification passed.

In-app browser verification also passed for the main round-trip flow:

- application detail shows the new scope-aware header shortcuts
- application settings shows the new scope strip and escalation guidance
- opening `Shared Resources` from application overview preserves `applicationId` and `fromSection`
- opening `System` from `Resources` preserves the same context
- returning from `System` back to the application overview works correctly

## Recommended Next Step

The next valuable consistency pass is to extend the same context model deeper into reused legacy modules where it helps operators stay oriented, for example:

- profile or model pages opened from scope-aware workbench surfaces
- deeper troubleshooting entry points launched from `System`
- output review or run investigation paths that should later return to the originating application context
