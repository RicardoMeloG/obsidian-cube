# Architectural Decision Records

This directory holds short ADRs (Architectural Decision Records) for the project. ADRs document **irreversible or hard-to-reverse decisions** so future agents (human or AI) understand the reasoning without needing to ask.

## When to write an ADR

Write one when:

- The decision is structural (changing it later would touch many files).
- A future contributor or AI agent could reasonably choose the opposite without context.
- The decision contradicts an obvious default (e.g. "we don't use library X even though everyone does").

**Do not** write ADRs for tactical decisions (variable renames, easing tweaks, local refactors). Those live in git history.

## Naming

`NNN-short-decision-title.md` — e.g. `001-unified-vector-worlds.md`, `002-bilingual-content-loader.md`.

Numbers are sequential and never reused. Once written, ADRs are append-only — corrections come as new ADRs that supersede the old one (mark the old one with a "Superseded by" note at the top).

## Format

Each ADR is short:

```markdown
# NNN: Decision Title

**Status:** accepted | superseded by NNN
**Date:** YYYY-MM-DD

## Context
What problem we faced.

## Decision
What we chose.

## Consequences
What this enables, what this costs, what we're now committed to.
```

That's it — usually under one screen.
