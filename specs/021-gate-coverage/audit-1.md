# Audit 1 · spec 021, its build

**Date:** 2026-11-22 · **Diff:** `bb40192` (the spec, `push-gate.mjs`, its test and the documents) · **Record:** `audit-runs/` (local, gitignored)
**Auditor:** an independent Claude Sonnet subagent with no prior context (owner, 2026-11-19: Sonnet audits until further notice). Claude Opus checked every finding against the code.

| # | Finding | Verdict |
|---|---|---|
| 1 | `infra/visit-log-fields.json` (gate data, guarded by `visitLogFields.test.ts`), `infra/bin/` (the stack's entry point) and `scripts/audit-change.mjs` and `scripts/audit-drift.mjs` (the audit gate, which do not match `check-*.mjs`) were still ordinary changes, against a spec titled "every gate" | **Real, medium.** Fixed: all four are large changes, in the spec's table and the test |
| 2 | `server/appEnv.test.ts` and `package.json` left out and not named as non-goals | **Real, low.** The test is now a large change with `appEnv.ts`; `package.json` is a written non-goal (a dependency bump touches it every time, and a removed script fails loudly) |
| 3 | No `audit-1.md`, and acceptance criterion 2 asked for a check by hand nobody recorded | **Real, low.** This file; criterion 2 now rests on the test of `classify`, the function the hook calls |
| 4 | The test had no negatives for the paths next to the new rules, and no case of a gated file pushed with excluded generated data | **Real, low.** Added: `infra/tsconfig.json`, `server/main.ts`, `infra/package-lock.json`, and `budget.json` with `world.json` (large, and only `budget.json` audited) |
| 5 | `infra/scripts/prepare-cdk.mjs` is a build step, not a test, yet now a large change | **Accepted** and written as a non-goal: it pins and patches the CDK source, a supply-chain step that deserves the ceremony |

Also verified by the auditor: every path of the problem table exists and was not in the old list; the hook asks a large change only for a commit message naming a spec or ADR, so dependency bumps and generated data are unaffected.
