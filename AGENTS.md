# Agent Orientation

This is the **single source of truth** for the agentic-cube-prototype project. Read this before making any product, content, UI, or architecture change. Other docs are referenced from here only when relevant.

The project is an open-source, public, agentic portfolio prototype for Ricardo Melo. It is **not** a CV — it is visible proof of a transition from senior software engineering into Agentic Product Engineering.

## Direction (reset 2026-10-09)

A review on 2026-10-09 found the engineering well ahead of the product: the site was not yet published and no face linked to a real artifact, so the priority moved from the container to the content. Full reasoning in `docs/decisions/002-evidence-before-spectacle.md`.

- **Evidence before spectacle.** The cube is the invitation, not the proof. What makes the owner stand out is inspectable work: every face must link to at least one concrete artifact (repo, demo, write-up) with one line of result.
- **Stages, in order; build nothing more until the release.** The path to the first public release is normalization, then compositions (`docs/decisions/008-compositions-before-content.md`), then content, then security, then release; a stage starts only when the previous one met its exit criteria, and its decisions are taken at its entry (`docs/decisions/007-staged-path-to-publishing.md`). Normalizing the existing code to the declared architecture is not building more: the public repository is evidence too. New features, infrastructure, admin functions or 3D worlds wait until the site is live, except what spec 011 lists (the admin forms and media for the compositions, the CONTACT world).
- **The site is its own case study.** The methodology deep-dive explains how this site was built with agents: decisions, gates, what went wrong. It is the one page that aligns the cube with the positioning.
- **Name first, message largest.** The owner's name and role are the first text a visitor reads: top-left, the page's `h1`, never covered, AA contrast. The face title stays the largest text, because two headlines of equal weight compete; the name wins by position and contrast, not size.
- **Backgrounds must be perceivable.** A world that cannot be seen in a static frame behind the cube is not doing its retention job.

**Two layers (2026-10-10).** The code is public; the owner's personal content never enters the repository. In production it reaches the site through the admin, which moves to AWS behind Cognito (`docs/decisions/004-cognito-admin-on-aws.md`); how it reaches production for the first release is decision D-6, taken at the entry of the release stage.

Stages (ADR 007, ADR 008): (1) normalization, spec 010 P2b–P4 and the developer-facing docs (closed); (2) compositions, spec 011; (3) content, one artifact per face and the real copy; (4) security, the contact form, the CV request behind a captcha and the security review; (5) release. After the release: methodology page (unless D-8 brings it into the release), thesis/presentation state, the Cognito admin (ADR 004), evidence items per face, world visibility. `docs/roadmap.md` carries the detail.

## Identity

- Public display name: Ricardo Melo
- SEO/legal full name: Ricardo Hernan Melo Gallardo
- Technical handle: RicardoMeloG
- Primary positioning: Agentic Product Engineer
- Secondary positioning: Senior Software Engineer, AI-assisted product builder, open-source tool builder

## Audience

Evidence and segments behind this list: `docs/visitor-profile.md` (2026-10-10). Machines that read raw HTML are the largest audience; most AI crawlers do not execute JavaScript.

1. **Recruiters / hiring managers**: must understand in under 30 seconds what Ricardo is becoming professionally, why his senior systems background matters, what he can build with agentic workflows, and how to contact him.
2. **AI / recruiter systems**: indexable, semantic HTML with clear keywords (Agentic Product Engineer, AI-assisted development, React, TypeScript, Python, PostgreSQL, AWS, Security, Legacy modernization, Open source, Production systems).
3. **Developers and technical hiring managers**: inspect the repo and find clear architecture, reproducible setup, design rules, and a professional commit/spec history. The repository is evidence, not an appendix (ADR 007).

## Narrative

Short form:

> Agentic Product Engineer building AI-assisted products from real-world systems experience.

Long form:

> Ricardo Melo is a senior software engineer transitioning into Agentic Product Engineering, focused on AI-assisted product development, production systems, security, AWS, open-source tools, and independent research on thought, truth, and representation.

## Experience Architecture

The site is a **single-screen experience** built around a persistent obsidian cube.

- The cube stays visible at the center of the screen at all times on desktop. It is **not** a one-shot portal.
- Selecting a face does **not** navigate to a separate page or full-screen overlay. Instead, the composition around the cube updates in place to reveal that face's minimal content. The address bar follows in place (`/security`, `/es/seguridad`), so a copied link opens on that face; the page never reloads.
- Desktop layout: cube center, the face's composition around it (one template per face, chosen and filled from the admin; spec 011, E-1), face navigation on the bottom dock.
- Content per face is intentionally minimal: it must fit a single viewport without scroll on a standard 1440-1920px desktop. **No long-form essays inside the cube experience.**
- Responsive: on stacked screens the cube is the hero on top, the face's composition follows in reading order in one column, and the dock stays fixed at the bottom.
- Long-form deep-dive pages (methodology, project archive, research index) live on separate routes reached from the composition's CTAs and may scroll. They are not part of the single-screen experience.

