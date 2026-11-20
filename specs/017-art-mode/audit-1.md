# Audit 1 · art mode (spec 017)

**Date:** 2026-11-14 · **Diff:** `main..6c9028b` (14 code files) · **Record:** `audit-runs/change-ad8b82174435c796.json` (local)
**Models:** `qwen3.8:27b` (2 findings, 238 s) and `gemma4:31b` (4 findings, 71 s), one at a time, the card measured first (18.7 GB free for qwen, 19.8 GB for gemma).

| # | Model | Finding | Verdict |
|---|---|---|---|
| 1 | qwen | `src/app/artMode.css` is hand-written CSS in `app/`, where only `intro.css` is allowed | **Not real.** The rule (AGENTS.md, Styling) asks for hand-written CSS next to its component, in the `components` layer, commented with why; `intro.css` is the one exception *outside a layer*. `artMode.css` is inside `@layer components`, next to `ArtModeLayer.tsx`, and commented. What was missing: `docs/architecture.md` lists the hand-written sheets and now names it. |
| 2 | qwen | `.stage-content > *` matches the 3D canvas, so a double-click on the background never opens the mode | **Not real.** The canvas lives in `.cube-canvas`, a sibling of the stage, not inside `.stage-content`. Measured: the double-click on the background opened the mode on 12 of 12 faces and sizes, with the canvas as the target. |
| 3 | gemma | `setSeenActive` and `setPhase` in the render body cause warnings or infinite renders | **Not real.** It is React's documented pattern for state that follows a prop ("adjusting state when a prop changes"), guarded by `active !== seenActive`, so it runs once per change; the `react-hooks` lint rules, which flagged the effect-based version, pass. No warning in the walkthrough's console. |
| 4 | gemma | `color-mix(...)` breaks "no colour literal outside the tokens" | **Not real.** It mixes token variables with `transparent`; `check:tokens` passes (0 problems in 97 files) and `stage.css` uses the same form. |
| 5 | gemma | `alpha: false` contradicts the violet volumetric ambient if the canvas layers over the page | **Not real.** The art canvas is meant to be opaque: it covers the page, and the cube scene's canvas uses the same setting. |
| 6 | gemma | The second top-bar button may break "one height and one top edge" | **Not real.** Both buttons use `.stage-explore` (height 2.83em) inside a centred flex row; the walkthrough screenshots show them on the same top edge as the links and the language switch. |

## Round 2 · the gallery (D-9)

**Diff:** `main..df54b5b` · **Record:** `audit-runs/change-004b8c4b3e21b7c8.json` (local) · **Models:** `qwen3.8:27b` (3 findings, 241 s) and `gemma4:31b` (5 findings, 261 s), one at a time, the card measured first (21.2 GB free).

| # | Model | Finding | Verdict |
|---|---|---|---|
| 7 | qwen | `src/app/ArtModeLayer.tsx` imports a scene component, while scene and DOM features may only meet through the store | **Not real.** The rule binds the features (`scene` ↔ `stage`, `faces`, `navigation`); `app/` composes them and may import any of them (eslint boundary for `src/app/**` has no restriction), as `Experience.tsx` already imports `SceneLayer`. The layer and the canvas still exchange nothing but props. |
| 8 | qwen | `artMode.css` is a second unlayered sheet in `app/` | **Not real**, same as #1: it is inside `@layer components`. |
| 9 | qwen | In `ShowcaseLookAt`, the memoized vector keeps a y-adjusted value if `composition` later becomes undefined | **Not real here.** The code moved unchanged from the dev showcase; `composition` comes from the world's registry entry, a constant, and the art canvas is remounted per world (`key={worldId}`), so it never changes within one instance. |
| 10 | gemma | The owner's name is a `<p>`, not the `<h1>` every face opens with | **Not real.** Art mode is not a face: the face's `<h1>` stays in the page underneath; the layer is a modal dialog labelled «Modo arte: el fondo a solas», and the signature is a decoration on the art (ADR 001). |
| 11 | gemma | The double-click now works in production, where it was dev-only | **Intended:** that is the feature (spec 017, D-2). |
| 12 | gemma | `color-mix` with a token, uncommented | **Not real**, same as #4; the file's header says why it is hand-written. |
| 13 | gemma | The canvas lacks the violet volumetric ambient | **Not real**, same as #5: it shows each world exactly as its approved showcase does. |
| 14 | gemma | The second top-bar button may break the shared height and top edge | **Not real**, same as #6. |

## Round 3 · the release merge (perf + art mode)

**Diff:** `b08dce4..cb43f6b` (the two branches together on `main`, as deployed on 2026-11-14) · **Record:** `audit-runs/change-8357d8efc9d349bf.json` (local) · **Models:** `qwen3.8:27b` (2 findings) and `gemma4:31b` (6 findings, 60 s, run after the first attempt found 18.7 GB free of the 19.7 GB it needs), one at a time, the card measured first.

| # | Model | Finding | Verdict |
|---|---|---|---|
| 15 | qwen | `ArtModeLayer.tsx` is a syntax fragment and the build fails | **Not real.** The model saw a cut part of the diff; the build passes and this exact commit is live on ricardomelog.com. |
| 16 | qwen | `artMode.css` breaks the one-unlayered-sheet rule | **Not real**, same as #1 and #8. |
| 17 | gemma | A state update inside the render body of `ArtModeLayer` | **Not real.** It is guarded (`active !== seenActive`) and is React's documented pattern for adjusting state that follows a prop; it runs once per change, never in a loop. |
| 18 | gemma | The double-click works in production | **Intended**, same as #11. |
| 19 | gemma | `var(--color-violet-300)` is a colour literal | **Not real**: it is a token reference, inside `color-mix`. |
| 20 | gemma | The art canvas has `alpha: false` and no violet ambient | **Not real**, same as #5 and #13; the main canvas uses the same `gl` options. |
| 21 | gemma | The `artPaused` timer may fire after cleanup | **Not real.** The cleanup clears the timer before resetting the state. |
| 22 | gemma | `.stage-modes` may break the top bar's shared edge | **Not real**, same as #6 and #14. |
