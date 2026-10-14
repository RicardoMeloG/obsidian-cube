import { describe, expect, it } from 'vitest'
import { interfaceCopy } from './copy'

describe('interface copy', () => {
  it('has the same strings, none empty, in both locales', () => {
    const en = interfaceCopy('en')
    const es = interfaceCopy('es')
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort())
    for (const value of [...Object.values(en), ...Object.values(es)]) expect(value.trim()).not.toBe('')
  })
})
