# 015: Match Log Receiver for Iron Bastion

**Status:** code written and synthesized on branch `feat/registro-partidas` (2026-11-14); **not deployed**. The deploy waits for the owner's approval (section 7).
**Builds on:** spec 014 (Free plan, web ACL, kill switch, the 20 USD ceiling), spec 010 (the static stack). **Serves:** the game's spec 003 (Iron Bastion 1.0), item M1: "match logging switched on", the only source of the survival curve and of the first-minute data.

## 1. Problem

| Id | Fact | Reproduce |
|---|---|---|
| E-01 | The game already records every match (waves, purchases, damage, first-minute data, console errors) and can send it to an address fixed at build time (`VITE_REGISTRO_URL`), only after the player ticks a consent box. Without that address it sends nothing, so today no match from another player reaches the owner. | The game's `src/app/match-recorder.js`; its tests cover both cases. |
| E-02 | The game's 1.0 is closed by numbers measured on at least 20 matches of other players (survival curve, first-minute times, console errors). Without a receiver those criteria cannot be measured. | The game's `specs/003-cierre-mvp/propuesta.md`, sections 3 and 6 (cut C2). |
| E-03 | The account has a hard ceiling of about 20 USD a month and the distribution is on the flat-rate Free plan, which refuses some CloudFront features. | `AGENTS.md`, "Infrastructure and cost rules"; spec 014. |

## 2. Outcome

A write-only path on the existing distribution: `POST https://ricardomelog.com/api/iron-bastion/partidas` with one match log as JSON. CloudFront forwards it to a Lambda function URL that only CloudFront can invoke; the function validates the log and stores it as one JSON object in a private S3 bucket. Objects expire after 12 months. There is no database, no read API and no ranking.

```
game (GitHub Pages) ──POST──▶ CloudFront /api/iron-bastion/*  (plan web ACL: IP rate rule)
                                   │  OAC (SigV4)
                                   ▼
                          Lambda function URL (AWS_IAM)  ── validate ──▶ S3 partidas/YYYY-MM-DD/<clave>.json
                                                                           (lifecycle: expire at 365 days)
```

## 3. Decisions

- **D-1 Behind the existing distribution, not a new endpoint.** The plan's web ACL and its IP rate rule (300 requests in 5 minutes) already protect the distribution, and requests under the Free plan's allowance cost nothing. A second public endpoint (an API Gateway URL or an open function URL) would bypass the rate rule.
- **D-2 Function URL with Origin Access Control.** The function URL uses `AWS_IAM` auth and CloudFront signs each request with OAC (`FunctionUrlOrigin.withOriginAccessControl`), so the function cannot be called around CloudFront. For a POST through OAC, Lambda requires the viewer to send the payload's SHA-256 in `x-amz-content-sha256`; the game computes it with `crypto.subtle` before sending (a change in the game, recorded in its spec 003). Pay per use: no API Gateway, no reserved concurrency.
- **D-3 Opt-in by context.** The route, the function and the bucket exist only when `infra/cdk.json` has `matchLogOrigins` (the allowed browser origins, e.g. `["https://ricardomelog.github.io"]`). Without it the stack synthesizes exactly as before, so merging this branch changes nothing in AWS until the owner adds the context and deploys.
- **D-4 The function validates before writing.** Allowed `Origin` only; `content-type: application/json`; body at most 512 KB; valid JSON; the shape of the game's record (`formato` 1 or 2, `id`, `clave` a UUID, `oleadas` and `ordenes` arrays of bounded length, `resultado` null or an object). Anything else is refused with 4xx and nothing is written. The object key never takes free text from the client: `partidas/<UTC date>/<clave>.json`, where `clave` must match the UUID pattern. The game sends the cumulative log after every wave, so the same key is overwritten and one object per match remains.
- **D-5 No personal data.** The function stores only the body; it does not store the IP, the user agent or any header. Its log group keeps 1 month of logs and the function logs only the key and the size. Consent stays in the game (unticked by default).
- **D-6 Not cached, Free-plan compatible.** The behavior uses the managed `CachingDisabled` cache policy and the managed `AllViewerExceptHostHeader` origin request policy, allows all methods (POST and the CORS preflight), and adds no response headers policy, no Lambda@Edge, no logging. The security-headers viewer-response function is attached to this behavior too.
- **D-8 Refusals may reach the browser as the site page.** The distribution's error responses (403 and 404 answered with `index.html` and status 200, spec 010) apply to every behavior, so a refusal with 403 (wrong origin, or a request OAC rejects) reaches the browser as 200 with the page. Nothing is written in either case, and the game does not read the answer (it sends and forgets), so this is accepted; real 404s (spec 010, AD-09) would fix it for the whole site.
- **D-7 CORS in the function URL.** The function URL's own CORS configuration answers the preflight for the allowed origins, methods `POST` and headers `content-type` and `x-amz-content-sha256`.

