# 013 — Audit 1

## Part 1: the spec, before the build

**Date:** 2026-11-13. **Auditors:** `qwen3.8:27b` (think on, context 16384) and `gemma4:31b` (think off, context 8192), each on its own, without prior context, given the Direction and Engineering Contract of `AGENTS.md` and the spec as proposed. qwen spent most of its answer budget thinking and returned four findings, the last one cut short; gemma returned six. Every finding was verified against the rules and the code.

| Id | Model | Finding | Verdict |
|---|---|---|---|
| S-1 | both | The SSO profile name `ricardo-admin` as a default in code identifies the owner | Partly real: the owner's name is public, but a local profile name is his configuration, not the project's. Fixed: no default in code; `VISITS_PROFILE` lives only in `.env` |
| S-2 | both | The raw user agent stays in S3 for 90 days; it is a fingerprinting input | Real as a question of minimisation. Answered in D-2 (no IP, cookie, query or request id, so a line joins nothing; no reduction is possible before delivery without a Lambda) and left to the owner's approval (section 7, a) |
| S-3 | qwen | `readPagePath` of «the kernel» is not defined, so the page-view rule is unverifiable | Real for a reader without the code. Fixed: D-5 names the file and what it accepts; the unit tests enumerate the paths |
| S-4 | qwen | D-8 does not say the framing headers still apply on another port | Not a defect (the headers are set on every response, `server/main.ts`), clarified in D-8 |
| S-5 | gemma | Scanner floods would grow the logs and the cost | Real but small: estimated in section 7 (a million requests ≈ 250 MB). A budget alarm is account-wide and stays out of this spec |
| S-6 | gemma | A local admin with an SSO profile cannot run as the production Lambda of ADR 004 | Not real: `AGENTS.md` keeps the local admin until ADR 004 is complete, and section 4 makes the Cognito dashboard a non-goal |
| S-7 | gemma | Building a feature breaks «build nothing more until the release» | Not real: the release happened on 2026-11-12; the rule held until then. The status line, which said «built» before the build, was corrected |
| S-8 | gemma | No test that the new route is not frameable | Not real: `noFraming` runs before every route and `server/noFraming.test.ts` covers it; acceptance 5 checks the headers on the running admin |

## Part 2: the change audit (`npm run audit:change`)

Each round audits the exact code diff of the branch against `main` (24 code files, 31 parts). Every finding was verified by reading the code; fixes were written by the local coder (`build-log.md`, rounds 20 to 22) and the audit run again.

### Round 1 (diff `3ede3eb81ec77d54`)

`qwen3.8:27b`: three findings in 589 s. `gemma4:31b`: no usable answer (one part returned no JSON), so the round does not count for the hook.

| Id | Model | Finding | Verdict |
|---|---|---|---|
| C-1 | qwen | `showVisits()` hides the language switch and `selectTarget()` never shows it again | Not real: `selectTarget()` still runs its own `langSwitch.classList.toggle('hidden', kind === 'visual')` after the lines quoted; `check:admin` leaves the view for a face and finds the editor back |
| C-2 | qwen | An empty `perDay` makes the day chart read `pd[0].key` of undefined and stops the render | Real, low (the server always sends at least 7 days). Fixed: the chart says «Sin datos en el rango.» |
| C-3 | qwen | The fixture's first line is a truncated fragment, not JSON | Not real: an artifact of the audit cutting a long hunk into parts; the file's 186 lines all parse (checked with `JSON.parse` per line) |

Found by the agent's own review in the same pass, fixed before the next round:

| Id | Finding | Verdict |
|---|---|---|
| R-1 | The S3 source collected every line of up to 90 days in one array before counting (about three million strings at a million requests a month) | Real, medium. Fixed: `createTally` counts line by line and `forEachS3Line` drops each object after reading it |
| R-2 | The 503 always suggested `aws sso login`, also for `NoSuchBucket` (seen against a missing bucket with the real SSO profile, a read-only call) | Real, low. Fixed: the SSO hint only for credential and token errors; otherwise it names `VISITS_BUCKET` and the profile's permissions |

### Round 2 (diff `92abb935758ea66e`)

`qwen3.8:27b`: two findings in 578 s, both repeats of round 1 and both not real for the same reasons: C-1 (the language switch, restored by `selectTarget`'s own toggle) and C-3 (a «truncated» first line of the fixture, again where the audit cut a hunk). `gemma4:31b`: no usable answer again. Running it part by part showed that it failed on exactly the 14 parts that carry `server/admin/world.json` (answers describing the map, empty answers or the context running out) and answered every other part. Decision D-10 of the spec: the generated shapes join the lockfiles in `AUDIT_EXCLUDE`, by exact path; their generator stays audited (test in `scripts/checks/pushGate.test.ts`).

### Round 3 (diff `9cc991c0be387169`, 17 parts)

Both models answered every part: `qwen3.8:27b` five findings in 420 s, `gemma4:31b` eleven in 282 s.

| Id | Model | Finding | Verdict |
|---|---|---|---|
| C-4 | both | `getWorld()` caches the body of `/world.json` without checking `r.ok`, so one failed load breaks every later render until a reload | Real, low. Fixed (round 24): an error is thrown and nothing is cached unless the body has `countries` and `other` |
| C-5 | gemma | The bucket policy allows writes only under `AWSLogs/<account>/CloudFront/`, but the destination is the bucket root | Not real by the documentation: with no destination prefix CloudFront writes under `AWSLogs/<account>/CloudFront/` plus the suffix path ([standard logging, S3](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/standard-logging.html#bucket-without-prefix)). Only a deploy proves it: the first check after the owner's deploy is that objects appear under that prefix (open as debt D-3 of the report) |
| C-6 | gemma | `.flat()` on MultiPolygon coordinates leaves rings, not points | Not real: the function returns the list of rings on purpose, and the loop walks each ring's points; the map was looked at in Chromium |
| C-7 | gemma | The stand-in API serves `visits.js` with no page that runs it | Not real: the stand-in serves `index.html` at `/`, which loads it |
| C-8 | gemma | `ADMIN_PORT`'s error message is in Spanish | Not real: the server's operator messages are Spanish (`appEnv.ts`, `devBypass.ts`); `copy.ts` is the public site's copy |
| C-9 | gemma | The fixture shows `/.env` answered 200: secrets exposed | Not real: the site answers unknown paths with its own page (spec 010, AD-09, known), and the fixture models exactly that scanner traffic; no `.env` is served |
| C-10 | gemma | `Date.UTC` with a negative day is fragile; `since` ignores daylight saving; a corrupt gzip crashes the process | Not real: `Date.UTC` normalises overflow by specification, UTC has no daylight saving, and `gunzipSync` throws inside the service's `try`, which answers 503 |
| C-1, C-3 | both | The language switch and the «truncated» fixture lines (repeated) | Not real (rounds 1 and 2) |
