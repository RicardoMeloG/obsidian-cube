# 005: Content Kernel Inside the Site, Workspaces Deferred

**Status:** accepted
**Date:** 2026-10-12

## Context

The content contract (Zod schemas, face catalog, defaults, example content, SEO renderer) is consumed by the site, by the site's own Vite plugin (build-time SEO) and by the local NestJS admin. The future Lambda `admin-api` (ADR 004, task 3) will consume it too.

Today that contract is scattered and impure (`specs/010-architecture`, E-07, E-08, E-16): the admin imports two site modules by a deep relative path, the schemas pull in copy and the scene catalog, one schema module touches `window` (so the server does not type-check), and default content exists three times.

The first proposal moved everything into npm workspaces (`apps/`, `services/`, `packages/content`). The independent audit (`specs/010-architecture/audit-1.md`, A-09) found that heavier than the problem: two real consumers today, one of them (NestJS) scheduled for retirement, `infra/` with its own toolchain, and the workspace move would land in the riskiest phase.

## Decision

- The kernel lives in `src/kernel/`, inside the single site package, at the path it keeps.
- It is pure TypeScript with no DOM: schemas and inferred types, face catalog data, example content, one set of defaults derived from the example, the SEO renderer, layout budgets and link rules. It depends on `zod` only.
- Browser-bound pieces stay out: the rich-text sanitizer (DOMPurify) and the loaders that read `window`/`navigator` live in `src/features/content`.
- `server/` may import `src/kernel` and nothing else from `src/`.
- npm workspaces come with the Lambda, when a second real consumer exists, in their own ADR. `infra/` stays a separate package.

## Consequences

- One relative import path survives (`server/` → `../src/kernel`); it is sanctioned and lint-guarded.
- The server type-checks once the kernel no longer touches `window`.
- The kernel can later become a package by moving one folder; no consumer changes its imports beyond the path.
- Verified by: a `tsc` pass over `src/kernel` with no `DOM` lib; a lint rule restricting `server/` imports; schema unit tests for every budget and link rule (spec 010, H-04b, H-15).
