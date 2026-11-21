# 020: Visits and Probes From the Web ACL's Samples

**Status:** draft (2026-11-21), not built. The owner asked for a visit counter on 2026-11-21 and, after seeing what the console reports give, for where the bots try to get in. Nothing in AWS changes until the owner approves this spec and the stack diff.
**Builds on:** spec 013 (the «Visitas» view in the local admin, its counting and its fixture), spec 014 (the flat-rate Free plan and its web ACL), spec 016 (layered security), `AGENTS.md` (no cookies, no third-party script, no IP stored).

## 1. Problem

Spec 013 built a visits dashboard fed by CloudFront's standard logs, and its D-9 already found that the flat-rate **Free** plan has no access logs. Measured on 2026-11-21:

| Id | Fact | Reproduce |
|---|---|---|
| E-01 | The plans' feature table lists Access Logs and WAF request logs for Pro and above, not Free. Pro is USD 15 a month, three quarters of the account's ceiling (spec 014). | [flat-rate pricing plans](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html), «Logging and Monitoring» |
| E-02 | The free console reports cannot count visits: they count requests (assets included), are sampled («Unit: Adjusted»: about 500 requests a week against about 8,000 in CloudWatch), 72.8 % of what they show is bots, and the Locations report shows «No data available». No API. | CloudFront console, Viewers, Popular objects and Top referrers, last 7 days |
| E-03 | CloudWatch's free CloudFront metrics give total requests only (700 to 3,100 a day since the release, the owner's own `check:live` runs included). | `aws cloudwatch get-metric-statistics --namespace AWS/CloudFront --metric-name Requests` |
| E-04 | The web ACL the Free plan includes already samples every request it sees, for each rule and for the default action: method, path with query, country, headers, the action, the exact managed rule that matched (`RuleNameWithinRuleGroup`) and a sampling weight. Samples cover the last three hours, at most 500 per call; the API has no charge. In the last three hours: 507 allowed requests (500 sampled) and 5 blocked. Samples carry no bot labels on the Free plan. | `aws wafv2 get-sampled-requests --scope CLOUDFRONT` |
| E-05 | Its CloudWatch metrics give 14-day totals by rule, attack type, country and device, but not the path: 1,212 blocked against 9,796 allowed; `ExploitablePaths_URIPATH`, the reconnaissance and reputation IP lists, the rate rule, `RestrictedExtensions`, `NoUserAgent`, `BadBots` and `GenericLFI` blocked; blocked requests from Germany, Korea, Chile, the US, Singapore, Ukraine, Taiwan and Lithuania first. Allowed probes such as `/wp-admin/install.php?step=1` reach the origin and get the 404 page. | `aws cloudwatch get-metric-data` with `SEARCH('{AWS/WAFV2,...}')` (2026-11-21) |

So what the owner wants exists, but only for three hours at a time.

## 2. Outcome

A small scheduled function copies the web ACL's samples every hour, before they expire, into a private bucket: one record per sampled request, **without the IP or the headers**. The local admin's «Visitas» view reads those records with the owner's SSO profile and shows two sides over 7, 30 or 90 days (or the retention chosen in D-5):

- **Visits:** page views by day, by page and by country, with crawlers and the owner's own tests apart.
- **Probes:** what was blocked or asked for a path the site does not have: the paths, the rules that stopped them, the countries and the kind of client, by day.

Nothing changes in the public site: no script, no request from the page, no new public endpoint.

## 3. Decisions

### D-1 The source is the web ACL's samples, not the browser and not logs

