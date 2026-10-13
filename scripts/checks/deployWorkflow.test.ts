// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Deploy invariants (spec 010, AD-11, H-14): the code deploy never deletes the
// admin's content, and never deletes hashed chunks an open page may still need.
const workflow = readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8')

// Each S3 command, with folded (>-) continuation lines joined.
const s3Commands = workflow
  .replace(/\r/g, '')
  .replace(/\n\s{10,}(?=\S)/g, ' ')
  .split('\n')
  .filter((line) => line.includes('aws s3 '))
const syncCommands = s3Commands.filter((line) => line.includes('aws s3 sync'))

describe('deploy workflow', () => {
  it('deploys only on demand or after a green CI run (audit-2 B-08)', () => {
    expect(workflow).not.toMatch(/^\s*push:/m)
    expect(workflow).toMatch(/workflow_run:\s*\n\s*workflows: \[CI\]/)
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'")
  })

  it('never removes, copies or moves anything onto content/ (audit-2 B-08)', () => {
    expect(s3Commands.filter((line) => /aws s3 rm\b/.test(line))).toEqual([])
    expect(s3Commands.filter((line) => /aws s3 (cp|mv)\b/.test(line) && line.includes('content'))).toEqual([])
  })

  it('syncs to S3', () => {
    expect(syncCommands.length).toBeGreaterThan(0)
  })

  it('never deletes or uploads content/ in a sync that deletes', () => {
    for (const command of syncCommands.filter((line) => line.includes('--delete'))) {
      expect(command).toContain('--exclude "content/*"')
      expect(command).toContain('--exclude "assets/*"')
    }
  })

  it('uploads assets before the HTML that references them, without deleting', () => {
    const assetsIndex = syncCommands.findIndex((line) => line.includes('dist/assets/'))
    const siteIndex = syncCommands.findIndex((line) => line.includes('--delete'))
    expect(assetsIndex).toBeGreaterThanOrEqual(0)
    expect(syncCommands[assetsIndex]).not.toContain('--delete')
    expect(assetsIndex).toBeLessThan(siteIndex)
  })
})