## 4. Non-goals

- A read API, a dashboard or a ranking: the owner reads the bucket with the SSO profile and a local script (game spec 003, section 5).
- Authentication of players or a captcha: the payload is anonymous telemetry, the rate rule limits floods, and the size cap bounds each write.
- Managing the web ACL from the stack (spec 014, D-4).

## 5. Acceptance

1. `npx cdk synth` passes without `matchLogOrigins` and the template is unchanged in resources; with `-c matchLogOrigins='["https://ricardomelog.github.io"]'` it adds the bucket (block all public access, SSE-S3, SSL only, 365-day expiry), the function (Node.js 22, 128 MB, no reserved concurrency, write-only on `partidas/*`), its URL (`AWS_IAM`, CORS), the OAC and the `/api/iron-bastion/*` behavior.
2. The validation is unit tested against stubs (`scripts/checks/matchLog.test.ts`): accepts a valid log, refuses a wrong origin, an oversize body, broken JSON, a bad `clave`, a wrong shape; the key format; no header reaches the stored object.
3. `scripts/checks/infraPlan.test.ts` still passes (no refused features, `webAclArn` kept).
4. After the owner's deploy (not part of this branch): a POST from the game with consent writes one object; a POST without the hash header, from another origin or directly to the function URL is refused.

## 6. Cost estimate

At the expected volume (hundreds of matches a month, each sent up to 20 times, about 100 KB compact):

| Item | Volume | Cost |
|---|---|---|
| CloudFront requests and transfer | a few thousand POSTs | within the Free plan's allowance: 0 USD |
| Lambda | ~10 000 invocations × 128 MB × ~100 ms | perpetual free tier (1 M requests, 400 000 GB-s): 0 USD |
| S3 PUT | ~10 000 PUTs | ~0.05 USD |
| S3 storage | ~0.1 GB after a year (objects overwritten per match) | < 0.01 USD |
| CloudWatch Logs | a few MB, 1 month retention | free tier: 0 USD |

Expected: **under 0.10 USD a month**. Worst case under a flood that passes the rate rule (300 requests per 5 minutes per IP, each ≤ 512 KB): S3 PUTs at 0.005 USD per 1 000, so even 1 million writes in a month is about 5 USD, below the 20 USD kill switch of spec 014.

## 7. What the owner approves

1. Merging `feat/registro-partidas` into `main` (changes nothing in AWS by itself: D-3).
2. Adding `matchLogOrigins` to `infra/cdk.json` and deploying `ObsidianCubeStaticSite` (new bucket, function, URL, OAC and behavior; estimated cost in section 6).
3. Watching the first deploy: if CloudFront refused the function URL origin on the Free plan, CloudFormation rolls the stack back and nothing changes; it is not expected (a function URL is a standard custom origin), but it has not been tried on this account.
4. In the game: building 0.4.0 with `VITE_REGISTRO_URL=https://ricardomelog.com/api/iron-bastion/partidas` and publishing it.

## 8. Validation

The definition of done, `npx cdk synth` with and without `matchLogOrigins`, `npm run audit:change` on the exact diff, and an independent audit of this spec recorded next to it.
