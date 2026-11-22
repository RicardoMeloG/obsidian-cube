# Specs

A product milestone is described here before it is built.

The path to publishing ran in five stages, each closed before the next started (ADR 007, ADR 008): normalization (spec 010), compositions (spec 011), content, security and release. The first release went live on 2026-11-12 at https://ricardomelog.com; of the security stage only the contact form and the CV request remain, behind a captcha. Specs not yet written, numbered when they start:

1. `methodology-deep-dive`, if decision D-8 keeps it: the site as its own case study (static SEO and JSON-LD already exist).
2. `presentation-state`: the thesis or opening state of the site.

The hardening of the local admin is not a spec: the admin stays on 127.0.0.1, and its cloud form is the Cognito admin of ADR 004 (spec 010, section 12).

In order:

- `009-cube-intro/`: built and live (merged 2026-10-13). The first-visit intro (the cube falls through the beam shedding sparks and lands) and the rotate invitation asked for by ADR 002, point 4.
- `010-architecture/`: architecture and harness (system, repository, site modules, styling, layout modes, degradation, gates). Built in P0 to P4 and closed after two independent audits (`audit-1.md`, `audit-2.md`).
- `011-stage-compositions/`: accepted (2026-10-15) and merged (2026-10-18). The stage layout and per-face compositions as templates the owner edits from the admin (content in the kernel documents, owner images, forms generated from the schemas), with the CONTACT world.
- `012-proportional-gates/`: accepted and built (2026-11-13). The pre-push hook classifies each push by the paths it changes (adjustment, change, large change), asks code for an audit of its exact diff and the contract for its spec or ADR, and refuses ignored files and secrets.
- `013-visits-dashboard/`: built, in `main` since 2026-11-20. A visits view in the local admin (world map by country, total, humans and crawlers, per day and per page) fed by CloudFront standard logs (v2) with chosen fields and no IP, in a private bucket kept 90 days. The log delivery stays off until the owner turns it on.
- `014-cost-guardrails/`: built and in force (2026-11-14). A cost ceiling of about 20 USD a month: the CloudFront flat-rate Free plan (no overage charges), IP rate limiting in its web ACL, a kill switch that disables the distribution when a 20 USD budget is passed, and the alerts.
- `015-match-log-receiver/`: deployed (2026-11-14). A write-only receiver for the Iron Bastion game's match logs behind `/api/iron-bastion/*`, a Lambda only CloudFront can invoke, one JSON per match in a private bucket kept 12 months.
- `016-layered-security/`: analysis (2026-11-19). The controls in place with their evidence, where the layers are redundant and where they are not (a distributed flood on the match-log receiver), and staged proposals (a limit inside the function, the web ACL as data, a trip test, SECURITY.md); the owner decides before anything is built.
- `017-art-mode/`: built and live (2026-11-14). The fullscreen art mode of ADR 001 («Contemplar»), desktop only.
- `018-idle-scene-and-caching/`: built and live (2026-11-17). The scene draws at 30 frames a second after five seconds without input, the pedestal ticks merged by sector (224 draw calls to 36), and `Cache-Control` by path at the edge (load audit of 2026-11-14, C-2, C-5, M-3).
- `019-performance-gate/`: draft (2026-11-19). `check:perf`, a ratchet per metric on the built site (name readable, first frame, main thread at rest and moving, frames at rest, draw calls), from the load audit's thresholds (M-4).
- `020-waf-sample-collector/`: built and deployed (2026-11-21). An hourly function copies the web ACL's request samples, without IP or headers, into a private bucket, so the local admin shows page views by country and the probes the web ACL saw (paths, rules, countries); no change to the public site.
- `021-gate-coverage/`: accepted and built (2026-11-21). The large-change gate also covers the gates' tests and data, their libraries, the edge and Lambda functions, the stack's context, the expected web ACL and `server/appEnv.ts` (dt-42).

Specs are lightweight markdown (problem, outcome, non-goals, acceptance, validation). GitHub Spec Kit was tried in June 2026 and not adopted.