`GetSampledRequests` returns what the web ACL saw, for any window inside the last three hours, per rule metric name (the four rules and the web ACL's default action). It is included in the Free plan and has no charge (E-04). Unlike a page beacon it adds no public endpoint to defend (spec 016 already weighs the one the match-log receiver adds) and no byte to the page; unlike logs it needs no Pro plan.

Alternatives, measured or researched on 2026-11-21: Pro with standard logs (USD 15 a month); a first-party beacon to a Lambda (a second public endpoint that costs per call, and it does not see the probes); a third-party script such as GoatCounter, Umami or Plausible (1 to 3 KB, a new origin in the CSP, blocked by ad blockers, and against the rule «no third-party trackers», `check:live` CU-11); Cloudflare Web Analytics (would put Cloudflare's proxy in front of CloudFront).

### D-2 One run an hour, on whole hours

An EventBridge schedule runs the function at ten minutes past every hour; it reads the previous whole hour, `[H-1, H)`, for each rule metric name. Whole, adjacent windows mean no sample is read twice. If a run fails, the next one also reads the missed hour while it is still inside the three-hour limit: the function keeps the last completed hour in the bucket (`state.json`) and catches up at most two hours back. An hour lost beyond that is recorded as missing, so the view can say so.

The default action saw about 170 requests an hour (E-04), a third of the 500 a call returns; a burst above 500 is still represented by the weights (D-4).

### D-3 What a record keeps

Per sampled request: the minute (`2026-11-21T03:12Z`), the method, the path, the country, the action (`ALLOW`, `BLOCK`, `COUNT`), the rule metric name and the managed rule that matched, the weight, and the client's class and name. The class is read from the user agent by the rules spec 013 already has (`agentOf`, `server/visits/visitLog.ts`), widened to: `browser`, `crawler` (named: Googlebot, Applebot, SemrushBot…), `library` (curl, python, node, Go), `empty`, and `owner-test` (D-6). The name is the browser family or the bot's name, never the full user agent.

Never kept: the client IP, any header (the user agent is reduced in memory), the HTTP version, the request id. The query string is dropped from allowed requests (the site's own queries, such as `?intro=0`, say nothing); for blocked requests and for paths the site does not have it is kept, cut at 200 characters, because it is the attack (`?list-type=2`, a traversal). A test refuses an IP or a header in any record.

### D-4 Counts are estimates, and the view says so

Each sample has a weight: how many requests it stands for. Counts add weights, not samples, and the view labels them «estimated from samples». At this site's traffic the weight is 1 (every request sampled); it grows only above 500 requests an hour per rule.

A visit is what spec 013's D-5 calls a page view: a `GET` allowed, on a page of the site (`readPagePath`) or of the layer for machines. The samples carry no response status, so «answered 200» becomes «a path the site has»; a known path is not checked against the origin's answer. Crawlers are counted apart, as in spec 013. Bots that disguise themselves as browsers count as visits unless they hit a path the site does not have or a block; the reconnaissance and reputation labels seen in the metrics (E-05) are not in the samples (E-04), so they cannot be used per request. The view states this limit.

### D-5 A private bucket, records kept twelve months

A new private bucket (`BLOCK_ALL`, SSE-S3, TLS only), objects `samples/YYYY/MM/DD/HH.json` (one JSON array per hour) plus `state.json`, with a lifecycle rule that expires samples after 12 months. Twelve months, against spec 013's 90 days, because a record holds no IP and no user agent and the attack trend is more useful over a year; at about 170 records an hour a year is roughly 1.5 million records, about 150 MB. **Owner decision: 12 months (recommended) or 90 days.**

### D-6 The owner's own tests are marked, not guessed

`check:live`, the deploy checks and the `curl` probes of the docs send a user agent that ends in `obsidian-cube-check` (a constant shared by `scripts/check-live.mjs` and the collector's classifier); the collector classes them `owner-test`. Without an IP there is no other way to tell the owner's runs from a visitor, and they were most of the «human» traffic of the last weeks (E-02, E-03).

### D-7 The function is small and can only read the samples and write the bucket

`infra/lambda/waf-samples/` (Node 24, no dependencies beyond the SDK in the runtime), 128 MB, 60 s timeout, reserved concurrency 1, logs kept one month. Its role allows `wafv2:GetSampledRequests` on this web ACL's ARN and `s3:GetObject`/`s3:PutObject` on its bucket only. No function URL, no route on the distribution. The logic lives in plain functions (`logic.mjs`) tested with Vitest, as the match-log receiver does.

### D-8 The admin reads the bucket like spec 013 reads logs

`VISITS_SOURCE=waf` and `VISITS_BUCKET` in `.env` (the bucket's stack output); the SSO profile as in spec 013's D-4. `GET /api/visits?days=` keeps its shape and gains the probes; the fixture gains sample records, so the view still runs with no AWS. The map, the days and the pages keep spec 013's design; the probes are a second panel: top paths, rules, countries and client classes, by day.

### D-9 Behind a context switch, off

`WafSampleCollector` (`infra/lib/waf-sample-collector.ts`) is added only when the CDK context `wafSamples` is `true` and `webAclArn` is set; `cdk.json` sets it to `false`. Spec 013's `VisitLogs` stays as it is, for a distribution on pay-as-you-go or Pro.

## 4. Non-goals

- Any change to the public site, its headers or its bundle (beyond `check:live`'s user agent, which is a test).
- Unique visitors, sessions, referrers or anything that needs an identifier.
- Blocking anything new: this spec observes; what to do with what it shows belongs to spec 016.
- The dashboard in the Cognito admin (ADR 004).
- History before the first run: the samples of the past have expired.

## 5. Slices

| Slice | Content | Checkpoint |
|---|---|---|
| S1 | `logic.mjs`: a sample to a record (D-3), classes (D-6), whole-hour windows and catch-up (D-2), tests (no IP, no header, weights, query kept only on probes) | `npm test` |
| S2 | `WafSampleCollector` construct, schedule, role, bucket, lifecycle, behind `wafSamples`; `check:live`'s user agent | `cdk synth` with the switch on and off; infra tests on the role's actions and resources |
| S3 | `VISITS_SOURCE=waf` in the admin, the fixture's sample records, the probes panel; `check:admin` covers it | visual walkthrough of the admin |
| S4 | Gates, change audit, findings | `audit-1.md` |

## 6. Acceptance

1. A sample with an IP and headers becomes a record with neither; a blocked sample keeps its query cut at 200 characters, an allowed one on a known page keeps none (unit tests).
2. Two adjacent runs read adjacent whole hours and never the same sample twice; a failed run is caught up by the next while within three hours, and an hour beyond that is recorded as missing (unit tests over a fake clock).
3. `cdk synth -c wafSamples=true` produces one function with reserved concurrency 1, an hourly schedule, a role limited to `wafv2:GetSampledRequests` on the web ACL and `s3:GetObject`/`s3:PutObject` on its bucket, and a private bucket that expires samples at the chosen retention; without the switch the template is unchanged.
4. With `VISITS_SOURCE` unset the view shows the fixture's visits and probes; `npm run check:admin` finds both.
5. After the owner's deploy: the first hourly objects appear, their records carry no IP, and a `check:live` run shows as `owner-test`.
6. The definition-of-done gates pass, and the change audit's findings are verified (`audit-1.md`).

## 7. Cost and what the owner approves

720 runs a month of under a second at 128 MB, inside Lambda's permanent free tier (1 million requests, 400,000 GB-seconds); EventBridge Scheduler's free tier is 14 million invocations a month; `GetSampledRequests` has no charge. S3: 720 puts a month (under USD 0.004) and about 150 MB a year (under USD 0.004 a month at the end of the year). CloudWatch Logs for the function: a few KB a day. The total stays under one cent a month, and nothing in it grows with an attack except the records, which are capped at 500 per rule per hour by the API itself.

Before the deploy the owner approves: (a) D-3 (what a record keeps, the query on probes) and D-5 (retention); (b) the output of `npx cdk diff -c wafSamples=true` from `infra/` (a bucket, a function, its role, its log group and a schedule; the distribution and the web ACL do not change); (c) then sets `wafSamples` to `true` in `cdk.json` and deploys, and sets `VISITS_SOURCE=waf` and `VISITS_BUCKET` in `.env`.
