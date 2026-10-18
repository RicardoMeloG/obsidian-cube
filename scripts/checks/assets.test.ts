// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Provenance of public assets (spec 010, E-21): docs/assets.md records the
// source and licence of every file the site serves from public/.
const PUBLIC = 'public'

// Licences still to be confirmed. Resolving one removes it from here; a new
// asset cannot join without a recorded licence.
const KNOWN_PENDING: string[] = []

function publicFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return publicFiles(path)
    return [relative(PUBLIC, path).replace(/\\/g, '/')]
  })
}

const rows = new Map(
  [...readFileSync('docs/assets.md', 'utf8').matchAll(/^\| `([^`]+)` \| ([^|]+) \| ([^|]+) \|$/gm)].map((match) => [
    match[1],
    { source: match[2].trim(), licence: match[3].trim() },
  ]),
)

describe('public assets', () => {
  const files = publicFiles(PUBLIC).filter((file) => !file.startsWith('content/'))

  it('are all recorded with a source and a licence', () => {
    const missing = files.filter((file) => !rows.get(file)?.source || !rows.get(file)?.licence)
    expect(missing).toEqual([])
  })

  it('have no pending licence beyond the known ones', () => {
    const pending = [...rows].filter(([, row]) => row.licence === 'pending').map(([path]) => path)
    expect(pending.sort()).toEqual([...KNOWN_PENDING].sort())
  })

  it('list no file that no longer exists', () => {
    expect([...rows.keys()].filter((path) => !files.includes(path))).toEqual([])
  })
})
