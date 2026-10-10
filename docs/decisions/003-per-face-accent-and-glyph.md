# 003: Per-Face Accent and Inner Glyph

**Status:** accepted
**Date:** 2026-10-09

## Context

`docs/visual-direction.md` stated that all six faces share one diamond glyph and that per-face glyph divergence is prohibited. The code did the opposite since the accent experiment recovered from commit `87c5fc8`: `cubeSections.ts` defines a muted accent per face (violet, copper, steel blue, mint, lavender, sand), `PremiumCube.tsx` draws a quiet inner glyph per face inside the shared double-diamond frame, and the side panels pick the same accent for the second title line and the eyebrow. The code comment called it an undocumented proof of concept kept easy to roll back.

Stage 2 of the content system then exposed the accent as data (`public/content/visual.json`, editable from the admin), which made the experiment part of the product contract while the design document still prohibited it.

The 2026-10-09 audit judged the per-face accents one of the strengths of the composition: they give the six faces variety without breaking the obsidian identity, and they are the main thing that distinguishes one face from the next in a static frame.

## Decision

Per-face accent color and inner glyph are the rule, not an experiment.

- The **frame** is shared by all six faces and never varies: inset bevel, corner brackets, outer double-diamond, section label, "OBSIDIAN CUBE" subtitle, three dots.
- Inside the frame each face carries its **own accent** (from `visual.json`, defaults in `cubeSections.ts`) and a **quiet inner glyph** drawn in that accent.
- The same accent drives the face's side-panel title and eyebrow, so cube and panels agree.
- Nothing else varies per face on the cube: no per-face typography, bevel or bracket changes.

`docs/visual-direction.md` is updated accordingly; the prohibition now reads "per-face divergence beyond accent and inner glyph".

## Consequences

- The visual layer (`visual.json`, admin "Presentación" section) is a first-class part of the product, not a debug surface.
- Any new face treatment is a change to the glyph or accent, never to the frame.
- The "OBSIDIAN CUBE" subtitle on every face is kept by this ADR but questioned by ADR 002 (it outranks the owner's name in the hierarchy). A later ADR may replace it with the owner's name or remove it.
