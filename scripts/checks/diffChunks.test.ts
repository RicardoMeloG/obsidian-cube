// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { CONTINUED_MARK, CUT_MARK, diffChunks } from '../lib/diff-chunks.mjs'

// The change audit's parts (dt-05, D-3): every part fits, keeps its file
// header, and a hunk is cut between lines, never inside one.
const header = (file: string) => `diff --git a/${file} b/${file}\nindex 1111111..2222222 100644\n--- a/${file}\n+++ b/${file}\n`
const hunk = (start: number, count: number, width = 60) =>
  `@@ -${start},0 +${start},${count} @@\n` + Array.from({ length: count }, (_, i) => `+${`line ${start + i} `.padEnd(width, 'x')}\n`).join('')

describe('diffChunks', () => {
  it('keeps a small diff whole and packs small files together', () => {
    const diff = header('a.ts') + hunk(1, 3) + header('b.ts') + hunk(1, 3)
    expect(diffChunks(diff)).toEqual([diff])
  })

  it('cuts a large hunk between lines, each part under the size with its header', () => {
    const diff = header('big.ts') + hunk(1, 400)
    const parts = diffChunks(diff, 4000)
    expect(parts.length).toBeGreaterThan(1)
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(4000)
      expect(part.startsWith(header('big.ts'))).toBe(true)
      // Every body line is a whole diff line.
      for (const line of part.slice(header('big.ts').length).split('\n').filter(Boolean)) {
        expect(line).toMatch(/^(@@ |\+line \d+ x+$)/)
      }
    }
    // Nothing lost or repeated: the bodies join back into the hunk.
    expect(parts.map((part) => part.slice(header('big.ts').length)).join('')).toBe(hunk(1, 400))
  })

  it('cuts a single line longer than a part and marks both sides of the cut', () => {
    const long = `+${'{"a":1},'.repeat(1500)}\n`
    const parts = diffChunks(header('world.json') + `@@ -0,0 +1 @@\n` + long, 4000)
    expect(parts.length).toBeGreaterThan(2)
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(4000)
    expect(parts[0]).toContain(CUT_MARK)
    expect(parts.at(-1)).toContain(CONTINUED_MARK)
    expect(parts.at(-1)).not.toContain(CUT_MARK)
    const bodies = parts.map((part) => part.slice(header('world.json').length)).join('')
    const text = bodies.replaceAll(` ${CUT_MARK}\n`, '').replaceAll(`+${CONTINUED_MARK} `, '')
    expect(text).toBe(`@@ -0,0 +1 @@\n${long}`)
  })

  it('keeps a large file with no hunk instead of dropping it', () => {
    const body = Array.from({ length: 400 }, (_, i) => `literal ${i} ${'z'.repeat(60)}\n`).join('')
    const diff = `diff --git a/x.bin b/x.bin\nGIT binary patch\n${body}`
    const parts = diffChunks(diff, 4000)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.join('')).toBe(diff)
  })

  it('ends even when a part is smaller than its header', () => {
    const parts = diffChunks(header('world.json') + `@@ -0,0 +1 @@\n+${'y'.repeat(5000)}\n`, 100)
    expect(parts.length).toBeGreaterThan(1)
  })
})
