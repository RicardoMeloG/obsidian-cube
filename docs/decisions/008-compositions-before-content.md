# 008: Face Compositions Before Content

**Status:** accepted 2026-10-15 (amends ADR 007 and decisions D-9 and D-10 of spec 010)
**Date:** 2026-10-15

## Context

ADR 007 orders the path to the first release as normalization, content, release, and keeps "building more" (features, admin functions, worlds) for after the release. Spec 010 left two decisions for later: D-9, world visibility and composition variety (recommended after the release), and D-10, whether CONTACT stays a face.

Normalization closed on 2026-10-13. Before writing content, the owner found the composition itself monotonous: every face is the same two rails around the cube, so the content stage would write six faces into one shape. A concept on 2026-10-14 (`?layout=escenario`, spec 011) gave each face its own composition, with icons, images and cards, and the owner chose that direction. The concept's content, though, is code: nothing of it can be edited, and it bypasses the two-layer model (ADR 004, ADR 005).

The reason ADR 007 put normalization first applies again: the owner should write content once, against the final shape and its budgets. Writing it into the rails and rewriting it for the compositions doubles the content stage.

## Decision

- **Compositions are a stage of their own, between normalization and content.** Spec 011 (templates with typed slots, content in the kernel documents, owner images, admin forms generated from the schemas) runs now. The content stage starts when spec 011 meets its acceptance.
- **D-9 is split.** Composition variety: before content (this ADR). World visibility (002, point 5): after the release, unchanged.
- **D-10 is closed:** CONTACT is a permanent face (owner, 2026-10-14). Contact must be easy to reach for recruiters; the CV is not shown, it is requested behind a captcha (its flow is a later spec).
- **The CONTACT world is part of spec 011** (owner, 2026-10-15): it was a placeholder listed after the release; every face reaches the content stage with its final composition and background.
- **Security is a stage of its own, the last before the release** (owner, 2026-10-15): the contact form, the CV request behind a captcha and the security review of the site and the admin are solved together there, not piecemeal inside other stages. The path becomes normalization, compositions, content, security, release.
- **Admin functions needed to edit the compositions are part of spec 011**, not "building more": without them the owner cannot write the content stage. The Cognito admin of ADR 004 still waits for the release; the admin page is built so it only swaps the API it calls.

## Consequences

- The release moves later by the length of spec 011. Its slices and acceptance (spec 011, sections 5 and 8) keep it finite.
- The content stage writes against the final compositions and their measured budgets once.
- `AGENTS.md` changes where spec 011's entry decisions take effect: the desktop layout description (E-1), and the stages line (this ADR).
- Until the security stage, CONTACT shows its channels without a form; nothing on the site collects data from visitors. The rule "the cube does not disappear" stays unless the owner amends it (spec 011, E-3).
- Spec 010's section 9 records D-9 as split and D-10 as closed, pointing here.
