# 019: A Performance Gate

**Status:** draft (2026-11-19), not built; decisions D-1 to D-4 taken by the owner on 2026-11-21; the draft audited on 2026-11-22 (`audit-1.md`) and to be revised before it is built. Asked for by pending item dt-14 (load audit of 2026-11-14, finding M-4). It adds a gate, so it is a large change (spec 012): this draft is audited by agents without prior context, revised, and the owner decides D-1 to D-4 before anything is built.
**Builds on:** the load audit's thresholds (section 5) and scripts (`medir.mjs`, `reposo.mjs`), spec 018 (idle cadence, ticks by sector, caching), the GPU plexus of dt-12 (C-3), `check:budget` (spec 010, H-07).

## 1. Problem

`check:budget` is a ratchet on bytes: the first view may not grow past its last accepted gzip size plus 1 %. It says nothing about what a visitor waits for or what the page costs while it stays open. No gate measures:

- when the owner's name becomes readable, and when the first 3D frame is drawn;
- long tasks on the main thread during the first view;
- how busy the main thread is at rest and with the pointer moving;
- frames drawn at rest, draw calls per frame, the canvas size.

Every one of these regressed or improved during the last month without a gate noticing: the idle scene of spec 018 took the main thread at rest from 99.3 % to 24.6 % with the CPU slowed 4× (6.7 % once the plexus moved to the GPU, P-5), the GPU plexus took the moving case from 38.6 % to 16.5 % (both measured by hand with scratch scripts), and nothing stops a later change from undoing either.

## 2. Outcome

`npm run check:perf` builds nothing: it serves `dist/` with `vite preview` (production security headers, as `check:layout`), opens it in Playwright's Chromium with the CPU and the network throttled, measures each metric over several runs, and compares the median with a limit per metric. It prints the table and fails when a metric is past its limit.

## 3. Metrics

Measured on the built site, never on production (production is `check:live` and the external checks of section 7). Values of 2026-11-19 are from the scratch scripts of that day, on `work/backlog-2026-11-19` with the owner's content; the gate's first run replaces them.

| Id | Metric | Scenario | Today | Target (audit, section 5) |
|---|---|---|---|---|
| P-1 | Name readable (the `h1` visible and opaque) | phone 390×844 ×3, CPU 4×, slow 4G | ≈ 6.1 s (intro, dt-11) | < 2.5 s |
| P-2 | Name readable | desktop 1920×1080, no throttling | ≈ 3.7 s (intro, dt-11) | < 1.0 s |
| P-3 | First 3D frame | phone, CPU 4×, slow 4G | 4.2 s | < 3.0 s |
| P-4 | Total blocking time after the first paint | phone, CPU 4× | to measure | to set |
| P-5 | Main thread busy at rest, after the 5 s quiet stretch | 1366×768, CPU 4× | 6.7 % (AGENTIC) | < 30 % |
| P-6 | Main thread busy with the pointer moving | 1366×768, CPU 4× | 16.5 % (AGENTIC) | to set |
| P-7 | Frames drawn per second at rest | 1366×768 | 27.5–30 | ≤ 30 |
| P-8 | Draw calls per frame | 1366×768 | 36 | < 40 |
| P-9 | Canvas size at 1920×1080, density 1 | desktop | to measure | 1920×1080 |

P-5 to P-8 run on every face, since each face has its own world; P-1 to P-4 on the cube page and one face page per language.

## 4. Decisions for the owner

- **D-1 What fails.** (a) A ratchet per metric, like `check:budget`: the limit is the last accepted median plus a margin (10 % or a fixed floor, whichever is larger, because a headless timing is noisy), and it only goes down unless a spec raises it. The targets stay in this spec as the direction. (b) The targets themselves as limits. Recommended: (a). P-1 and P-2 cannot meet their targets while the intro hides the name, and the intro is set aside (dt-11).
- **D-2 Where it runs.** (a) On the owner's machine only, as a step of the definition of done for changes to `src/features/scene/`, `src/app/` and the build. (b) Also in CI. Recommended: (a). A CI runner has no GPU: SwiftShader makes the frame metrics measure the software renderer, and shared runners make timings noisy. A CI run can come later with wider margins for P-1 to P-4 only.
- **D-3 Runs per measurement.** Three runs and the median (about 4 minutes in all), or five (about 7). Recommended: three, with the option of five before a stage's acceptance.
- **D-4 The push gate.** (a) A standalone check, like `check:layout --worlds`, run on demand and named in AGENTS.md. (b) A pre-push requirement for pushes that touch the scene, recorded like the change audit. Recommended: (a) first; (b) only if a regression gets through.

