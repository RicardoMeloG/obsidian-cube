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
