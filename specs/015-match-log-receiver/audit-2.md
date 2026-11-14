# Audit 2 · push of the receiver to main and its deploy

**Date:** 2026-11-14 · **Diff:** `origin/main..edfdb40` (9 code files: the receiver, the GPU guard commits of spec 012 and `matchLogOrigins` in `infra/cdk.json`) · **Record:** `audit-runs/change-bd52a671457d35a4.json` (local)
**Models:** `qwen3.8:27b` (0 findings, 133 s) and `gemma4:31b` (2 findings, 47 s), one at a time, the card measured first (21.2 GB free).

| # | Model | Finding | Verdict |
|---|---|---|---|
| 1 | gemma | `matchLogOrigins` commits the owner's personal data (a URL with his name) | **Not real.** `https://ricardomelog.github.io` is the public address of the published game, as public as `ricardomelog.com`, which the repo already names. It is not contact data; `check:privacy` passes with 0 findings in 275 files. |
| 2 | gemma | A new origin and behavior may break the CloudFront flat-rate Free plan cap | **Not real, verified live.** The deploy ran on 2026-11-14 without rollback; the distribution keeps its web ACL and `PriceClass_All`, and the behavior `/api/iron-bastion/*` answers. What the Free plan does refuse is a WAF rule scoped to `/api/` (a string match statement needs Pro): tried after the deploy, refused whole, the web ACL unchanged. Recorded in the panel (dt-09). |

**Live checks after the deploy:** a valid POST with origin and hash wrote one object (204); another origin or no hash wrote nothing; the CORS preflight answers with the allowed origin; the function URL called directly answers 403. The test object was deleted.
