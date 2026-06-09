# Agentic Cube Prototype

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
- Tailwind v4 (tokens in `src/index.css`)
- Zod for content schema validation
- Web Audio API (gesture-driven, no auto-play)

## Getting Started

```bash
npm install
npm run dev
```

Checks before committing:

```bash
npm run build
npm run lint
```

## Content

Public examples (committed):

- `public/content/site.example.en.json`
- `public/content/site.example.es.json`

Personal deploy content (gitignored):

- `public/content/site.en.json`
- `public/content/site.es.json`

Loading order: try private → fall back to example → fall back to embedded defaults.

Language behavior: `?lang=en` or `?lang=es` to force; otherwise inferred from `navigator.language`.

## Visual Direction

Obsidian Interface System: dark, premium, technical, sober. Violet volumetric ambient is the signature; obsidian black is the surface. No `Bloom` in production, no auto-playing audio, no generic SaaS gradients. See `docs/visual-direction.md` for tokens, materials, motion, and layout rules.

## Orientation for Contributors and AI Agents

Read in this order:

1. `AGENTS.md` — single source of truth (identity, audience, rules, contract).
2. `docs/visual-direction.md` — design system, loaded for visual work.
3. `docs/roadmap.md`, `docs/decisions/`, `specs/` — loaded on demand.

## License

MIT