## 5. Design

- `scripts/check-perf.mjs` with the measurement code moved from the audit's scripts: a WebGL wrapper that counts draw calls and stamps the first draw, a `PerformanceObserver` for paint, long tasks and the name's visibility, CDP `Performance.getMetrics` for task time, CDP throttling for CPU and network.
- Limits in `scripts/checks/perf.json` (`{ metric, scenario, limit, accepted }`), updated by `--update` the same way `check:budget` updates its own.
- The GPU: one large job at a time (AGENTS.md). The check uses the browser's default adapter and records which one it got (`UNMASKED_RENDERER_WEBGL`) in its output, so a run on the integrated GPU is not compared with one on the discrete card. A run on a different adapter than the accepted one warns and does not fail.
- `layout-known.json`-style known failures are not needed: a ratchet has none.

## 6. Non-goals

- Fixing any metric. This spec only measures and holds the line; dt-11 (the intro), M-1 (splitting the JS) and the rest of C-5 have their own items.
- Measuring production. `check:live` checks the live site's use cases; the external checks of section 7 measure the visitor's view.
- Safari and iOS: Playwright's WebKit has no CDP throttling.

## 7. Acceptance

- `npm run check:perf` passes on `main` with the accepted limits, and fails when a change undoes spec 018's idle cadence (verified by reverting it on a scratch branch) and when the plexus goes back to the CPU.
- Three consecutive runs on the same machine give the same verdict.
- External verification, once, written down in this spec: WebPageTest (a real mid-range Android, 4G, three runs, median), PageSpeed Insights, and the owner's laptop on battery.

## 8. Validation

- Unit tests for the limit comparison and the `--update` ratchet (no browser).
- The definition of done; `check:docs` counts the measurements in this spec as dated.
- The independent audit of this draft before building it (spec 012, large change).

## 9. External baseline, 2026-11-21

A first point of reference, taken before anything here is built (pending item dt-35, part 6). PageSpeed Insights refused the run (the keyless API's shared daily quota was spent), so the same engine ran locally: Lighthouse 12.8.2 against `https://ricardomelog.com` (deploy of `39eca65`), mobile with its default simulated throttling (412×823), desktop with its preset. One run each; the lab numbers of PageSpeed Insights come from the same simulation.

| Page | Perf. | A11y | Best pr. | SEO | LCP | TBT | CLS | Weight |
|---|---|---|---|---|---|---|---|---|
| `/` mobile | 60 | 100 | 96 | 100 | 3.2 s | 2,450 ms | 0 | 471 KiB |
| `/es` mobile | 61 | 100 | 96 | 100 | 3.2 s | 1,750 ms | 0 | 470 KiB |
| `/` desktop | 90 | 100 | 100 | 100 | 0.6 s | 250 ms | 0 | 471 KiB |
| `/es` desktop | 92 | 100 | 100 | 100 | 0.6 s | 230 ms | 0 | 470 KiB |

What it says:

- The mobile score is held down by the main thread, not by the network: 4.0 s of script evaluation in the single bundle, with long tasks of 1.5 s and 0.7 s after the first paint (the scene being built). The LCP element is the name (`h1`). The weight is small and nothing shifts.
- Best practices on mobile loses two audits: no source maps for the bundle (a deliberate choice for a public site) and «Document doesn't use legible font sizes»: on a 412 px phone only 26% of the text is 12 px or larger. The body of the AGENTIC proofs and steps renders at 10.9 px, the proofs' small print at 8.4 px, the dock labels at 9.8 px. `check:layout` proves the text fits; it does not judge its size.
- Not done yet: WebPageTest on a real mid-range Android (needs an account), PageSpeed Insights itself (field data needs traffic CrUX does not have), and the owner's laptop on battery.
