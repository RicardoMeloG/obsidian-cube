# Agent Orientation

This is the **single source of truth** for the agentic-cube-prototype project. Read this before making any product, content, UI, or architecture change. Other docs are referenced from here only when relevant.

The project is an open-source, public, agentic portfolio prototype for Ricardo Melo. It is **not** a CV — it is visible proof of a transition from senior software engineering into Agentic Product Engineering.

## Direction (reset 2026-10-09)

A review on 2026-10-09 found the engineering well ahead of the product: the site was not yet published and no face linked to a real artifact, so the priority moved from the container to the content. Full reasoning in `docs/decisions/002-evidence-before-spectacle.md`.

- **Evidence before spectacle.** The cube is the invitation, not the proof. What makes the owner stand out is inspectable work: every face must link to at least one concrete artifact (repo, demo, write-up) with one line of result.
- **Publish before building more.** No further infrastructure, admin features or 3D worlds until the site is live with real identity and real links.
- **The site is its own case study.** The methodology deep-dive explains how this site was built with agents: decisions, gates, what went wrong. It is the one page that aligns the cube with the positioning.
- **Name first, message largest.** The owner's name and role are the first text a visitor reads: top-left, the page's `h1`, never covered, AA contrast. The face title stays the largest text, because two headlines of equal weight compete; the name wins by position and contrast, not size.
- **Backgrounds must be perceivable.** A world that cannot be seen in a static frame behind the cube is not doing its retention job.

**Two layers (2026-10-10).** The code is public; the owner's personal content never enters the repository and reaches the site only through the admin. The admin is therefore on the critical path to publishing, and moves to AWS behind Cognito (`docs/decisions/004-cognito-admin-on-aws.md`).

Priority order: (1) real content and publish, (2) one artifact per face, (3) methodology page and static SEO, (4) thesis/presentation state, (5) admin hardening and admin-to-deploy-target publishing, (6) cleanup. `docs/roadmap.md` carries the detail.

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
3. **Developers** (secondary): inspect the repo and find clear architecture, reproducible setup, design rules, and a professional commit/spec history.

## Narrative

Short form:

> Agentic Product Engineer building AI-assisted products from real-world systems experience.

Long form:

> Ricardo Melo is a senior software engineer transitioning into Agentic Product Engineering, focused on AI-assisted product development, production systems, security, AWS, open-source tools, and independent research on thought, truth, and representation.

## Experience Architecture

The site is a **single-screen experience** built around a persistent obsidian cube.

- The cube stays visible at the center of the screen at all times on desktop. It is **not** a one-shot portal.
- Selecting a face does **not** navigate to a separate page or full-screen overlay. Instead, the surrounding side panels update in place to reveal that face's minimal content.
- Desktop layout: cube center, primary narrative on the left rail, supporting structure (numbered flow / metrics) on the right rail, breadcrumb/section navigation on the bottom strip.
- Content per face is intentionally minimal: it must fit a single viewport without scroll on a standard 1440-1920px desktop. **No long-form essays inside the cube experience.**
- Responsive: on narrow viewports the side panels collapse below/above the cube while the cube remains the visual anchor.
- Long-form deep-dive pages (methodology, project archive, research index) live on separate routes reached from side-panel CTAs and may scroll. They are not part of the single-screen experience.

For materials, color, motion, layout details, and tokens, see `docs/visual-direction.md` — the only other always-loaded document.

## Visual Strategy

Each cube face is paired with its own custom vector background that functions as a **standalone art piece**, not as thematic decoration. The user-facing funnel is explicit:

- **Background = retention** (the free sample that stops the indifferent visitor from bouncing).
- **Cube = invitation** (the anchor that offers a way into the content).
- **Side panels = conversion** (the reward for the truly interested).

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

Every face must point at least one real, inspectable artifact through its CTAs or `detail.links`. Whether CONTACT keeps a face or becomes persistent chrome is an open decision (see `docs/project-memory.md`, 2026-06-11).

## Hard Rules

Product:

- Do **not** turn the site into a CV.
- Do **not** publish private/personal production content in the public repo.
- Do **not** expose private client details or sensitive history.
- Preserve the distinction between public example content and private personal content.
- Every visible page should be understandable by a recruiter in under 30 seconds and indexable by AI parsers.

Design:

- The cube is the persistent focal element; selecting a face updates side panels in place — the cube does not disappear.
- Each face's primary content must fit a single viewport on desktop without scroll, and collapse responsively on narrow viewports.
- All six cube faces share the same frame; accent color and inner glyph vary per face, nothing else.
- The owner's name and role are the first text read on every face (top-left, `h1`, not covered by any layer) and must meet AA contrast; the face title may be larger.
- Fixed chrome (face strip, identity block, language toggle) never overlaps scrolling content on narrow viewports.
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

1. `npm run build`, `npm run lint` and `npm test` pass.
2. The server type-checks and lints (P1).
3. The layout and accessibility checks pass, with no new failure beyond the recorded known ones (P1).
4. The privacy check passes (P1).
5. Visual changes are verified with Playwright: desktop at 1440px or wider, a short desktop (1366×768) and a 390px phone.
6. `docs/architecture.md` is updated in the same change when a boundary, flow or rule status changes.
7. Changes stay scoped to one product hito per commit.

Admin and backend rules:

