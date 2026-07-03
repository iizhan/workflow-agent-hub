# Application Orchestration Language Alignment

## Context

After the main application detail shell and the core sub-workspaces were aligned, the orchestration area still exposed older wording centered on `workflow` and lower-level runtime phrasing.

This area is especially important because it explains how an application actually executes.

The orchestration workspace includes:

- overview
- runtime state summary
- template application
- flow editor

## Objective

Make the orchestration workspace read like part of the same application workbench system:

- `execution flow`
- `orchestration`
- `outputs`
- `roles`
- `runtime state`

Instead of a mixed vocabulary of workflow-engine and console wording.

## Language Decisions

### Overview card

The overview card now frames the object as an execution flow instead of an isolated workflow object.

Direction:

- `Workflow Overview` -> `Execution Flow Overview`
- `Unnamed workflow` -> `Unnamed execution flow`
- `Artifact Root` -> `Output Root`
- `Owner` -> `Flow Owner`

### Runtime summary card

The runtime card should describe user-facing execution state, not just internal run metadata.

Direction:

- `Run Status` -> `Execution State`
- `No active node` -> `No active stage`
- `Current role` -> `Active role`
- `Completed` -> `Completed Stages`

### Template application card

Templates are still technically workflow templates, but in the application workbench they function as reusable execution flow starters.

Direction:

- `Workflow Templates` -> `Flow Templates`
- template actions now emphasize applying a flow and optional starter roles
- agent wording in this context was reframed to `roles`

### Editor card

The editor card should emphasize orchestration and handoffs rather than raw workflow engine terminology.

Direction:

- `Workflow Editor` -> `Flow Editor`
- `Save Workflow` -> `Save Flow`
- `Refresh Runtime` -> `Refresh Runtime State`
- prompt placeholders now describe execution flow behavior

## Boundary

This round remains display-layer only.

No changes were made to:

- workflow engine contracts
- backend APIs
- entity names in storage
- route structure

## Outcome

The orchestration workspace now better matches the application-centric product story:

- users configure an execution flow
- roles hand off work through stages
- outputs are produced under defined rules
- runtime state can be reviewed without exposing too much engine-level language

## Recommended Next Step

Continue checking:

- settings summaries
- system-domain bridges
- remaining application-facing infrastructure wording that still leaks through old module copy
