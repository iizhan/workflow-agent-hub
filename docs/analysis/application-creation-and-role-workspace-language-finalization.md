# Application Creation And Role Workspace Language Finalization

## Context

After aligning the application detail shell, sub-workspaces, orchestration, and migration bridge surfaces, the remaining high-visibility roughness shifted to:

- the application creation wizard
- the role workspace

These surfaces matter because they shape first-run understanding:

- how users set up an application
- how they think about agent roles
- how much internal implementation language leaks during onboarding

## Objective

Make creation and role-management surfaces read as part of the same application workbench system:

- project context
- execution flow
- starter roles
- application workspace

Instead of:

- workflow template presets
- room creation internals
- agent-heavy infrastructure phrasing

## Updates

### Application creation wizard

The wizard now better frames setup in application-centric terms.

Direction:

- `Optional project and workflow presets` -> `Optional context project and flow presets`
- `Project connection` -> `Project context`
- `Use existing project` -> `Reuse existing project`
- `Bind local project` -> `Attach local project`
- `Workflow template` -> `Execution flow template`

The phase note was also softened so it acknowledges the reused setup form without overexposing old room-centric implementation wording.

### Role workspace

The role workspace now speaks more consistently in role/team language.

Direction:

- `Edit Agent` / `Configure Agent` -> `Edit Role` / `Configure Role`
- `Agent Actions` -> `Role Actions`
- `Add Agent` -> `Add Role`
- `No agents configured yet` -> `No roles configured yet`
- default-save/apply feedback now refers to roles rather than agents

### Role overview

The overview card now better matches the execution-flow narrative.

Direction:

- `Agent Overview` -> `Role Overview`
- `Workflow Missing Roles` -> `Execution Flow Missing Roles`

## Boundary

This round still changes only display-layer language.

It does not change:

- underlying create flow wiring
- API entities
- reused room creation mechanics
- agent/runtime data contracts

## Outcome

The onboarding and role-management surfaces now feel much closer to the target product identity:

- users create an application workspace
- optionally attach project context
- optionally preload an execution flow
- then configure roles that support that flow

This makes the overall product story easier to understand without increasing migration risk.

## Recommended Next Step

The display-layer migration can now slow down and shift priority toward:

- deeper editing capabilities inside settings and resources
- stronger application-first system bridges
- functional roadmap work beyond terminology cleanup
