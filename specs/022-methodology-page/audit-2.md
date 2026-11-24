# 022: Audit 2, the Built Diff

**Date:** 2026-11-24. **Auditor:** an agent without prior context (Claude Sonnet, as `AUDIT_MODELS=sonnet` sets for this period, spec 012). Round 1 read the diff `79e9bed..506a440`; round 2, by the same agent, read its fixes (`506a440..ea5bda6`). It changed nothing and did not build. The escape of R2-1 and this file came after, and were checked by Claude and the gates.
**Verdict:** no high finding. The renderer fails closed, and no injection or link bypass was found. Both languages say the same. Every finding was checked against the repository by Claude before it was answered.

## Verified by the auditor

- The five commits exist on `main` and say what the cases say. The ten repository links are tracked, in exact case.
- Specs 009 and 016 have no audit file. The build counted 14 specs, 17 audits and 9 ADRs (this file is one more audit).
- The production environment has one required reviewer, and only the upload job may ask for an AWS token.
- `sameAs` is unaffected, the sitemap has 16 entries, and `llms.txt`, the visit log and CU-13 and CU-15 know the pages.
- Both addresses answer 200 with the security headers, with JSON-LD as the only script.

## Findings and answers

| Id | Severity | Finding | Checked | Answer |
|---|---|---|---|---|
| F-1 | medium | "Confirmed ones are fixed": some stay as debt | Yes: spec 013, audit 1, C-11 | "fixed or recorded as debt" |
| F-2 | medium | "Every decision is written down in its public repository": pending work and priorities are in a private panel | Yes: `AGENTS.md`, rule 10 | "The decisions are written down"; the panel is named under what the method does not prove |
| F-3 | medium, uncertain | "Codex helps with design reviews" has no record | No: d0993d9, on `main`, is a review by Codex of twelve captures with sample content | Kept. Its input was captures, not the repository, so it agrees with spec 013's build log. Round 2 accepted it |
| F-4 | low, uncertain | "ten writes passed" proves little: ten is the per-IP limit | Yes | The case says what the test showed, the forged header, and the proof of the fix, the eleventh write refused (spec 016, D-1) |
| F-5 | low | The gate requires the record of an audit and does not run it; the live check after a deploy is manual | Yes: `check-push.mjs`, `deploy-aws.md` | Both reworded |
| F-6 | low | The large-change bullet leaves out the kernel | Yes | "the site's core" added |
| F-7a | medium | Nothing checks the built pages: a skipped render would ship an empty page | Yes | `generateBundle` requires the text and no executable script in each page. Proved by a mutation: with the render skipped, the build fails |
| F-7b | medium | `llms.txt` untested | Yes | Test added |
| F-7c | medium | A wrong folder would count zero in silence | Yes | A zero count fails the build |
| F-7d | low | The link test reads the disk: any case on Windows, untracked files too | Yes | It reads `git ls-files` |
| F-7e | low | Only counts in digits are caught; the 009 and 016 claim is untested | Yes | Test added for 009 and 016. A count typed in words is left to review |
| F-7f | medium | No gate opens the page for layout or contrast before a deploy | Yes | Debt. Measured by hand for this change (axe without violations at 320, 768, 1366 and 1920 px, smallest text 12.3 px); CU-15 checks 320 px after a deploy |
| F-8 | low | ADR 009 says the AGENTIC face links the pages; only its static text does | Yes | Reworded |
| R2-1 | low | A raw NUL byte in `methodology.test.ts` made git treat it as binary, so its diff could not be read | Yes | Written as the escape `\0` |
