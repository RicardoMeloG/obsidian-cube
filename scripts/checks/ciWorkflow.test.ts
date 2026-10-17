// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// CI invariants (audit-3 F-1, 2026-10-16): the gates run on every branch,
// whatever its prefix. Spec 011 was built on `concept/escenario` while the
// trigger only knew `main` and `feature/**`, so thirteen commits reached the
// acceptance audit with no CI run behind them.
const read = (name: string) => readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), 'utf8').replace(/\r/g, '')
const triggersOf = (workflow: string) => /^on:\n((?:(?: {2}.*)?\n)+?)(?=^\S)/m.exec(workflow)?.[1] ?? ''
const workflow = read('ci.yml')
const triggers = triggersOf(workflow)

describe('ci workflow', () => {
  it('runs on every push to any branch', () => {
    expect(triggers).toMatch(/^ {2}push:\n(?: {4}#.*\n)* {4}branches: \["\*\*"\]/m)
  })

  it('runs on pull requests', () => {
    expect(triggers).toMatch(/^ {2}pull_request:/m)
  })

  // While the site is being built (owner, 2026-10-16), until the release
  // stage's entry decides otherwise: the contrast over the worlds took 30 to
  // 36 minutes of a 40-minute run, and the nightly run re-checked an unchanged
  // main.
  it('runs the full matrix and the contrast over the worlds only on demand, and has no schedule', () => {
    expect(triggers).toMatch(/^ {2}workflow_dispatch:/m)
    expect(triggers).not.toMatch(/^ {2}schedule:/m)
    const layoutRuns = workflow.split('\n').filter((line) => line.includes('npm run check:layout'))
    expect(layoutRuns.length).toBeGreaterThan(0)
    for (const line of layoutRuns) {
      if (line.includes('--worlds')) expect(line).toContain("inputs.worlds && '--worlds'")
      if (line.includes('--full')) expect(line).toContain("inputs.full && '--full'")
    }
  })

  it('cancels a push run made stale by a newer push', () => {
    expect(workflow).toMatch(/^concurrency:\n {2}group: .*github\.ref.*github\.event_name.*\n {2}cancel-in-progress: true/m)
  })
})

describe('infra workflow', () => {
  it('synthesises the CDK stack only when infra/ changes', () => {
    const infra = read('infra.yml')
    expect(infra).toContain('npm run synth')
    for (const event of ['push', 'pull_request']) {
      expect(triggersOf(infra)).toMatch(new RegExp(`^ {2}${event}:\\n(?: {4}.*\\n)*? {4}paths: \\["infra/\\*\\*"`, 'm'))
    }
    expect(workflow).not.toContain('npm run synth')
  })
})
