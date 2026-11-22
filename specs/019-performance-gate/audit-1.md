# Audit 1 · spec 019, the draft

**Date:** 2026-11-22 · **Of:** `spec.md` as drafted on 2026-11-19, after the owner's decisions of 2026-11-21 (D-1 a ratchet per metric, D-2 local only, D-3 three runs and the median, D-4 a standalone check run on demand) · **Auditor:** an independent Claude Sonnet subagent with no prior context, reading the code (nothing run). Claude Opus checked the findings below against the code; the ones marked *probe* need a run on the owner's machine before they can be settled.

Result: the draft is not ready to build. The revision it needs, in order:

1. **Section 4 as decisions.** It still reads as open options. D-2 (a step of the definition of done) contradicts D-4 (on demand): the owner chose on demand, named in `AGENTS.md` next to `check:layout --worlds`.
2. **A probe first** (*probe*): which adapter the bundled headless Chromium gets on Windows (hardware through ANGLE or SwiftShader), whether `WEBGL_debug_renderer_info` is exposed, and whether `vite preview` compresses. A software adapter, or an uncompressed preview under slow 4G, would make P-1 to P-8 measure something else than a visitor's view.
3. **The scenario of each metric**: URL (`?intro=0` or a first visit), viewport and device scale, storage state (intro and nudge seen), throttling and the wait predicate. P-1 and P-2 as two variants (load cost, and what a first visit waits for); P-9 at device scale 2, or it cannot see the adaptive density of `SceneLayer.tsx`.
4. **Instrumentation**: a draw-call counter installed with `addInitScript` on the WebGL prototypes, filtered to the scene's canvas (the WebGL probe of `hasWebGL()` and the art-mode canvas must not count), frames as draws per animation frame, observers with `buffered: true`, and the rest detected from the frame cadence settling, not a fixed five seconds (the nudge and the busy states delay it). Record whether the first frame came from compiled shaders or the 3 s ready timeout.
5. **The ratchet per metric**: `limit = min(old limit, new median + margin)`, never raised by `--update`; margins with floors (times 10 % or 250 ms, busy fractions 3 points, frames ±3, draw calls +2, canvas size exact); min, median and max printed, and a run whose spread exceeds the margin reported as inconclusive; a hint when a metric improves.
6. **Provenance in `perf.json`**: adapter (normalised vendor and device, with the backend), CPU, Chromium version and which content built `dist/`. On an adapter mismatch the GPU metrics are skipped and `--update` refuses, instead of warning and passing.
7. **The GPU rule**: reuse `scripts/lib/gpu-guard.mjs` and refuse to run while a local model holds the card; reject a SwiftShader or basic-render adapter as not comparable.
8. **Runtime**: "about 4 minutes" does not hold for six faces, each needing its own rest; measure the cube and one face per world family by default, all six before a stage's acceptance, and re-estimate after a prototype.
9. **The plan of a large change**: this record, a row in the gates table of `docs/architecture.md`, the `AGENTS.md` mention, the unit tests (comparison, never-raise, adapter mismatch, spread), and P-4 and P-6 set from the first baseline.
10. **Testable acceptance**: undoing spec 018 fails P-5 and P-7, the plexus back on the CPU fails P-6, and two `--update` runs with no code change leave `perf.json` unchanged.

Also noted: the measurement code of 2026-11-14 (`medir.mjs`, `reposo.mjs`) lives outside the repository and must pass `check:privacy` before any of it is committed.
