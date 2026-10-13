# Public Assets

Every file served from `public/` (except the content documents in `public/content/`) has a recorded source and licence, because the repository is public and the site redistributes them (spec 010, E-21). `scripts/checks/assets.test.ts` fails when a file is missing from this table, and keeps the list of pending licences from growing.

| Path | Source | Licence |
|---|---|---|
| `environments/udec-frontis.jpg` | Photograph used as the cube's reflection environment, resized to 1536 px wide on 2026-10-12; origin not recorded | pending |
| `favicon.svg` | Vite's logo, left by the project template; to be replaced by the site's own icon | pending |
| `js-flag.js` | Written for this site: marks the page as running JavaScript before it paints | Same as the repository |
| `og-image.jpg` | Rendered from this site (the cube on the AGENTIC face, interface hidden), 2026-10-12 | Same as the repository |
| `seo-fallback.css` | Written for this site: the style of the plain HTML fallback for clients without JavaScript | Same as the repository |

Bundled from npm (not in `public/`, so not in the table the test reads):

- Inter, variable weight, `@fontsource-variable/inter` 5.3.0: SIL Open Font License 1.1. The browser downloads only the Latin subset the page uses (counted in the first-view budget).
