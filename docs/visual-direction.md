# Visual Direction: Obsidian Interface System

## North Star

The visual system should feel like polished obsidian: dark, precise, reflective, quiet, and premium. It should signal engineering discipline and independent thought, not generic startup energy.

## Core Aesthetic

- Material: polished obsidian, dark glass, mineral reflection.
- Light: controlled highlights, ice-blue glints, restrained warm reflection.
- Tone: technical, editorial, serious, calm.
- Motion: deliberate, slow enough to feel intentional, never flashy.
- Sound: subtle glass/cup resonance, only after user interaction.

## Current Design Language

Name: Obsidian Technical Luxury.

The design should read as premium because it is precise, not because it is decorated. Use restraint:

- Use black glass surfaces, fine mineral borders, and controlled reflection.
- Use copper/gold only as a micro-accent: numeration, corner marks, active states, and thin rules.
- Use ice-blue for technical signal: glyphs, focus lines, status, and spatial depth.
- Prefer custom geometric glyphs over generic icon packs when the symbol is part of the cube language.
- Avoid filling empty space with decoration unless it reinforces navigation, structure, or hierarchy.

## Cube Rules

- The cube is the **persistent focal element** of the entire experience, always visible at screen center on desktop.
- The cube is not a one-shot portal. Selecting a face updates the surrounding side panels in place; the cube does not disappear, navigate, or fade out.
- The cube rotates on drag and snaps to the selected face on click. Audio cues stay subtle and gesture-driven.
- All six faces share the same visual grammar: inset bevel, corner brackets, central diamond glyph, section label, "OBSIDIAN CUBE" subtitle, three accent dots. No per-face glyph divergence.
- Material direction: deep obsidian (`#010208`), high metalness (≈0.92), low-to-mid roughness (≈0.13), strong clearcoat. Edges should catch a clean top rim highlight; the underside should bathe in violet underglow.
- Avoid postprocessing that creates instability.
- `Bloom` is prohibited for production because it caused visible flicker.

## Background

Default field (always present):

- Deep obsidian field (`#02040a` to `#03050b`) with a subtle dotted grid (faint blue-violet intersections, low alpha).
- A vertical light beam descends onto the cube from above as ambient continuity.
- A wide, soft violet volumetric glow surrounds the cube and platform — this is the signature ambient. It should read as nebula/aurora, never as a generic SaaS purple gradient.
- The platform under the cube has concentric rings with chronometer-style tick marks and a small bright center point.

### Wave-Field Background (Target)

Behind the cube and behind the platform, the scene includes a **violet "wave-field"**: a low-poly point-and-line mesh that occupies the lower half of the background and behaves like a calm sea.

- Visual reference: a perspective grid of small violet dots (`~#b8aeff`) connected by thin segments (`~#7a6dff`, low alpha), receding toward the horizon. Brighter, denser nodes near the camera; fainter, sparser nodes far away.
- Motion: a slow, continuous wave displacement on the Z (height) axis — combine two or three sine waves of different wavelengths and phases so the surface never visually repeats. Amplitude must stay small enough that the cube reads as the focal element, not the waves.
- Tempo: think tide, not ocean storm. Period in the order of 4-8 seconds per major undulation, with finer ripples superimposed.
- Color discipline: violet/indigo only. Do not let the wave-field shift toward generic neon cyan or magenta. It is the same family as the ambient glow.
- Density: roughly poster-quality — visible structure but never crowded. Fade to black at the horizon and at the screen edges so it never competes with side-panel content.
- Performance: implement as a `BufferGeometry` driven by an animation loop or a shader; avoid per-frame allocations and avoid heavy postprocessing.

### Environment reflection (for the cube)

- Warmth should come from reflection, not from a busy background.
- Avoid green tint dominating the cube.
- The wave-field should contribute soft violet reflections on the cube's lower edges, reinforcing the underglow.
- Prefer high-contrast light bands, pale sky, distant dark forms, and subtle gold/ice highlights.

## Layout: Single-Screen Side Panels

The experience is a single-viewport composition. Selecting a face never navigates away.

Desktop composition (≈1440-1920px):

- **Center**: the cube, occupying roughly 40-50% of the horizontal frame, vertically centered.
- **Top-left**: identity block — display name and role (e.g. "Ricardo Melo / Ingeniero de Productos Agénticos").
- **Top-right**: language toggle (EN / ES).
- **Left rail**: the selected face's primary narrative — eyebrow (e.g. "Ingeniería de"), large two-line headline, a short paragraph, then a vertical list of 3-5 named features with a small glyph and one-sentence description each. End with a single primary action (e.g. "EXPLORAR ENFOQUE").
- **Right rail**: the supporting structure for that face — a numbered flow or metric stack (e.g. "FLUJO AGÉNTICO 04" with steps `01 ESPECIFICAR`, `02 PROTOTIPAR`, `03 VALIDAR`, `04 PUBLICAR`), each with a brief one-line description. End with a secondary action (e.g. "VER METODOLOGÍA →").
- **Bottom strip**: section breadcrumb (e.g. `DISEÑO INTELIGENTE • SISTEMAS AUTÓNOMOS • IMPACTO REAL`) on the left and the full searchable name on the right.

