import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { TEMPLATE_IDS } from './compositions'
import type { Composition } from './compositions'
import { publishIssues, slotValues, TEMPLATE_BUDGETS, templateMismatches } from './publishRules'
import { getDefaultSiteContent, normalizeSections, SiteContentSchema } from './siteContent'
import { RICH_TEXT_TAGS } from './fields'
import type { SiteContent } from './siteContent'
import { VisualContentSchema } from './visualContent'

describe('example compositions', () => {
  it('give every face a composition and a tagline, in both languages, using every template', () => {
    for (const locale of ['en', 'es'] as const) {
      const sections = getDefaultSiteContent(locale).sections
      expect(sections.every((section) => section.composition && section.tagline)).toBe(true)
      expect(new Set(sections.map((section) => section.composition!.template))).toEqual(new Set(TEMPLATE_IDS))
    }
  })

  it('use the same template per face in both languages', () => {
    const english = getDefaultSiteContent('en').sections.map((section) => section.composition!.template)
    const spanish = getDefaultSiteContent('es').sections.map((section) => section.composition!.template)
    expect(spanish).toEqual(english)
  })

  it('fill a face that has no composition from the example in its language', () => {
    const face = normalizeSections([{ id: 'contact', label: 'C', title: 'T', summary: 'S' }], 'es').find((section) => section.id === 'contact')!
    expect(face.composition).toEqual(getDefaultSiteContent('es').sections.find((section) => section.id === 'contact')!.composition)
  })

  it('have a budget for every template', () => {
    for (const template of TEMPLATE_IDS) expect(TEMPLATE_BUDGETS[template].chars).toBeDefined()
  })
})

describe('JSON Schema for the admin forms (spec 011, AD-04)', () => {
  it('is generated for every document without unsupported types', () => {
    const site = z.toJSONSchema(SiteContentSchema) as { properties: Record<string, unknown> }
    const visual = z.toJSONSchema(VisualContentSchema)
    expect(site.properties.sections).toBeDefined()
    expect(visual).toBeDefined()
    expect(JSON.stringify(site)).toContain('"widget":"media"')
  })
})

describe('slotValues', () => {
  it('walks fields, lists and object values', () => {
    const value = { a: [{ b: 'x' }, { b: 'y' }], c: { d: 'p', e: 'q' } }
    expect(slotValues(value, 'a[].b').map((found) => found.path)).toEqual([['a', 0, 'b'], ['a', 1, 'b']])
    expect(slotValues(value, 'c.*').map((found) => found.value)).toEqual(['p', 'q'])
    expect(slotValues(value, 'missing[].b')).toEqual([])
  })
})

describe('publish rules on compositions', () => {
  // The example made publishable except for what each test breaks.
  function ownerContent(change: (composition: Composition) => void): SiteContent {
    const content = structuredClone(getDefaultSiteContent('en'))
    content.identity = { ...content.identity, displayName: 'Ada', fullName: 'Ada Lovelace', handle: 'ada' }
    const text = JSON.stringify(content)
      .replaceAll('your-handle', 'ada')
      .replaceAll('your-project', 'engine')
      .replace(/\/examples\/[a-z0-9-]+\.webp/g, `/content/media/${'a'.repeat(64)}.webp`)
      .replaceAll('Illustrative data', 'From the migration log')
    const owner = JSON.parse(text) as SiteContent
    for (const section of owner.sections) {
      section.ctaPrimary = { label: 'Open', href: 'https://example.com/artifact' }
      change(section.composition!)
    }
    return owner
  }

  it('accept the example once its placeholders and images are replaced', () => {
    expect(publishIssues(ownerContent(() => {}))).toEqual([])
  })

  it('refuse example images in owner content', () => {
    const content = ownerContent((composition) => {
      if (composition.template === 'catalog') composition.items[0].image!.src = '/examples/project-1.webp'
    })
    expect(publishIssues(content).map((issue) => issue.message)).toContain('Reemplaza las imágenes de ejemplo por imágenes subidas desde el admin.')
  })

  it('refuse data labelled as illustrative', () => {
    const content = ownerContent((composition) => {
      if (composition.template === 'case') composition.map!.note = 'Datos ilustrativos'
    })
    expect(publishIssues(content).map((issue) => issue.message)).toContain('Los datos ilustrativos no se publican: pon datos reales o quita el bloque.')
  })

  it('accept a case without its map and catalog items without images: no data, no block', () => {
    const content = ownerContent((composition) => {
      if (composition.template === 'case') delete composition.map
      if (composition.template === 'catalog') for (const item of composition.items) delete item.image
    })
    expect(SiteContentSchema.safeParse(content).success).toBe(true)
    expect(publishIssues(content)).toEqual([])
  })

  it('refuse a slot over its budget and a list over its count, pointing at the slot', () => {
    const content = ownerContent((composition) => {
      if (composition.template !== 'showcase') return
      composition.steps[1].text = 'x'.repeat(TEMPLATE_BUDGETS.showcase.chars['steps[].text'] + 1)
      composition.proofs.push(...composition.proofs)
    })
    const paths = publishIssues(content).map((issue) => issue.path.join('.'))
    expect(paths).toContain('sections.0.composition.steps.1.text')
    expect(paths).toContain('sections.0.composition.proofs')
  })

  it('check every link a composition holds', () => {
    const content = ownerContent((composition) => {
      if (composition.template === 'channels') composition.channels[0].href = 'javascript:alert(1)'
    })
    expect(publishIssues(content).map((issue) => issue.path.join('.'))).toContain('sections.5.composition.channels.0.href')
  })
})

describe('cross-language warning (spec 011, AD-02)', () => {
  it('is silent when both languages use the same template on every face', () => {
    expect(templateMismatches(getDefaultSiteContent('es'), getDefaultSiteContent('en'))).toEqual([])
  })

  it('names the face whose template differs, pointing at the template', () => {
    const spanish = structuredClone(getDefaultSiteContent('es'))
    const contact = spanish.sections.findIndex((section) => section.id === 'contact')
    spanish.sections[contact].composition = structuredClone(getDefaultSiteContent('es').sections.find((s) => s.id === 'research')!.composition!)
    const issues = templateMismatches(spanish, getDefaultSiteContent('en'))
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toEqual(['sections', contact, 'composition', 'template'])
    expect(issues[0].message).toContain('EN')
  })
})

describe('rich text in the admin form', () => {
  it('lists the tags the sanitizer allows', () => {
    expect(JSON.stringify(z.toJSONSchema(SiteContentSchema))).toContain(JSON.stringify(RICH_TEXT_TAGS))
  })
})
