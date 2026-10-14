# Obsidian Cube

Open-source agentic portfolio prototype for Ricardo Melo.

This project is **not** a public CV. It is visible proof of a transition into Agentic Product Engineering: building AI-assisted products with real production systems experience, security awareness, open-source practice, and independent research depth.

## Concept

A single-screen experience built around a persistent obsidian cube.

- The cube stays at screen center; it is not a portal that disappears on selection.
- Selecting a face updates the surrounding side panels in place — left rail carries the narrative, right rail carries the numbered process, the cube animates between faces but never goes away.
- All content per face fits a single desktop viewport without scrolling; the layout treats each face as a poster, not a page.
- Each face opens its long form in a detail dialog; whether the first release also has a methodology page is decision D-8 (release stage).
- Bilingual (English / Spanish), driven by structured JSON content with Zod validation.

## Stack

- React + TypeScript + Vite
- Three.js / @react-three/fiber / drei
- Tailwind v4 (tokens and layout-mode variants in `src/styles/tokens.css`, primitives in `src/ui/`)
- Zod for content schema validation (schemas shared with the admin)
- Web Audio API (gesture-driven, no auto-play)
- NestJS admin API + vanilla admin page (`server/`), Postgres for drafts, versions and admin users
- AWS CDK for static hosting (`infra/`: private S3 + CloudFront with OAC), GitHub Actions over OIDC

## Architecture

Four parts, one repository (`docs/architecture.md` has the module map, the flows and every rule with its gate):

- **The site** (`src/`): React and React Three Fiber, organised by feature (`app`, `features/{experience,scene,faces,navigation,content,audio,dev}`, `ui`, `styles`, `lib`). The 3D scene and the DOM interface never import each other; they meet in one experience store, a pure reducer with typed events. Styling is Tailwind v4 over the tokens and layout-mode variants of `src/styles/tokens.css`; without WebGL the page shows a poster and keeps working.
- **The content kernel** (`src/kernel/`): the Zod contract for the content, the publish rules (layout budgets, safe links, one artifact per face) and the static SEO. No DOM and no React, so the site, the Vite build and the admin share it.
- **The local admin** (`server/`): NestJS on 127.0.0.1, MFA, writes the same content files; it imports only the kernel. Its cloud form is ADR 004, after the release.
- **The infrastructure** (`infra/`): AWS CDK, private S3 behind CloudFront with the security headers of `infra/security-headers.json`; GitHub Actions deploys over OIDC, only after a green CI.

Module boundaries are lint rules, and each rule is proved by a test that feeds it a violating file (`scripts/checks/boundaries.test.ts`).

## How It Is Built

The process is part of the evidence: an AI agent writes most of the code, and the repository shows how it is kept in line.

- **Decisions before code.** Each change of direction is an ADR (`docs/decisions/`) and each body of work a spec (`specs/`) with its acceptance criteria. `AGENTS.md` is the contract every agent reads first.
- **Rules are gates, not advice.** A rule counts as in force only when a check fails without it: lint boundaries, type-checked tests, a first-view size ratchet, a privacy scan (files and, before publishing, the whole history), colour and type tokens, a layout check that measures every face on a viewport matrix with real and worst-case content, accessibility and contrast, and the content security policy. Every new gate is proved by breaking it once on purpose.
- **Independent audits.** Stages close only after an audit by an agent with no context from the work (`specs/010-architecture/audit-1.md`, `audit-2.md`); every finding is fixed or recorded as a decision.
- **Stages in order** (ADR 007): normalize the code, then the content, then release.

## Getting Started

Public site:

```bash
npm install
npm run dev
```

Admin (optional, local only):

```bash
cp .env.example .env        # set SESSION_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD
docker compose up -d        # Postgres on 5433
npm run server              # http://127.0.0.1:5182 — first login enrolls TOTP MFA
```

Without Postgres the admin still starts in file-only mode (publish works, drafts and versions are disabled).

Checks before committing (the same gates run in CI; see `docs/architecture.md`):

```bash
npx playwright install chromium   # once, for check:layout
npm run build
npm run lint
npm run typecheck:server
npm test
npm run check:budget     # first-view size, a ratchet
npm run check:privacy    # no personal data in publishable files
npm run check:docs       # no undated measurements in living docs
npm run check:tokens     # colours and type only from the tokens
npm run check:layout     # layout, accessibility, contrast and CSP on a viewport matrix (Playwright)
git config core.hooksPath .githooks   # once per clone: privacy check before every push
```

Private values for the privacy check go in `.privacy-denylist` (gitignored, one per line) and, in CI, in the `PRIVACY_DENYLIST` secret.

AWS: see `docs/deploy-aws.md`. Nothing is provisioned by default; `cd infra && npm run synth` validates the stack offline.

## Content

Public examples (committed):

- `public/content/site.example.en.json`
- `public/content/site.example.es.json`

Personal deploy content (gitignored):

- `public/content/site.en.json`
- `public/content/site.es.json`
- `public/content/visual.json` (world and accent per face; example committed as `visual.example.json`)

Loading order: the private file if present, otherwise the example, which is bundled as the defaults (`src/kernel/siteContent.ts`); a face that leaves a field empty takes it from the example in the same language. The admin edits and publishes these same files.

Language behavior: `?lang=en` or `?lang=es` to force; otherwise inferred from `navigator.language`.

## Visual Direction

Obsidian Interface System: dark, premium, technical, sober. Violet volumetric ambient is the signature; obsidian black is the surface. No `Bloom` in production, no auto-playing audio, no generic SaaS gradients. See `docs/visual-direction.md` for tokens, materials, motion, and layout rules.

## Status (2026-10-13)

Prototype, not yet published. The first stage, normalizing the code, is closed: the architecture of spec 010 is built (P0–P4) and passed two independent audits. Next is the content stage: real identity and one inspectable artifact per face. Then the release stage: the public repository, the domain and the first deploy. The direction is *evidence before spectacle* (`docs/decisions/002-evidence-before-spectacle.md`); what is left, in order, is in `docs/roadmap.md`.

## Orientation for Contributors and AI Agents

Read in this order:

1. `AGENTS.md` — single source of truth (identity, audience, rules, contract, current direction).
2. `docs/architecture.md` — module map, flows, and which rules are in force with their gates; read before changing code.
3. `docs/visual-direction.md` — design system, loaded for visual work.
4. `docs/project-memory.md` — owner direction that must survive across sessions.
5. `docs/roadmap.md`, `docs/decisions/`, `docs/deploy-aws.md`, `specs/` — loaded on demand.

## License

MIT
