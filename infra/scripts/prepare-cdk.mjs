// CDK 2.275.0 bundles minimatch 10, so npm overrides cannot replace it.
// Keep the official CDK code; let npm install the patched minimatch normally.
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const VERSION = '2.275.0'
const INTEGRITY = 'Gjj1tM3dQedhsI7MdwMvULF1PzgEO/zX0KFHU9xwZskkSL9057IZB4fJWm9nL+aaNU3TU+lNt8uB6d8QcZtUpQ=='
const directory = new URL('../.vendor/', import.meta.url)
const upstream = new URL(`aws-cdk-lib-${VERSION}.tgz`, directory)
const output = new URL(`aws-cdk-lib-${VERSION}.tar`, directory)

export function verifySource(data) {
  if (createHash('sha512').update(data).digest('base64') !== INTEGRITY) {
    throw new Error('CDK source integrity mismatch; no archive was prepared')
  }
}

export function patchArchive(tar) {
  const chunks = []
  let manifestCount = 0
  let removed = 0
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) break
    const field = (start, end) => header.toString('utf8', start, end).replace(/\0.*$/s, '')
    const name = [field(345, 500), field(0, 100)].filter(Boolean).join('/')
    const size = Number.parseInt(field(124, 136).trim() || '0', 8)
    if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length) throw new Error('Invalid CDK tar entry')
    const end = offset + 512 + Math.ceil(size / 512) * 512
    const body = tar.subarray(offset + 512, offset + 512 + size)
    if (/^package\/node_modules\/minimatch(?:\/|$)/.test(name)) {
      removed++
    } else if (name === 'package/package.json') {
      const pkg = JSON.parse(body.toString('utf8'))
      if (pkg.name !== 'aws-cdk-lib' || pkg.version !== VERSION || pkg.dependencies.minimatch !== '^10.2.6' || !pkg.bundleDependencies.includes('minimatch')) {
        throw new Error('Unexpected CDK manifest; review the upstream package')
      }
      pkg.dependencies.minimatch = '11.0.5'
      pkg.bundleDependencies = pkg.bundleDependencies.filter(name => name !== 'minimatch')
      const replacement = Buffer.from(JSON.stringify(pkg, null, 2) + '\n')
      const updated = Buffer.from(header)
      updated.write(replacement.length.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii')
      updated.fill(32, 148, 156)
      const checksum = updated.reduce((sum, byte) => sum + byte, 0)
      updated.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii')
      chunks.push(updated, replacement, Buffer.alloc((512 - replacement.length % 512) % 512))
      manifestCount++
    } else {
      chunks.push(tar.subarray(offset, end))
    }
    offset = end
  }
  if (manifestCount !== 1 || removed === 0) throw new Error('CDK package layout changed; no archive was prepared')
  chunks.push(Buffer.alloc(1024))
  return Buffer.concat(chunks)
}

export async function prepare() {
  await mkdir(directory, { recursive: true })
  let source
  try { source = await readFile(upstream) } catch (error) {
    if (error.code !== 'ENOENT') throw error
    const response = await fetch(`https://registry.npmjs.org/aws-cdk-lib/-/aws-cdk-lib-${VERSION}.tgz`, { signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`CDK download failed: ${response.status}`)
    source = Buffer.from(await response.arrayBuffer())
    verifySource(source)
    await writeFile(upstream, source)
  }
  verifySource(source)
  // Uncompressed tar keeps the lockfile's integrity identical across Node/zlib
  // versions and operating systems. Both archives stay local and gitignored.
  const archive = patchArchive(gunzipSync(source))
  await writeFile(output, archive)
  console.log(`Prepared CDK ${VERSION} with minimatch 11.0.5 (${archive.length} bytes)`)
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) await prepare()
