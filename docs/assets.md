# Public Assets

Every file served from `public/` (except the content documents in `public/content/`) has a recorded source and licence, because the repository is public and the site redistributes them (spec 010, E-21). `scripts/checks/assets.test.ts` fails when a file is missing from this table, and keeps the list of pending licences from growing.

| Path | Source | Licence |
|---|---|---|
| `concept/busqueda-thumb.webp` | Concept branch `concept/escenario` only: an invented screenshot of the agentic search tool, generated with OpenAI's image model through Codex on 2026-10-14 (no real brands, covers or people), cropped to a 160 px square | Same as the repository (OpenAI's terms assign the output to the user) |
| `concept/busqueda.webp` | Concept branch `concept/escenario` only: an invented screenshot of the agentic search tool, generated with OpenAI's image model through Codex on 2026-10-14 (no real brands, covers or people), resized to 1080 px wide | Same as the repository (OpenAI's terms assign the output to the user) |
| `concept/openmenu-thumb.webp` | Concept branch `concept/escenario` only: an invented screenshot of OpenMenu GDEMU Manager, with original abstract covers, generated with OpenAI's image model through Codex on 2026-10-14 (no real brands, covers or people), cropped to a 160 px square | Same as the repository (OpenAI's terms assign the output to the user) |
| `concept/openmenu.webp` | Concept branch `concept/escenario` only: an invented screenshot of OpenMenu GDEMU Manager, with original abstract covers, generated with OpenAI's image model through Codex on 2026-10-14 (no real brands, covers or people), resized to 1080 px wide | Same as the repository (OpenAI's terms assign the output to the user) |
| `concept/panel-thumb.webp` | Concept branch `concept/escenario` only: an invented screenshot of an anonymized operations panel, generated with OpenAI's image model through Codex on 2026-10-14 (no real brands, covers or people), cropped to a 160 px square | Same as the repository (OpenAI's terms assign the output to the user) |
| `concept/panel.webp` | Concept branch `concept/escenario` only: an invented screenshot of an anonymized operations panel, generated with OpenAI's image model through Codex on 2026-10-14 (no real brands, covers or people), resized to 1080 px wide | Same as the repository (OpenAI's terms assign the output to the user) |
| `concept/transcripcion-thumb.webp` | Concept branch `concept/escenario` only: an invented screenshot of the local transcription tool, generated with OpenAI's image model through Codex on 2026-10-14 (no real brands, covers or people), cropped to a 160 px square | Same as the repository (OpenAI's terms assign the output to the user) |
| `concept/transcripcion.webp` | Concept branch `concept/escenario` only: an invented screenshot of the local transcription tool, generated with OpenAI's image model through Codex on 2026-10-14 (no real brands, covers or people), resized to 1080 px wide | Same as the repository (OpenAI's terms assign the output to the user) |
| `environments/obsidian-hall.jpg` | The cube's reflection environment: generated with an OpenAI image model on 2026-10-13 from the prompt below, resized to 1024 px wide. Replaced a photograph of a public building whose author was not recorded | Same as the repository (OpenAI's terms assign the output to the user) |
| `favicon.svg` | Vite's logo, left by the project template; to be replaced by the site's own icon | pending |
| `js-flag.js` | Written for this site: marks the page as running JavaScript before it paints | Same as the repository |
| `og-image.jpg` | Rendered from this site (the cube on the AGENTIC face, interface hidden), 2026-10-12; rendered again with the new reflection environment on 2026-10-13 | Same as the repository |
| `seo-fallback.css` | Written for this site: the style of the plain HTML fallback for clients without JavaScript | Same as the repository |

Bundled from npm (not in `public/`, so not in the table the test reads):

- Inter, variable weight, `@fontsource-variable/inter` 5.3.0: SIL Open Font License 1.1. The browser downloads only the Latin subset the page uses (counted in the first-view budget).

## Prompt of the reflection environment

`environments/obsidian-hall.jpg` was the third of three images generated from this prompt (2026-10-13), chosen by comparing each one on the live cube. Its brightness by height is darker at the horizon than the photograph it replaced, so the cube's faces stay black.

```
Equirectangular 360° panorama, exactly 2:1 aspect ratio (2048×1024),
seamless at the left and right edges. It will be used only as a
reflection map on a black glass cube, so lighting structure matters
more than detail.

Scene: an abstract architectural interior of polished black obsidian
and dark glass: tall vertical panels and thin columns around the
horizon, a high open ceiling. Neutral, almost colourless tones with a
very faint cool violet tint. No text, no logos, no people, no plants.

Lighting by height (top of the image to bottom), keep these
brightness levels:
- top edge: muted blue-grey (#5e6a84)
- 20% down: the brightest band, soft light grey (#a4a6ad), like a
  luminous ceiling or skylight
- 38% down: falls to dark grey (#4a4a52)
- 50% down (horizon): darkest band (#2a2a30), only thin bright
  vertical edges of the panels catch light here
- 70% down: dark grey (#3a3a40)
- bottom edge: dark slate floor (#383c45)

One small, soft, white sun or light source at 75% of the width and
14% of the height from the top, with a gentle glow around it.

Sharp, high-contrast vertical edges near the horizon are wanted; large
smooth areas everywhere else. Photorealistic, no vignette, no lens
flare.
```
