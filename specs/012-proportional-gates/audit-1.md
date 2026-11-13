# 012 — Audit 1: the change audit on its own push

**Date:** 2026-11-13. **Auditors:** `qwen3.8:27b` and `gemma4:31b`, each on its own, without prior context, through the tool this spec adds (`npm run audit:change`). **Scope:** the code diff of the push from `9915667`: the push gate (`scripts/lib/push-gate.mjs`, `scripts/check-push.mjs`, `.githooks/pre-push`), the audit (`scripts/audit-change.mjs`), `scripts/enable-hooks.mjs`, the tests, `package.json`, and the content backup that had been pushed without an audit (`scripts/backup-content.mjs`, E-01).

Every finding was verified by reading the code. Fixing a finding changes the diff, so each round audited the new diff again; the last round is the one the hook accepted.

## Round 1

| Model | Finding | Verdict |
|---|---|---|
| qwen | A hunk longer than a piece was cut to the piece size and then placed after its file header, so the piece could exceed the limit | Real, fixed: the cut leaves room for the header |
| qwen | An audit record that is not valid JSON made the hook fail with a stack trace | Real, low (the push was refused anyway), fixed: a clear message |
| gemma | `JSON.parse` of an empty answer crashes the audit | Not real: the caller catches it and records the model as not answered |
| gemma | The `.env` reader fails on values with `=` | Not real: the value is the rest of the line |
| gemma | Added lines are read only after `+++ b/`, and `diff.noprefix` changes that prefix | Real for that setting, fixed: both diffs force `a/` and `b/` |

## Round 2

| Model | Finding | Verdict |
|---|---|---|
| qwen | A draft's `doc_id` from Postgres became a file name without a check, so `../` could write outside the backup | Low (ids come from the admin's fixed list), fixed: only plain names are written |
| gemma | The `.env` reader overwrites existing variables | Not real: it skips names already in the environment |
| gemma | The `b/` prefix (repeated) | Not real: the diffs force it |

## Round 3

qwen returned no JSON for one of the five parts, so its run did not count and the hook kept refusing. Fixed in the tool: a part gets one more try, and a model that already answered for the same diff is not run again.

## Round 4 (accepted)

| Model | Finding | Verdict |
|---|---|---|
| qwen | none | — |
| gemma | With a file header over 8,000 characters a piece could pass the limit | Not real: the header is the few `diff --git`, `index`, `---` and `+++` lines |
| gemma | `DATABASE_URL` unset makes `pg.Client` throw | Not real: the constructor does not throw; the connection fails inside the `try` and the backup warns |
| gemma | The `b/` prefix (repeated) | Not real |

Across the rounds the two models agreed on no finding; four of qwen's five were real, one of gemma's eight was. The gate accepts an audit, not a verdict: a person still reads every finding.
