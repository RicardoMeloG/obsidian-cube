// @vitest-environment node
import { describe, expect, it } from 'vitest'
import exampleEn from '../../public/content/site.example.en.json'
import exampleEs from '../../public/content/site.example.es.json'
import budgets from '../../src/kernel/layoutBudgets.json'
import { LAYOUT_BUDGETS, publishIssues, PublishableSiteContentSchema, visibleLength } from '../../src/kernel/publishRules'
import { SiteContentSchema } from '../../src/kernel/siteContent'
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
      for (const section of stress.sections) {
        expect(section.label).toHaveLength(LAYOUT_BUDGETS.label)
        expect(section.title).toHaveLength(LAYOUT_BUDGETS.title)
        expect(section.summary).toHaveLength(LAYOUT_BUDGETS.summary)
        expect(section.features).toHaveLength(budgets.counts.features.max)
        for (const feature of section.features ?? []) expect(feature.description).toHaveLength(LAYOUT_BUDGETS.featureDescription)
        for (const step of section.flow ?? []) expect(step.description).toHaveLength(LAYOUT_BUDGETS.flowDescription)
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
    expect(messages).toContain('Enlaza al menos un artefacto (https: o mailto:) desde esta cara.')
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
})
