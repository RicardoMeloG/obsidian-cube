# Audit 1 · spec 015, code diff

**Date:** 2026-11-14 · **Diff:** `main..00f8871` (5 code files, 2 parts; base forced to the local `main`, because `origin/main` is two harness commits behind) · **Record:** `audit-runs/change-36c26d734e2b6a2b.json` (local, gitignored)
**Models:** `qwen3.8:27b` (1 finding, 91 s) and `gemma4:31b` (2 findings, 41 s), one at a time, the GPU measured before each load (21.8 GB free).

Every finding was checked against the code.

| # | Model | Finding | Verdict |
|---|---|---|---|
| 1 | qwen | `@aws-sdk/client-s3` does not ship with the Node.js 22 Lambda runtime, so the import throws | **Not real.** The Node.js 18+ Lambda runtimes include the AWS SDK for JavaScript v3 with every client; the deployed kill switch of spec 014 imports `@aws-sdk/client-cloudfront` the same way, unbundled, and works (spec 014, acceptance 4). |
| 2 | gemma | `status` in `logic.mjs` versus `statusCode` in the handler is a fragile mismatch | **Not real.** The pure logic returns a plain result and the handler maps it to the function URL response; 204 is returned without a body, refusals with the reason. No defect is shown. |
| 3 | gemma | A new endpoint and Lambda break the Free plan constraints (response headers policies, Lambda@Edge) | **Not real.** The behavior uses managed cache and origin request policies, no response headers policy, no Lambda@Edge (the function is a regular origin behind a function URL), no logging; `scripts/checks/infraPlan.test.ts` still passes. The cost is estimated in section 6 of the spec, and the deploy needs the owner's approval (section 7). |

Result: no real finding; nothing to fix.
