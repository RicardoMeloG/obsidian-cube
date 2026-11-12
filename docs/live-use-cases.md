# Use Cases on the Published Site

**Status:** living document, 2026-11-12. Run by `npm run check:live` (`scripts/check-live.mjs`).

The layout check proves the build before it ships; these use cases prove the published site, in a real browser, the way each kind of visitor meets it ([visitor-profile.md](visitor-profile.md)). The console is watched in every case: a reviewer may open the developer tools, so any error, warning, failed request or CSP violation fails the run. The script is read-only.

```
npm run check:live                                 # https://ricardomelog.com
npm run check:live -- --url=http://127.0.0.1:5181  # a local preview, before a deploy
npm run check:live -- --only=CU-09,CU-10
```

## Use cases

| Id | Visitor | What they do | What must hold |
|---|---|---|---|
| CU-01 | Recruiter from the CV, desktop 1366×768, English | First visit, the intro plays, a key skips it, clicks the cube | Name in the served page and in the top after the intro; the click opens a face and the address follows it |
| CU-02 | Visitor with the browser in Spanish | Opens the bare address, moves through faces with the dock | Lands on `/es`, `lang="es"`; each face has its own address and title |
| CU-03 | Someone who receives a link to a face | Opens `/es/productos`, switches to English | Opens on that face; the switch keeps the face (`/products`); the bare address then stays in English |
| CU-04 | The same link on a phone (390×844, touch) | Reads a face, taps the dock | No sideways scroll; content visible; the tap changes face and address |
| CU-05 | Keyboard user | Opens a detail with Enter, tabs, presses Esc | Focus stays in the dialog; Esc closes it and focus returns to its button |
| CU-06 | Curious visitor | Enters cube mode, presses Esc | The interface steps aside and comes back |
| CU-07 | Old laptop or locked-down browser, no WebGL | Opens a face | Still of the cube, full interface, no canvas, no errors |
| CU-08 | Visitor who asked for reduced motion | Opens the site | No intro; ready to read |
| CU-09 | Answer engines, crawlers, link previews | Read the raw HTML and the machine files | Name, description, Open Graph with an absolute image, JSON-LD `Person`, canonical address; `/es/...` in Spanish; `llms.txt` and the profile pages answer |
| CU-10 | Reviewer checking security from outside | Reads headers, tries plain HTTP and private paths | Enforced CSP, HSTS, `DENY`, `nosniff`, Referrer and Permissions policies, no `Server: AmazonS3`; HTTP moves to HTTPS; `www` answers; no private file is served |
| CU-11 | The owner's rules | Looks at Contact in both languages | No CV link (the CV is never on the site), no request to another host, no cookies |
| CU-12 | Any desktop visitor | Opens all 14 addresses | Every one answers 200 with a clean console |

## Notes

- **Software WebGL.** The runs use SwiftShader. Three.js warns once that it lacks `KHR_parallel_shader_compile`, an extension real GPU drivers have; only that line is excused, and only in software runs. Checked on 2026-11-12 in Edge with a real GPU: the warning does not appear.
- **THREE.Clock.** `@react-three/fiber` 9 (up to 9.8.2) still creates a `THREE.Clock`, deprecated in three r183, so every visit printed a warning. `src/features/scene/threeConsole.ts` drops that one message through three's own console hook; remove it when fiber moves to `THREE.Timer`.
- **Unknown paths.** Until real 404s exist (spec 010, AD-09) an unknown or private path answers with the home page; CU-10 checks that no private content is served, not the status.
- **Published content.** `/content/site.*.json` and `/content/profile.*.json` are the published content the page reads; they are public by design (ADR 004).
