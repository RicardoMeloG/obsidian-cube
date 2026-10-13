# Claude Code Orientation

This project uses `AGENTS.md` as the **single source of truth**. Read it first — it is the consolidated constitution, and its "Direction" section says what the project is optimizing for right now.

Before changing code, read `docs/architecture.md`: the module map, the flows and which architecture rules are in force (ADR 005, ADR 006, `specs/010-architecture/`).

For visual decisions (color, motion, layout, materials, tokens), also read `docs/visual-direction.md`.

All other docs are loaded on demand only:

- `docs/project-memory.md` — owner direction that must survive across sessions
- `docs/roadmap.md` — phase status, known gaps, priority order
- `docs/decisions/` — architectural decision records
- `docs/deploy-aws.md` — static hosting IaC and CI/CD
- `specs/NNN-*/` — feature specs

Layout: `src/` public site (React + Three.js; `src/kernel/` is the content contract shared with the admin), `server/` NestJS admin (`npm run server`, needs `.env`; Postgres via `docker compose up -d` is optional), `infra/` AWS CDK (own `package.json`).

Before reporting completion, meet the definition of done in `AGENTS.md` (Engineering Contract): build, lint, server types, tests, and the `check:*` scripts (budget, privacy, docs, tokens, layout); verify visual changes with Playwright on desktop, a short desktop (1366×768) and a 390px phone.
