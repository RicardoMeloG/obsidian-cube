import { describe, expect, it } from 'vitest'
import exampleEn from '../public/content/site.example.en.json'
import { publishRuleIssues, PublishableSiteContentSchema } from '../src/kernel/publishRules'
import { SiteContentSchema } from '../src/kernel/siteContent'
import { appEnv, publishRulesBlock } from './appEnv'

describe('APP_ENV', () => {
  it('is development unless the owner sets production', () => {
    expect(appEnv(undefined)).toBe('development')
    expect(appEnv('')).toBe('development')
    expect(appEnv('development')).toBe('development')
    expect(appEnv('production')).toBe('production')
  })

  it('refuses any other value, so a typo is not taken for development', () => {
    expect(() => appEnv('prod')).toThrow()
  })

  it('lets the publish rules block only in production', () => {
    expect(publishRulesBlock('development')).toBe(false)
    expect(publishRulesBlock('production')).toBe(true)
  })

  it('still reports the rules in development: the example breaks them, yet its shape is valid', () => {
    const content = SiteContentSchema.parse(exampleEn)
    expect(publishRuleIssues(content).length).toBeGreaterThan(0)
    expect(PublishableSiteContentSchema.safeParse(exampleEn).success).toBe(false)
  })
})