For materials, color, motion, layout details, and tokens, see `docs/visual-direction.md` — the only other always-loaded document.

## Visual Strategy

Each cube face is paired with its own custom vector background that functions as a **standalone art piece**, not as thematic decoration. The user-facing funnel is explicit:

- **Background = retention** (the free sample that stops the indifferent visitor from bouncing).
- **Cube = invitation** (the anchor that offers a way into the content).
- **Composition = conversion** (the reward for the truly interested; the side panels of ADR 001).

Supporting rules:

- Each background must occupy a **distinct physical register** (motion type, density, depth axis), not just a distinct geometry — to avoid spectacle fatigue across the six faces.
- **Cube as Polaris:** any rotating element in a background must center its rotation on the cube. The cube is the still point of the rotating universe.
- **Fullscreen art mode** (pending implementation): double-click on the background hides cube + panels + chrome, leaving only the visitor's name strap and the background. Lets visitors appreciate the piece without losing authorship.

Full reasoning: `docs/decisions/001-spectacle-as-retention.md`.

## Cube Faces

The cube has six faces, each with a stable semantic identity:

1. **AGENTIC** — Agentic workflows, product building with AI agents, this site as process evidence.
2. **PRODUCTS** — Selected public products that support the current positioning (agentic tools, this site). Exclude old projects that do not.
3. **SYSTEMS** — Production systems, legacy modernization, databases, architecture, reliability.
4. **SECURITY** — Security mindset, MFA, rate limiting, ethical hacking readiness, secure production defaults.
5. **RESEARCH** — AI, philosophy of thought, truth, representation, papers, novels, independent research.
6. **CONTACT** — Email, GitHub, LinkedIn, collaboration signal.

All six faces share the same frame (double-diamond, inset bevel, corner brackets, label, three dots). Inside the frame each face carries its own accent color and inner glyph, assigned from `public/content/visual.json` (see `docs/decisions/003-per-face-accent-and-glyph.md`).

Every face must point at least one real, inspectable artifact through its CTAs, a link inside its composition or `detail.links`. CONTACT is a permanent face (owner, 2026-10-14; ADR 008): contact must be easy to reach for recruiters, and the CV is requested behind a captcha, never shown.

## Hard Rules

Product:

- Do **not** turn the site into a CV.
- Do **not** publish private/personal production content in the public repo.
- Do **not** expose private client details or sensitive history.
- Preserve the distinction between public example content and private personal content.
- Every visible page should be understandable by a recruiter in under 30 seconds and indexable by AI parsers.

Design:

- The cube is the persistent focal element: it stays at the centre and visible on every face; selecting a face updates the composition in place — the cube does not disappear.
- Each face's primary content must fit a single viewport on desktop without scroll, and collapse responsively on narrow viewports.
- All six cube faces share the same frame; accent color and inner glyph vary per face, nothing else.
- The owner's name and role are the first text read on every face (top-left, `h1`, not covered by any layer) and must meet AA contrast; the face title may be larger.
- Fixed chrome (the top bar with the name and the language, the dock) never overlaps content the visitor cannot scroll clear of.
- The dock names every face in full, at every width: no ellipsis, the longest `label` included (`check:layout --content=stress`). The top bar's controls share one height and one top edge (design review, 2026-10-21).
- Do **not** use `Bloom` in production — it caused visible flicker.
- Do **not** add auto-playing audio. Audio is gesture-driven and subtle.
- Avoid design drift: no generic SaaS gradients, no decorative cards, no landing-page templates, no bokeh backgrounds.
- Purple/violet volumetric ambient is the signature; obsidian black is the surface.
- Permanent motion is allowed only when it reinforces the obsidian identity (e.g. the violet wave-field background); never as random decoration.

## Engineering Contract

Stack (do not change without a spec justifying it):

