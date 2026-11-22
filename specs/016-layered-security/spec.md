# 016: Layered Security, Shown With Evidence

**Status:** analysis (2026-11-19), not built. The owner asked for it on 2026-11-14 (pending item dp-18): not to answer an attack, but to show command of the subject with redundant controls, where each layer still holds when the one before it fails. The owner asked for a deeper analysis before building; this is that analysis. Decisions D-1 to D-6 taken by the owner on 2026-11-21 (section 6); being built: P-1 (with a per-IP brake added by the owner) and P-2 in `main`, P-3 to P-5 next.
**Builds on:** spec 014 (Free plan, web ACL, kill switch), spec 015 (the match log receiver), the security review of 2026-11-12 (OWASP Top 10:2025, ZAP), ADR 004 (the Cognito admin, later).

## 1. What there is to protect

| Asset | Threat | Today's exposure |
|---|---|---|
| The account's money | Denial of wallet: requests that cost per call (Lambda, S3 PUT) or a resource billed outside the Free plan | The receiver (`/api/iron-bastion/*`) is the only path that executes code per request |
| The site's integrity | Defacement through the bucket, the deploy role or the owner's accounts | Since 2026-11-21 deploys run from GitHub: an OIDC role only the `production` environment can take, after the owner's approval, unable to write `content/` (dp-04); the owner's machine with SSO is the fallback |
| The visitor | Script injection through content (links, rich text), framing | The content comes from the owner's admin; the CSP is enforced |
| The owner's identity and data | Personal data in the public repository; account takeover (GitHub, AWS, Cloudflare, the mail domain) | `check:privacy`, the push gate, 2FA on every account (dp-13) |
| Match logs | Junk or oversized writes; personal data in what is stored | Anonymous telemetry, consent in the game, no IP stored |

## 2. Controls in place, with their evidence

| Layer | Control | Defined in | Last verified | Gap |
|---|---|---|---|---|
| Edge | CloudFront flat-rate Free plan: no overage charges | console (spec 014) | 2026-11-14 | — |
| Edge | IP rate rule, 300 requests in 5 minutes, block | console | 2026-11-14, by hand | Not checked automatically (dt-09 a); one rule for every path, since a path-scoped rule needs the Pro plan (dt-09 b) |
| Edge | Managed rule groups (IP reputation, known bad inputs, common rule set) blocking, `SizeRestrictions_BODY` in Count | console | 2026-11-14 (`/.env.bak` blocked, 20 KB POST passes) | Same as above |
| Edge | Security headers: CSP enforced (`'self'` only, no inline), HSTS 2 years, `frame-ancestors 'none'`, Permissions-Policy | `infra/security-headers.json`, `edgeHeaders.test.ts` | Observatory A+ (2026-11-12) | Not on error responses: the viewer-response function does not run when the origin answers 400 or more, so the S3 404 and the WAF 403 go out without these headers (dt-31). Accepted: both pages are static with no script, HSTS is already stored from the 200 responses, and `404.html` carries its own policy in a meta tag |
| Receiver | Only CloudFront can call the function (function URL `AWS_IAM` + OAC SigV4) | `infra/lib/match-log-receiver.ts` | by design and synth; the function URL called directly answered 403 on 2026-11-14 (`specs/015-match-log-receiver/audit-2.md`) | — |
| Receiver | Origin allow-list, JSON only, 512 KB cap, schema check, key is a UUID, nothing from the client in the path | `infra/lambda/match-log/logic.mjs`, `matchLog.test.ts` | unit tests | — |
| Receiver | Reserved concurrency 3: a flood cannot take the account's pool from the cost guard | same stack (dt-10) | deployed 2026-11-15 | It caps parallelism, not the rate |
| Money | Budget of 20 USD a month with an action that disables the distribution | `infra/lib/cost-guard-stack.ts` | 2026-11-14, fired and recovered in 3 minutes | Budget data lags by hours |
| Money | Alerts at any spend and at 5 USD, cost anomaly monitor | console | — | — |
| Content | Links limited to https, mailto and site paths; rich text sanitised | `src/kernel/links.ts` (dp-06, on a branch), `sanitizeRichText` | unit tests | — |
| Repository | Push gate: secrets, ignored files, audit of the code diff, noreply authors (dt-24, on a branch); `check:privacy` | `scripts/check-push.mjs`, spec 012 | every push | Dependencies and Actions are not watched |
| Accounts | 2FA on GitHub, Google, Microsoft, Cloudflare, AWS root; encrypted recovery codes off the machine | owner (dp-13) | 2026-11-13 | dp-13 items 3 to 5 |

