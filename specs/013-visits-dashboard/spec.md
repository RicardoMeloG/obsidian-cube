# 013: Visits Dashboard in the Local Admin

**Status:** proposed (2026-11-13); spec audited before the build (`audit-1.md`, part 1), built on `feat/visits-dashboard`, not deployed. The infrastructure half is inert until the owner turns it on (D-6): nothing in AWS changes until he approves the stack diff and deploys it himself. The feature code was written by a local model (`qwen3.8:27b`) and reviewed by the agent (`build-log.md`).
**Builds on:** `AGENTS.md` (admin rules, Working Method), spec 012 (gates), ADR 004 (the admin's cloud form; this spec does not change it).

## 1. Problem

The site went live on 2026-11-12 and the owner has no way to know whether anyone visits it, from where, or which faces are opened.

| Id | Fact | Reproduce |
|---|---|---|
| E-01 | The distribution has no access logging of any kind: neither standard logging (legacy) nor v2. | `aws cloudfront get-distribution-config` → `Logging.Enabled: false`; `aws logs describe-delivery-sources` → 0 (read-only, 2026-11-13) |
| E-02 | The usual answer, a browser analytics script, breaks the site's rules: no cookies, no Google, no third-party script, and the public site does not change for this. | `AGENTS.md`, `infra/security-headers.json` (`script-src 'self'`) |
| E-03 | The defaults of CloudFront logging deliver the viewer's IP (`c-ip`, `x-forwarded-for`), cookies and query strings. IPs are personal data and must never be stored. | `aws logs describe-configuration-templates --service cloudfront`: the default `recordFields` include `c-ip` |

## 2. Outcome

The local admin (`127.0.0.1`, never exposed) gains a «Visitas» view: a world map shaded by the visits from each country, a total counter, humans against crawlers, visits per day and visits per page, over the last 7, 30 or 90 days. The numbers come from CloudFront's own logs, delivered to a private bucket with only the fields the dashboard needs and no IP, kept 90 days, read by the admin with the owner's SSO profile and reduced to counts in memory. In development the dashboard runs on a committed fixture, with no AWS at all.

## 3. Decisions

### D-1 The source is CloudFront standard logging (v2), not the browser

Standard logging v2 delivers access logs to S3 through CloudWatch vended logs and lets the delivery **choose its fields** (`RecordFields` of `AWS::Logs::Delivery`), including `c-country`, a real-time field the legacy logs do not carry. The live account's template for `ACCESS_LOGS` to S3 lists **no mandatory field**, so a delivery without `c-ip` is valid (`describe-configuration-templates`, 2026-11-13). Nothing runs in the visitor's browser and the public site is unchanged.

Evidence: [Configure standard logging (v2)](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/standard-logging.html) (field selection, `c-country`, output formats, S3 partitioning, pricing note), [AWS::Logs::Delivery](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-logs-delivery.html) (`RecordFields`, `S3SuffixPath`), [Logs sent to Amazon S3](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AWS-logs-infrastructure-V2-S3.html) (bucket policy, SSE-S3).

Alternatives: a cookieless script such as Plausible or a self-hosted beacon (changes the public site and its CSP, E-02); CloudWatch real-time logs through Kinesis (always-on cost for a portfolio); legacy standard logs (every field including `c-ip`, no `c-country`).

### D-2 Seven fields, no identifier

The delivery carries exactly `date`, `time`, `c-country`, `cs-method`, `cs-uri-stem`, `sc-status`, `cs(User-Agent)`, listed once in `infra/visit-log-fields.json`. Never `c-ip`, `x-forwarded-for`, `cs(Cookie)`, `cs-uri-query`, `cs(Referer)`, `x-edge-request-id` or `asn`; a test refuses them. The user agent is there only to tell crawlers from people, which matters on a site whose largest audience is machines (`AGENTS.md`, Audience); the admin reduces it to «human» or «crawler» and never keeps it. Output format JSON lines, so a field is read by name.

Why the user agent is kept and the IP is not (audit-1 S-2): with no IP, no cookie, no query and no request id, a line cannot be joined to another line or to a person; the user agent alone is shared by millions of browsers. CloudFront offers no way to reduce it to «crawler» before delivery without a Lambda in the path, which this spec does not add. The retention of 90 days and the owner's approval of this point (section 7) bound it.

### D-3 A private logs bucket with 90 days of retention

A second bucket, private (`BLOCK_ALL`, SSE-S3, TLS only, objects owned by the bucket owner), with a lifecycle rule that expires every object after 90 days, and a bucket policy that lets only `delivery.logs.amazonaws.com` write, conditioned on this account and its delivery sources. The admin's history is therefore the last 90 days (D-5).

### D-4 The admin reads S3 with the owner's SSO profile, the fixture otherwise

`VISITS_SOURCE` in `.env` picks the source: `fixture` (the default) reads `server/visits/fixtures/sample-logs.jsonl`; `s3` lists and reads `VISITS_BUCKET` with the AWS SDK and the SSO profile named by `VISITS_PROFILE` (the owner's admin profile, set only in his `.env`; the code has no default, audit-1 S-1), in `us-east-1`. No key is written anywhere: an expired session or a missing profile makes the view say so and name the `aws sso login --profile <profile>` it needs; the admin never asks for a login itself. The route is `GET /api/visits?days=7|30|90`, behind the `AuthGuard` like every other admin route.

### D-5 Counts only, in memory

The server parses each line, drops it if it is not a page view, and keeps counts: by country, by day, by page, humans and crawlers. Raw lines are not written to disk, to Postgres or to `private/`; a summary is cached in memory for five minutes. A page view is a `GET` answered `200` or `304` whose path is one of the site's pages (`readPagePath` in `src/kernel/sitePaths.ts`, the function the site itself uses to read an address: `/`, `/es` and each face's slug in each language; `.html` and a trailing slash dropped) or of the layer for machines (`/llms.txt`, `/profile`, `/profile.es`); assets, content files and unknown paths (scanners) are not visits, and unknown paths are counted apart as one number. The map, the days and the pages count people; crawlers are one number beside them, because a crawler's country is its data centre's.

### D-6 The infrastructure is behind a context switch, off

`VisitLogs` (`infra/lib/visit-logs.ts`) is added to the stack only when the CDK context `visitLogs` is `true`; `cdk.json` sets it to `false`. A deploy made for another reason does not carry it by accident; the owner turns it on when he approves this spec.

### D-7 The map is local

Country shapes from Natural Earth 1:110m admin-0 (public domain), projected once to Equal Earth by `scripts/build-world-map.mjs` and committed as `server/admin/world.json` (ISO 3166-1 alpha-2 → SVG path), served by the admin by exact name. No tile server, no CDN, no new source in the admin's policy; credited in `docs/assets.md`.

### D-8 The admin's own port can be moved

`ADMIN_PORT` in the environment moves the local admin off 5182 (still on `127.0.0.1`), so a second checkout or an agent can run its admin while the owner's runs. The bypass's own-address check follows the port; the framing headers (`noFraming.ts`) do not depend on it and stay on every response.

### D-9 The flat-rate Free plan has no access logs; the console report is the fallback

The owner may move the distribution to CloudFront's flat-rate **Free** plan (USD 0/month, no overage charges) as a cost cap (2026-11-13). Verified against the documentation the same day:

- The plans' feature table lists **Access Logs** (standard logs, «with Amazon CloudWatch Logs ingestion included at no extra cost») for Pro, Business and Premium, **not for Free** ([flat-rate pricing plans](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html), «Logging and Monitoring»). Real-time logs are unsupported on every plan. A user on AWS re:Post reports the console's logging setting disabled on a Free distribution with «upgrade to Pro» as the only option ([re:Post](https://repost.aws/questions/QUKC3ktiuRRnSYJbU6RzGHJQ/cloudfront-standard-logging-is-disabled-and-only-option-i-see-is-to-upgrade-to-pro)). Not verified here: whether the CloudWatch API (`PutDeliverySource`, the path this stack uses) is refused too, because verifying it needs an AWS write. The plan's subscribe check lists only real-time logs as an unsupported feature, so the behaviour of an existing v2 delivery on a Free distribution is unknown; the owner's deploy (section 7) is where it shows.
- Pro costs USD 15/month ([available plans](https://docs.aws.amazon.com/PricingPlanManager/latest/UserGuide/plans.html)) and includes the access logs; inside the owner's ceiling of about USD 20/month for the whole account, it would take three quarters of it for a dashboard. Not recommended for this alone. Even on Pro, CloudWatch storage and queries are not covered («All other CloudWatch costs such as storage and querying are not covered»), which is why this spec delivers to S3 and never to a CloudWatch log group.
- **Fallback on Free:** CloudFront's console **Viewers** report shows the top 50 locations by country for any range in the last 60 days, with daily points, and the **Popular objects** report the most requested paths, both «without enabling access logs» and downloadable as CSV ([viewers reports](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/viewers-reports.html), [reports](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/reports.html)). The documentation describes them only in the console and CSV; no API for them is documented, so the admin cannot fetch them by itself. They count requests, assets and crawlers included, not page views. A later slice can let the admin read a downloaded Locations CSV (`VISITS_SOURCE=csv`) into the same map; it is not built in this change.

So the infrastructure stays behind its switch (D-6): with the Free plan the owner leaves `visitLogs` off and uses the console report (or the CSV slice once built); on pay-as-you-go or Pro he can turn it on.

## 4. Non-goals

- Any change to the public site, its headers or its bundle.
- History beyond the 90 days of the bucket (keeping daily counts in `private/` is a later step if wanted).
- Unique visitors, sessions, referrers or anything that needs an identifier.
- The dashboard in the Cognito admin (ADR 004): this view is local until that admin exists.
- Deploying: no `cdk deploy` is part of this spec's work.

## 5. Slices

| Slice | Content | Checkpoint |
|---|---|---|
| S1 | Log reading and counting (`server/visits/`), the fixture, unit tests | `npm test` |
| S2 | `GET /api/visits`, S3 source with the SSO profile, `ADMIN_PORT` | the route answers on the fixture |
| S3 | World shapes, the «Visitas» view, `check:admin` covers it | visual walkthrough of the admin |
| S4 | `VisitLogs` construct behind `visitLogs`, field list and its test | `cdk synth` with the switch on and off |
| S5 | Gates, `audit:change`, findings | `audit-1.md` |

## 6. Acceptance

1. With `VISITS_SOURCE` unset, the «Visitas» view shows the fixture: the total, humans and crawlers, a shaded map with a tooltip per country, visits per day and per page; nothing reaches AWS.
2. A log line that carries `c-ip` is counted without the IP reaching the summary, and a line with an unknown path, an asset or a `POST` is not a visit (unit tests).
3. `cdk synth -c visitLogs=true` produces one `AWS::Logs::Delivery` whose `RecordFields` are the seven of D-2, a bucket that expires objects at 90 days and blocks public access; without the switch the template is unchanged.
4. `npm run check:admin` opens the view against a stand-in API and finds the total and a country shaded.
5. The admin's response headers are unchanged (`frame-ancestors 'none'`, `X-Frame-Options: DENY`) and the page loads nothing from outside `127.0.0.1`.
6. The definition-of-done gates pass, and the change audit's findings are verified (`audit-1.md`).

## 7. Cost and what the owner approves

Log delivery from CloudFront to S3 has no CloudFront charge; S3 storage and requests apply ([standard logging pricing note](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/standard-logging.html#pricing-standard-logs)). CloudWatch's page warns that vended-log delivery to S3 can show as `S3-Egress-Bytes`; even at that rate the volume is tiny: seven fields are about 250 bytes per request, so 100,000 requests a month are about 25 MB, cents a month in storage, puts and delivery together, and the admin's reads (one list and a few hundred gets per refresh) add fractions of a cent. Logs grow with requests, scanners included (audit-1 S-5): a million requests in a month would be about 250 MB, still well under a dollar; CloudFront delivers files in batches, so S3 puts do not grow per request. A budget alarm on the account is a separate, account-wide decision, not part of this spec.

Bounds against the account's ceiling of about USD 20/month: the delivery goes to S3 only (no CloudWatch log group, so no CloudWatch storage or query charges, D-9), JSON not Parquet (Parquet conversion is billed), and the lifecycle rule caps what is stored at 90 days of logs. With the Free plan the switch stays off and this part costs nothing (D-9).

Before the deploy the owner approves: (0) which pricing plan the distribution stays on (D-9): the logs exist only on pay-as-you-go or Pro; (a) this spec's decisions D-1 to D-3, in particular keeping the user agent for 90 days; (b) the output of `npx cdk diff -c visitLogs=true` from `infra/` (a new bucket, its policy, a delivery source, destination and delivery; the distribution itself does not change); (c) then sets `visitLogs` to `true` in `cdk.json` and deploys by hand, and sets `VISITS_SOURCE=s3` and `VISITS_BUCKET` (the stack output whose name starts with `VisitLogsVisitLogsBucketName`) in `.env`.
