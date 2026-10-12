import { describe, expect, it } from 'vitest'
import { CUBE_FACE_ORDER } from './faces'
import { getDefaultSiteContent, normalizeSections } from './siteContent'
import type { SiteSection } from './siteContent'

describe('default content', () => {
  it('is the committed example in each locale, every face with its eyebrow', () => {
    for (const locale of ['en', 'es'] as const) {
      const content = getDefaultSiteContent(locale)
      expect(content.locale).toBe(locale)
      expect(content.sections.map((section) => section.id)).toEqual(CUBE_FACE_ORDER)
      expect(content.sections.every((section) => section.eyebrow)).toBe(true)
    }
  })
})

describe('normalizeSections', () => {
  const spanish = getDefaultSiteContent('es').sections
  const english = getDefaultSiteContent('en').sections

  it('fills an empty Spanish face from the Spanish example, never from English (E-08)', () => {
    const published: SiteSection[] = [{ id: 'agentic', label: 'AGÉNTICO', title: 'Mi título', summary: 'Mi resumen.' }]
    const agentic = normalizeSections(published, 'es')[0]
    const exampleAgentic = spanish.find((section) => section.id === 'agentic')!

    expect(agentic.title).toBe('Mi título')
    expect(agentic.features).toEqual(exampleAgentic.features)
    expect(agentic.eyebrow).toBe(exampleAgentic.eyebrow)
    expect(agentic.features).not.toEqual(english.find((section) => section.id === 'agentic')!.features)
  })

  it('uses the eyebrow the content provides, in either locale (E-09)', () => {
    const published: SiteSection[] = [{ id: 'research', label: 'R', title: 'T', summary: 'S', eyebrow: 'Mi línea' }]
    const research = normalizeSections(published, 'es').find((section) => section.id === 'research')!
    expect(research.eyebrow).toBe('Mi línea')
  })

  it('returns the six faces in catalog order even when the document omits some', () => {
    expect(normalizeSections([], 'en').map((section) => section.id)).toEqual(CUBE_FACE_ORDER)
  })
})
