# Specs

Future product milestones should be described here before implementation.

Recommended next specs:

1. `001-content-system`
2. `002-static-pages`
3. `003-tailwind-design-system`
4. `004-contact-channel`
5. `005-admin-content-panel`
6. `006-aws-production-deploy`

Use this directory for Spec Kit or compatible spec-driven development artifacts.

## Rescued drafts (June 2026, from the `codex/*` branches)

Two specs were written on the `codex/001-spec-driven-gates` branch with GitHub Spec Kit and never implemented (0 tasks done). They are kept here as **input**, not as approved work. They reference `$speckit-*` commands and `npm run quality`, which only exist on that branch — the Spec Kit tooling itself was not adopted into this line.

- `002-personal-data-layer/` — public code vs removable personal layer. Partly superseded: the private/example JSON split, Zod validation and loader fallback already exist (`public/content/`, `src/features/premium-cube/content/`). Still open from it: the automated privacy gate (`privacy:check`) and generalizing owner data out of `AGENTS.md` / `docs/project-memory.md`.
- `003-agentic-flow-hardening/` — required code/security review evidence, design-token lint, Playwright visual regression. Fully open.

Owner direction captured alongside them lives in `docs/project-memory.md`.
