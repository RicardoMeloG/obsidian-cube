# Obsidian Cube

The portfolio of Ricardo Melo, live at **https://ricardomelog.com**.

The site is the visible part. The repository is the evidence: how a product is built with AI agents under an architecture, gates and decision records that keep it honest.

## Concept

A single-screen experience built around a persistent obsidian cube.

- The cube stays at screen center; it is not a portal that disappears on selection.
- Selecting a face changes the composition around the cube in place — each face has its own shape (a showcase, a catalog with screenshots, a case with its status map, a register of controls, a reading, the contact channels), chosen and filled from the admin; the cube turns between faces but never goes away. On phones the cube is the hero and the composition follows below it.
- All content per face fits a single desktop viewport without scrolling; the layout treats each face as a poster, not a page.
- Each face opens its long form in a detail dialog.
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
- **The infrastructure** (`infra/`): AWS CDK, private S3 behind CloudFront with the security headers of `infra/security-headers.json`; for now I deploy from my machine with the private content (spec 010, D-6); the GitHub Actions workflow over OIDC runs on demand.

Module boundaries are lint rules, and each rule is proved by a test that feeds it a violating file (`scripts/checks/boundaries.test.ts`).

## How It Is Built

I design the architecture, the rules and the gates; AI agents implement inside them, and nothing reaches `main` without passing them. The repository shows that loop, not only its output.

- **Decisions before code.** Each change of direction is an ADR (`docs/decisions/`) and each body of work a spec (`specs/`) with its acceptance criteria. `AGENTS.md` is the contract every agent, human or AI, reads first.
- **Rules are gates, not advice.** A rule counts as in force only when a check fails without it: lint boundaries, type-checked tests, a first-view size ratchet, a privacy scan (files and, before publishing, the whole history), colour and type tokens, a layout check that measures every face on a viewport matrix with real and worst-case content, accessibility and contrast, and the content security policy. Every new gate is proved by breaking it once on purpose.
- **Independent audits.** Stages close only after an audit by a reviewer with no context from the work (`specs/010-architecture/audit-1.md`, `audit-2.md`); every finding is fixed or recorded as a decision.
- **Stages in order** (ADR 007, ADR 008): normalize the code, compositions, content, security, release.
- **The published site is tested too.** `npm run check:live` walks twelve visitor use cases against the live site and fails on any console error or warning (`docs/live-use-cases.md`).

## Getting Started

Public site:

```bash
npm install
npm run dev
```

Admin (optional, local only):

```bash
cp .env.example .env        # set SESSION_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD; APP_ENV and ADMIN_AUTH set the mode
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
npm run check:layout -- --worlds   # also name and role over every world (software WebGL; on demand in CI)
npm run check:live       # use cases against the published site (or --url=http://127.0.0.1:5181)
git config core.hooksPath .githooks   # once per clone: privacy check before every push
```

Private values for the privacy check go in `.privacy-denylist` (gitignored, one per line) and, in CI, in the `PRIVACY_DENYLIST` secret.

AWS: see `docs/deploy-aws.md`. Nothing is provisioned by default; `cd infra && npm run prepare:cdk && npm ci && npm run synth` prepares the verified dependency and validates the stack; subsequent synths are offline. See `docs/dependency-security.md`.

## Content

Public examples (committed):

- `public/content/site.example.en.json`
- `public/content/site.example.es.json`

Personal deploy content (gitignored):

- `public/content/site.en.json`
- `public/content/site.es.json`
- `public/content/visual.json` (world and accent per face; example committed as `visual.example.json`)

Loading order: the private file if present, otherwise the example, which is bundled as the defaults (`src/kernel/siteContent.ts`); a face that leaves a field empty takes it from the example in the same language. The admin edits and publishes these same files.

Addresses and language: one page per language and face, English at the root (`/`, `/security`) and Spanish under `/es` (`/es`, `/es/seguridad`), each built as its own static HTML with its title and share preview (`src/kernel/sitePaths.ts`). The bare `/` opens in the visitor's last choice, otherwise in `navigator.language`.

## Visual Direction

Obsidian Interface System: dark, premium, technical, sober. Violet volumetric ambient is the signature; obsidian black is the surface. No `Bloom` in production, no auto-playing audio, no generic SaaS gradients. See `docs/visual-direction.md` for tokens, materials, motion, and layout rules.

## Status (2026-11-12)

Published at https://ricardomelog.com on CloudFront and S3 (`infra/`), with an enforced content security policy and an A+ on Mozilla Observatory and SSL Labs. This is the first release. Still open, in order (`docs/roadmap.md`): the contact form and the CV request of the security stage, real 404s, and the Cognito admin of ADR 004.

## Orientation for Contributors

Read in this order:

1. `AGENTS.md` — single source of truth (identity, audience, rules, contract, current direction).
2. `docs/architecture.md` — module map, flows, and which rules are in force with their gates; read before changing code.
3. `docs/visual-direction.md` — design system, loaded for visual work.
4. `docs/roadmap.md`, `docs/decisions/`, `docs/deploy-aws.md`, `specs/` — loaded on demand.

## License

MIT

Content checks: CI uses neutral fixtures. Reviewing the private database drafts requires a separate private build with recorded provenance; see `docs/content-validation.md`. A green CI does not accept the personal content.
