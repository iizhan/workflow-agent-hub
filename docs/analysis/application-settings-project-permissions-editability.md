# Application Settings Project Permissions Editability

## Context

After application settings gained editable access, compression, and flow guardrails, the remaining major read-only operational area was project execution permissions.

That meant users could configure how an application thinks and routes work, but not yet how far it is allowed to act on the bound project context.

## Objective

Lift project execution permissions into the application settings workspace so users can manage the application's execution boundary directly from the main control surface.

The target controls are:

- read
- write
- commit
- push
- push requires approval

## Why This Belongs In Settings

Project binding still belongs in the dedicated project workspace.

But once a project is already bound, these permission switches behave more like application governance than project selection.

That makes them a better fit for application settings than for the raw project explorer.

## What Changed

### Settings state layer

`useApplicationSettingsWorkspace` now:

- loads current room-project binding permissions
- maintains a normalized local permission draft
- enforces permission dependency rules in the UI
- saves updated permissions by reusing the existing project-binding API

### Permission dependency rules

The UI now keeps permissions coherent:

- disabling read disables write, commit, and push
- enabling commit enables read and write
- enabling push enables read, write, and commit
- disabling push resets approval gating to the safer default

This avoids presenting impossible or misleading permission combinations.

### Settings UI

The `Project Context` card now includes editable permission switches when a primary project is connected.

It still shows the project summary, but now also acts as the application-level execution boundary panel.

If no project is connected, the card stays informative and explains why the controls are unavailable.

## Product Meaning

This round moves application settings another step toward being a true control plane:

- not only how the application collaborates
- not only how it executes
- but also how far it may act on bound project assets

That is important for multi-scenario trust, especially beyond pure code workflows.

## Boundary

This round does not change:

- project binding selection flow
- project explorer behavior
- repository structure browsing
- deeper branch/release governance

It only lifts the application-facing execution permissions.

## Recommended Next Step

The next strong candidates for settings expansion are:

- application-linked resource defaults
- model routing policy at application scope
- richer project governance such as branch policy and publish lanes
