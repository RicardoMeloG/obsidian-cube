import { describe, it, expect } from 'vitest'
import { getDefaultVisualContent, resolveSections, resolveWorldId } from './visualContent'
import type { VisualContent } from './visualContent'
import { CUBE_SECTIONS } from '../cubeSections'

describe('visualContent defaults', () => {
  it('exposes all six worlds enabled and a 1:1 face->world mapping', () => {
    const visual = getDefaultVisualContent()
    expect(visual.worlds).toHaveLength(6)
    expect(visual.worlds.every((w) => w.enabled)).toBe(true)
    expect(visual.faces.agentic.worldId).toBe('agentic')
    expect(visual.faces.contact.accent).toMatch(/^#[0-9a-fA-F]{6}$/)
  })
})

describe('resolveWorldId', () => {
  const base = getDefaultVisualContent()

  it('returns the assigned world when it is enabled', () => {
    expect(resolveWorldId(base, 'systems')).toBe('systems')
  })

  it('returns null when the assigned world is disabled', () => {
    const visual: VisualContent = {
      ...base,
      worlds: base.worlds.map((w) => (w.id === 'systems' ? { ...w, enabled: false } : w)),
    }
    expect(resolveWorldId(visual, 'systems')).toBeNull()
  })

  it('returns null when a face has no world assigned', () => {
    const visual: VisualContent = {
      ...base,
      faces: { ...base.faces, security: { worldId: null, accent: '#89d6c7' } },
    }
    expect(resolveWorldId(visual, 'security')).toBeNull()
  })

  it('supports reassigning a different world to a face', () => {
    const visual: VisualContent = {
      ...base,
      faces: { ...base.faces, contact: { worldId: 'agentic', accent: '#f0d2b4' } },
    }
    expect(resolveWorldId(visual, 'contact')).toBe('agentic')
  })
})

describe('resolveSections', () => {
  it('attaches accent and worldId onto each section', () => {
    const resolved = resolveSections(CUBE_SECTIONS, getDefaultVisualContent())
    const agentic = resolved.find((s) => s.id === 'agentic')!
    expect(agentic.accent).toBe('#b8aeff')
    expect(agentic.worldId).toBe('agentic')
  })
})
