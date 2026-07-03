# Bilingual Language Switch And Workbench I18n

## Context

The project already had a Vue I18n foundation, but the actual experience was incomplete:

- language switching was mainly buried after login
- the existing language selector exposed many locales even though the current product need is only Chinese and English
- the new application workbench surfaces still contained a large amount of hard-coded English copy

That meant the product technically had i18n infrastructure, but not a reliable bilingual experience.

## Objective

Upgrade the product from “i18n exists in the codebase” to “users can actually switch between Chinese and English and see the main workbench respond”.

This round focused on:

- limiting the active display-layer locale scope to `zh` and `en`
- exposing a real language switch before and after login
- wiring the main workbench shell and top-level pages into i18n
- making document titles and page language metadata follow the selected locale

## Boundary Decision

This round is a display-layer bilingual upgrade.

It does not attempt to:

- localize every historical legacy module in one pass
- translate backend-originated dynamic status text that is still stored as raw data
- redesign the entire localization architecture beyond current product needs

The product target here is practical bilingual usability, not full multilingual completion.

## What Changed

### Locale scope was simplified

The active locale configuration is now centered on:

- `zh`
- `en`

This keeps the current product promise honest and avoids pretending the whole product is fully maintained across more languages than the team is actually ready to support.

### Global locale helpers

A dedicated locale config layer now handles:

- supported locales
- locale persistence
- locale resolution from saved preference and browser language

### Language switch is now visible as a real product control

The language switch now exists in the key places users need it:

- login page
- authenticated sidebar/footer area

That means users can change language even before entering the product shell.

### App shell reacts to locale

The app now updates:

- `document.documentElement.lang`
- browser tab titles

so the selected language is reflected more consistently across the shell.

### Workbench mainline copy was localized

The main workbench path now uses i18n for high-visibility product copy, including:

- applications list hero and filters
- application empty state
- application create hero and wizard
- application detail summary shell
- application header scope actions
- overview scope map
- settings intro and scope guidance
- resources hero and context banner
- runs hero and summary shell
- system hero and top-level summary shell

## Product Meaning

This round turns language switching into a first-class product behavior instead of a partially wired technical feature.

It also helps the new application-centric workbench feel more native for Chinese-speaking users, especially because the workbench is now the highest-priority user journey in the product.

## Verification Note

Build verification passed.

Browser verification confirmed that:

- the applications workbench renders in Chinese when the locale is `zh`
- the new Chinese workbench hero, filters, and major shell copy are visible after the change

There are still some backend-originated or not-yet-migrated strings that remain English in deeper or legacy paths, so bilingual coverage is now solid on the main workbench line but not yet exhaustive everywhere.

## Recommended Next Step

The next localization pass should prioritize:

- remaining application sub-workspace cards and deeper detail panels
- backend-originated status reasons that still surface raw English
- legacy pages that are still mixed-language after the workbench path is complete

## 2026-05-29 Follow-up Closure

### What was still broken

After the first bilingual pass, some dynamic workbench labels still rendered raw English in Chinese mode, including:

- `Bind primary project`
- `Primary project is not configured yet`

The issue was not just static page copy. Some labels were derived dynamically from workbench aggregation data and then rendered directly in UI components.

### What changed in the follow-up

- localized dynamic `nextAction` rendering through UI mapping helpers
- localized dynamic `statusReason` rendering through UI mapping helpers
- cleaned the remaining hardcoded English in:
  - application header
  - application overview
  - application cards
  - runs board
  - shared resources page
  - system control page
  - application settings lower sections
  - run timeline card
- fixed a locale-sensitive settings bug by replacing a display-text conditional with a stable internal key

### Verification

- build verification passed again after the follow-up cleanup
- the direct rendering path that previously surfaced `Bind primary project` in Chinese mode no longer uses raw backend-derived English labels

### Remaining direction

The next bilingual pass should move deeper into:

- agents workspace
- workflow workspace
- artifacts and collaboration subcards
- older legacy pages outside the new application-centric workbench path

## 2026-05-29 Deep Workspace Follow-up

### What was still leaking

Even after the workbench-level cleanup, several embedded sub-workspace components still bypassed the new bilingual layer:

- application local project path placeholder in the create wizard
- workflow editor internals inside collaboration and workflow configuration
- collaboration panel microcopy such as system badges, avatar preset labels, artifact action text, and workflow interaction hints

This meant the shell could switch languages while inner tools still showed mixed Chinese and English.

### What changed in this pass

- connected the create wizard local project path input to the existing workbench locale key
- localized the embedded `LogicFlowWorkflowEditor` end-to-end:
  - node panel
  - runtime settings
  - inspector labels
  - assigned agent help text
  - node and edge condition labels
  - artifact settings
  - default node names and default workflow owner role
- localized visible `GroupChatPanel` and `GroupMessageItem` leftovers:
  - system badge
  - clear messages success toast
  - avatar preset labels
  - workflow interaction guide copy
  - approval-area “open artifact” action
  - admin fallback labels used when no operator name is present
- extended both `zh` and `en` locale dictionaries with the new workflow-editor and collaboration microcopy keys

### Verification

- build verification passed after the deeper collaboration/workflow localization pass
- residual visible hardcoded strings in the targeted workbench and embedded collaboration paths were re-scanned and cleared

### Remaining boundary

One internal regex in `GroupChatPanel` still uses Chinese keywords to classify system messages for change-history display.

It is not user-facing copy, so it was left unchanged in this pass to avoid accidental behavior regressions while finishing the visible bilingual surface first.
