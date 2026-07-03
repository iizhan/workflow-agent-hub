# Application Settings And System Bridge Language Alignment

## Context

After the main workbench shell, sub-workspaces, and orchestration area were aligned, the next rough edge was the bridge between application-facing settings and the reused system/infrastructure surfaces.

The language problem in this layer was subtle:

- it did not break functionality
- but it exposed too much migration scaffolding and infrastructure-first wording

Examples included:

- references to old routes
- references to room-based internals
- provider-heavy phrasing in role configuration

## Objective

Keep the migration boundary honest without making the application workbench feel like a thin wrapper over old infrastructure pages.

The bridge should read as:

- shared workspaces
- reused modules during migration
- application-facing routing and configuration surfaces

Not:

- old routes
- room internals
- infrastructure implementation details

## Areas Updated

### Application settings workspace

The settings intro now explains that:

- the section summarizes shared operating defaults
- deeper edits still bridge into reused collaboration and system workspaces

This keeps the migration transparent without exposing implementation-heavy language.

### System and resources placeholders

These pages now present themselves as workspaces rather than generic placeholders.

Direction:

- `System` -> `System Workspace`
- `Resources` -> `Resources Workspace`
- placeholder descriptions now describe migration bridges instead of referencing old route structures

### Application detail bridge copy

The collaboration loading state and fallback text were adjusted to avoid exposing room-based internals.

Direction:

- describe the collaboration space as a shared workspace powering the application
- describe remaining migrations as promotion from reused shared workspaces

### Agent role form

The role form now better matches the application-team framing.

Direction:

- `Profile` -> `Role Profile`
- `Model Provider` -> `Model Routing Source`
- `System Prompt` -> `Role Prompt`
- `Save Agent` -> `Save Role`

This still preserves technical accuracy while reducing unnecessary infrastructure emphasis.

## Boundary

This round remains presentation-only.

It does not change:

- runtime ownership
- API contracts
- backend naming
- real routing behavior

## Outcome

The application workbench now does a better job of acknowledging the migration without sounding like a temporary shell over legacy internals.

That matters because users can tolerate incomplete consolidation more easily than inconsistent product language.

## Recommended Next Step

Continue with:

- application create wizard wording
- agent workspace messaging
- remaining application-facing infrastructure terms in modal and onboarding surfaces
