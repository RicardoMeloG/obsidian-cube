# Specs

Future product milestones should be described here before implementation.

The path to publishing runs in five stages, each closed before the next starts (ADR 007, ADR 008): normalization (spec 010), compositions (spec 011), content (spec 012), security and release; the first release went live on 2026-11-12 at https://ricardomelog.com. Specs not yet written, numbered when they start:

1. Release stage: `publish-real-content` — the first deploy with the real identity, the publish step to S3 and the invalidation.
2. Release stage, if decision D-8 keeps it: `methodology-deep-dive` — the site as its own case study (static SEO and JSON-LD already exist).
3. `presentation-state` — the thesis or opening state of the site.

The hardening of the local admin is not a spec: the admin stays on 127.0.0.1, and its cloud form is the Cognito admin of ADR 004, after the release (spec 010, section 12).

Written outside that sequence:

- `009-cube-intro/` — first-visit intro (the cube falls through the beam shedding sparks and lands) and the rotate invitation asked for by ADR 002, point 4.
- `012-evidence-per-face/` — the content stage, proposal (2026-10-18): one artifact per face that a stranger can open, one line of result, and the owner's copy in both languages through the admin; its entry decisions are pending.
- `011-stage-compositions/` — accepted (2026-10-15): the stage layout and per-face compositions as templates the owner edits from the admin (content in the kernel documents, owner images, forms generated from the schemas). Runs before the content stage (ADR 008); includes the CONTACT world.
- `010-architecture/` — architecture and harness (system, repository, site modules, styling, layout modes, degradation, gates); built in P0–P4 and closed after two independent audits (`audit-1.md`, `audit-2.md`).

Specs are lightweight markdown (problem, outcome, non-goals, acceptance, validation). The Spec Kit tooling tried in June 2026 now lives in its own repository, `RicardoMeloG/spec-kit-study` (see `docs/roadmap.md`, Phase 2).
