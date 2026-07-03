# DESIGN.md

## 1. Overview

This product is evolving from a utility-heavy admin console into an application-centric AI workbench.

The visual language should communicate:

- focused execution
- structured collaboration
- calm intelligence
- durable project context

It should not look like:

- a generic chat app
- a cloud infra dashboard clone
- a playful consumer AI product
- a monochrome engineer-only control panel

The intended feel is:

- editorial clarity
- product workbench density
- crisp hierarchy
- restrained but confident brand presence

## 2. Colors

### Core intent

Use a light-first system with deep ink text, warm-neutral surfaces, and a single controlled electric accent.

The palette should feel more like a modern workbench than a backend admin.

### Primary roles

- `--bg-app`: soft warm white
- `--bg-elevated`: pure white
- `--bg-muted`: quiet neutral wash
- `--bg-panel`: slightly tinted work surface
- `--text-strong`: near-black ink
- `--text-body`: graphite
- `--text-muted`: muted slate
- `--border-soft`: low-contrast structural border
- `--border-strong`: stronger interactive border
- `--accent-primary`: cobalt-teal bridge tone
- `--accent-primary-soft`: low-opacity accent wash
- `--success`: grounded green
- `--warning`: amber
- `--danger`: brick red

### Suggested values

```text
--bg-app: #f6f6f3
--bg-elevated: #ffffff
--bg-muted: #efefe9
--bg-panel: #f9f8f4
--text-strong: #141414
--text-body: #2f3437
--text-muted: #697177
--border-soft: #dfdfd6
--border-strong: #c7c9bf
--accent-primary: #1f6f8b
--accent-primary-soft: rgba(31, 111, 139, 0.10)
--success: #2f7d4a
--warning: #b7791f
--danger: #b24b42
```

### Accent usage rules

- Use the accent sparingly.
- Accent should highlight action, active state, selected context, and important progress.
- Do not flood the interface with colored cards or gradients.

## 3. Typography

### Tone

Typography should do most of the branding work.

It should feel:

- precise
- calm
- professional
- readable over long sessions

### Font families

- UI sans: `Inter`, `Manrope`, or similar modern grotesk
- Display / brand serif: `Instrument Serif`, `Iowan Old Style`, or similarly restrained editorial serif
- Code: `JetBrains Mono`

### Usage

- Sans handles UI chrome, navigation, forms, tables, and body copy
- Serif is used only for hero statements, application titles, and a few identity moments
- Code font remains strictly for code, paths, commands, and structured output

### Type scale

- Hero: 44-56
- Section title: 24-32
- Page title: 18-22
- Body: 14-16
- Meta: 12-13

### Rules

- Prefer strong hierarchy over many font sizes
- Keep line lengths disciplined
- Avoid oversized dashboard numerals unless they carry real decision value

## 4. Layout

### Structure

The product should feel like a workbench with three clear spatial layers:

1. global shell
2. application navigation and context rail
3. content canvas

### Rhythm

- Use wide outer breathing room on desktop
- Use clear section bands inside pages
- Prefer stable column systems over free-floating widgets

### Shell pattern

- Top shell or left navigation should establish product scope
- Application-level navigation should establish local scope
- Main canvas should focus on one decision area at a time

### Page archetypes

- Application list: catalog + filters + recent activity
- Application overview: summary + status + next actions + recent artifacts
- Builder views: structured split panes
- System pages: compact utility layouts

## 5. Elevation And Depth

Depth should be subtle and architectural, not decorative.

### Rules

- Use surface contrast first
- Use border definition second
- Use shadow only when necessary

### Preferred treatment

- large panels: thin border + slight tonal separation
- dialogs: stronger separation + softer shadow
- active cards: border emphasis + accent wash

Avoid:

- heavy floating shadows
- glowing cards
- glassmorphism

## 6. Shapes

### Radius system

- Small: 8
- Medium: 14
- Large: 20
- Pills only for status or compact filters

### Shape language

- panels and cards should feel sturdy and organized
- avoid overly sharp enterprise rectangles
- avoid overly soft consumer blobs

## 7. Components

### Navigation

- Global nav should feel structural, not decorative
- Active item should use subtle accent fill and stronger text
- Group labels should read like information architecture, not section ornaments

### Buttons

- Primary button: strong ink/accent field, clear contrast
- Secondary button: neutral surface with defined border
- Tertiary button: quiet text action

### Cards

- Cards should be content containers, not decoration
- Every card needs a clear role:
  summary, object, state, queue, artifact, or configuration

### Forms

- Inputs should feel calm and document-like
- Use clear label hierarchy
- Avoid overusing outlined control noise

### Tables And Lists

- Prefer readable list rows with strong left alignment
- Use density carefully
- Status metadata should be compact and scannable

### Artifact Views

- Artifact cards should feel like deliverables
- Previews should emphasize title, type, source run, and destination project path

### Workflow Views

- Workflow surfaces should feel like production planning, not toy node editors
- Emphasize stage intent, role ownership, and deliverables

## 8. Do's And Don'ts

### Do

- Make the product feel like a serious workbench
- Use whitespace to separate decisions
- Let typography and structure carry the brand
- Keep accent usage deliberate
- Differentiate business surfaces from system surfaces

### Don't

- Don't revert to pure monochrome admin styling
- Don't make everything look like a chat bubble interface
- Don't use many saturated accent colors
- Don't treat every page like a dashboard
- Don't let system configuration dominate the first-run experience

## 9. Responsive Behavior

### Desktop

- Desktop is the primary experience
- Support wide canvases for applications, workflows, and artifacts
- Preserve stable side navigation and content hierarchy

### Tablet

- Collapse non-critical side areas
- Preserve local navigation near content

### Mobile

- Mobile should prioritize:
  - application switching
  - run status
  - artifact viewing
  - lightweight collaboration
- Avoid forcing full builder experiences into cramped mobile layouts

### General rule

- Responsive behavior should preserve hierarchy, not just stack everything blindly
