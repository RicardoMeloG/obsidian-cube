# 022: The Methodology Page

**Status:** accepted (2026-11-24) and built; the deploy and the link from AGENTIC (stage 4) remain. Drafted and audited on 2026-11-22. The owner took decision D-8 of spec 010 on 2026-11-21: the page exists (pending-work panel, item dt-44, point 18). It is a large change, since it touches the kernel, the build and the visit log. The owner took D-1 to D-8 of §8 as recommended on 2026-11-24.
**Builds on:** ADR 002 (evidence before spectacle; "the site is its own case study"), ADR 005 (a pure kernel), ADR 009 (clean addresses, the layer for machines), spec 010 §5.9 (routes, AD-08), `docs/visual-direction.md` (Deep-dive Pages).
**Audit:** `audit-1.md`, the audit of this draft by an agent without context, with the verdict on each finding. **Text:** `docs/methodology/`, from `content-draft.md`.

## 1. Problem

The AGENTIC face says the site was built with agents under specs, gates and audits without context. The proof is real but scattered: 14 specs, 16 audit records, 9 ADRs, a pre-push gate and the CI gates, spread across a repository a recruiter will not read. Today the face's primary call to action leads to another project's `AGENTS.md` (Iron Bastion). The secondary one ("How I work") has no link. The proof "Audits without context" links nothing (pending item dt-37, point 3).

`AGENTS.md` has promised this page since ADR 002: "the methodology deep-dive explains how this site was built with agents: decisions, gates, what went wrong."

## 2. Outcome

Two static pages, `/methodology` and `/es/metodologia`. A person reads them in about five minutes, and a crawler reads them without JavaScript.

1. **The loop**, in one diagram and seven steps: spec, audit without context, revision, build, gates, a person looks, a commit that names its spec. Each step links a real file that shows it.
2. **Proportional gates:** adjustment, change and large change; what decides the level; and which gates run where (before the push, in CI, after a deploy).
3. **Where a person decides.** Each item names whether it is enforced (and where) or a working rule.
4. **What went wrong:** the five cases of `content-draft.md`, each with its public commit.
5. **What it does not prove**, stated plainly. This includes the gaps between the stated loop and the record: specs 009 and 016 have no audit file, and the owner can skip the hook.
6. **Numbers counted at build time, never typed:** specs, audit records and ADRs (§3.2). A typed count went stale on a card (dt-37, point 4).

The AGENTIC face's calls to action point to the page, and so does the proof "Audits without context" (D-3).

## 3. Design

### 3.1 Where the text lives (D-1)

The text describes the method, and every claim links to a file in this repository. It is not personal content. It lives in `docs/methodology/methodology.en.md` and `methodology.es.md`, reviewed like any document and versioned with the evidence it cites. The owner corrects it there; the admin plays no part.

**Alternative:** a content document edited in the admin (spec 011). Rejected for now: the text cites the repository's files and changes with them, and the admin's content stays out of Git.

### 3.2 Rendering (D-5, D-6)

- **The renderer is in the kernel and has no dependency** (D-5). `src/kernel/seo/renderMethodology.ts` is pure: it parses a fixed Markdown subset by hand and fails on anything outside it, so the kernel keeps depending on zod only (ADR 005; the lint rule in `eslint.config.js`). The subset is:
  - `#` to `###` headings;
  - paragraphs;
  - ordered and unordered lists, one level deep;
  - `**bold**`, `` `code` `` and links.

  Raw HTML is not part of the subset and fails the build. A third-party Markdown parser is the alternative, rejected: it needs a kernel exception (an ADR 005 amendment), a dependency and its audit, for a dozen syntax rules.
- **Links.** A link is written relative to the Markdown file (`../../`), so it also works where GitHub shows it, and becomes an absolute GitHub link on `main`: `/blob/` for a file, `/tree/` for a folder. A link to a site path stays relative. Every link passes `isAllowedHref` (`src/kernel/links.ts`).
- **The page goes through Vite** (D-6). `methodology.html` is a second HTML entry of the build (`build.rollupOptions.input`). It links a stylesheet, `src/methodology/methodology.css`, that imports `tokens.css` and Inter's latin file. Vite emits both hashed, as for the app, so the page shares the palette and the font through the same files and `check:tokens` needs no exemption. The entry has no module script; the build fails if the emitted page has a `<script>` other than JSON-LD. The Spanish page is written in `generateBundle` from the same processed template.
- **Head.** Each page has the same head as the face pages:
  - title, description and canonical;
  - the `hreflang` pair and the share image;
  - JSON-LD `TechArticle` whose `author` is the `#person` `@id` of the profile page, so the author stays one entity.
