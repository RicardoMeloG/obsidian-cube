# 007: Staged Path to Publishing

**Status:** accepted (amends point 1 and the priority order of 002)
**Date:** 2026-10-12

## Context

The goal of the project is that a stranger (recruiter, hiring manager, AI system, developer) understands in thirty seconds who the owner is and what they build, finds evidence to inspect, and leaves wanting to talk to them. The site and the repository are both that evidence: the repository becomes public the day the site does, and its architecture, specs, audits and commit history are the proof behind the claim "agentic product engineering with production judgment".

ADR 002 set "publish before building more" and a priority order whose first step was real content and publishing. Spec 010 then defined the code architecture (ADR 005, ADR 006) and, following 002, left most of its migration for after publishing. Two problems follow from that order:

- A public repository with its declared architecture half applied (1,800 lines of hand-written CSS next to an ADR that requires Tailwind and tokens, one component owning most behaviour) contradicts the claim at the moment it is first inspected. The owner's verdict: someone who says they keep AI-driven development under control and does not apply their own architecture looks worse than someone who publishes later.
- Work done in parallel without closing stages leaves decisions open while later work depends on them. A review on 2026-10-12 found several such contradictions between the documents (listed in `specs/010-architecture/spec.md`, section 12).

Rule 1 of 002 also mixed two kinds of work. Building more adds product: features, infrastructure, admin functions, worlds. Normalizing brings the existing code to the architecture already decided and adds nothing a visitor sees.

## Decision

The path to the first public release has three stages, in order. A stage starts only when the previous one met its exit criteria; the decisions a stage needs are taken at its entry, not during it.

1. **Normalization.** Spec 010 phases P2b (tokens, `src/ui` primitives, header and rails in Tailwind), P3 (experience store, split of the shell component, copy dictionary, boundary lint) and P4 (remaining components, `App.css` reduced to documented exceptions, `<dialog>`, security headers), plus the developer-facing documents (README, `docs/architecture.md`). No feature is added and the site stays visually unchanged except where a phase says so. *Exit:* every phase's exit criteria met, all gates green, and an independent audit of the built architecture with its findings resolved.
2. **Content.** The face set, the artifact behind each face and the real copy, written within the layout budgets; the licences of the public assets resolved. *Entry decisions:* whether CONTACT stays a face, which artifact each face links. *Exit:* the owner's content passes the publish rules in the admin and the layout check against it passes.
3. **Release.** The public repository, the infrastructure and the first deploy. *Entry decisions:* repository history (spec 010 D-5), visit measurement (D-2), how the owner's content reaches production the first time (D-6), domain (D-7), whether the methodology page is part of the first release (D-8). *Exit:* the site is live at its public URL with the real identity, and its share preview and static HTML verified.

Building more still waits until the release: new features, infrastructure beyond what the release needs, admin functions and worlds (002, point 1, unchanged for them).

## Consequences

- The first public version of the repository shows the architecture applied and enforced, not announced.
- Publishing moves later by the length of the normalization. Its bounds (no features, phase exit criteria, gates, audit at the exit) keep it finite.
- Content waits for the normalization instead of running beside it, so the owner writes against the final interface and its budgets once.
- Spec 010's driver "publish soon" ranks below the legibility of the public repository for the order of phases.
