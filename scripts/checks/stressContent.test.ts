// @vitest-environment node
import { describe, expect, it } from 'vitest'
import exampleEn from '../../public/content/site.example.en.json'
import exampleEs from '../../public/content/site.example.es.json'
import budgets from '../../src/kernel/layoutBudgets.json'
import { LAYOUT_BUDGETS, publishIssues, PublishableSiteContentSchema, slotValues, TEMPLATE_BUDGETS, visibleLength } from '../../src/kernel/publishRules'
import { SiteContentSchema } from '../../src/kernel/siteContent'
import type { SiteSection } from '../../src/kernel/siteContent'
import { buildStressContent, fillTo } from './stressContent.mjs'

describe('stress content', () => {
  for (const [locale, example] of [
    ['en', exampleEn],
    ['es', exampleEs],
  ] as const) {
    const stress = buildStressContent(SiteContentSchema.parse(example), budgets)

    it(`passes the publish rules (${locale})`, () => {
      expect(publishIssues(PublishableSiteContentSchema.parse(stress))).toEqual([])
    })

    it(`fills every budgeted field to its limit (${locale})`, () => {
      expect(stress.identity.displayName).toHaveLength(LAYOUT_BUDGETS.name)
      expect(stress.identity.role).toHaveLength(LAYOUT_BUDGETS.role)
      expect(stress.identity.keywords).toHaveLength(LAYOUT_BUDGETS.keywords)
      for (const section of stress.sections) {
        expect(section.label).toHaveLength(LAYOUT_BUDGETS.label)
        expect(section.title).toHaveLength(LAYOUT_BUDGETS.title)
        expect(section.summary).toHaveLength(LAYOUT_BUDGETS.summary)
        expect(section.tagline).toHaveLength(LAYOUT_BUDGETS.tagline)
      }
    })

    it(`fills every template slot to its budget and every list to its maximum (${locale})`, () => {
      for (const { composition } of stress.sections as SiteSection[]) {
        const budget = TEMPLATE_BUDGETS[composition!.template]
        for (const [slot, max] of Object.entries(budget.chars)) {
          for (const { value } of slotValues(composition, slot)) expect(value).toHaveLength(max)
        }
        for (const [slot, limits] of Object.entries(budget.counts)) {
          for (const { value } of slotValues(composition, slot)) expect(value).toHaveLength(limits.max)
        }
      }
    })
  }

  for (const [locale, example] of [
    ['en', exampleEn],
    ['es', exampleEs],
  ] as const) {
    it(`without the optional blocks still passes the publish rules (${locale}, audit-3 F-6)`, () => {
      const bare = buildStressContent(SiteContentSchema.parse(example), budgets, { bare: true })
      expect(publishIssues(PublishableSiteContentSchema.parse(bare))).toEqual([])
      for (const section of bare.sections as SiteSection[]) {
        const composition = section.composition!
        if (composition.template === 'case') expect(composition.map).toBeUndefined()
        if (composition.template === 'catalog') for (const item of composition.items) expect(item.image).toBeUndefined()
      }
    })
  }

  it('fills to an exact length without cutting below it', () => {
    expect(fillTo('Short', 40)).toHaveLength(40)
    expect(fillTo('A sentence that is already far too long for the limit', 10)).toHaveLength(10)
  })
})

describe('publish rules', () => {
  const example = SiteContentSchema.parse(exampleEn)

  it('keep the example content within every layout budget', () => {
    const budgetIssues = publishIssues(example).filter((issue) => /caracteres|elementos/.test(issue.message))
    expect(budgetIssues).toEqual([])
  })

  it('refuse to publish the example as is: placeholders and faces without an artifact link', () => {
    const messages = publishIssues(example).map((issue) => issue.message)
    expect(messages).toContain('Reemplaza el texto de ejemplo "your-handle".')
    expect(messages).toContain('Enlaza al menos un artefacto (https:) desde esta cara.')
  })

  it('count a mailto: as a channel, not as an artifact (audit-3 F-3)', () => {
    const section = {
      ...example.sections[0],
      ctaPrimary: { label: 'Write', href: 'mailto:someone@example.com' },
      ctaSecondary: undefined,
      composition: undefined,
      detail: undefined,
      links: undefined,
      cta: undefined,
    }
    const messages = publishIssues({ ...example, sections: [section, ...example.sections.slice(1)] }).map((issue) => issue.message)
    expect(messages).toContain('Enlaza al menos un artefacto (https:) desde esta cara.')
    expect(messages.filter((message) => message.startsWith('Usa un enlace'))).toEqual([])
  })

  it('keep the top bar within its budgets: name, role and keywords (audit-3 F-4)', () => {
    const identity = { ...example.identity, displayName: 'x'.repeat(LAYOUT_BUDGETS.name + 1), role: 'y'.repeat(LAYOUT_BUDGETS.role + 1), keywords: 'z'.repeat(LAYOUT_BUDGETS.keywords + 1) }
    const paths = publishIssues({ ...example, identity })
      .filter((issue) => issue.message.startsWith('Máximo'))
      .map((issue) => issue.path.join('.'))
    expect(paths).toEqual(expect.arrayContaining(['identity.displayName', 'identity.role', 'identity.keywords']))
  })

  it('check what a visitor sees: an empty field filled from the example cannot carry a placeholder (audit-2 B-01)', () => {
    const owned = JSON.parse(
      JSON.stringify(exampleEn).replaceAll('your-handle', 'ada').replaceAll('your-project', 'tool').replaceAll('Portfolio Owner', 'Ada Example'),
    )
    const products = owned.sections.find((section: { id: string }) => section.id === 'products')
    delete products.detail
    const result = PublishableSiteContentSchema.safeParse(owned)
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.message)).toContain('Reemplaza el texto de ejemplo "your-project".')
  })

  it('count only the text a visitor reads, not inline markup', () => {
    expect(visibleLength('Build <strong>autonomous</strong> systems &amp; tools')).toBe('Build autonomous systems _ tools'.length)
  })

  it('reject unsafe or unsupported link schemes', () => {
    const section = { ...example.sections[0], ctaPrimary: { label: 'Go', href: 'javascript:alert(1)' } }
    const issues = publishIssues({ ...example, sections: [section, ...example.sections.slice(1)] })
    expect(issues.some((issue) => issue.message.startsWith('Usa un enlace https:'))).toBe(true)
  })

  it('check the links of the older fields too: cta and links (audit-2 B-11)', () => {
    const section = { ...example.sections[0], cta: { label: 'Go', href: 'javascript:alert(1)' }, links: [{ label: 'Old', href: 'http://plain.example.com' }] }
    const paths = publishIssues({ ...example, sections: [section, ...example.sections.slice(1)] })
      .filter((issue) => issue.message.startsWith('Usa un enlace https:'))
      .map((issue) => issue.path.join('.'))
    expect(paths).toEqual(['sections.0.cta.href', 'sections.0.links.0.href'])
  })
})