- **The loop diagram** is an inline SVG built by the renderer. The Markdown places it with a marker, `{{figure:loop}}`. Its labels come from a typed dictionary per language, its text is real SVG text so crawlers read it, and it is styled by classes defined in `methodology.css`. It has no `style` attribute and no colour value, because the content security policy has no `unsafe-inline` and `check:tokens` refuses colour literals.
- **Counts.** `vite.config.ts` counts the repository and hands the numbers to the renderer:
  - **specs:** `specs/NNN-*/` folders;
  - **audits:** `specs/*/audit-*.md` files;
  - **adrs:** `docs/decisions/NNN-*.md` files.

  The Markdown names them as `{{specs}}`, `{{audits}}` and `{{adrs}}`, and an unknown placeholder fails the build. There is no count of checks: no single list of checks is honest (some run before the push, some in CI, some after a deploy), so the text names them by where they run (D-7).
- **Development.** A middleware renders `/methodology` and `/es/metodologia` on each request, as `machineLayer` does for its files. Without it, the dev server would answer with the cube.

### 3.3 Files touched

| File | Change | Level (spec 012) |
|---|---|---|
| `src/kernel/seo/renderMethodology.ts`, `methodologyMarkdown.ts`, `methodologyFigure.ts` and their test | new: head and body, Markdown subset, diagram | large (kernel) |
| `methodology.html` | new: the second entry's template | change |
| `scripts/checks/methodology.test.ts` | new: the links exist, both languages match, no typed count | large (a check) |
| `src/kernel/sitePaths.ts` | `methodologyPages()`: the two paths and files, a second export kept apart from `sitePages()`, so `check:layout` and `check:budget` do not open them as cube pages | large |
| `src/kernel/seo/crawlFiles.ts` and its test | the sitemap adds the pair, with its own `hreflang` alternates | large |
| `src/kernel/seo/renderMachine.ts` | `llms.txt` lists the page | large |
| `src/kernel/seo/renderSeo.ts` | the AGENTIC face's static text links the page; `publicLinks` drops relative links today, so a site path is turned into an absolute link | large |
| `server/visits/visitLog.ts` | `MACHINE_PAGES` gains the two paths, so the visits view counts them (spec 013) | change |
| `vite.config.ts` | the second entry, the Spanish page, the counts, the dev middleware | change |
| `src/methodology/methodology.css` | new | change |
| `docs/methodology/*.md` | new: the text | adjustment |
| `docs/live-use-cases.md`, `scripts/check-live.mjs` | a new case, CU-15: both addresses answer 200, `text/html`, with the security headers. CU-13 counts the sitemap's pages: sixteen, not fourteen | large (a check) |
| Docs | spec 010 D-8 (taken); `AGENTS.md` (D-8 no longer open); `visual-direction.md` ("none exist yet"); `docs/architecture.md`; ADR 009 and `crawlFiles.ts` ("fourteen pages") | adjustment, except `AGENTS.md` (large) |

The edge needs no change: `clean-paths.cjs` already serves `/methodology` from `methodology.html`, and the deploy's `sync` uploads every built file except `content/` and `assets/` already present.

### 3.4 Links from the cube (D-3)

The AGENTIC face's calls to action and the proof "Audits without context" are content: the owner changes them in the admin once the page is live. `isAllowedHref` already accepts a site path. `publishRules.ts` is checked to make sure it does too.

## 4. Non-goals

- A router, client-side navigation, the cube, or a JavaScript language toggle on the page. The language link is a plain link, and spec 010 §5.9 still holds.
- A blog, a project archive or a research index: each one is its own decision.
- Anything about the owner's employer or clients, or the work on a client's legacy system. The privacy check refuses those names, and the page speaks only of this repository and Iron Bastion.
- Analytics on the page beyond what the site already logs (specs 013 and 020).
- Translating the specs: the page is the summary, and the specs stay in English.

