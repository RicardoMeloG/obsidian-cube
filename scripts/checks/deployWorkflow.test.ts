// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Deploy invariants (spec 010, AD-11, H-14): the code deploy never deletes the
// admin's content, and never deletes hashed chunks an open page may still need.
const workflow = readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8')

// Each `aws s3 sync` command, with folded (>-) continuation lines joined.
const syncCommands = workflow
  .replace(/\r/g, '')
  .replace(/\n\s{10,}(?=\S)/g, ' ')
  .split('\n')
  .filter((line) => line.includes('aws s3 sync'))

describe('deploy workflow', () => {
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
