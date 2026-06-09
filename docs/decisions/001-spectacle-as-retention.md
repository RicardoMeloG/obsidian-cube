# 001: Visual Spectacle as Retention Strategy

**Status:** accepted
**Date:** 2026-05-28

## Context

This is a public portfolio competing against thousands of generically styled developer sites. Without a strong visual hook, an indifferent visitor bounces in a few seconds — never reading the content, never converting. The cube alone, however polished, is one moment of visual interest; the rest of the screen is conventional UI.

A standard fix would be a single signature background. We are deliberately going further: each of the six cube faces is paired with its own custom vector world. This is expensive per face and must be justified.

## Decision

Each cube face is paired with a custom vector background that functions as a **standalone art piece**, not as thematic decoration of the face's topic. The user-facing funnel is explicit and intentional:

- **Background = retention.** Strong enough that even an indifferent visitor pauses. The free sample.
- **Cube = invitation.** The anchor that says "if this stopped you, here is where the conversation begins."
- **Side panels = conversion.** The reward for the truly interested — short, dense, actionable.

Three supporting rules follow from this framing:

1. **Distinct physical registers.** Each background must occupy a different physical register (motion type, density, depth axis), not only a different geometry. This prevents spectacle fatigue when navigating between faces. A visitor who clicks through all six should feel six distinct sensations, not six versions of the same beauty.

   Current and planned registers:

   - AGENTIC — continuous horizontal wave (wave field)
   - SYSTEMS — forward urban density (city corridor)
   - RESEARCH — still landscape with rotating sky (starlit nightscape)
   - PRODUCTS, SECURITY, CONTACT — registers to be defined as a set, not individually

2. **Cube as Polaris.** Any rotating element in a background must center its rotation on the cube. The cube is the still point of the rotating universe. This binds the spectacle to the focal anchor and reinforces the cube's role as the visual constant across faces.

3. **Fullscreen art mode.** Double-clicking the background hides the cube, side panels, and chrome, leaving only the visitor's name strap and the background itself. This lets visitors who want to appreciate the piece on its own do so without losing context — the name keeps the authorship attached to the art.

## Consequences

- Production cost per face is significantly higher than a generic shared background. This cost is accepted as part of the project's intended signal: the visual investment is itself evidence of judgment and craft.
- Each new face background must be designed as autonomous spectacle and must justify its register against the other five. A redundant register requires a rework, not just an aesthetic adjustment.
- The cube can never be removed from the composition without breaking the Polaris rule for any rotating-sky face.
- Fullscreen art mode introduces a new interaction primitive (double-click on background); this needs implementation in `PremiumCubePrototype.tsx` and must be discoverable enough to find but quiet enough not to interfere with normal use.
- Future ADRs may supersede individual register choices, but the funnel framing (retention → invitation → conversion) is the baseline assumption all subsequent visual decisions inherit.