- React + TypeScript + Vite (public site, `src/`)
- Three.js / @react-three/fiber for 3D
- Tailwind v4 with project tokens (see `docs/visual-direction.md`; styling rules in ADR 006)
- Zod for content schema validation — the same schemas are shared by the site and the admin
- Admin in production (ADR 004, in progress): static page under `/admin/`, Amazon Cognito User Pool (TOTP MFA, managed login, code + PKCE), API Gateway HTTP API with a Cognito JWT authorizer, one Lambda, S3 for published content, drafts and versions. No database in the cloud.
- Admin locally until ADR 004 is complete: NestJS API plus a vanilla admin page (`server/`), Postgres via `docker-compose.yml`; `npm run server` on `127.0.0.1:5182`. Retired once the Lambda path covers every operation.
- AWS CDK (`infra/`): private S3 + CloudFront with OAC, deployed by GitHub Actions over OIDC (`docs/deploy-aws.md`)

Before reporting a change complete (definition of done; items marked with a phase start when that phase of `specs/010-architecture` lands):

1. `npm run build`, `npm run lint` (site and server), `npm run typecheck:server` and `npm test` pass.
2. `npm run check:budget`, `npm run check:privacy`, `npm run check:docs` and `npm run check:tokens` pass.
3. `npm run check:layout` passes: no layout or accessibility failure beyond the known ones in `scripts/checks/layout-known.json`. A fix removes its entry; a new entry needs a reason in the commit. Add `--worlds` when a world, the top bar or its veil changed, and `--full --worlds` before a stage's acceptance: CI runs both only on demand while the site is being built (2026-10-16). `npm run check:admin` passes when the admin or a schema changed.
4. The pre-push hook is enabled (`git config core.hooksPath .githooks`).
5. Every slice, visual or not, closes with a visual walkthrough a person looks at (owner, 2026-10-15): `node scripts/walkthrough.mjs` photographs every face in every layout, both languages, at 1440×900, 1366×768 and 390×844 (screenshots in `walkthrough/`, gitignored); add `--admin` when the admin changed. Green gates do not prove the experience still holds; the walkthrough's findings are reported.
6. `docs/architecture.md` is updated in the same change when a boundary, flow or rule status changes.
7. Changes stay scoped to one product hito per commit.
8. A spec in progress is audited for drift at the checkpoints its slice table names, by agents without prior context (`node scripts/audit-drift.mjs`: two local models, each on its own), against `AGENTS.md`, its ADRs and the spec, and judged against the objective (Direction, Audience, MVP Definition: closer, neutral or postpones); every finding is verified, and the result is recorded next to the spec (`audit-N.md`) and resolved before the next slice.

Admin and backend rules:

- The custom login (bcrypt + TOTP in `server/auth/`) never leaves `127.0.0.1`. Authentication in production is Cognito's; do not add homegrown auth to the cloud path (ADR 004).
- In development an agent works on the local admin without the owner (owner, 2026-10-18): `ADMIN_AUTH=off` in `.env` skips the login for requests made on this machine to the admin's own address (`server/auth/devBypass.ts`); it needs `APP_ENV=development`, and with production the server refuses to start. The admin shows the bypass as its user name. Never widen it beyond loopback, and keep the admin out of other pages' frames (`server/noFraming.ts`, audit-4 F-1): a framed admin with the bypass on is signed in.
- The owner's personal data (email, admin user) is never written in code or committed; the Cognito user is created out of band.
- "Publish" must reach the deploy target: validate, write to the site bucket under `content/`, invalidate `/content/*`. The local NestJS publish writes to disk only and is not production.
- Code deploys never delete or overwrite private content: `deploy.yml` excludes `content/*` from the deleting sync and uploads hashed `assets/` without deleting old ones (spec 010, AD-11; gated by `scripts/checks/deployWorkflow.test.ts`).
- Admin backend logic lives in plain functions tested with Vitest against an S3 stub.

## Architecture Rules

The overview, the module map and the status of every rule (in force, or the phase that brings it) are in `docs/architecture.md`; the reasoning is in ADR 005, ADR 006 and `specs/010-architecture/`. Read `docs/architecture.md` before changing code. In short:

