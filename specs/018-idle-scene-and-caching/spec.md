# 018: Idle Scene and Browser Caching

**Status:** built on `perf/idle-and-cache` (2026-11-16), live since 2026-11-17 (the edge function by `cdk deploy`, the code by the deploy of that day). The owner asked for it on 2026-11-16 (pending items dt-12 and dt-13), and set the intro (dt-11) aside: not a priority, not to be touched.
**Builds on:** the load audit of 2026-11-14 (findings C-2, C-5, M-3), spec 014 (the viewer-response function, D-7), spec 017 (D-6: contemplating never slows down), the pixel budget of dt-03.

## 1. Problem

Measured on production with the audit's scripts:

- **C-2.** The scene draws at the display's full rate forever, also while nobody touches anything: 55 to 68 frames a second headless, 165 on a 165 Hz screen. At rest the main thread is busy 21 to 36 % on a fast desktop and 94 to 99 % with the CPU slowed 4×.
- **C-5.** 224 draw calls a frame for about 6,000 triangles. 204 of them are the pedestal's ticks: `PlatformTicks` made one mesh and one material per tick.
- **M-3.** No response carries `Cache-Control`, hashed assets included; the browser guesses how long to keep them.

## 2. Outcome

- After five seconds without input, with nothing in the scene meant to move fast, the scene draws at 30 frames a second. Any pointer, key, wheel or touch input brings the full rate back at once. The worlds keep moving: their motion follows the clock, so it is the same motion sampled less often.
- The pedestal ticks are drawn in 16 calls (8 sectors per ring) and look as before.
- Hashed files are kept a year; pages and content documents are revalidated on every visit.

## 3. Decisions

- **D-1 What counts as busy.** The intro until it is done, a face change (`transition`), a requested face, the cube held (grabbing cursor), and the cube's call (`nudge` shown). `explore` is not: the stage opens in cube mode, so it is the resting state too (found measuring: with it, the rest never started). Leaving a busy state counts as activity, so a change finishes at full rate before the rest starts (`src/features/scene/idleCadence.ts`).
- **D-2 How it slows down.** The canvas switches to `frameloop="demand"` and `IdleTicker` asks for a frame 30 times a second, aligned to the display's refresh, with 2 ms of slack so a 60 Hz screen keeps 30. A hidden tab gets no animation frames, as before.
- **D-3 The density monitor.** It would read the rest as a slow machine and lower the pixel density (dt-03), so it ignores the rest and the 2.5 seconds after it.
- **D-4 Art mode** is not touched (spec 017, D-6): its own canvas runs at full rate, and the cube scene's canvas is paused under it as before.
- **D-5 Ticks by sector, not one mesh.** The colour times the opacity is baked into vertex colours with the material at full opacity, which additive blending (SrcAlpha, One) adds exactly as before. A single mesh per ring changed the look: three sorts transparent objects by position, and the ticks behind the cube used to sort farther than the pedestal's translucent disc, which dimmed them; one mesh at the ring's centre drew them all over the disc and lit the back half (walkthrough, 2026-11-16). Eight sectors per ring, each mesh at the centre of its own ticks, sort where their ticks did (`src/features/scene/tickRing.ts`).
- **D-6 Caching by path** in the viewer-response function, on 200 and 304 only (an error is never kept): `public, max-age=31536000, immutable` for `/assets/*` and the admin's `/content/media/<sha256>(-thumb).webp`; `no-cache` for everything else (pages, `/content/*.json`, `js-flag.js`, `llms.txt`, the environment map), revalidated with the ETag S3 sends. It sets what the browser keeps, not the edge cache. No backslashes in the function source: the CDK's template literal eats them (sg-12).

## 4. Non-goals

- The intro that hides the name (dt-11): set aside by the owner.
- Splitting the JS (M-1): while the intro waits for the cube to land, the scene's code is on the critical path anyway, so a split would not show the name sooner. It goes with dt-11.
- Moving the plexus to a vertex shader (C-3) and baking the pedestal rings (rest of C-5).
- `prefers-reduced-motion`: the scene still animates with it (53.6 frames a second in the audit). Reducing or stopping the motion for those visitors is a design decision for the owner.

## 5. Acceptance

Measured on 2026-11-16 with Playwright's Chromium (RTX 4090 through ANGLE, 165 Hz), the built site in `vite preview`, `main` (`b6d5dc4`) against this branch, 6 seconds per measurement after the intro and the nudge:

| | main | branch |
|---|---|---|
| Frames drawn at rest, desktop 1920×1080 | 165 | 27.5 |
| Main thread at rest, desktop | 36 % | 4.6 % |
| Frames drawn at rest, CPU 4×, 1366×768 | 102 | 27.5 |
| Main thread at rest, CPU 4× | 99.3 % | 24.6 % |
| Frames drawn with the pointer moving, desktop | 165 | 165 |
| Draw calls per frame | 224 | 36 |

On a 165 Hz screen the 30-frame target lands at 27.5 (one frame every six refreshes); on 60 Hz it is 30.

## 6. Validation

- Unit tests: `idleCadence.test.tsx` (the rest starts only after the quiet stretch, input ends it, busy blocks it, listeners removed), `tickRing.test.ts` (every tick where its separate mesh was, sector centres, colours), `edgeHeaders.test.ts` (cache by path, never on an error).
- `npm run build`, lint, server typecheck, 259 tests, `check:budget`, `check:privacy`, `check:docs`, `check:tokens`, `check:layout`.
- Pedestal screenshots of `main` and the branch at the same moment (1920×1080), compared by eye.
- The change audit on the exact diff (`npm run audit:change`): four findings from gemma, none real (`audit-1.md`).
- After the deploy: `curl -I` on an asset, a page and a 404 to see the header live, and the owner's look at the pedestal.