- The custom login (bcrypt + TOTP in `server/auth/`) never leaves `127.0.0.1`. Authentication in production is Cognito's; do not add homegrown auth to the cloud path (ADR 004).
- The owner's personal data (email, admin user) is never written in code or committed; the Cognito user is created out of band.
- "Publish" must reach the deploy target: validate, write to the site bucket under `content/`, invalidate `/content/*`. The local NestJS publish writes to disk only and is not production.
- Code deploys must never delete or overwrite private content. **Not yet true:** `deploy.yml` syncs with `--delete` and no exclusion; fixed before the first publish (spec 010, AD-11), gated by a CI test.
- Admin backend logic lives in plain functions tested with Vitest against an S3 stub.

## Architecture Rules

The overview, the module map and the status of every rule (in force, or the phase that brings it) are in `docs/architecture.md`; the reasoning is in ADR 005, ADR 006 and `specs/010-architecture/`. Read `docs/architecture.md` before changing code. In short:

- **Content kernel** (`src/kernel/`, from P1): schemas, catalog, defaults, example content, SEO renderer, layout budgets. Pure TypeScript, no DOM, depends on `zod` only. The admin server imports the kernel and nothing else from `src/`.
- **Scene and DOM are separate.** Scene code (R3F, three) and DOM features never import each other; they meet in the experience store (from P3).
- **Styling.** Tailwind utilities and tokens; hand-written CSS only for what utilities express poorly, commented with why. `App.css` is legacy being migrated (P2b–P4): do not grow it except for the P2a short-screen fix.
- **Layout modes** come from one source, `src/styles/layoutModes.ts` (from P2a). No numeric breakpoints in components.
- **Content budgets** (lengths, counts, link rules) are schema constraints, so content that would not fit is rejected at publish.
- **No blank page.** Error boundaries keep the name, rails and strip visible when WebGL or a scene chunk fails (from P2a).
- **Unchecked rules** (review only) say so where they are written.

## Content Strategy

The site is bilingual: English (primary), Spanish (secondary).

Language behavior:

- `?lang=en` forces English.
- `?lang=es` forces Spanish.
- Otherwise: use `navigator.language` (Spanish if it starts with `es`, English otherwise).

Content files (paths):

- Public examples (committed): `public/content/site.example.en.json`, `public/content/site.example.es.json`
- Private deploy (gitignored): `public/content/site.en.json`, `public/content/site.es.json`
- Visual layer, world and accent per face: `public/content/visual.example.json` (committed) / `public/content/visual.json` (gitignored)

Loading order: try private → fall back to example → fall back to embedded defaults. Validate shape (Zod) before rendering. Prose fields accept inline HTML only, sanitized at render time by `sanitizeRichText` (no block tags, no Markdown).

Face content shape (primary scene, must stay minimal):

- `title` (2-4 strong words), `summary` (one thesis line)
- `features`: 3-4 named signals for the left rail
- `flowTitle` + `flow`: 4 short procedural steps for the right rail
- `ctaPrimary` + `ctaSecondary` — at least one of them, or one `detail.links` entry, must carry a real `href` to an artifact
- `label` (the face name on the cube and the bottom strip): 13 characters at most — "INVESTIGACIÓN" is the ceiling that fits the 320px strip without clipping
- `researchConcepts` (RESEARCH face only): the side panel shows the first 4; extra entries are silently ignored
- Copy must name concrete things (a tool, a system, a result). Generic consultancy phrasing ("real impact", "practical vision") is a defect, not content.

Extended content (`detail.title`, `detail.summary`, `detail.points`, `detail.links`) is for the modal — not the rails. Full essays and project archives belong on future deep-dive routes.

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
- [x] Each face reveals minimal content on the surrounding side panels in a single viewport (no overlay routing, no scroll on desktop).
- [x] The same composition adapts gracefully to narrow viewports — verified at 390px: cube hero, stacked rails, fixed face strip at the viewport bottom with the content padded above it.
- [x] Content is loaded from the structured bilingual content system.
- [x] Public repo contains example content only; private content is supplied at deploy.
- [ ] At least one deep-dive page exists (methodology) reached from a side-panel CTA — there is no router yet.
- [x] Static SEO in `index.html` (`<title>`, description, share preview, JSON-LD, plain-text fallback for non-JS crawlers) — rendered at build time from the site content by `src/seo/renderSeo.ts`. CI has no private content, so a CI deploy carries the example identity until ADR 004 slice 5 renders it at publish.
- [ ] README explains the agentic process and architecture — it covers the site, not the admin or the infra.
- [ ] Real identity and at least one real artifact per face, live at a public URL.
- [x] `npm run build`, `npm run lint` and `npm test` pass.

## Other References (load on demand)

- `docs/visual-direction.md` — design system (materials, color, motion, layout, tokens)
- `docs/project-memory.md` — owner direction that must survive across sessions (future-state positioning, presentation layer, market reframing)
- `docs/roadmap.md` — phase status, known gaps, priority order
- `docs/architecture.md` — code architecture overview, module map, flows and the status of every rule
- `docs/decisions/` — architectural decision records (001 spectacle as retention, 002 evidence before spectacle, 003 per-face accent and glyph, 004 Cognito-authenticated admin on AWS, 005 content kernel inside the site, 006 frontend architecture)
- `docs/deploy-aws.md` — static hosting IaC and CI/CD, one-time AWS setup
- `docs/visitor-profile.md` — who visits, with sources: recruiters, hiring managers, peers, AI crawlers, link previews, sourcing tools
- `docs/research-philosophy.md` — content brief for the RESEARCH face (what of the private archive may be shown)
- `specs/NNN-*/` — feature specs (lightweight markdown; Spec Kit drafts 002/003 kept as input)
