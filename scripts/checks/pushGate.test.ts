// @vitest-environment node
// The proportional gates of a push (spec 012): each rule with a case that
// breaks it and one that passes.
import { describe, expect, it } from 'vitest'
import { addedLines, classify, diffHash, namesSpec, SECRET_NAME, secretLines } from '../lib/push-gate.mjs'

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

  it('the contract and the gates are a large change', () => {
    for (const path of ['src/kernel/siteContent.ts', 'server/auth/totp.ts', 'infra/lib/static-site-stack.ts', '.githooks/pre-push', 'scripts/check-privacy.mjs', 'scripts/lib/push-gate.mjs', '.github/workflows/ci.yml', 'AGENTS.md', 'docs/decisions/010-x.md']) {
      expect(classify([path]).level, path).toBe('large change')
    }
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
