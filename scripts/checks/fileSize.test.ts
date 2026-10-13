// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// File size of the DOM layers (spec 010, AD-04 and H-16): a component that
// grows past this is doing more than one thing. Scene files are exempt: 3D
// worlds are long by nature and were moved as they were.
const LIMIT = 250
const DOM_LAYERS = ['src/app', 'src/features/faces', 'src/features/navigation', 'src/features/content', 'src/features/experience', 'src/ui', 'src/lib']

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('DOM-layer files', () => {
  it(`stay within ${LIMIT} lines`, () => {
    const tooLong = DOM_LAYERS.flatMap(sourceFiles)
      .map((file) => ({ file: file.replace(/\\/g, '/'), lines: readFileSync(file, 'utf8').split('\n').length }))
      .filter((entry) => entry.lines > LIMIT)
    expect(tooLong).toEqual([])
  })
})
