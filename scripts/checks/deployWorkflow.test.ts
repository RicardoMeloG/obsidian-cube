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
// One job's block of the workflow, from its key to the next job.
const job = (name: string) => {
  const text = workflow.replace(/\r/g, '')
  const start = text.indexOf(`\n  ${name}:\n`)
  const next = text.slice(start + 1).search(/\n {2}\w[\w-]*:\n/)
  return next < 0 ? text.slice(start) : text.slice(start, start + 1 + next)
}

describe('deploy workflow', () => {
  it('deploys only on demand, never on its own (2026-10-16, until the release stage)', () => {
    const triggers = /^on:\n((?: {2}.*\n)+)/m.exec(workflow.replace(/\r/g, ''))?.[1] ?? ''
    expect(triggers.match(/^ {2}\w+/gm)).toEqual(['  workflow_dispatch'])
  })

  it('never removes, copies or moves anything onto content/ (audit-2 B-08)', () => {
    expect(s3Commands.filter((line) => /aws s3 (rm|mv|cp)\b/.test(line))).toEqual([])
    expect(workflow).not.toMatch(/aws s3api\b/)
  })

  it('builds from the published content of the live site, never the example (dp-04)', () => {
    const build = job('build')
    const fetch = build.indexOf('Fetch the published content')
    expect(fetch).toBeGreaterThan(build.indexOf('run: npm ci'))
    expect(fetch).toBeLessThan(build.indexOf('run: npm run build'))
    // The documents the build reads (vite.config.ts): both languages of the
    // site and the profile, and the visual document; a missing one fails.
    expect(build).toMatch(/for doc in site\.en site\.es profile\.en profile\.es visual; do/)
    expect(build).toContain('curl --fail')
    expect(build).toContain('"https://ricardomelog.com/content/$doc.json" -o "public/content/$doc.json"')
  })

  it('only the upload job, in the production environment, can get an OIDC token', () => {
    expect(workflow.replace(/\r/g, '').split('\njobs:')[0]).not.toContain('id-token')
    expect(job('build')).not.toMatch(/id-token|environment:|aws /)
    const upload = job('upload')
    expect(upload).toMatch(/^ {4}environment: production$/m)
    expect(upload).toMatch(/^ {6}id-token: write/m)
    expect(upload).toMatch(/^ {4}needs: build$/m)
    // It runs nothing from the repository: no checkout, no npm.
    expect(upload).not.toMatch(/uses: actions\/checkout|run: npm/)
    expect(job('build')).toMatch(/^ {4}if: github\.ref == 'refs\/heads\/main'$/m)
  })

  it('pins every action by commit', () => {
    for (const [, ref] of workflow.matchAll(/uses: [\w./-]+@(\S+)/g)) expect(ref).toMatch(/^[0-9a-f]{40}$/)
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
