// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LAYOUT_QUERIES } from './layoutModes'

// One source for the layout modes (ADR 006, spec 010 AD-06 and H-17).
function sourceFiles(directory: string, pattern = /\.tsx?$/): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return sourceFiles(path, pattern)
    return pattern.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

// Every stylesheet of the site.
const css = sourceFiles('src', /\.css$/)
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')
const mediaQueries = [...css.matchAll(/@media ([^{]+)\{/g)].map((match) => match[1].trim())

// Media queries that are not layout modes.
const OTHER_QUERIES = ['(prefers-reduced-motion: reduce)']

describe('layout modes', () => {
  it('are the only media queries in the CSS', () => {
    const allowed = new Set<string>([...Object.values(LAYOUT_QUERIES), ...OTHER_QUERIES])
    expect(mediaQueries.filter((query) => !allowed.has(query))).toEqual([])
  })

  it('are all declared in the CSS, so a renamed query cannot silently stop applying', () => {
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