- **Content kernel** (`src/kernel/`): schemas, catalog, defaults, example content, SEO renderer, layout budgets. Pure TypeScript, no DOM, depends on `zod` only. The admin server imports the kernel and nothing else from `src/`.
- **Scene and DOM are separate.** Scene code (R3F, three) and DOM features never import each other; they meet in the experience store (`src/features/experience`): typed events, a pure reducer, `useExperience(selector)`. Module boundaries are lint rules; imports across modules use `@/`.
- **Styling.** Tailwind utilities with the tokens and layout-mode variants of `src/styles/tokens.css`; reusable pieces in `src/ui/`. Hand-written CSS only for what utilities express poorly (scrims, choreography, layered gradients), next to its component, in the `components` layer, commented with why; the one exception outside a layer is the intro choreography (`src/app/intro.css`), which must win over the elements' own transitions. No colour literal outside the tokens (`check:tokens`).
- **Layout modes** come from one source, `src/styles/layoutModes.ts`: three modes, `stacked`, `desktop`, `desktop-short` (height ≤ 900px, compact rhythm), and six width refinements inside them (`stacked-wide`, `tight`, `narrow`, `phone`, `phone-small`, `tiny`; see `docs/architecture.md`). No numeric breakpoints or loose width variants in components; Tailwind's own breakpoints are removed, and a test keeps CSS and JavaScript equal.
- **Content budgets** (`src/kernel/layoutBudgets.json`, visible characters and item counts) and link rules are publish rules: in production the admin refuses content that would not fit or links nowhere; while the project is in development (`APP_ENV` in `.env`, read by `server/appEnv.ts`; development until the owner says it goes to production) they are warnings and the publish goes through. The content's shape blocks in both phases; the site renders with the tolerant schema. Change a budget only with a layout check run that proves the stress content still fits.
- **Security headers** come from `infra/security-headers.json`: CloudFront serves them (the content security policy as report-only until it has run clean in production) and `vite preview` enforces them, so the layout check fails on any violation. No inline script or style in `index.html` (a test): the policy has no hashes.
- **No blank page.** Without WebGL the scene is replaced by a still image (`hasWebGL`); a scene or world error is contained by `src/lib/ErrorBoundary`. The name, the composition and the dock are DOM and always stay.
- **Interface copy** (labels, hints, `aria-label`s) comes from `src/features/content/copy.ts`; interface code never compares locales.
- **Size.** DOM-layer files have at most 250 lines (a test); a component that grows past it is doing more than one thing.
- **Unchecked rules** (review only) say so where they are written.

## Content Strategy

The site is bilingual: English (primary), Spanish (secondary).

Language behavior and addresses (owner, 2026-10-20; spec 012, AD-08):

- Every language and face has a clean address of its own, served as its own static HTML page: English at the root (`/` for the cube, `/security` for a face), Spanish under `/es` (`/es`, `/es/seguridad`). The slugs live in `src/kernel/sitePaths.ts` and never follow the content's labels: shared links point at them.
- The bare `/` opens in the language the visitor last chose (remembered in the browser), otherwise in `navigator.language` (Spanish if it starts with `es`, English otherwise); the address then names the language shown.
- The address bar never shows a query (owner, 2026-10-20). Query parameters are for review and development only: the review's (`?intro=`, `?nudge=`) are read on arrival and then removed from the bar, as is any other; the development tools' (`?bg=`, `?tune=`, `?fx=`, `?introAt=`, `?cube=solo`) exist and stay only in development.

Content files (paths):

- Public examples (committed): `public/content/site.example.en.json`, `public/content/site.example.es.json`
- Private deploy (gitignored): `public/content/site.en.json`, `public/content/site.es.json`
- Visual layer, world and accent per face: `public/content/visual.example.json` (committed) / `public/content/visual.json` (gitignored)
- Profile for machines, one per language (`llms.txt` and the profile pages, built from it; spec 012, AD-07): `public/content/profile.example.{en,es}.json` (committed) / `public/content/profile.{en,es}.json` (gitignored). It may say more than the faces, never anything else.

Loading order: the private document if present and valid, otherwise the example, which is bundled as the defaults; a field a published face leaves empty comes from the example in the same language. Validate shape (Zod) before rendering. Prose fields accept inline HTML only, sanitized at render time by `sanitizeRichText` (no block tags, no Markdown).

Face content shape (primary scene, must stay minimal):

- `title` (2-4 strong words), `eyebrow`, `summary` (one thesis line), `tagline` (the line under the face name in the dock)
- `composition`: one of the templates of `src/kernel/compositions.ts` (spec 011) with its slots filled; every slot has a measured budget in `layoutBudgets.json`, enforced when publishing
- `ctaPrimary` + `ctaSecondary` — at least one of them, a link inside the composition, or one `detail.links` entry, must carry a real `https:` `href` to an artifact; a `mailto:` is a channel, not an artifact (audit-3 F-3). The one line of result the artifact deserves is unchecked: no field carries it yet
- The top bar's `identity.displayName`, `role` and `keywords` have budgets too (`layoutBudgets.json`: `name`, `role`, `keywords`), enforced when publishing like the face fields (audit-3 F-4)
- `label` (the face name on the cube and the dock): 13 characters at most — "INVESTIGACIÓN" is the ceiling
- Images are uploaded through the admin (WebP, stored by hash); example images are refused in owner content
- Copy must name concrete things (a tool, a system, a result). Generic consultancy phrasing ("real impact", "practical vision") is a defect, not content.

