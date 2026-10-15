# 009: Cube Intro and Rotate Invitation

**Status:** in progress (branch `feature/cube-intro`)
**Date:** 2026-10-10

## Problem

ADR 002, point 4: the cube is the invitation, and it "must invite touch (a welcome motion or hint)". Today the cube appears already at rest, centered and still; nothing tells a first-time visitor that it can be dragged, and nothing marks the moment the experience starts. The 2026-10-09 audit agreed.

## Outcome

On the first visit of a session the cube **falls through the light beam above the platform, shedding sparks from its edges, and lands on the platform**; the owner's name and the panels appear after it; then the cube **turns a full face on its own, shows the next face, and comes back**, while a hint says it can be dragged. The whole sequence lasts about 5.4 seconds and any input skips it.

## Script

Times are seconds from the first rendered frame of the 3D scene (not from page load: the scene may arrive later than the DOM).

| t (s) | Cube | Light and particles | Interface |
|---|---|---|---|
| 0.00 – 0.35 | Out of view, above the frame. | Platform glow at 30%; beam at its usual faint level. Stars and the face's world are already there. | Everything hidden: identity, panels, face strip, language toggle. |
| 0.35 – 1.60 | **Falls** from ~4.2 units above its rest height. Accelerates during the first 40%, then decelerates strongly into the rest height — heavy, guided, no bounce. It starts turned (yaw −28°, pitch +14°) so the visitor sees edges and a second face, and straightens to the active face exactly on landing. | **Shedding sparks:** ~220 points released from the cube's twelve edges along the fall, denser in the fast middle part. Each one stays where it was released (the cube leaves it behind), drifts slowly up and outward, twinkles faintly and fades in 0.7–1.3 s. The beam brightens while the cube passes through it and returns afterwards. | Hidden. |
| 1.60 | **Lands.** | **Landing:** the platform glow flashes to full and settles back to its normal level over ~0.9 s. A thin violet ring expands from the platform center to its edge and fades (0.9 s). ~70 sparks burst outward from the bottom edges, low over the platform, slowing as they go. | — |
| 1.70 | At rest. | Remaining sparks fade out. | Owner's name and role fade and rise in (first). |
| 1.95 | | | Left and right rails. |
| 2.20 | | | Face strip and language toggle. |
| 2.70 – 5.30 | **Invitation turn:** turns a full face (90°) toward PRODUCTS (1.04 s), holds it so the face can be read (0.52 s), and returns (1.04 s); each leg starts and ends at zero speed. | — | Hint fades in below the cube: "Drag to rotate" / "Arrastra para girar" (touch: "Swipe to rotate" / "Desliza para girar"), with a small arc glyph. |
| 5.40 | Normal behaviour. | Particle system removed from the scene. | Intro over. |
| 10.0 | If the visitor has not touched the cube: one more invitation turn. Never more than two. | | Hint stays until the first drag. |

The pointer tilt (the cube "looking at" the cursor) keeps working on top of the invitation turn.

## Rules

- **Skippable.** Any pointer down, key press or wheel during the intro jumps to the final state at once: cube at rest on the active face, particles gone, interface visible. Touching the falling cube also counts as the first interaction.
- **Once per session.** The intro plays only on the first page load of a browser session (`sessionStorage`). Returning or reloading visitors get the site at rest. `?intro=1` forces it, `?intro=0` disables it (development and review).
- **Reduced motion.** With `prefers-reduced-motion: reduce` there is no fall, no sparks and no invitation turn. The interface appears without staging and the hint is shown static.
- **Hint lifetime.** The hint is shown until the first drag of the session, also on visits without the intro. It never animates on its own after appearing.
- **No sound.** Browsers block audio without a gesture and AGENTS.md forbids auto-playing audio; the intro is silent. The existing drag and transition sounds are unchanged.
- **No Bloom.** Glow comes from additive sprites and points, as the platform glow and the beam already do.
- **Safety.** If the scene never renders (no WebGL, slow load), the interface is revealed anyway after 4 s.
- **Duration exception.** `docs/visual-direction.md` asks for 400–900 ms transitions for page and cube shifts. The intro is an entrance, not a shift; each of its steps stays within ~1.3 s and the whole can be skipped.

## Implementation

- `scene/intro/introTimeline.ts` — pure functions: phase at time `t`, fall offset and rotation, landing pulse, invitation-turn angle, and the session/reduced-motion/query decision. Unit-tested.
- `scene/intro/IntroSparks.tsx` — one `Points` object with a small shader. Spawn position, release time, velocity and size are computed once from the timeline (deterministic), so the GPU only evaluates age, drift and fade per frame. No per-frame allocations; unmounted when the intro ends.
- `scene/intro/LandingRing.tsx` — a thin ring on the platform, scaled and faded from the timeline.
- `CubeScene.tsx` — drives the rig's height and rotation from the timeline during the intro, pulses the platform glow and the beam, schedules the invitation turns, exposes `skipIntro()` and reports phase changes and the first interaction.
- `SceneLayer.tsx` + `CubeScene.tsx` (2026-10-14) — the canvas does not draw until the scene's shaders are compiled with the reflection already set (`compileAsync`, off the main thread) and the face's world is compiled too; a world that arrives later stays hidden until compiled. Before, a first visit compiled them on the first frames: the page froze while the cube fell, and the visitor saw 2 frames of the fall. Measured with a cold cache on an RTX 4090 (median of 3): frozen time 2.44 → 1.36 s, frames of the fall 2 → 201, interface shown 2.44 → 3.19 s after load (the fall now plays instead of being skipped). If compiling stalls, the canvas draws anyway after 3 s.
- `reflection.ts` (2026-10-15) — the reflection is loaded as the atlas three.js would compute from `obsidian-hall.jpg` at load, baked by `scripts/bake-reflection.mjs` (WebP, 45 KB); converting it in the browser compiled two shaders synchronously (~0.45 s frozen on a first visit). Together with the lighter glass (no transmission, three spots fewer), measured cold on the RTX 4090 against the state before these changes: frozen time 2.44 → 0.65 s, interface shown 2.44 → 2.52 s, the whole fall seen; on the integrated AMD GPU 2.97 → 0.95 s frozen, interface 2.66 → 2.63 s.
- `PremiumCubePrototype.tsx` + `App.css` — `data-intro` on the shell (`pending` → `reveal` → removed) hides and stages the interface; the hint element and its copy in both languages live in code until the content model is revisited.

## Non-goals

- Changing the content schema or the admin.
- A thesis / presentation state (roadmap priority 4).
- Raising the owner's name in the hierarchy (separate change; the intro only orders when it appears).

## Acceptance

- First load of a session (`?intro=1`): fall with sparks, landing pulse and ring, staged interface, invitation turn and hint, in that order, at 1600×900 and at 390×844.
- Reload in the same session: no intro; hint still visible until the first drag.
- Pointer down or key press during the fall: final state immediately, no stuck hidden interface.
- `prefers-reduced-motion: reduce`: no motion, interface visible, static hint.
- `npm run build`, `npm run lint`, `npm test` pass.
