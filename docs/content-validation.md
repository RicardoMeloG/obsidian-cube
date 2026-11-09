# Content validation scope

Updated 2026-11-08 after a validation-source mistake: the local regression run and its walkthrough used the older published files. Their missing compositions were silently supplied by the committed examples. The owner's database drafts were only spot-checked separately. Those results did not accept the owner's six faces.

## What each run proves

- CI intentionally uses neutral examples and stress data. It checks reusable code, schemas, layout capacity and accessibility. It has no private owner content.
- The default local build reads the local published files, not the admin's database drafts. The absence of a composition is filled by an example. A title naming the owner does not prove the composition is theirs.
- Owner acceptance uses a separate private build from a fixed snapshot of all five admin documents. The snapshot's source and hashes are recorded in `review-manifest.json`. The same snapshot must supply the build-time HTML, machine pages and runtime JSON. Images are the actual uploaded files. The published files and database are not overwritten.

## Reviewing an owner snapshot

Keep the snapshot, build, manifest, logs and images outside the repository, beside the project. The manifest records `documents` (source and SHA-256), `faces` (one composition or explicit example fallback per face/language), and `warnings` from the admin's validate operation. A build produced from that snapshot carries the manifest at its root and the five unchanged JSON files in `content/`.

The private build can be selected explicitly:

```sh
node scripts/check-layout.mjs --content-report --out-dir="<private-build>"
node scripts/check-layout.mjs --full --out-dir="<private-build>" --require-complete-content
node scripts/check-budget.mjs --out-dir="<private-build>"
node scripts/report-objective.mjs --out-dir="<private-build>"
node scripts/walkthrough.mjs --out-dir="<private-build>" --output="<empty-private-review-directory>"
```

The layout check verifies the five document hashes against the manifest before running. It derives composition ownership and the fields filled from examples from the actual JSON, rather than trusting the manifest's face labels. `--content-report` reports that scope without starting a browser. With `--require-complete-content`, a missing manifest, an example composition fallback or unresolved publish warnings fails acceptance even when geometry is correct. Known layout debt is not applied to owner snapshots. The custom walkthrough directory must be empty; earlier evidence is preserved.

Record geometry/accessibility separately from content completion. The objective report checks links anonymously and the raw HTML/machine layer of the selected build; LinkedIn still needs a signed-out manual check. Add `--worlds` to the layout check when the scene/top-bar/veil changed or for stage acceptance, as required by `AGENTS.md`.

A successful technical run is not the owner's approval and is not the final security audit. Do not publish, rewrite history, remove reusable examples or mark content complete as a consequence of running these checks.
