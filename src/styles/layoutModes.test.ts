// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LAYOUT_QUERIES } from './layoutModes'

// One source for the layout modes (ADR 006, spec 010 AD-06 and H-17).
const css = ['src/App.css', 'src/styles/tokens.css'].map((file) => readFileSync(file, 'utf8')).join('\n')
const mediaQueries = [...css.matchAll(/@media ([^{]+)\{/g)].map((match) => match[1].trim())

// Legacy component breakpoints from before the layout modes. They are migrated
// with the components in P2b and P4; the list only shrinks.
const LEGACY_QUERIES = [
  '(prefers-reduced-motion: reduce)',
  '(max-width: 340px)',
]

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [path] : []
  })
}

describe('layout modes', () => {
  it('are the only media queries in the CSS besides the known legacy ones', () => {
    const allowed = new Set<string>([...Object.values(LAYOUT_QUERIES), ...LEGACY_QUERIES])
    expect(mediaQueries.filter((query) => !allowed.has(query))).toEqual([])
  })

  it('are all used by the CSS, so a renamed query cannot silently stop applying', () => {
    for (const query of Object.values(LAYOUT_QUERIES)) {
      expect(mediaQueries).toContain(query)
    }
  })

  it('make desktop the exact complement of stacked', () => {
    expect(LAYOUT_QUERIES.desktop).toBe(`(not (${LAYOUT_QUERIES.stacked.replace(', ', ' or ')}))`)
    expect(LAYOUT_QUERIES.desktopShort.startsWith(LAYOUT_QUERIES.desktop)).toBe(true)
  })

  it('leave no numeric breakpoint in the components', () => {
    const offenders = sourceFiles('src')
      .filter((file) => !file.replace(/\\/g, '/').endsWith('src/styles/layoutModes.ts'))
      .filter((file) => /\b(innerWidth|innerHeight|size\.width|size\.height|viewport\.width)\s*[<>]=?\s*\d|<=?\s*4\s*\/\s*3/.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
