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

### D-2 One run an hour, read in ten-minute slices

How the API samples (verified in the [API reference](https://docs.aws.amazon.com/waf/latest/APIReference/API_GetSampledRequests.html), 2026-11-21): for a window and a rule metric name it picks up to `MaxItems` (at most 500) **at random from the first 5,000 requests** of the window, says how many there were (`PopulationSize`), and, if the window held more than 5,000, returns a **shorter `TimeWindow`**: the rest of the window is not sampled at all. Below 500 requests it returns every one.

So an EventBridge schedule runs the function at ten minutes past every hour, and the function reads the previous whole hour, `[H-1, H)`, as **six ten-minute slices** for each rule metric name (the four rules and the web ACL's default action, whose metric name is the web ACL's: `CreatedByCloudFront-988acf5a`, verified): 30 calls a run. The default action saw about 170 requests an hour (E-04), about 30 per slice, so every request is returned. Each slice records its `PopulationSize`, the window asked and the window returned:

- population ≤ 500: complete;
- 500 < population, window returned whole: sampled (weights apply, D-4);
- window returned shorter: **truncated**: more than 5,000 requests in ten minutes (over 8 a second, an attack or a flood; the rate rule already blocks a single source above 300 in five minutes). The slice is marked, and the view says so instead of showing a low count.

The hour comes from the schedule's event time, never from the clock. The function writes the hour's object (overwriting, so a retried or repeated run cannot duplicate it), and only then advances `state.json`, the last completed hour. If a run fails, the next reads the missed hour too, but only the slices still wholly inside the three-hour limit (the API silently moves an older start to three hours ago); a slice that is no longer whole is recorded as **missing** in a marker object, so the view tells a missing hour from a quiet one. Reserved concurrency 1 keeps two runs from overlapping. A request seen in the last seconds of a slice can be stamped into the next; the tolerance is that of the WAF's own timestamps.

### D-3 What a record keeps

Per sampled request: the ten-minute slice (`2026-11-21T03:10Z`, not the minute: coarser time makes a record harder to single out and matches D-2), the method, the path as below, the country, the action (`ALLOW`, `BLOCK`, `COUNT`), the rule metric name and the managed rule that matched, the weight, and the client's class and name. The class is read from the user agent by the rules spec 013 already has (`agentOf`, `server/visits/visitLog.ts`), widened to: `browser`, `crawler` (named: Googlebot, Applebot, SemrushBot…), `library` (curl, python, node, Go), `empty`, and `owner-test` (D-6). The name is the browser family or the bot's name, never the full user agent.

The path, by kind (a path can carry personal data, an e-mail or a token in `/x/user@mail`, and a scanner's query can carry credentials):

- an allowed request on a page of the site keeps only the site's own form of the page (`readPagePath`: `/es/seguridad`), never a query;
- an allowed request on any other path, and every blocked request, is a **probe**: it keeps the path cut at 200 characters and **no query by default**; keeping the query too, cut at 200 characters, is an owner decision (it shows the attack: `?list-type=2`, a traversal, an injection).

Never kept: the client IP, any header (the user agent is reduced in memory), the HTTP version, the request id. A test refuses an IP, a header or a query (unless D-3's option is on) in any record.

**Owner decision: keep the query of probes (shows the attack) or not (recommended default: not).**

### D-4 Counts are estimates, and the view says so

Each sample has a weight: how many requests it stands for. Counts add weights, not samples, and the view labels them «estimated from samples», with the slices that were sampled, truncated or missing (D-2). At this site's traffic the weight is 1: every request is returned while a ten-minute slice holds 500 or fewer.

A visit is what spec 013's D-5 calls a page view: a `GET` allowed, on a page of the site (`readPagePath`) or of the layer for machines. The samples carry no response status for requests the origin answered (`ResponseCodeSent` exists only for the WAF's own responses), so spec 013's «answered 200 or 304» becomes «a path the site has»: visits are an **upper bound**. Crawlers are counted apart, as in spec 013. Bots that disguise themselves as browsers count as visits unless they hit a path the site does not have or a block; the reconnaissance and reputation labels seen in the metrics (E-05) are not in the samples (E-04), so they cannot be used per request. The view states these limits.

### D-5 A private bucket, records kept twelve months

A new private bucket (`BLOCK_ALL`, SSE-S3, TLS only), objects `samples/YYYY/MM/DD/HH.json` (one JSON array per hour) plus `state.json`, with a lifecycle rule that expires samples after 12 months. Twelve months, against spec 013's 90 days: spec 013 bounded at 90 days a log line that keeps the full user agent (its D-2); a record here keeps only the client's class and name, no IP, no user agent and the time in ten-minute slices, and the attack trend is more useful over a year. At about 170 records an hour a calm year is roughly 1.5 million records, about 150 MB; an attack adds at most 500 records per rule per slice (D-2), so a sustained flood on every rule is about 15,000 records an hour, still cents a month. The bucket is kept if the stack is deleted (`RETAIN`, as the site and match-log buckets). **Owner decision: 12 months (recommended) or 90 days.**

### D-6 The owner's own tests are marked, not guessed

`check:live`, the deploy checks and the `curl` probes of the docs send a user agent that ends in `obsidian-cube-check` (a constant shared by `scripts/check-live.mjs` and the collector's classifier); the collector classes them `owner-test`. Without an IP there is no other way to tell the owner's runs from a visitor, and they were most of the «human» traffic of the last weeks (E-02, E-03). The marker is public in the repository and anyone can send it, so `owner-test` is informational: it is shown apart, never trusted for anything else.

### D-7 The function is small and can only read the samples and write the bucket

`infra/lambda/waf-samples/` (the runtime the match-log receiver uses, Node.js 22, no dependencies beyond the SDK in the runtime), 128 MB, 60 s timeout, reserved concurrency 1, logs kept one month. It lives in the site's stack, deployed in **us-east-1** (a CloudFront-scope web ACL is only reachable from that region, and the stack is already there for the certificate), and its WAF client is pinned to us-east-1. The web ACL's ARN comes from the `webAclArn` context the stack already uses. Its role allows `wafv2:GetSampledRequests` on that web ACL's ARN (the action supports the `webacl` resource type) and `s3:GetObject`/`s3:PutObject` on its bucket only. A `WAFInternalErrorException` or throttling is retried with backoff inside the run; what still fails leaves the hour to the catch-up (D-2). No function URL, no route on the distribution. The logic lives in plain functions (`logic.mjs`) tested with Vitest, as the match-log receiver does.

### D-8 The admin reads the bucket like spec 013 reads logs

`VISITS_SOURCE=waf` and `VISITS_BUCKET` in `.env` (the bucket's stack output); the SSO profile as in spec 013's D-4. `GET /api/visits?days=` keeps its shape and gains the probes; the fixture gains sample records, so the view still runs with no AWS. The map, the days and the pages keep spec 013's design; the probes are a second panel: top paths, rules, countries and client classes, by day. The view shows the last completed hour and the sampled, truncated and missing slices of the range, so a stopped collector is visible the next time the owner looks; an alarm is not part of this spec.

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
| S1 | `logic.mjs`: a sample to a record (D-3), classes (D-6), slices, coverage and catch-up (D-2), retries (D-7), tests (no IP, no header, weights, paths by kind) | `npm test` |
| S2 | `WafSampleCollector` construct, schedule, role, bucket, lifecycle, behind `wafSamples`; `check:live`'s user agent | `cdk synth` with the switch on and off; infra tests on the role's actions and resources |
| S3 | `VISITS_SOURCE=waf` in the admin, the fixture's sample records, the probes panel; `check:admin` covers it | visual walkthrough of the admin |
| S4 | Gates, change audit, findings | `audit-1.md` |

## 6. Acceptance

1. A sample with an IP and headers becomes a record with neither; an allowed request on a known page keeps only the page; a probe keeps its path cut at 200 characters and a query only if D-3's option is on (unit tests).
2. Two adjacent runs read adjacent hours and never the same sample twice; a repeated run overwrites its hour; `state.json` advances only after the hour is written; a failed run is caught up by the next for the slices still inside three hours, and the rest is recorded as missing (unit tests over a fake schedule time).
3. A slice whose returned window is shorter than asked is recorded as truncated, one with more than 500 requests as sampled, and the view shows both; a `WAFInternalErrorException` is retried (unit tests).
4. `cdk synth -c wafSamples=true` produces one function in the site's stack with reserved concurrency 1, an hourly schedule, a role limited to `wafv2:GetSampledRequests` on the web ACL and `s3:GetObject`/`s3:PutObject` on its bucket, its WAF client set to us-east-1, and a private bucket kept on stack deletion that expires samples at the chosen retention; without the switch the template is unchanged (infra test).
5. With `VISITS_SOURCE` unset the view shows the fixture's visits and probes and the last completed hour; `npm run check:admin` finds them.
6. After the owner's deploy: the first hourly objects appear, their records carry no IP, and a `check:live` run shows as `owner-test`.
7. The definition-of-done gates pass, and the change audit's findings are verified (`audit-1.md`).

## 7. Cost and what the owner approves

720 runs a month of a few seconds (30 calls each) at 128 MB, inside Lambda's permanent free tier (1 million requests, 400,000 GB-seconds); EventBridge Scheduler's free tier is 14 million invocations a month; `GetSampledRequests` has no charge listed in the WAF pricing or the API reference. S3: about 1,500 puts a month (the hours and their state, under USD 0.01) and about 150 MB in a calm year (under USD 0.004 a month at the end of the year). CloudWatch Logs for the function: a few KB a day. The total stays around one cent a month. Under attack only the records grow, capped by the API at 500 per rule per slice (D-5); the calls and runs stay the same.

Before the deploy the owner approves: (a) D-3 (what a record keeps, and whether probes keep their query) and D-5 (retention); (b) the output of `npx cdk diff -c wafSamples=true` from `infra/` (a bucket, a function, its role, its log group and a schedule; the distribution and the web ACL do not change); (c) then sets `wafSamples` to `true` in `cdk.json` and deploys, and sets `VISITS_SOURCE=waf` and `VISITS_BUCKET` in `.env`.
