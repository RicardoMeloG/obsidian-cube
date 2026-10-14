# 006: Frontend Architecture

**Status:** accepted
**Date:** 2026-10-12

## Context

The code is about to be public and developers are a stated audience. The product and infrastructure architecture are recorded (ADR 001–004); the code architecture is not. All site code sits in one feature folder, one 492-line component owns most behaviour, 1,697 lines of hand-written CSS carry no Tailwind utilities, breakpoints are duplicated between CSS and JavaScript and disagree, a missing WebGL context blanks the page, and nothing fails when any of it drifts (`specs/010-architecture`, section 2).

The full analysis, alternatives and the audit that shaped it are in `specs/010-architecture/` (`spec.md`, `audit-1.md`).

## Decision

- **Modules.** `src/app` (composition, error boundaries), `src/features/{experience,scene,faces,navigation,content,audio,dev}`, `src/ui` (presentational primitives), `src/styles`, `src/kernel` (ADR 005). The scene and the DOM never import each other; they meet in `features/experience`. Imports across top-level folders use the `@/` alias.
- **State.** One experience store per page: a pure reducer with typed events behind `useSyncExternalStore`. Per-frame values stay in refs inside the scene.
- **Styling.** Tailwind v4 utilities for layout, spacing, typography and states. `src/styles/tokens.css` defines named tokens and defaults; per-face accents keep their runtime source, `visual.json` (ADR 003). Hand-written CSS only where utilities are poor (canvas, scrims, keyframes, intro), each block commented with why. This supersedes the "Tailwind for static pages and future admin UI" scope in `docs/visual-direction.md`.
- **Layout modes.** `stacked`, `desktop`, `desktop-short`, defined once in `src/styles/layoutModes.ts`, used by JavaScript through `useLayoutMode()` and by CSS with the same queries. Short screens compact by a declared priority; rails have a safety-net `max-height`. Content budgets live in the kernel schema.
- **Degradation.** Error boundaries around the canvas (static poster fallback) and around each lazy world; no SPA rewrite while there are no routes; deploys keep old hashed chunks.
- **Typography.** Inter self-hosted (`woff2`, Latin subset, preloaded), so a layout measured in CI holds on visitors' machines.
- **Copy.** Owner content wins; interface strings and `aria-label`s live in one typed dictionary per locale.
- **Routes.** None until the methodology page; then one static HTML file per route from the kernel's SEO renderer.
- **Order.** Migration by phases, ordered to publish first: P1 gates and kernel, P2a fit and resilience, then publishing, then P2b styling, P3 state, P4 finish (spec 010, section 7). The rules above are targets until their phase lands; `docs/architecture.md` states which are in force.

## Consequences

- Every rule has a gate or is labelled "unchecked" (spec 010, section 6): boundary lint, layout check across a viewport matrix, accessibility check, first-view budget, privacy check, kernel purity, layout-mode sync, degradation tests.
- During the migration two styling systems coexist; `App.css` shrinks phase by phase and ends as documented exceptions.
- The P2a overflow fix is written in the existing CSS (about 60 lines) and migrated in P2b, accepted so the fix that blocks publishing does not wait for the styling migration.
- New dependencies: `@axe-core/playwright` (development) and the Inter font files. No state, routing or class-merging library.
