# Audit 1 · spec 020, draft and build

**Date:** 2026-11-21 · **Diffs:** the draft `08a2d15..b2d0671` and the build `b2d0671..c6eeca3` · **Records:** `audit-runs/change-73d0b68183cd440e.json` and `audit-runs/change-46cda31c5cb29f4e.json` (local, gitignored)
**Auditors:** independent Claude Sonnet subagents with no prior context, in place of the local models (owner, 2026-11-19: Sonnet audits until further notice, the GPU is in use). Claude Opus checked every finding against the code or the AWS documentation.

Recorded on 2026-11-21 by the drift audit of the same day, which found the record missing although the spec's slice table (S4) and acceptance criterion 7 name it.

| # | Stage | Finding | Verdict |
|---|---|---|---|
| 1 | Draft | The sampling was described as a uniform sample of every request; `GetSampledRequests` returns a random sample from the first 5,000 requests of each window, and a busier window comes back shorter. Also the region (the plan's web ACL lives in `us-east-1`), races between runs, the privacy of a path, and visits as an upper bound | **Real, high.** Fixed in `b2d0671`: ten-minute slices, each with a status (`complete`, `sampled`, `truncated`), the region fixed, one run at a time (reserved concurrency 1, no retry), paths without query and cut at 200 characters, and the counts shown as weighted estimates |
| 2 | Build | A rule in Count mode was counted again as a block; the owner's test mark hid blocked probes that carried it; `HEAD` and `OPTIONS` on a real page counted as probes; one unreadable timestamp failed the whole hour; a 60 s timeout was tight for catching up three hours; the check's fetch wrapper replaced the caller's headers instead of merging them | **Real, medium.** Fixed in `323f185` (and the test in `c6eeca3`): Count records are skipped, the mark sets a request apart only when it was allowed (the mark is public, D-6), other methods on a page are neither a view nor a probe, a bad timestamp drops that record only, the timeout is 180 s, and the wrapper merges through `Headers` |
| 3 | Build | If the state write fails after the hour was written, the next run reads that hour again, and slices older than three hours come back as `missing` | **Real, low; accepted.** The hour object is overwritten, never appended, so nothing is counted twice; the cost is a coverage gap the admin shows as such. A failed write also shows in the function's errors |

Result: two findings fixed before the deploy, one accepted. The definition-of-done gates passed on `main` before the deploy (`447f18d`, `0568491`).
