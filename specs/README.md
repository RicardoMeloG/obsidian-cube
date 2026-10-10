# Specs

Future product milestones should be described here before implementation.

Recommended next specs, in the order set by `docs/roadmap.md` (001–003 are taken by the rescued drafts below):

1. `004-publish-real-content` — private content files with real identity, first deploy, publish → S3 + invalidation.
2. `005-evidence-per-face` — one inspectable artifact per face; content shape with a mandatory `href`; rewrite of the generic copy.
3. `006-methodology-deep-dive` — a router, the site as its own case study, static SEO and JSON-LD.
4. `007-presentation-state` — thesis / opening state (see `docs/project-memory.md`, 2026-06-11).
5. `008-admin-hardening` — login rate limit, secure cookies, persistent sessions, backend tests.

Specs are lightweight markdown (problem, outcome, non-goals, acceptance, validation). The Spec Kit tooling tried in June 2026 now lives in its own repository, `OlemOdracir/spec-kit-study` (see `docs/roadmap.md`, Phase 2).

## Rescued drafts (June 2026, Spec Kit)

Two specs were written with GitHub Spec Kit and never implemented (0 tasks done). They are kept here as **input**, not as approved work. They reference `$speckit-*` commands, `npm run quality` and `.specify/memory/constitution.md`, which exist in the `spec-kit-study` repository, not here.

- `002-personal-data-layer/` — public code vs removable personal layer. Partly superseded: the private/example JSON split, Zod validation and loader fallback already exist (`public/content/`, `src/features/premium-cube/content/`). Still open from it: the automated privacy gate (`privacy:check`) and generalizing owner data out of `AGENTS.md` / `docs/project-memory.md`.
- `003-agentic-flow-hardening/` — required code/security review evidence, design-token lint, Playwright visual regression. Fully open.

Owner direction captured alongside them lives in `docs/project-memory.md`.
