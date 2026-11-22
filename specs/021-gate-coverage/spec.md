# 021: The Large-Change Gate Covers Every Gate

**Status:** accepted by the owner (2026-11-21, pending item dt-42, point 4) and built in one slice. A change to the push gate, so a large change itself (spec 012): this spec, an independent audit of its diff (`audit-1.md`), and commits that name it.
**Builds on:** spec 012 (proportional gates), the drift audit of 2026-11-21 (finding 4).

## 1. Problem

The pre-push hook classifies a push by its paths (`scripts/lib/push-gate.mjs`). A large change, "the contract or a gate" in `AGENTS.md` (Working Method), must name its spec or ADR. The drift audit of 2026-11-21 found gates and infrastructure that the list of large-change paths (`MAJOR`) does not reach, so they pass as an ordinary change:

| Path | What it is | Today |
|---|---|---|
| `scripts/checks/` | The gate tests (file size, module boundaries, the push gate's own tests, the infrastructure plan, the edge functions) and their data: `budget.json`, the ratchet of `check:budget`, and `layout-known.json`, the known failures of `check:layout` | change |
| `scripts/lib/` | Libraries of the gates (diff chunks, the GPU guard, the web ACL comparison); only `push-gate.mjs` was listed | change |
| `infra/scripts/` | The infrastructure tests, the forbidden-resources gate among them (spec 014) | change |
| `infra/edge/` | The CloudFront functions: security headers, clean paths, the viewer address for the receiver's brake | change |
| `infra/lambda/` | The functions: the public match log receiver, the kill switch, the sample collector | change |
| `infra/cdk.json` | The stack's context: the web ACL, the certificate, the domains, the cost ceiling, the deploy subject | change |
| `infra/web-acl.expected.json` | The expected web ACL that `check:waf` compares with the live one (spec 016, P-2) | change |
| `server/appEnv.ts` and its test | Decides development or production, and so whether the admin's login bypass is allowed | change |
| `scripts/audit-*.mjs` | The change audit and the drift audit, the audit gate itself (they do not match `check-*.mjs`) | change |
| `infra/bin/` | The stack's entry point, which wires the context | change |
| `infra/visit-log-fields.json` | The fields the visit log may keep, guarded by `visitLogFields.test.ts` | change |

So a push could raise the limit in `budget.json`, mark a layout failure as known, loosen the file-size test or the forbidden-resources test, or change the public receiver, without naming a spec. `scripts/check-budget.mjs` says its limit "only goes down unless a spec raises it", and nothing enforced that.

## 2. Outcome

Each path of the table is a large change. A push touching one of them carries a commit message that names its spec or ADR, as spec 012 already asks of the rest of the contract. Nothing else changes: the audit of the code diff, the file checks and the privacy check stay as they are.

The cost is a line in a commit message. Every code change is already audited; a large change only adds the reference, so a test or a function changed for a reason the specs do not record is caught.

## 3. Design

- `MAJOR` in `scripts/lib/push-gate.mjs` gains `^scripts\/checks\/`, `^scripts\/lib\/` (replacing the single `push-gate.mjs` entry), `^infra\/scripts\/`, `^infra\/edge\/`, `^infra\/lambda\/`, `^infra\/cdk\.json$`, `^infra\/web-acl\.expected\.json$`, `^infra\/visit-log-fields\.json$`, `^infra\/bin\/`, `^scripts\/audit-[^/]+\.mjs$` and `^server\/appEnv(\.test)?\.ts$` (the last four added by the audit of the first build, `audit-1.md`).
- `scripts/checks/pushGate.test.ts` proves each new path is a large change, and that the paths around them stay what they were: a page component, an admin script, a content example.
- `AGENTS.md` (Working Method) and spec 012's table name the new paths.

## 4. Non-goals

- Gating `src/features/` or `server/` beyond `appEnv.ts`: they are product code, audited as a change.
- `package.json`, which wires the gate commands: a dependency bump touches it every time, and its scripts are read by every gate run, so a removed script fails loudly. It stays a change.
- `infra/scripts/prepare-cdk.mjs` counts as a large change although it is a build step, not a test: it pins and patches the CDK source (supply chain), so the ceremony fits.
- Moving the gates to CI: the hook can still be skipped with `--no-verify` (pending item dt-39, point 5); that is a separate decision.

## 5. Acceptance

1. `npm test` passes with the new cases in `pushGate.test.ts`.
2. A push that changes only `scripts/checks/budget.json` is classified as a large change: the test of `classify`, which `scripts/check-push.mjs` calls on the push's paths.
3. The change audit of this spec's diff is recorded in `audit-1.md`, every finding verified.