## 5. Risks

- **Links depend on GitHub.** The text cites commit hashes and GitHub's URL scheme. History was rewritten once (dt-24), and a rewrite would break the commit links; the link test catches files, not commits.
- **The numbers move by themselves.** They change when a spec or an audit is added, with no one editing the page. That is intended, but the prose must never type a number.
- **The claims must match the record.** Each rule the page states names where it is enforced, or says it is a working rule. Section 5 of `content-draft.md`, what it does not prove, carries the gaps.

## 6. Stages

1. **Decisions and text:** the owner decides §8 and corrects `content-draft.md`. It becomes the two Markdown files.
2. **Renderer and page:** the files of §3.3, with their tests. Visual check at 320, 768, 1366 and 1920 px.
3. **Documents:** the amendments of §3.3.
4. **Link:** the owner points the AGENTIC calls to action to the page in the admin. It ships in the next grouped deploy.

## 7. Acceptance

1. `npm run build` writes `methodology.html` and `es/metodologia.html`. Neither has executable script; JSON-LD is the only `<script>`. Each has the `lang` of its language.
2. Each page has a title, description, canonical, the `hreflang` pair, valid JSON-LD with the `#person` author, a link back to the site and a link to the other language (`renderMethodology.test.ts`).
3. The renderer fails on raw HTML, an unknown placeholder and syntax outside the subset (tests).
4. The counts equal the repository's at build time. A test fixes the counting rules against a fixture tree.
5. Every repository link resolves to a file or folder that exists in the working tree (test). Before the push that publishes the page, the cited files are on `main`.
6. The sitemap lists the pair with its alternates. `llms.txt` lists the page, and the visits view counts both paths (tests).
7. `check:privacy`, `check:tokens`, `check:budget` and `check:layout` pass. The cube's first view does not grow.
8. Body text meets AA (4.5:1), and no text is under 12 px on a phone (dt-43).
9. After the deploy, the new case of `check:live` passes for both addresses.
10. The change audit of the built diff is recorded in `audit-2.md`.

## 8. Decisions for the owner

Taken on 2026-11-24: all eight as recommended. The text was corrected where the record contradicted the draft (`content-draft.md` stays as drafted):

- "finds them before they reach anyone": cases 1 and 5 were found in production;
- "two early specs": they are 009 and 016, and 016 is of 2026-11-19;
- an audit "judges against its goal, not against the code": the audits read the code too;
- "layout at every screen size" in CI: the full matrix runs on demand only;
- production: the approval in GitHub covers the code; content and infrastructure go out from the owner's machine.

| Id | Decision | Options | Recommendation |
|---|---|---|---|
| D-1 | Where the text lives | (a) Markdown in the repository; (b) a content document in the admin | (a): it cites the repository and changes with it |
| D-2 | Spanish address | `/es/metodologia`, in the faces' style | Yes |
| D-3 | AGENTIC's calls to action | (a) the secondary call to action ("How I work"), which has no link today, and the proof "Audits without context" point to the page, while the primary keeps Iron Bastion; (b) the primary points to the page | (a): the secondary is the natural door to the method, and Iron Bastion stays one click away |
| D-4 | The "what went wrong" cases | Which of the five in `content-draft.md` are published | All five, as reworded after the audit |
| D-5 | The Markdown renderer | (a) by hand in the kernel, subset only; (b) a parser outside the kernel | (a): no dependency, and ADR 005 stays intact |
| D-6 | Styling and font | (a) a Vite entry that shares `tokens.css` and Inter; (b) a plain sheet with `system-ui` and an exemption in `check:tokens` | (a): "same typography, same palette" (`visual-direction.md`) |
| D-7 | What is counted | specs, audits and ADRs; checks named by where they run, without a number | As written |
| D-8 | Working rules on the page | Rules the repository does not enforce (credentials, grouped deploys, the visual walk-through) appear as working rules, labelled as such | Yes: the page claims only what it can show |
