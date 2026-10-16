// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// CI invariants (audit-3 F-1, 2026-10-16): the gates run on every branch,
// whatever its prefix. Spec 011 was built on `concept/escenario` while the
// trigger only knew `main` and `feature/**`, so thirteen commits reached the
// acceptance audit with no CI run behind them.
const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8').replace(/\r/g, '')
const triggers = /^on:\n((?:(?: {2}.*)?\n)+?)(?=^\S)/m.exec(workflow)?.[1] ?? ''

describe('ci workflow', () => {
  it('runs on every push to any branch', () => {
    expect(triggers).toMatch(/^ {2}push:\n(?: {4}#.*\n)* {4}branches: \["\*\*"\]/m)
  })

  it('runs on pull requests and nightly', () => {
    expect(triggers).toMatch(/^ {2}pull_request:/m)
    expect(triggers).toMatch(/^ {2}schedule:/m)
  })
})