Hard constraints:

- The entire composition must fit in a single viewport at standard desktop widths without scrolling. Treat each face as a poster, not a page.
- Side panel content per face is minimal: short paragraph, list of named items, one or two CTAs. No long-form essays inside the cube experience.
- Switching faces is a soft cross-fade of the side-panel content; the cube animates in place.

Responsive collapse (≤900px):

- Cube remains the visual anchor, scaled down.
- Left and right rails stack below the cube as accordions or a vertical scroll list.
- Bottom breadcrumb may collapse to a horizontal scroller.
- Maintain the no-scroll-on-desktop rule only for desktop; mobile may scroll, but the first fold must include the cube and the face's headline.

Surface rules (for side-panel cards and pills):

- Cards should feel like polished obsidian panels: dark, reflective, thin bordered, and responsive to the pointer.
- Cards may use tiny corner marks, inner highlights, and cursor-following light.
- Do not nest cards inside cards.
- Do not use large rounded SaaS-style cards.
- Repeated cards should share a common interaction model and visual grammar.

## Deep-dive Pages (Secondary)

Long-form content (the methodology behind a face, the actual project archive, the full research index) lives on separate routes reached via the side-panel CTAs ("VER METODOLOGÍA", "EXPLORAR ENFOQUE", etc.).

- These pages may use the existing static obsidian page styling.
- They are not part of the single-screen experience and may scroll.
- They should still feel like the same system: same typography, same palette, same surface vocabulary.
- The cube is not required to be present on these pages.

## Color Tokens

Working palette:

- `obsidian-950`: `#020307`
- `obsidian-900`: `#05070d`
- `obsidian-800`: `#090d14`
- `ice-300`: `#9acbf2`
- `ice-100`: `#eef7ff`
- `mineral-500`: `#8a97a6`
- `copper-400`: `#c08b5a`
- `glass-line`: `rgba(222, 232, 242, 0.14)`

## Typography

- Use a sober sans-serif.
- Avoid oversized marketing headlines except on true section entrances.
- Use tight, readable editorial blocks.
- Letter spacing should be restrained.
- On high-density desktops, prefer editorial density over spectacle. A 5K display at 250% scaling behaves like a roughly 2048px CSS viewport; the page must not look zoomed-in at that size.
- Desktop content should use wide containers before oversized typography. Keep section H1s below roughly 94px on large CSS viewports unless a specific visual review approves a larger scale.

## Responsive Density

- Treat `1600px-2200px` CSS width as the primary desktop review range.
- Use wide page containers, not giant centered blocks.
- Keep first-screen content high enough that the structure is visible without excessive scrolling.
- Avoid using `vw` alone for major typography; always cap with conservative `clamp()` limits.
- Validate with browser scale/DPR combinations, not only raw monitor resolution.

## Motion

- Use 400-900ms transitions for page/cube shifts.
- Use smooth cubic easing.
- No bounce effects.
- No permanent distracting motion.
- Respect future reduced-motion support.

## Prohibited Visual Patterns

- Generic purple gradients used as decoration (the violet ambient must read as volumetric/nebula light, not as a flat SaaS gradient).
- Decorative orb/bokeh backgrounds.
- Excessive cards.
- Floating nested cards.
- Busy sci-fi dashboards.
- Hero sections that look like a SaaS template.
- Bloom-driven glow.
- Stock-like imagery that does not reveal useful meaning.
- Gold ornament used as luxury decoration without structural purpose.
- Icon styles that do not match the cube glyph geometry.
- Per-face cube glyph divergence: all six faces share the same diamond glyph and surface grammar; only the section label changes.
- Full-page section overlays that hide the cube (the cube must remain visible in the primary experience).

## Tailwind Implementation

Tailwind is the implementation layer for static pages and future admin UI. It must follow the Obsidian Interface System above.

Setup:

- Tailwind v4 installed via `@tailwindcss/vite`.
- Tokens defined in `src/index.css` using Tailwind v4 `@theme` (mirrors the Color Tokens section above).
- Three.js scene styling stays controlled by scene code and focused CSS — Tailwind does not improvise around the cube material or 3D scene.

Token rules:

- Use project tokens first (`obsidian-950/900/800`, `ice-300/100`, `mineral-500`, `copper-400`, `glass-line`).
- Avoid arbitrary colors unless there is a documented design reason.

Usage rules:

- Use Tailwind for static page layouts, typography, spacing, and future admin UI.
- Prefer reusable React components for repeated page patterns (planned components tracked in `docs/roadmap.md`).
- Do not introduce generic SaaS/landing-page visual patterns.
- Keep pages semantic and readable for recruiters and AI parsers.