## 3. Where the layers are redundant, and where they are not

The question for each threat is what still holds when a layer fails. Worst-case cost of a flood on the receiver, each figure with only the layers to its left working (S3 PUT 0.005 USD per 1,000; Lambda inside the free tier until 1 M requests a month, then 0.20 USD per million plus duration):

| Flood on `/api/iron-bastion/*` | Rate reaching S3 | Cost per day |
|---|---|---|
| From one IP, IP rule working | ≤ 1 request/s (300 in 5 min) | ≈ 0.43 USD |
| From many IPs (the rule is per IP), concurrency 3 working, about 100 ms per call | ≤ 30 requests/s | ≈ 13 USD, plus Lambda once past the free tier |
| Concurrency removed by mistake | bounded by the account pool (1,000) | hundreds of USD |
| Any of the above | — | the kill switch stops the distribution once the budget sees 20 USD, hours late |

The weak point is the second row: a distributed flood gets past the IP rule, and the only bound left is concurrency times speed, about 13 USD a day, with the kill switch reacting only after the budget data arrives. The receiver also writes every valid request, so a flood stores garbage until the 365-day expiry.

## 4. Proposals, by stage

Following the owner's rule for audits (recommendations, staged: now, later, no):

| # | Proposal | Stage | Why |
|---|---|---|---|
| P-1 | **A limit inside the function**: a fixed one-second window per instance (for example 5 writes a second; at a window's edge up to twice that can land within one second). With at most 3 instances, the rate to S3 is bounded at 15 a second whatever the IP count, so row two drops from ≈ 13 to ≈ 6.5 USD a day, and the bound holds even if the WAF rule is deleted. No state store: an instance's memory is enough, because concurrency bounds the instances. Refusals answer 429 and write nothing, but each one is still a Lambda invocation: P-1 bounds the S3 writes, not the invocations. A refusal takes milliseconds instead of the ≈ 100 ms of a write, so the same 3 instances can answer hundreds of requests a second, millions a day, past the free tier; invocations plus duration could cancel the S3 saving. P-1 therefore relies on the WAF's IP rule to bound invocations (P-2 keeps that rule from drifting), and its cost is measured in the trip test (P-3) before it counts as a saving. | now | The redundant layer the analysis is missing; a few lines, unit testable |
| P-2 | **The web ACL as data in the repository**: the expected rules (`infra/web-acl.expected.json`) and a read-only script that compares them with `aws wafv2 get-web-acl` under the SSO profile, run by the owner after any console change and before a stage's acceptance. Managing the plan's web ACL from CDK stays out (spec 014, D-4). | now | Closes dt-09 a; turns a console setting into reviewable evidence |
| P-3 | **A test that trips the IP rule on purpose**, from AWS CloudShell so the owner's own IP is not blocked: request a harmless static path until the first 403, record the count and the time, then poll until it lifts. Recorded as dated evidence in SECURITY.md. | now | The rule is verified by its effect, not by its configuration |
| P-4 | **SECURITY.md** in the public repository: the threat model of section 1, the controls of section 2 with their evidence, the redundancy table of section 3, the accepted risks of section 5, and how to report a vulnerability. With `/.well-known/security.txt` (RFC 9116) pointing to the same contact. | now | What a reviewer reads; the site's security face can link to it |
| P-5 | **Dependency and Actions watch**: Dependabot alerts and security updates, GitHub secret scanning with push protection (free on public repositories), and the "block command line pushes that expose my email" setting (dt-24) | now (settings, no code) | Supply chain is the gap in the repository row |
| P-6 | **CSP violation reports**: `report-to` an endpoint | later | Needs a receiver of its own (spec 015's pattern); little value while the CSP runs clean |
| P-7 | **Tarpitting** (slowing abusive clients) | no | Lambda bills by the millisecond: a slow answer costs the owner, not the attacker |
| P-8 | **A WAF rule for `/api/` only** | no, on the Free plan | Needs a string match statement, a Pro feature (dt-09 b; the change was refused by AWS) |

## 5. Risks accepted, and why

- A distributed flood can cost up to the bound of section 3 before the kill switch acts: the bound is the design, and the switch is the last layer.
- The match logs are anonymous and unauthenticated: a captcha would hurt the game's players and the data has no value to an attacker.
- `SizeRestrictions_BODY` stays in Count: the receiver's own cap (512 KB) replaces it on the one path that takes bodies.
- The local admin's login has no rate limiting: it never leaves 127.0.0.1 (AGENTS.md, admin rules); the cloud admin will use Cognito's (ADR 004).

## 6. Decisions for the owner

Taken on 2026-11-21, one question at a time:

- **D-1** Yes, and more: two brakes in the function (`infra/lambda/match-log/brakes.mjs`). Per IP, at most 10 stored logs in 10 minutes (the owner asked that too many sends from one origin block that sender; the IP is the connection's address as the edge saw it, `event.viewer.ip`, written into an `x-viewer-ip` header by a viewer-request function on the receiver's behaviour (`infra/edge/viewer-ip.cjs`), which replaces anything a client sends under that name; kept only in the instance's memory for the window, never written). In total, 5 writes a second per instance, the only brake on a flood from many addresses. A refusal answers 429 with `Retry-After`. The map of addresses holds at most 5,000; a flood from more distinct addresses inside one window can push an earlier offender out of it, and then the total brake is what holds. The first version read `X-Forwarded-For`; the trip test after its deploy (2026-11-21) found that behind the function URL that header arrives as the client sent it: ten logs with forged values all passed. Hence the edge function. The log line says whether a viewer IP was found, never the IP.
- **D-2** Compare only (`npm run check:waf`; the expected rules in `infra/web-acl.expected.json`, taken on 2026-11-21, 0 differences).
- **D-3** Once now and after any change to the rule; the owner runs it from CloudShell.
- **D-4** English only; contact a `security@` alias of the site's domain, which the owner creates (the address itself is written where it is published, SECURITY.md and security.txt).
- **D-5** The settings applied through the GitHub API with the owner's yes to each; the protection of `main` must not require pull requests.
- **D-6** Yes: SECURITY.md is the SECURITY face's inspectable artifact, linked from the admin.

The questions as they were put:

- **D-1** P-1, and its rate (5 writes a second per instance is about 20 times what one player sends).
- **D-2** P-2: the script compares only, or also prints the console steps to restore a drifted rule.
- **D-3** P-3: run it once now and after any change to the rule, or on a schedule.
- **D-4** P-4: SECURITY.md content in English only, like the repository; the contact address (a role address of ricardomelog.com).
- **D-5** P-5: the three GitHub settings, done by the owner in the browser.
- **D-6** Whether SECURITY.md is linked from the SECURITY face, as its inspectable artifact.

## 7. Acceptance

- Unit tests for the function's limit (P-1): the window resets each second, an instance refuses past its rate with 429 and writes nothing.
- The web ACL comparison (P-2) reports no difference against the live web ACL, and reports one when an expected rule is changed in a copy.
- The trip test (P-3) recorded with its date, count, block time and lift time.
- SECURITY.md and `security.txt` published; `check:docs` passes; the security review of 2026-11-12 is re-run with ZAP after the change.

## 8. Found while writing this

- `AGENTS.md` (Architecture Rules) still says the content security policy is served "as report-only until it has run clean in production", while `infra/security-headers.json` enforces it since the first deploy (`reportOnly: false`). The rule's text should follow the code.
