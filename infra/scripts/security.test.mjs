import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { patchArchive, verifySource } from './prepare-cdk.mjs'
const require = createRequire(import.meta.url)

test('rejects a CDK source whose checksum is not the pinned upstream checksum', () => {
  assert.throws(() => verifySource(Buffer.from('untrusted source')), /integrity mismatch/)
})

test('rejects an archive without the expected manifest and bundled dependency', () => {
  assert.throws(() => patchArchive(Buffer.alloc(1024)), /layout changed/)
})

test('CDK resolves the patched minimatch installed by npm', () => {
  const cdkRoot = dirname(require.resolve('aws-cdk-lib/package.json'))
  const minimatch = require.resolve('minimatch/package.json', { paths: [cdkRoot] })
  assert.equal(JSON.parse(readFileSync(minimatch, 'utf8')).version, '11.0.5')
})

test('CDK asset exclusions still match nested paths and brace patterns', () => {
  const { IgnoreStrategy } = require('aws-cdk-lib')
  const root = resolve('asset-fixture')
  const strategy = IgnoreStrategy.glob(root, ['**/node_modules/**', '**/*.test.ts', 'src/{generated,fixtures}/**'])
  for (const path of ['node_modules/a/index.js', 'src/unit.test.ts', 'src/generated/schema.ts', 'src/fixtures/example.json']) {
    assert.equal(strategy.ignores(resolve(root, path)), true, path)
  }
  assert.equal(strategy.ignores(resolve(root, 'src/main.ts')), false)
})
