# Claude Code Orientation

This project uses `AGENTS.md` as the **single source of truth**. Read it first — it is the consolidated constitution, and its "Direction" section says what the project is optimizing for right now.

For visual decisions (color, motion, layout, materials, tokens), also read `docs/visual-direction.md`.

All other docs are loaded on demand only:

- `docs/project-memory.md` — owner direction that must survive across sessions
- `docs/roadmap.md` — phase status, known gaps, priority order
- `docs/decisions/` — architectural decision records
- `docs/deploy-aws.md` — static hosting IaC and CI/CD
- `specs/NNN-*/` — feature specs

Layout: `src/` public site (React + Three.js), `server/` NestJS admin (`npm run server`, needs `.env`; Postgres via `docker compose up -d` is optional), `infra/` AWS CDK (own `package.json`).

Always run `npm run build`, `npm run lint` and `npm test` before reporting completion. Verify visually with Playwright when the change is visual (desktop and a 390px phone).
