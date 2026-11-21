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
  it('deploys only on demand, never on its own (2026-10-16, until the release stage)', () => {
    const triggers = /^on:\n((?: {2}.*\n)+)/m.exec(workflow.replace(/\r/g, ''))?.[1] ?? ''
    expect(triggers.match(/^ {2}\w+/gm)).toEqual(['  workflow_dispatch'])
  })

  it('never removes, copies or moves anything onto content/ (audit-2 B-08)', () => {
    expect(s3Commands.filter((line) => /aws s3 rm\b/.test(line))).toEqual([])
    expect(s3Commands.filter((line) => /aws s3 mv\b/.test(line))).toEqual([])
    expect(workflow).not.toMatch(/aws s3api\b/)
    // A copy may read the bucket (the owner's content, to build the pages),
    // never write it: the bucket is only ever the source, the word right
    // after `cp`, and no other word of the command names it.
    for (const command of s3Commands.filter((line) => /aws s3 cp\b/.test(line))) {
      const words = command.slice(command.indexOf('aws s3 cp') + 'aws s3 cp'.length).match(/"[^"]+"|\S+/g)!
      expect(words[0], command).toMatch(/s3:\/\//)
      expect(words.slice(1).filter((word) => word.includes('s3://')), command).toEqual([])
    }
  })

  it('builds without AWS credentials and takes the role again to upload', () => {
    const steps = workflow.replace(/\r/g, '')
    const drop = steps.indexOf('Drop the credentials for the build')
    const again = steps.indexOf('Configure AWS credentials again')
    expect(drop).toBeGreaterThan(steps.indexOf('Fetch the published content'))
    expect(drop).toBeLessThan(steps.indexOf('run: npm run build'))
    expect(again).toBeGreaterThan(steps.indexOf('run: npm run report:objective'))
    expect(again).toBeLessThan(steps.indexOf('Upload hashed assets'))
    for (const name of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN']) expect(steps).toContain(name)
  })

  it('pins every action by commit', () => {
    for (const [, ref] of workflow.matchAll(/uses: [\w./-]+@(\S+)/g)) expect(ref).toMatch(/^[0-9a-f]{40}$/)
  })

  it('builds from the published content read from the bucket, never the example (dp-04)', () => {
    const steps = workflow.replace(/\r/g, '')
    const fetch = steps.indexOf('Fetch the published content')
    expect(fetch).toBeGreaterThan(steps.indexOf('Configure AWS credentials'))
    expect(fetch).toBeLessThan(steps.indexOf('run: npm run build'))
    // The documents the build reads (vite.config.ts): both languages of the
    // site and the profile, and the visual document.
    expect(steps).toMatch(/for doc in site\.en site\.es profile\.en profile\.es visual; do/)
    expect(steps).toContain('"s3://${{ vars.SITE_BUCKET }}/content/$doc.json" "public/content/$doc.json"')
  })

  it('runs only from main, in the production environment that asks the owner', () => {
    expect(workflow).toMatch(/^\s+environment: production$/m)
    expect(workflow).toMatch(/^\s+if: github\.ref == 'refs\/heads\/main'$/m)
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
