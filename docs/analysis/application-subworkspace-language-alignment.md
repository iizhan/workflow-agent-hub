# Application Subworkspace Language Alignment

## Context

The application-centric workbench shell is already in place, but several high-visibility sub-workspaces still exposed mixed wording from the older console era. The biggest remaining inconsistency was no longer navigation or page architecture, but card-level copy inside the application detail experience.

This round focused on the most visible sub-workspaces:

- runs
- artifacts
- projects
- agents

## Objective

Align sub-workspace language with the application workbench narrative already established in the main detail shell.

The experience should read as one product:

- an application workbench
- with execution state
- output browsing
- project context
- role-based agent collaboration

## Language Decisions

### Runs

For user-facing state and approvals, `execution` is clearer than low-level `run` phrasing.

Applied direction:

- `Run Summary` -> `Execution Summary`
- `Run Timeline` -> `Execution Timeline`
- state actions now read as execution actions
- approval copy now refers to stages and handoff ownership

### Artifacts

For user-facing browsing, `outputs` better expresses what the application produced, while `artifact` can remain a system object behind the scenes.

Applied direction:

- `Artifacts Overview` -> `Outputs Overview`
- `Artifact Browser` -> `Outputs Browser`
- empty states and labels now describe produced outputs

### Projects

Inside an application, the linked project should read as long-lived workspace context, not just a raw repository binding.

Applied direction:

- emphasize `context project` and `workspace context`
- bind/connect actions now read as attaching reusable context
- explorer messaging now frames browsing as workspace-level inspection

### Agents

`Agent` remains the correct domain term, but presentation should make agents feel like application team roles instead of detached infrastructure objects.

Applied direction:

- role-oriented action labels
- clearer custom prompt wording
- softer default descriptions

## Boundary

This round is intentionally display-layer only.

It does not change:

- backend contracts
- runtime entity names
- routes
- storage models

## Outcome

After this pass, the application detail experience is more internally consistent:

- execution areas read like execution areas
- output areas read like output areas
- project areas read like application context management
- agent areas read more like role-team management

This improves perceived product cohesion without introducing migration risk.

## Recommended Next Step

Continue the same alignment pass into:

- workflow editor and template surfaces
- remaining settings summary copy
- bridges between application workbench language and system-domain pages
