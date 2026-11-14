# Build log · spec 015

The code was written by the local model `qwen3.8:27b` (thinking on, 16 384 context), directed and reviewed by Claude, who wrote only glue. The GPU was measured before every load; the model ran alone on the card (beside a headless Chrome of the game's harness, a few hundred MB).

| Round | Task | Result | Correction |
|---|---|---|---|
| 1 | `logic.mjs`, `index.mjs`, `match-log-receiver.ts`, the stack change and the test, all as whole files | Context ran out during the stack file; the first three files were complete | Claude kept the three complete files and asked for the rest as edits |
| 2 | Stack change as search/replace edits, the Vitest file, and a wrong comment fixed (reserved concurrency: the reason is the account's pool of 10, not the plan) | All edits applied; 14 tests green; synth green with and without `matchLogOrigins` | — |
| 3 | Lint failed: two imports unused in the test | Two tests added that use them (`objectKey`, `validateLog`); lint green, 16 tests | — |

Claude's own additions: the spec, the D-8 note (the distribution's 403/404 error responses also cover the API path), and the row in `docs/architecture.md`.

Gates (2026-11-14): `npm run build`, `npm run lint`, `npm test` (244 tests), `npm run check:privacy`, `npm run check:docs`, `node --test infra/scripts/security.test.mjs`, `npx cdk synth` of `ObsidianCubeStaticSite` without the context and with `-c matchLogOrigins='["https://ricardomelog.github.io"]'` (adds 1 bucket, 1 function with its role and write-only policy on `partidas/*`, 1 function URL with `AWS_IAM`, 1 OAC, 2 invoke permissions for CloudFront, 1 log group and the `/api/iron-bastion/*` behavior). Nothing was deployed and nothing was written to AWS.
