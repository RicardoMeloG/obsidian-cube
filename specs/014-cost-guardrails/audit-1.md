# 014 — Audit 1: the change audit on its push

**Date:** 2026-11-14. **Auditors:** `qwen3.8:27b` and `gemma4:31b`, each on its own, through `npm run audit:change` (`audit-runs/change-80617af34901b754.json`). **Scope:** the code diff of the four commits after `64bacc4`: the cost-guard stack and its function, the security headers as a viewer-response function, the deploy documentation, and robots.txt, sitemap.xml and the edge charset (ADR 009).

Every finding was verified by reading the code.

| Model | Finding | Verdict |
|---|---|---|
| qwen | The AWS SDK v3 is not in the Lambda Node.js runtime, so the kill switch would fail to import `@aws-sdk/client-cloudfront` | Not real: the Node.js 18 and later runtimes ship the AWS SDK for JavaScript v3; the function runs on `nodejs22.x` |
| gemma | `distributionId` in `infra/cdk.json` publishes a private production detail | Not real: a distribution id grants nothing without the account's credentials, and the account id and certificate ARN were already in the same file by decision (D-7 of spec 010); the alert email, which is personal, stays out (D-5) |
| gemma | `securityHeaders` cast to `unknown` loses type safety for the function code | Not a defect: the JSON is read and passed through unchanged; `scripts/checks/edgeHeaders.test.ts` checks every header the function sets against it |
| gemma | The sitemap's alternate links are relative paths | Not real: every `href` goes through `url()`, which makes it absolute (`absoluteUrl`); `crawlFiles.test.ts` asserts the absolute alternates |

No finding was real, so nothing changed after the audit and no debt is left open from it.