Extended content (`detail.title`, `detail.summary`, `detail.points`, `detail.links`) is for the dialog a call to action opens. Full essays and project archives belong on future deep-dive routes.

Privacy:

- Do **not** publish: full CV, private phone numbers, sensitive client details, internal project names not already public, unreleased manuscripts.
- Do publish: public name, professional positioning, GitHub handle, LinkedIn URL, professional email, selected public projects, short research framing.

## Open Source

- Public repo must be reusable. Provide working example content.
- `public/content/site.{en,es}.json` are gitignored. Only the `.example.*` files are committed.
- README must explain setup, content strategy, and project intent.
- Use specs (see `specs/`) for large changes.

## Working Method

Large changes follow: spec (`specs/NNN-*/`) → independent audit by an agent without prior context, recorded next to the spec → revision → build → gates → visual verification → Conventional Commit. The method is part of what the site presents as its own case study; `specs/010-architecture/audit-1.md` is the first record. Unchecked: enforced by review.

## Commits

- Commit only coherent milestones.
- Commit messages describe the product hito, not the file diff.
- Do not mix unrelated refactors with feature changes.
- Messages follow Conventional Commits: `type(scope): summary`, lowercase after the colon except proper names (AWS, Cognito), no trailing period.
- Language: the summary and body are written in Spanish; types, scopes and footers (`BREAKING CHANGE:`, `Co-Authored-By:`) stay in English because tooling reads them. Example: `feat(cube): intro de primera visita e invitación a girar`.
  - Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`.
  - Scopes are optional; reuse the existing ones: `cube`, `admin`, `content`, `infra`, `a11y`, `mobile`.
  - A breaking change to the content schema or a public contract adds `!` after the type and a `BREAKING CHANGE:` footer.

## MVP Definition

Phase 1 ships when (status as of the 2026-10-09 audit):

- [x] The cube is the persistent focal element of the home experience.
- [x] Each face reveals minimal content in the composition around the cube in a single viewport (no overlay routing, no scroll on desktop).
- [x] The same composition adapts gracefully to narrow viewports — verified at 390px: cube hero, the composition in one column, the dock fixed at the viewport bottom with the content padded above it (spec 011, S4).
- [x] Content is loaded from the structured bilingual content system.
- [x] Public repo contains example content only; private content is supplied at deploy.
- [ ] At least one deep-dive page exists (methodology) reached from a composition CTA — there is no router yet. Whether it belongs to the first release is decision D-8 (release stage entry).
- [x] Static SEO in every page, one per language and face (`<title>`, description, share preview, JSON-LD, plain-text fallback for non-JS crawlers) — rendered at build time from the site content by `src/kernel/seo/renderSeo.ts`; `llms.txt` and the plain profile pages beside it (spec 012, AD-07). CI has no private content, so a CI deploy carries the example identity until ADR 004 slice 5 renders it at publish.
- [x] README explains the agentic process and architecture (site, kernel, local admin, infra; decisions, gates, independent audits, stages).
- [ ] Real identity and at least one real artifact per face, live at a public URL.
- [x] The CI gates pass (build, lint, types, tests, budget, privacy, docs, layout).

## Other References (load on demand)

- `docs/visual-direction.md` — design system (materials, color, motion, layout, tokens)
- `docs/project-memory.md` — owner direction that must survive across sessions (future-state positioning, presentation layer, market reframing)
- `docs/roadmap.md` — phase status, known gaps, priority order
- `docs/architecture.md` — code architecture overview, module map, flows and the status of every rule
- `docs/decisions/` — architectural decision records (001 spectacle as retention, 002 evidence before spectacle, 003 per-face accent and glyph, 004 Cognito-authenticated admin on AWS, 005 content kernel inside the site, 006 frontend architecture, 007 normalize before publishing)
- `docs/deploy-aws.md` — static hosting IaC and CI/CD, one-time AWS setup
- `docs/assets.md` — source and licence of every public asset
- `docs/visitor-profile.md` — who visits, with sources: recruiters, hiring managers, peers, AI crawlers, link previews, sourcing tools
- `docs/research-philosophy.md` — content brief for the RESEARCH face (what of the private archive may be shown)
- `specs/NNN-*/` — feature specs (lightweight markdown; Spec Kit drafts 002/003 kept as input)
