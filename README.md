# Obsidian Cube

Open-source agentic portfolio prototype for Ricardo Melo.

This project is **not** a public CV. It is visible proof of a transition into Agentic Product Engineering: building AI-assisted products with real production systems experience, security awareness, open-source practice, and independent research depth.

## Concept

A single-screen experience built around a persistent obsidian cube.

- The cube stays at screen center; it is not a portal that disappears on selection.
- Selecting a face updates the surrounding side panels in place — left rail carries the narrative, right rail carries the numbered process, the cube animates between faces but never goes away.
- All content per face fits a single desktop viewport without scrolling; the layout treats each face as a poster, not a page.
- Long-form material (methodology, project archive, research index) lives on separate routes reached from side-panel CTAs.
- Bilingual (English / Spanish), driven by structured JSON content with Zod validation.

## Stack

- React + TypeScript + Vite
- Three.js / @react-three/fiber / drei
- Tailwind v4 (tokens and layout-mode variants in `src/styles/tokens.css`, primitives in `src/ui/`)
- Zod for content schema validation (schemas shared with the admin)
- Web Audio API (gesture-driven, no auto-play)
- NestJS admin API + vanilla admin page (`server/`), Postgres for drafts, versions and admin users
- AWS CDK for static hosting (`infra/`: private S3 + CloudFront with OAC), GitHub Actions over OIDC

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
npm run build
npm run lint
npm run typecheck:server
npm test
npm run check:budget     # first-view size, a ratchet
npm run check:privacy    # no personal data in publishable files
npm run check:docs       # no undated measurements in living docs
npm run check:tokens     # no colour literal outside the tokens
npm run check:layout     # layout and accessibility on a viewport matrix (Playwright)
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

## Status (2026-10-09)

Prototype, not yet published. The cube, the bilingual content system, the admin with MFA and the AWS scaffolding exist and pass their gates; what is missing is the part that makes it a portfolio: real identity, one inspectable artifact per face, a methodology page and a public URL. The current direction is *evidence before spectacle* (`docs/decisions/002-evidence-before-spectacle.md`); the ordered list of what is left is in `docs/roadmap.md`.

## Orientation for Contributors and AI Agents

Read in this order:

1. `AGENTS.md` — single source of truth (identity, audience, rules, contract, current direction).
2. `docs/visual-direction.md` — design system, loaded for visual work.
3. `docs/project-memory.md` — owner direction that must survive across sessions.
4. `docs/roadmap.md`, `docs/decisions/`, `docs/deploy-aws.md`, `specs/` — loaded on demand.

## License

MIT
