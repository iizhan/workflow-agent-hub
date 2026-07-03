# Runs Workspace Execution Board

## Context

The application detail page already had a dedicated `Runs` sub-workspace with single-application execution controls and timeline inspection.

But the top-level `Runs` workspace was still a placeholder.

That created a gap in the workbench information architecture:

- applications could manage a run locally
- but operators still lacked a cross-application place to notice active execution, blocked approvals, and recent failures

## Objective

Turn the top-level `Runs` workspace into a real execution board.

It should help operators answer:

- which applications are actively running
- which applications are waiting for review
- which recent runs failed
- where to jump next

## Boundary Decision

This round keeps a clean split:

- top-level `Runs` = discovery, monitoring, triage, and routing
- application-level `Runs` = detailed execution handling for one application

That means the top-level board should not duplicate:

- approval submit/reject controls
- full stage timeline interaction
- per-run deep editing

Those remain inside the single-application run workspace.

## Why This Works With Existing Backend

The board is built by reusing stable application summary data that already exists:

- status
- status reason
- active run flag
- pending review flag
- last run time
- project and workflow summary

This avoids inventing a new run aggregation backend contract just to make the top-level IA useful.

## What Changed

### Runs workspace

`RunsView` now acts as a cross-application execution board with:

- summary counters
- live queue
- review queue
- failure attention lane
- recent activity lane

### Navigation behavior

Primary actions route operators back into the right application surface:

- running applications jump to collaboration
- blocked or failed applications jump to application run state

This makes the board a traffic director rather than another deep editor.

## Product Meaning

This round strengthens the application-centric workbench in an important way:

- `Applications` is where work is organized
- `Runs` is where active execution across applications is monitored

That makes the top-level IA more complete without breaking the application-first model.

## Verification Note

Build verification passed.

Browser verification reached the local login surface successfully, but run-board content could not be visually inspected in that browser session without an access token.

## Recommended Next Step

The next likely candidate is `System Workspace`, using the same principle:

- do not invent a new backend
- aggregate existing stable system surfaces into a true workbench hub
