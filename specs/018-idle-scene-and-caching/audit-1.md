# Audit 1 · spec 018, code diff

**Date:** 2026-11-16 · **Diff:** `b6d5dc4..d04045f` (10 code files, 4 parts) · **Record:** `audit-runs/change-61cab63226cfebc7.json` (local, gitignored)
**Models:** `qwen3.8:27b` (0 findings, 120 s) and `gemma4:31b` (4 findings, 120 s), one at a time, the GPU measured before each load (18.3 and 19.9 GB free).

Every finding was checked against the code.

| # | Model | Finding | Verdict |
|---|---|---|---|
| 1 | gemma | Setting `Cache-Control` on a 304 is redundant or incorrect | **Not real.** RFC 9111, section 4.3.4: the browser updates its stored response with the header fields of a 304, so a 304 should carry the `Cache-Control` the 200 would have carried. Without it, a revalidated asset would keep whatever it had before. |
| 2 | gemma | Array index as the React key of the sector meshes | **Not real.** The sectors come from `useMemo` on fixed ring options: always eight, in angle order, never reordered, inserted or removed. The index is their identity. |
| 3, 4 | gemma | `MAJOR_COLOR` and `MINOR_COLOR` are colour literals outside the tokens | **Not real.** The tokens rule covers the DOM layer; `scripts/check-tokens.mjs` exempts `src/features/scene/` by name (three.js materials take colour values), and `check:tokens` passes. The two values moved verbatim from `CubeScene.tsx`, where they were literals before. |

Result: no real finding; nothing to fix.
