# 002: Evidence Before Spectacle

**Status:** accepted
**Date:** 2026-10-09

## Context

ADR 001 bet on visual spectacle as the retention device: background stops the bounce, cube invites, panels convert. The work that followed was shaped by that bet. An audit on 2026-10-09 found:

- The site had not been published yet and still ran on example content.
- Most of the engineering existed and worked (cube, bilingual content system, admin with MFA, Postgres persistence, AWS IaC, CI). The product lagged behind: no real name, no real links, no artifact behind any face, no methodology page, no public URL.
- The funnel of ADR 001 was not landing even on its own terms. Four of the five finished worlds are drowned by the cube, the fog and the darkness in the main composition; they only read in the `?bg=` showcase. All six faces share one identical layout. The owner's name is the least visible text on screen.
- What the site claims to prove, agentic product engineering with production judgment, is proven by the repository (AGENTS.md, ADRs, specs, admin with MFA, CDK, commit discipline), which recruiters never open. The site hides its best evidence.

The conclusion: the cube is a strong hook but not evidence by itself; a portfolio is judged by whether a stranger leaves wanting to talk to its author.

## Decision

The project optimizes for inspectable evidence first and spectacle second. Concretely:

1. **Publish before building more.** No new infrastructure, admin features or 3D worlds until the site is live at a public URL with the real identity and real links.
2. **One artifact per face.** Every face links, through a CTA or `detail.links`, to at least one concrete, inspectable artifact (repository, demo, write-up) with one line of result. Generic copy is treated as a defect.
3. **The site is its own case study.** The methodology deep-dive explains how this site was built with agents: decisions, gates, what went wrong. It is the one page that aligns the cube with the positioning.
4. **The cube is the invitation, not the proof.** Its job is to make the visitor touch it and read the panels. It must invite touch (a welcome motion or hint), and its label must not outrank the owner's name.
5. **ADR 001 stays, with a visibility rule.** The retention bet is kept, but a world that cannot be perceived behind the cube in a static frame is not finished, and the six faces may not all share one composition.
6. **The admin is production only when publish reaches the deploy target.** Writing to the server's disk is a local convenience; publish must also upload to the static bucket and invalidate the CDN.

Priority order: real content and publish; one artifact per face; methodology page and static SEO; thesis/presentation state; admin hardening and publish-to-target; cleanup. Cognito, RDS, Fargate, domain and WAF are deferred until step 1 is done.

## Consequences

- The next weeks of work are content, links and one route, not code depth. This is cheaper than anything done so far and is the only work that changes whether the project is a portfolio.
- The five existing real artifacts outside this repository (this site with its admin and infra, the local transcription tool, the agentic search tool, the mining weather-forecast app, the legacy modernization work, anonymized) become the content of the faces. Private client details stay out; results and public repos go in.
- ADR 001 is not superseded. Its funnel is kept; its tuning changes (visibility rule, composition variety) and its priority drops below evidence.
- The engineering already built keeps its value as evidence for the AGENTIC and SECURITY faces, provided it is pointed at from the site.
- Spectacle work that cannot show a measured effect on retention (once the site is live and measurable) is not funded.
