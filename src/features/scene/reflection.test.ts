// @vitest-environment node
import { REVISION } from 'three'
import { describe, expect, it } from 'vitest'
import { ATLAS_THREE_REVISION } from './reflection'

describe('baked reflection', () => {
  it('was baked with the installed three revision', () => {
    // Another revision may lay the atlas out differently: run
    // `node scripts/bake-reflection.mjs` and update ATLAS_THREE_REVISION.
    expect(REVISION).toBe(ATLAS_THREE_REVISION)
  })
})
