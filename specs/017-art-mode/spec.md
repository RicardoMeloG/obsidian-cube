# 017: Fullscreen Art Mode

**Status:** proposed (2026-11-14), waiting for the owner's approval of the decisions in section 3 and the open questions in section 7. Owner's words: the site is premium and must feel premium; optimize without losing quality; never change an artistic decision he did not ask to change.
**Builds on:** ADR 001 point 3 (designed, never built for visitors), spec 011 (stage layout), the dev-only world showcase (`src/features/dev/VectorWorldShowcase.tsx`, `?bg=<world>`), the load audit of 2026-11-14 (`E:\Claude\obsidian-cube-verify\carga-inicial\`, finding C-2).

## 1. Problem

ADR 001 promises visitors a way to contemplate each face's world on its own: double-click the background, the cube and the interface step away, and only the world remains, signed with the owner's name. It was never built. What exists is a development tool: in `npm run dev` a double-click on the background (`src/app/Experience.tsx:137`) reloads the page into `?bg=<world>`, a separate showcase with debug chrome. The production build strips it (`import.meta.env.DEV`). The owner remembered the dev behavior as a feature of the site and noticed its absence.

## 2. Outcome

On a desktop stage layout, a visitor can enter an art mode for the current face and leave it without losing their place:

- The world fills the screen, framed for contemplation; the cube, the pedestal, the composition, the strip and the top bar fade out.
- The owner's full name stays in a corner, discreet, as in the showcase signature (ADR 001: the name keeps authorship attached to the art).
- Leaving returns to exactly the face and state the visitor left.
- The world renders at full quality in this mode: it is the only thing on screen.

## 3. Decisions (proposed)

- **D-1 In place, not a page.** The mode is a state of the experience (`artMode` in `experienceStore`, events `artModeStarted` and `artModeEnded`), not a reload into `?bg=`. No URL change, no new chunk to download: the world is already mounted. The dev showcase stays as it is, for tuning.
- **D-2 Entering.** Double-click on the background, not on the interface (the same target rule as `openWorldShowcase`: not on `.stage-top`, the composition, the dock, a dialog, a button or a link). Also a quiet control in the top bar, next to «Explorar el cubo», for keyboard and screen-reader visitors and as the discoverable path ADR 001 asks for (discoverable enough to find, quiet enough not to interfere). Only in the stage layout, after the intro, with no dialog open.
- **D-3 Leaving.** `Esc`, another double-click, or a «Volver» control that appears in a corner when the pointer moves and fades after 2 seconds still. A single click does not leave: it would end the mode by accident. Changing the window to the stacked layout leaves it.
- **D-4 Framing.** The camera eases to the world's showcase framing (`WORLD_REGISTRY[world].showcase`: camera, lookAt, fog and props), the one the owner already approved in the dev showcase, and back on leaving. About 1.2 seconds each way, the same easing family as the face transition. With `prefers-reduced-motion`, a 200 ms crossfade instead of a camera move.
- **D-5 The cube.** It fades out with the pedestal; the rotating skies keep rotating about the same center, so the Polaris rule (ADR 001 point 2) holds: the still point is still there, only invisible. The cube does not leave the composition outside this mode.
- **D-6 Quality, and the link with C-2.** In art mode the world runs at full cadence and at the pixel-density ceiling the adaptive monitor allows. When the audit's idle cadence (C-2) is built, it applies only outside this mode: reading slows down, contemplating never does. The perf branch's floor of 1.25 on dense screens and its MSAA stay.
- **D-7 The cursor** hides after 2 seconds still and returns on movement, so nothing sits on the art.
- **D-8 The name.** `identity.fullName` in the bottom corner, in the showcase signature style (`.wave-showcase__signature`), visible the whole time. No other text.

## 4. Non-goals

- Mobile and the stacked layout in this slice (see 7.1).
- A gallery to move between worlds inside art mode (see 7.2).
- New worlds, new camera paths, or any change to a world's look.
- Analytics of who uses the mode.

## 5. Acceptance

1. In the stage layout, a double-click on the background of each of the six faces enters art mode; on the interface it does nothing.
2. The top-bar control enters it with the keyboard; `Esc` leaves it; focus returns to the control that opened it.
3. In art mode: no cube, pedestal, composition, strip or top bar visible; the full name visible; the world framed as in its dev showcase.
4. Leaving restores the same face, the same composition and no dialog; a face change is impossible while the mode is on.
5. With `prefers-reduced-motion`, entering and leaving is a crossfade, not a camera move.
6. Screenshots of the six faces in art mode, at 1920×1080 and 1366×768, reviewed by the owner (the visual walkthrough rule).
7. Measured with the audit's `reposo.mjs`: frame rate and canvas size in art mode are not lower than outside it on the same machine.

## 6. Validation

Unit tests of the store events and of the target rule; the walkthrough screenshots; `npm run check` and the change audit on the exact diff (qwen and gemma, the card measured first); the owner's look at the six faces before merging.

## 7. Open questions for the owner

1. **Mobile.** Recommended: out of this slice. A double tap competes with the browser's zoom and with dragging the cube; on phones it would need its own control and its own framing per world (the showcase cameras are tuned for a wide screen). Alternative: a button in the hero layout with the same framing, accepting worse composition on a tall screen.
2. **Moving between worlds in art mode.** Recommended: no; one world, then back. Alternative: arrow keys move to the next face's world, a gallery of the six.
3. **The control's label.** Recommended: «Contemplar» with an expand icon. Alternatives: «Modo arte», «Ver el fondo».
