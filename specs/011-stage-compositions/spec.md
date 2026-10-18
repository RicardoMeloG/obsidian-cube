# 011: Stage Layout and Editable Face Compositions — Proposal

**Status:** accepted (2026-10-15), built on the branch `concept/escenario` and merged into `main` on 2026-10-18. Entry decisions taken by the owner (section 7); ADR 008 accepted. S0 to S2 done, the drift audit after S2 resolved (audit-1.md); S3 done (2026-10-18, end to end with the owner's login on the local admin; the publish step waits for the content stage, see the slice); S4 done, the drift audit after S4 resolved (audit-2.md); S5 done; S6 met by S4; the drift audit before acceptance recorded (audit-3.md, 2026-10-16): its seven findings resolved the same day, except that the one line of result per face stays unchecked (F-3); acceptance itself waits for the owner's content (section 8, criterion 1) and the walkthrough a person looks at (criterion 4).
**Builds on:** the stage concept (`?layout=escenario`, commit `ae0b93d`), ADR 004 (admin on AWS), ADR 005 (content kernel), ADR 006 (frontend architecture).

## 1. Problem

The concept answered the design question: a different composition per face, with icons, images and cards, breaks the monotony of the two rails (owner, 2026-10-14). It did not answer how that content is owned. Today it cannot be edited, and it breaks the two-layer model:

| Id | Fact | Reproduce |
|---|---|---|
| E-01 | All stage content is TypeScript in `src/features/stage/conceptContent.ts` (566 lines): six bespoke types, one per face, with both languages inline. It would ship in the public repository, and the admin cannot see it. | `wc -l src/features/stage/conceptContent.ts` |
| E-02 | Part of it is filler written to judge the design (stacks, results, a `check:security` command that does not exist, the research thesis, "24–48 h"), and the four product screenshots in `public/concept/` were generated, not captured. | `docs/assets.md`, rows `concept/*` |
| E-03 | The admin edits three documents (`site.en`, `site.es`, `visual`) as raw JSON in a textarea, one face slice at a time, validated by the kernel. It has no media handling and no forms. | `server/admin/index.html`, `server/content/docs.ts` |
| E-04 | `src/features/stage` is outside the gates of the other DOM layers: `StageFaces.tsx` has 485 lines (the limit is 250, H-16), no boundary rule names the module, the layout check never opens `?layout=escenario`, and the menu's `aria-label` is a Spanish literal. | `scripts/checks/fileSize.test.ts`; `eslint.config.js`; `StageView.tsx:104` |
| E-05 | The first view is 10.9 KB over its budget (Lucide icons and the stage code). Resolved by S4 (S6). | `npm run check:budget` on the branch |
| E-06 | The stage contradicts three rules of `AGENTS.md`: the desktop layout is "cube centre, left rail, right rail, bottom strip"; "the cube does not disappear" (PRODUCTS covers it, RESEARCH nearly); and new features and admin functions "wait until the site is live" (ADR 007). | `AGENTS.md`, Experience Architecture and Hard Rules |

## 2. Outcome

The owner composes every face from the admin: chooses one of a fixed set of compositions, fills it with text in both languages, picks icons from a catalog and uploads images. Nothing about a face's content lives in code. The public repository holds the compositions, the schemas and neutral example content; the owner's text and images stay in the private layer. Every composition, filled to its limits, passes the layout and accessibility checks.

## 3. Architecture decisions

### AD-01 Compositions are templates with typed slots, not a page builder

A face's content is one of a fixed set of templates. A template is code (a component, its grid placement, its stacked order) with named, typed slots; the owner picks the template and fills the slots. Templates are not tied to a face. The first six come from the concept:

| Template | Concept face | Slots, in short |
|---|---|---|
| `showcase` | AGENTIC | heading, featured case (icon, label, title, text, chips, link), list of steps with icons, numbered proofs (icon, kind, title, text, chips), two CTAs |
| `catalog` | PRODUCTS | heading, items (name, meta, status, text, chips, image, thumbnail, facts with icons, links); the visitor selects an item |
| `case` | SYSTEMS | heading, case label and name, before and after lists, status map (cells: done, active, pending; legend), steps with icons, CTA |
| `ledger` | SECURITY | heading, callouts (icon, label, title, text), a console of rows (status, id, text), status labels, CTA |
| `reading` | RESEARCH | heading, question, chain (icon, label, text), distinctions (term, text), a document card, CTA |
| `channels` | CONTACT | heading, availability line, channels (kind, label, text); the request form arrives with the security stage (E-7) |

Alternatives: one bespoke type per face (the concept: a face cannot change its shape without code); free blocks on a grid (a page builder: no budget can prove a free layout fits, and it invites the drift `AGENTS.md` forbids). **Verified by:** the kernel schema is a discriminated union on `template`; every template has stress content in the layout check (AD-06).

### AD-02 Where each piece lives

The existing split holds: text by language in `site.{lang}.json`, language-free presentation in `visual.json`.

- `sections[].composition` in `site.{lang}.json`: the template id and its slots (text, item data, links, icon ids, image references with their `alt`). Each document validates on its own. A publish warning, not an error, flags a face whose two languages use different templates, so a template can be changed one language at a time.
- `sections[].tagline` in `site.{lang}.json`: the line under each face name in the dock.
- `identity.links` in `site.{lang}.json`: GitHub and LinkedIn URLs for the top bar (email is not shown; CONTACT is the channel).
- `faces[id].icon` in `visual.json`: the dock icon, next to the face's accent and world.
- Interface copy (`Explorar el cubo`, `Volver al contenido`, the top bar's link labels) is code, in `features/content/copy.ts` (AD-07 of spec 010). The counter (`01 / 06`) carries no words; its number format lives with the stage (`features/stage/motion.ts`, audit-2 F-2).
- Icons are a catalog in the kernel (`ICON_IDS`, data only), mapped to SVG components in the stage; the admin offers them as a list. The pattern of `FEATURE_GLYPHS`.

The rail fields (`features`, `flowTitle`, `flow`, `researchConcepts`) stayed while the rails existed (AD-05) and left the kernel with them in S4 (2026-10-15); a document that still has them loads, the schema drops them. Shared fields (`label`, `eyebrow`, `title`, `summary`, the CTAs, `detail`) are read by the stage in every mode, so a face is written once.

### AD-03 Images are owner content

`MediaRef = { src, alt, width, height }`. The owner uploads through the admin; the admin page resizes in the browser (canvas) to WebP, at most 1600 px wide plus a 320 px thumbnail, so neither the local server nor a future Lambda needs an image library. The server checks the bytes are WebP, the size and the dimensions, and stores the file under its content hash: `content/media/<hash>.webp`, gitignored locally like the rest of `public/content/`, and under `content/` in the site bucket in production (ADR 004: an upload is a presigned PUT to the drafts bucket; publish copies it). Example content uses neutral committed images under `public/examples/`, and the publish rules reject them in owner content, as they reject `Portfolio Owner`.

### AD-04 The admin's forms are generated from the kernel

`z.toJSONSchema()` turns the publishable schema of each document into JSON Schema (checked on 2026-10-15: enums become lists, minimums and required fields carry over). The server serves it (`GET /api/schema/:doc`) and the admin page renders it as a form: objects as groups, arrays as lists with add, remove and reorder, enums as selects, `meta({ widget: 'media' })` as an upload and picker, rich text as a text area that lists the allowed tags, `meta({ title })` as the Spanish label. The JSON view stays, as the advanced view. A field added to the kernel appears in the admin with no admin change, and the same page serves the Cognito admin of ADR 004, which only swaps the API it calls. **Verified by:** a unit test generates the JSON Schema of every document (no unsupported Zod type); a Playwright test loads the example documents into the form and saves them back unchanged.

### AD-05 One layout per mode

If E-1 is taken: the stage is the desktop experience, the rails retire from desktop in the same change, and stacked keeps the rails until the stage's stacked templates exist. `?layout=` remains only for review during the transition. Two desktop layouts are not maintained side by side.

### AD-06 Budgets per template, measured

`layoutBudgets.json` gains a `templates` section (visible characters and item counts per slot). The stress content fills every slot to its limit; the layout check renders every template in every layout mode and both languages, with axe. A budget changes only with a layout check run that proves the stress content still fits (the rule of `AGENTS.md`).

### AD-07 The stage is a DOM layer with the same rules

`features/stage` joins the boundary table (it must not import scene, audio, dev, app, three or R3F; it reads the experience store, content, ui and the kernel), the file-size limit (one file per template) and the copy rule.

## 4. Gates

| Rule | Gate |
|---|---|
| Every template renders the stress content within its area at every mode, no axe violation | `npm run check:layout` (H-06, H-13), extended to the stage |
| No content in code: the stage reads only the kernel's normalized content | Lint (`STAGE_TEXT` in `eslint.config.js`): no text of two words or more in the stage's JSX, no literal in `aria-label`, `title`, `alt` or `placeholder`. Single words written in markup and strings held in constants are left to review, **unchecked** (audit-1, F-2): a rule on every string literal also catches class names |
| JSON Schema generation covers every document | Unit test |
| The admin form round-trips the example documents | Playwright test on the admin page |
| Example media never published as owner content, nor data labelled as illustrative; a block without data (the `case` map, a `catalog` image) is left out, never filled with made-up data (2026-10-16) | Publish rules, unit test; `StageComposition.test.tsx`; `check:layout -- --content=stress` renders the stress content again without the optional blocks (audit-3 F-6) |
| DOM files ≤ 250 lines, boundaries, copy dictionary | `fileSize.test.ts`, `eslint.config.js`, `boundaries.test.ts` |
| First-view budget | `npm run check:budget`; a raise needs this spec to say why |

## 5. Slices

| Slice | Scope | Exit |
|---|---|---|
| S0 Decisions | Section 7 answered; ADR 008 accepted; `AGENTS.md`, the roadmap and `docs/architecture.md` amended | Documents merged (done 2026-10-15) |
| S1 Kernel | Icon catalog, `MediaRef`, the composition union with the six templates, `tagline`, `identity.links`, `faces[].icon`, template budgets, neutral example content in both languages with example images (`scripts/make-example-media.mjs`) | Schema, publish-rule and JSON Schema tests pass (done 2026-10-15; template budgets provisional until S2 measures them) |
| S2 Stage from content | `conceptContent.ts` removed (the stage reads it until this slice); one component per template, chrome and dock from content, copy dictionary, the stage under the boundary and size rules; layout check and stress content on the stage | All gates green on desktop and desktop-short (done 2026-10-15: the stage is the desktop default, `?layout=rails` for review; template budgets measured with the stress content on the full matrix; the right-hand blocks start at column 8, clear of the cube; first view still over budget, S6) |
| S3 Admin | Schema endpoint, generated form, media upload and picker (local disk), the cross-language warning | Round-trip test; an image uploaded, published and shown by the site locally (built 2026-10-15: `npm run check:admin` and the media store tests green. End to end on 2026-10-18 with the owner's login on the local admin, password and TOTP; the Cognito admin of ADR 004 is a later stage: on PRODUCTS, a `catalog` item got an uploaded image, the browser resized it, the server stored it with its thumbnail and the site at `localhost:5180` served it. Publishing was refused, correctly: the private content has no composition yet, so its faces fall back to the example's, which carries data labelled as illustrative, and three faces link no artifact. The first real publish, and the image shown by the site from it, is the exit of the content stage. The test was discarded: the private documents unchanged, the uploaded files removed) |
| S4 Stacked | Stacked order of each template; the rails retire (if E-1) | Layout check green on the full matrix (done 2026-10-15: the hero on stacked screens, the composition in reading order, the dock fixed at the bottom; the rails, the face strip, their CSS, their content fields and the research-concept dialog removed; `?layout=` gone) |
| S5 CONTACT world | The CONTACT background, today a placeholder (`contact` in `src/kernel/worlds.ts`), composed around the centred cube like the other five worlds (owner, 2026-10-15) | The world renders behind CONTACT in every layout mode; layout check and contrast of name and role green over it (built 2026-10-15: concept 2 of three generated with Codex, a channel network converging on the cube, always moving (owner); `contactNetwork.ts` holds the network and its composition tests. The layout pages run without WebGL, so their contrast was measured over the still image only: `check:layout` now also measures it over every world with the scene running. CONTACT passes in every mode. The pass found the SECURITY dome behind the role at 390×844 (4.23 in English, 2.90 in Spanish), a failure older than this slice: the top bar's veil on stacked screens now stays dense down through the role (owner's choice of three), and every face measures above 8 on stacked screens) |
| S6 Budget | Measure; replace or subset the icon library if it is the cause | `check:budget` green, or a raise justified here (met 2026-10-15 by S4: removing the rails brought the first view to 454.8 KB against 455.3 KB; the icon library stays) |

**Closing a slice** (owner, 2026-10-15): every gate of section 4 green, plus the visual walkthrough (`scripts/walkthrough.mjs`, `AGENTS.md` definition of done, item 5) looked at and its findings recorded in the commit. **Drift audits** (item 8): after S2 (the stage reads content; the biggest change to the architecture), after S4 (the rails retire) and before acceptance. Each is recorded as `audit-N.md` here and resolved before the next slice starts.

S1 closed on 2026-10-15 before this rule; its walkthrough ran the same day: the rails unchanged at the three viewports in both languages, the stage unchanged, no page errors.

## 6. Non-goals

A page builder; 3D worlds other than CONTACT's (S5); the contact form and the CV request (captcha and delivery), which belong to the security stage (E-7); the Cognito admin itself (ADR 004 slices); analytics.

## 7. Entry decisions (owner, 2026-10-15)

| Id | Question | Decision |
|---|---|---|
| E-1 | Does the stage replace the rails? | **(a)** yes: desktop now, stacked in S4. Two layouts would double every change and every check. |
| E-2 | Are templates free to use on any face? | **(a)** yes: a face can change shape from the admin without code. |
| E-3 | Must the cube stay visible on every face? | **(a)** yes: templates keep the centre clear (the `catalog` detail narrows, the `reading` column becomes lighter). The owner's condition for the stage (2026-10-14); "the cube does not disappear" stays. |
| E-4 | Images uploaded by the owner, private, resized in the browser? | **(a)** yes. |
| E-5 | Admin forms generated from the schemas? | **(a)** generated, JSON as the advanced view. |
| E-6 | Order against ADR 007 | **(a)** this spec before the content stage (ADR 008). |
| E-7 | The contact form | **Neither option.** The contact form, the CV request and its captcha are solved together with the rest of security in a stage of their own, the last before the release (ADR 008). The `channels` template ships without the form. |

Added by the owner at entry: the CONTACT background, a placeholder until now, is built in this spec (slice S5), so every face reaches the content stage with its final shape and world.

Outside audit (owner, 2026-10-16): of its seven-step plan, this spec takes only what belongs to it, because strong changes of direction now would cost visibility. Applied: the branches pushed; `deploy.yml` on demand only (it failed after every CI on main for lack of an AWS account); documents that still described the rails or contradicted the stage (the stage count in `specs/README.md`, the side panels in `AGENTS.md` and `docs/visual-direction.md`, the nesting rule written as the stage's one level of cards); the `case` map and `catalog` images optional, so a block without data is left out, and a publish rule against data labelled as illustrative; the drift audit judging the work against the objective. Everything else is weighed at the entry of its stage (`docs/roadmap.md`).

## 8. Acceptance

- The owner edits every face of the stage from the admin, in both languages, with no JSON hand-editing, including images and icons.
- `src/features/stage` contains no content: deleting the private documents shows the neutral example, never the owner's text.
- All gates green, the layout check covering every template with stress content in every mode and both languages.
- Visual check with Playwright at 1440 px or wider, 1366×768 and a 390 px phone (`AGENTS.md`, definition of done).
