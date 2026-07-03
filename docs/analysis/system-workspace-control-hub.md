# System Workspace Control Hub

## Context

The top-level workbench navigation already had:

- Applications
- Runs
- Resources
- System

But `System` was still a placeholder, even though the product already contains stable system-level modules such as:

- gateways
- models
- profiles
- channels
- settings
- logs
- usage

## Objective

Turn `System Workspace` into a real operational hub without inventing new backend contracts.

It should answer:

- is the runtime healthy
- what model fleet is available
- which profile is currently active
- what recent usage load looks like
- where operators should go for deeper system action

## Boundary Decision

This round keeps a clear split:

- top-level `System` = health overview, readiness summary, and routing hub
- legacy system modules = deep operational editing and detailed troubleshooting

That means the workbench `System` page should not duplicate:

- full gateway control tables
- full model toggling UI
- full profile CRUD flows
- full platform configuration editing

Those remain in the reused system surfaces.

## Why This Fits The Current Stage

The current backend already exposes stable system-facing data through existing client stores:

- app health
- gateway status
- model provider availability
- active profile details
- usage statistics

That makes an aggregation-first system hub the right move now.

## What Changed

### Shared system summary composable

A new composable aggregates:

- gateway runtime summary
- enabled provider and model counts
- active profile detail
- 30-day usage summary

### System workspace

`SystemView` now renders:

- hero and update banner
- top-level health summary cards
- runtime card
- model fleet card
- profile card
- telemetry card
- channels / settings card

Each card includes direct routing into the reused system modules.

## Product Meaning

This round completes another missing top-level IA piece:

- `Applications` organizes work
- `Runs` monitors execution
- `Resources` surfaces shared assets
- `System` now surfaces operational substrate

That makes the workbench feel more deliberate and less like a collection of placeholder shells.

## Verification Note

Build verification passed.

Browser verification confirmed the rendered `System Workspace` content through a logged-in page text inspection.

Viewport screenshot capture timed out in the in-app browser for this page, so textual runtime confirmation was used instead of a screenshot artifact.

## Recommended Next Step

The next high-value direction is no longer filling top-level placeholders.

Instead, the next step should likely focus on deeper product consistency work, such as:

- unifying cross-workspace language
- tightening action routing between top-level hubs and application detail
- clarifying what is still shared scope versus application-owned scope
