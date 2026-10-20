import { describe, expect, it } from 'vitest'
import { EXAMPLE_PROFILES, profileRuleIssues } from './profileContent'
import type { ProfileContent } from './profileContent'

const owner: ProfileContent = {
  locale: 'en',
  about: 'Builds products with agents on top of production systems.',
  titles: EXAMPLE_PROFILES.en.titles,
  skills: EXAMPLE_PROFILES.en.skills,
  roles: [{ title: 'Full stack developer', years: 'Over 15 years', text: 'Web systems end to end.' }],
  profiles: ['https://orcid.org/0000-0002-1825-0097'],
}

describe('the profile’s publish rules', () => {
  it('pass the owner’s own text, even with the example’s titles and skills', () => {
    expect(profileRuleIssues(owner)).toEqual([])
  })

  it('refuse the example’s sentences in either language', () => {
    expect(profileRuleIssues({ ...owner, about: EXAMPLE_PROFILES.es.about })).toHaveLength(1)
    expect(profileRuleIssues({ ...owner, education: EXAMPLE_PROFILES.en.education })).toHaveLength(1)
  })

  it('want other profiles on the web', () => {
    expect(profileRuleIssues({ ...owner, profiles: ['orcid.org/0000', 'mailto:owner@example.com'] }).map((issue) => issue.path)).toEqual([
      ['profiles', 0],
      ['profiles', 1],
    ])
  })
})
