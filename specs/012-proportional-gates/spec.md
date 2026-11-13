# 012: Proportional Gates Before Every Push

**Status:** accepted and built (2026-11-13), in one slice; its own push audited in four rounds (`audit-1.md`), acceptance criteria 1 to 5 run by hand the same day. Owner's decision: process is proportional to what a change touches, and the level is read from the diff, not chosen by whoever pushes.
**Builds on:** spec 010 (the harness and its gates, H-08a), `AGENTS.md` (Working Method, definition of done).

## 1. Problem

The harness gates what a change does to the site, not what a push carries. The first changes after the public release showed three gaps:

| Id | Fact | Reproduce |
|---|---|---|
| E-01 | The Working Method asks for a spec and an independent audit only for large changes, and says of itself "Unchecked: enforced by review". A new script with filesystem, database and git side effects (`scripts/backup-content.mjs`) was pushed without an audit; the audit run afterwards found five real defects. | `AGENTS.md`, Working Method |
| E-02 | Nothing checks which files enter a commit. A local development file, excluded only through `.git/info/exclude`, entered a commit through `git add -A` and was pushed to the public repository. | `git ls-files -ci --exclude-standard` lists nothing, but only after the fact |
| E-03 | The pre-push privacy hook works only after `git config core.hooksPath .githooks` in each clone. The fresh clone made for the public repository did not have it until the gap was noticed. | definition of done, item 4 |

A spec for every adjustment would not have caught E-02, and it would cost a typo fix the same ceremony as a new subsystem, which is the reason the full Spec Kit flow was not adopted (`docs/roadmap.md`).

## 2. Outcome

Every push is classified by the paths it changes, and each level has its own gate, enforced by the pre-push hook:

| Level | When (any changed path matches) | Gate |
|---|---|---|
| Adjustment | Only documentation, specs, content examples or assets | The privacy check and the file checks below |
| Change | Code: `src/`, `server/`, `scripts/`, `infra/`, `.githooks/`, `.github/`, `package.json`, root configuration | Adjustment, plus an audit of the exact code diff by the two local models, recorded before the push |
| Large change | The contract or a gate: `src/kernel/`, `server/auth/`, `infra/lib/`, the security headers, the hooks, the push gate, the check scripts, the CI workflows, `eslint.config.js`, `AGENTS.md`, `docs/decisions/` | The audit when code changed, plus a commit message in the push that names its spec or ADR (`spec 012`, `ADR 009`) |

File checks, on every push: no added or modified file matches an ignore rule (`.gitignore` or `.git/info/exclude`), has a key, database or environment file name, or adds a line that carries a secret value (private keys, cloud and token formats, a URL with a password for a host other than this machine).

The hook enables itself: `npm install` sets `core.hooksPath` in a git clone.

## 3. Decisions

- **D-1 The level is read from the diff.** The paths decide, so no agent or person has to remember to ask for an audit. The path lists live in one module (`scripts/lib/push-gate.mjs`) with tests.
- **D-2 The audit is keyed to the diff it read.** `npm run audit:change` hashes the code diff between the push base and `HEAD` (lockfiles excluded), runs each model on its own and writes `audit-runs/change-<hash>.json`. The hook recomputes the hash; a change after the audit means a new audit. The models report; a person or the agent verifies every finding and fixes it or answers it in the commit, as for the drift audits.
- **D-3 Local, not CI.** The models run on the author's machine (`127.0.0.1:11434`); CI has none, so the audit gate is local and CI keeps the deterministic gates. `git push --no-verify` stays possible and is for the owner only, with the reason in the next commit.
- **D-4 The spec reference is a check, not a judgement.** For a large change the hook only checks that some commit message in the push names a spec or an ADR; whether that document fits the change is the audit's and the reviewer's job.

## 4. Non-goals

- A spec per change. Specs stay for work with decisions and acceptance criteria (Working Method).
- Judging code quality by the hook itself: the hook checks presence and identity of the audit, the models and the reviewer judge.
- Scanning the whole history on every push: `check:privacy --history` keeps that role before a repository is published.

## 5. Acceptance

1. A push that adds a file matched by `.git/info/exclude` is refused, naming the file.
2. A push that changes code without an audit of its exact diff is refused and prints the command to run; after `npm run audit:change` it passes, and after one more code edit it is refused again.
3. A push that changes a gate without naming a spec or ADR in its messages is refused.
4. A push of documentation only passes without an audit.
5. `npm install` in a clone leaves `core.hooksPath` set to `.githooks`.
6. The classification, the file checks and the spec reference are unit tested (`scripts/checks/pushGate.test.ts`), each with a case that breaks it.

## 6. Validation

The definition of done, plus each acceptance criterion run once by hand against the hook (`scripts/check-push.mjs` with the input git gives a pre-push hook), and this spec's own push passing through the gate it adds.
