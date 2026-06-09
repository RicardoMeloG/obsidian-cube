# Agent Orientation

This is the **single source of truth** for the agentic-cube-prototype project. Read this before making any product, content, UI, or architecture change. Other docs are referenced from here only when relevant.

The project is an open-source, public, agentic portfolio prototype for Ricardo Melo. It is **not** a CV — it is visible proof of a transition from senior software engineering into Agentic Product Engineering.

## Identity

- Public display name: Ricardo Melo
- SEO/legal full name: Ricardo Hernan Melo Gallardo
- Technical handle: OlemOdracir
- Primary positioning: Agentic Product Engineer
- Secondary positioning: Senior Software Engineer, AI-assisted product builder, open-source tool builder

## Audience

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
2. **PRODUCTS** — Selected public products (e.g. OpenMenu GDEMU Manager). Exclude old projects that do not support the new positioning.
3. **SYSTEMS** — Production systems, legacy modernization, databases, architecture, reliability.
4. **SECURITY** — Security mindset, MFA, rate limiting, ethical hacking readiness, secure production defaults.
5. **RESEARCH** — AI, philosophy of thought, truth, representation, papers, novels, independent research.
6. **CONTACT** — Email, GitHub, LinkedIn, collaboration signal.

All six faces share the same visual grammar (diamond glyph, inset bevel, corner brackets); only the section label changes.

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
- All six cube faces share the same visual grammar; only the section label changes.
- Do **not** use `Bloom` in production — it caused visible flicker.
- Do **not** add auto-playing audio. Audio is gesture-driven and subtle.
- Avoid design drift: no generic SaaS gradients, no decorative cards, no landing-page templates, no bokeh backgrounds.
- Purple/violet volumetric ambient is the signature; obsidian black is the surface.
- Permanent motion is allowed only when it reinforces the obsidian identity (e.g. the violet wave-field background); never as random decoration.

## Engineering Contract

Stack (do not change without a spec justifying it):

- React + TypeScript + Vite
- Three.js / @react-three/fiber for 3D
- Tailwind v4 with project tokens (see `docs/visual-direction.md`)
- Zod for content schema validation

Before reporting a change complete:

1. Run `npm run build` (passes).
2. Run `npm run lint` (passes).
3. Verify visually with Playwright when the change is visual.
4. Keep changes scoped to one product hito per commit.

## Content Strategy

The site is bilingual: English (primary), Spanish (secondary).

Language behavior:

- `?lang=en` forces English.
- `?lang=es` forces Spanish.
- Otherwise: use `navigator.language` (Spanish if it starts with `es`, English otherwise).

Content files (paths):

- Public examples (committed): `public/content/site.example.en.json`, `public/content/site.example.es.json`
- Private deploy (gitignored): `public/content/site.en.json`, `public/content/site.es.json`

Loading order: try private → fall back to example → fall back to embedded defaults. Validate shape (Zod) before rendering.

Face content shape (primary scene, must stay minimal):

- `title` (2-4 strong words), `summary` (one thesis line)
- `features`: 3-4 named signals for the left rail
- `flowTitle` + `flow`: 4 short procedural steps for the right rail
- `ctaPrimary` + `ctaSecondary`

Extended content (`detail.title`, `detail.summary`, `detail.points`, `detail.links`) is for the modal — not the rails. Full essays and project archives belong on future deep-dive routes.

Privacy:

- Do **not** publish: full CV, private phone numbers, sensitive client details, internal project names not already public, unreleased manuscripts.
- Do publish: public name, professional positioning, GitHub handle, LinkedIn URL, professional email, selected public projects, short research framing.

## Open Source

- Public repo must be reusable. Provide working example content.
- `public/content/site.{en,es}.json` are gitignored. Only the `.example.*` files are committed.
- README must explain setup, content strategy, and project intent.
- Use specs (see `specs/`) for large changes.

## Commits

- Commit only coherent milestones.
- Commit messages describe the product hito, not the file diff.
- Do not mix unrelated refactors with feature changes.

## MVP Definition

Phase 1 ships when:

- The cube is the persistent focal element of the home experience.
- Each face reveals minimal content on the surrounding side panels in a single viewport (no overlay routing, no scroll on desktop).
- The same composition adapts gracefully to narrow viewports.
- Content is loaded from the structured bilingual content system.
- Public repo contains example content only; private content is supplied at deploy.
- At least one deep-dive page exists (methodology) reached from a side-panel CTA.
- README explains the agentic process and architecture.
- `npm run build` and `npm run lint` pass.

## Other References (load on demand)

- `docs/visual-direction.md` — design system (materials, color, motion, layout, tokens)
- `docs/roadmap.md` — phase tracking, future components, future admin panel
- `docs/decisions/` — architectural decision records (ADRs)
- `specs/NNN-*/` — feature specs (spec-kit, created on demand)
