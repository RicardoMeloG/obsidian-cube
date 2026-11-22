// @vitest-environment node
// The proportional gates of a push (spec 012): each rule with a case that
// breaks it and one that passes.
import { describe, expect, it } from 'vitest'
import { addedLines, classify, diffHash, namesSpec, privateIdentities, SECRET_NAME, secretLines } from '../lib/push-gate.mjs'

describe('classify', () => {
  it('documentation only is an adjustment', () => {
    expect(classify(['README.md', 'docs/roadmap.md', 'specs/012-proportional-gates/spec.md', 'public/examples/a.webp']).level).toBe('adjustment')
  })

  it('code is a change and lists the code files', () => {
    const result = classify(['README.md', 'scripts/backup-content.mjs', 'package.json', 'vite.config.ts'])
    expect(result.level).toBe('change')
    expect(result.code).toEqual(['scripts/backup-content.mjs', 'package.json', 'vite.config.ts'])
  })

  it('lockfiles alone need no audit', () => {
    expect(classify(['package-lock.json', 'infra/package-lock.json'])).toMatchObject({ level: 'adjustment', code: [] })
  })

  it('map shapes alone need no audit, but their generator does', () => {
    expect(classify(['server/admin/world.json'])).toMatchObject({ level: 'adjustment', code: [] })
    expect(classify(['server/admin/world.json', 'scripts/build-world-map.mjs']).code).toEqual(['scripts/build-world-map.mjs'])
  })

  it('the contract and the gates are a large change', () => {
    for (const path of ['src/kernel/siteContent.ts', 'server/auth/totp.ts', 'infra/lib/static-site-stack.ts', '.githooks/pre-push', 'scripts/check-privacy.mjs', 'scripts/lib/push-gate.mjs', '.github/workflows/ci.yml', 'AGENTS.md', 'docs/decisions/010-x.md']) {
      expect(classify([path]).level, path).toBe('large change')
    }
  })

  it("the gates' tests and data, their libraries, the functions and the stack context are a large change (spec 021)", () => {
    for (const path of ['scripts/checks/budget.json', 'scripts/checks/layout-known.json', 'scripts/checks/fileSize.test.ts', 'scripts/lib/web-acl.mjs', 'infra/scripts/forbidden-resources.test.mjs', 'infra/edge/clean-paths.cjs', 'infra/lambda/match-log/brakes.mjs', 'infra/cdk.json', 'infra/web-acl.expected.json', 'infra/visit-log-fields.json', 'infra/bin/infra.ts', 'scripts/audit-change.mjs', 'scripts/audit-drift.mjs', 'server/appEnv.ts', 'server/appEnv.test.ts']) {
      expect(classify([path]).level, path).toBe('large change')
    }
  })

  it('product code around them stays an ordinary change (spec 021)', () => {
    for (const path of ['src/features/stage/StageView.tsx', 'server/admin/visits.js', 'server/visits/wafSamples.ts', 'scripts/backup-content.mjs', 'infra/package.json', 'infra/tsconfig.json', 'server/main.ts']) {
      expect(classify([path]).level, path).toBe('change')
    }
    expect(classify(['public/content/site.example.en.json']).level).toBe('adjustment')
    expect(classify(['infra/package-lock.json']).level).toBe('adjustment')
    // A gated file with excluded generated data: still large, and the data is not audited.
    expect(classify(['scripts/checks/budget.json', 'server/admin/world.json'])).toMatchObject({ level: 'large change', code: ['scripts/checks/budget.json'] })
  })

  it('a large change of documents only has no code to audit', () => {
    expect(classify(['AGENTS.md'])).toMatchObject({ level: 'large change', code: [] })
  })
})

describe('file names', () => {
  it('refuses keys, databases and environment files', () => {
    for (const path of ['.env', '.env.local', 'server/.env.production', 'certs/site.pem', 'a/id_ed25519', 'backup.sql', 'data/admin.sqlite', 'vault.kdbx']) {
      expect(SECRET_NAME.test(path), path).toBe(true)
    }
  })

  it('lets the committed example and ordinary files through', () => {
    for (const path of ['.env.example', 'src/kernel/env.ts', 'docs/sql-notes.md', 'server/auth/keys.ts']) {
      expect(SECRET_NAME.test(path), path).toBe(false)
    }
  })
})

const diff = (file: string, ...lines: string[]) => [`diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`, '@@ -1 +1 @@', ...lines].join('\n')

describe('secret values', () => {
  it('reads only added lines, with their file', () => {
    expect(addedLines(diff('a.ts', '-old', '+new', ' same'))).toEqual([{ file: 'a.ts', text: 'new' }])
  })

  it('refuses a password in a remote URL, a token and a private key', () => {
    for (const line of [
      "+const url = 'postgres://admin:" + "s3cret@dbhost:5432/app'",
      '+token = ghp_' + 'a'.repeat(36),
      '+-----BEGIN OPENSSH ' + 'PRIVATE KEY-----', // split, so this file is not a secret itself
      '+key: AKIA' + 'B'.repeat(16),
    ]) {
      expect(secretLines(diff('x.ts', line)), line).toHaveLength(1)
    }
  })

  it('allows names of secrets and local development URLs', () => {
    for (const line of [
      "+process.env.DATABASE_URL || 'postgres://obsidian:obsidian@localhost:5433/obsidian_cube'",
      '+SESSION_SECRET=change-me',
      "+const remote = 'https://github.com/RicardoMeloG/obsidian-cube'",
      '-removed ghp_' + 'a'.repeat(36),
    ]) {
      expect(secretLines(diff('x.ts', line)), line).toHaveLength(0)
    }
  })
})

describe('commit identities (dt-24)', () => {
  it('lets only the GitHub noreply address sign a public commit', () => {
    const noreply = 'Ricardo Melo <49494594+RicardoMeloG@users.noreply.github.com>'
    expect(privateIdentities([noreply, 'Ada <ada@users.noreply.github.com>', 'GitHub <noreply@github.com>'])).toEqual([])
    expect(privateIdentities([noreply, 'Ada <ada@example.com>', 'Ada <ada@users.noreply.github.com.example.com>', 'Ada <noreply@github.com>'])).toEqual([
      'Ada <ada@example.com>',
      'Ada <ada@users.noreply.github.com.example.com>',
      'Ada <noreply@github.com>',
    ])
  })
})

describe('spec reference', () => {
  it('accepts a message that names a spec or an ADR', () => {
    expect(namesSpec(['feat(stage): stacked screens (spec 011, S4)'])).toBe(true)
    expect(namesSpec(['docs: ADR 009 for the machine layer'])).toBe(true)
  })

  it('refuses messages that name neither', () => {
    expect(namesSpec(['fix: small thing', 'chore: specification of nothing'])).toBe(false)
  })
})

it('the audit key changes with the diff', () => {
  expect(diffHash('a')).toBe(diffHash('a'))
  expect(diffHash('a')).not.toBe(diffHash('a '))
})
