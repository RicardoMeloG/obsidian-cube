// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import exampleEn from '../../public/content/site.example.en.json'
import exampleEs from '../../public/content/site.example.es.json'
import { publishRuleIssues } from '../../src/kernel/publishRules'
import { SiteContentSchema } from '../../src/kernel/siteContent'
import type { ContentRepository } from './content.repository'
import { ContentService } from './content.service'

// What the admin's publish decides, through the service itself (audit-4 F-2).
// No database, and the other language is the example, so the private documents
// on the owner's machine never enter the test.
function service() {
  const content = new ContentService({ isAvailable: () => false } as unknown as ContentRepository)
  vi.spyOn(content, 'read').mockResolvedValue({ data: exampleEs, source: 'example' })
  return content
}

const rules = publishRuleIssues(SiteContentSchema.parse(exampleEn)).map((issue) => issue.message)

afterEach(() => vi.unstubAllEnvs())

describe('ContentService.validate', () => {
  it('blocks on the publish rules in production', async () => {
    vi.stubEnv('APP_ENV', 'production')
    const check = await service().validate('site.en', exampleEn)
    expect(rules.length).toBeGreaterThan(0)
    expect(check.ok).toBe(false)
    expect(check.errors?.map((error) => error.message)).toEqual(rules)
  })

  it('lets the publish through in development and returns the rules as warnings', async () => {
    vi.stubEnv('APP_ENV', 'development')
    const check = await service().validate('site.en', exampleEn)
    expect(check.ok).toBe(true)
    expect(check.warnings?.map((warning) => warning.message)).toEqual(expect.arrayContaining(rules))
  })

  it("blocks on the content's shape in both", async () => {
    for (const env of ['development', 'production']) {
      vi.stubEnv('APP_ENV', env)
      const check = await service().validate('site.en', { ...exampleEn, sections: 'none' })
      expect(check.ok).toBe(false)
    }
  })
})
