# Application Settings Editability First Slice

## Context

The application settings workspace had already been promoted from a placeholder into a real section, but it was still read-only.

At that stage, the page improved information architecture but not real operating capability.

The next meaningful step was to make the settings workspace useful without overreaching into unstable backend boundaries.

## Objective

Turn application settings from a passive summary into a first editable slice of the application workbench.

The first slice should be:

- valuable
- low-risk
- built on existing stable backend capabilities

## Scope Chosen

The settings workspace now supports direct editing for:

- invite code
- conversation carry-forward rules
- manual compression trigger

The following areas remain read-only for now:

- flow ownership
- execution guardrails outside compression
- project context summary

## Why This Scope

This boundary is intentional.

`Invite code` and `compression` already map cleanly to existing room-level APIs, which means they can be elevated into the application workbench quickly and safely.

Other settings domains still span reused workflow/runtime/project structures and would require a larger object-model cleanup before they become good editing candidates.

## What Changed

### Settings state layer

A dedicated `useApplicationSettingsWorkspace` composable was added to manage:

- draft form state
- dirty detection
- saving invite code
- saving compression rules
- forcing compression
- refreshing application detail after mutations

### Settings UI

`ApplicationSettingsWorkspace` now includes:

- editable invite code form
- editable compression rule inputs
- a direct `Compress Now` action
- read-only cards for flow control and project context

This creates a mixed mode that is honest about current migration boundaries while still delivering real value.

## Product Meaning

This round matters because it changes the settings workspace from:

- `informational`

to:

- `operational`

That shift is important for the application-centric platform story.

Users should not only understand that an application has settings; they should start managing those settings directly inside the application workbench.

## Boundary

This round does not yet make the whole settings section editable.

It intentionally avoids:

- workflow owner editing
- deeper collaboration identity editing
- project permission editing
- application-level system/resource delegation

## Recommended Next Step

Continue settings expansion in similarly low-risk slices:

- flow ownership fields backed by workflow config
- project access and execution permission controls
- application-linked resource defaults
