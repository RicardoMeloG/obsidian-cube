# 022: Audit 1, the Draft

**Date:** 2026-11-22. **Auditor:** an agent without prior context (Claude Sonnet, as `AUDIT_MODELS=sonnet` sets for this period, spec 012). It read the spec and its text draft and checked them against `AGENTS.md`, ADR 002, ADR 009, `docs/visual-direction.md`, spec 010 and the code. It changed nothing and ran `check:privacy`, which found 0 findings.
**Verdict:** the draft needs revision before it is built; the concept needs no rework. The goal, the static pages, the clean addresses and the five cases with their commits were verified. Every finding below was checked against the repository by Claude before it was answered, and the spec and `content-draft.md` were revised the same day.

## Verified by the auditor

- All five cases exist on `main` and on GitHub, and each says what the draft says, after the rewording of cases 3 and 4 (F-3).
- Audit records number 16 and ADRs 9.
- The deploy approval is documented in `docs/deploy-aws.md`.
- `isAllowedHref` already accepts a site path.
- `clean-paths.cjs` already serves `/methodology` and `/es/metodologia`.
- The deploy's `sync` uploads the new HTML files.
- Neither file names an employer, a client or an e-mail address.

## Findings and answers

| Id | Severity | Finding | Checked | Answer |
|---|---|---|---|---|
| F-1 | high | A kernel renderer with a Markdown parser breaks the kernel's dependency rule. ADR 005 and `eslint.config.js` allow zod only. | Yes: the lint rule allows `zod` and relative imports only | §3.2: the renderer stays in the kernel and parses a fixed subset by hand, with no dependency. It fails on raw HTML and on syntax outside the subset. D-5 is added. |
| F-2 | high | "Inter, same palette" had no mechanism. A static sheet cannot name hashed files, and `check:tokens` refuses colour literals in `public/*.css`. | Yes: `seo-fallback.css` is exempted by name and uses `system-ui` | §3.2: the page is a second Vite entry whose stylesheet imports `tokens.css` and Inter, emitted hashed as for the app. D-6 is added, with the plain sheet as the alternative. |
| F-3 | high | Claims are false or overstated: "21 specs" (the repository has 14 folders), gates "before every push" (the hook runs privacy and the push gate only), a count of checks that mixes when they run, "none is skipped" (specs 009 and 016 have no audit), every commit named (only large changes are), Codex as a builder, and the wording of cases 3 and 4. | Yes, each one. Codex appears only in design reviews and image concepts. | The problem now says 14. Step 5 says what runs before the push, in CI and after a deploy. `{{checks}}` is removed (D-7). "None is skipped" is removed, and the gaps go to what the method does not prove. Step 7 is limited to large changes. Codex is described as design and concept help. Cases 3 and 4 are reworded to what their commits say. |
| F-4 | medium | The visual walk-through, grouped deploys and "no agent types credentials" have no record in the repository. | Yes | Each is labelled a working rule. Production cites `deploy-aws.md`. What the method does not prove now says the approval lives in GitHub. D-8 is added. |
| F-5 | medium | Files that must change were missing: the sitemap and its test, `sitePages()` (whose growth would reach `check:layout`), `visitLog.ts` `MACHINE_PAGES`, the dev server, `publicLinks` dropping relative links, and the documents that still call D-8 open. | Yes: `MACHINE_PAGES` is a fixed set (`server/visits/visitLog.ts`, line 13) | §3.3 adds a table of files touched with their level, including a separate `methodologyPages()` export and the document amendments. Stage 3 covers the documents. |
| F-6 | medium | The SVG under the content security policy, and how the figure is placed, were undefined. | Yes: `style-src 'self'` | §3.2: the SVG uses classes only, with no `style` attribute and no colour. It is placed by `{{figure:loop}}`, and its labels come from a dictionary per language. |
| F-7 | medium | The acceptance missed cases: JSON-LD is a script, links existing in the working tree are not yet on `main`, folder links need `/tree/`, `check:layout` was not named, the return and language links, `lang`, the sitemap, `llms.txt`, the visits view, and fixing the counting rules. | Yes | §7 was rewritten with each case. Folder links and commit links are covered in §3.2 and §5 (risks). |
| F-8 | low | `safeHref` is moot; "three to five cases" against "all five"; the audit numbering; JSON-LD should reuse the `#person` id; the header cites private pending items. | Yes | Each is fixed. The pending-item references are kept, as in the other public specs, with what each one means. |
| F-9 | low | Non-goals and risks: no cube or JavaScript toggle; dependence on hashes and GitHub URLs; numbers that move by themselves; the cases must match what the method does not prove. | Yes | §4 and the new §5 (risks). |

The auditor also suggested that the secondary call to action ("How I work"), which has no link, is the natural door to the page. D-3 now recommends it, and the primary keeps Iron Bastion.
