# 013 — Build log

The feature code was written by a local model and reviewed by the agent acting as tech lead (owner, 2026-11-13). Main coder: `qwen3.8:27b` on Ollama (`127.0.0.1:11434`, think on unless noted, context 16384, all layers on the GPU, one model loaded at a time). Each round: a precise task with the relevant files, the model's files applied exactly as written, then tests, lint and the server type-check, and the failures plus the review sent back.

**Why not Codex.** The Codex CLI (0.167.0-alpha) in local mode (`--oss --local-provider ollama`, a separate `CODEX_HOME`, user config ignored) only opened `127.0.0.1:11434` while it ran, but refused the turn with «This chat uses ollama, but your current provider is openai», also with `model_provider="ollama"` forced. A tool that believes its provider is OpenAI cannot be verified as local-only, and the rule is that this repository never goes to OpenAI, so the rounds went through Ollama's HTTP API directly (option B).

| Round | Task given | What came back | Review |
|---|---|---|---|
| 1 | `server/visits/visitLog.ts` (parse a log line, page or asset or other path, human or crawler, summary) and its tests, from typed signatures and rules | Both files; lint and types clean; 29 of 30 tests | The failing test was right and the agent's asset rule was wrong: `/wp-login.php` has an extension, so it was dropped as an asset instead of counted as a scanner. New rule: assets by prefix or a list of static extensions; also validate `today` |
| 2 | Same file with the new asset rule, plus a test file for it | Correct; 38 tests pass | Accepted |
| 3 | The fixture, about 130 log lines typed out (think off) | Cut at the output limit after 99 lines, out of date order | Wrong approach (the agent's): 130 lines of user agents do not fit a model's answer. Changed to a generator |
| 4 | `scripts/make-visit-fixture.mjs`: deterministic generator (seeded PRNG), weighted countries, pages by language, crawlers, assets, scanners | Runs, deterministic, 186 valid lines with only the seven keys | Scanners written with status 403, against the requirement (200: the site answers unknown paths with its page), so the dashboard showed 0 other paths |
| 5 | Fix the scanner status | Fixed, with a comment on why | Accepted |
| 6 | `server/visits/visitSource.ts` (config from `.env`, fixture re-dated to today, S3 reader with the SSO profile, gzip) and tests with an in-memory S3 | Both files; 51 tests pass | Lint: an unused parameter in the fake. Review: `push(...lines)` spreads a whole log file as call arguments and overflows the stack on large files |
| 7 | Both fixes (think off) | Fixed exactly | Accepted |
| 8 | `VisitsService` (five-minute cache, errors without AWS details, SSO hint), `VisitsController` (`days` 7, 30 or 90), module registration, `ADMIN_PORT` | Service, controller, module and port accepted on reading | Test file: `Object.keys` over an array, a fake log line in a format that is not CloudFront's, unused parameters (lint) |
| 9 | Fix the service test | Tests pass (76) | The server type-check then failed: the controller's injected property and its route method shared the name `visits`; `.at()` is not in ES2021 |
| 10 | Both type fixes (think off) | Fixed; tests, lint and type-check clean | Accepted. The route answered on port 5192 with the fixture, `400` for `days=5`, `401` with a foreign `Origin`, and the framing headers unchanged |
