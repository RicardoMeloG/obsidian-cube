import { describe, expect, it } from 'vitest'
import exampleEn from '../../../public/content/site.example.en.json'
import exampleEs from '../../../public/content/site.example.es.json'
import { EXAMPLE_PROFILES } from '../profileContent'
import { SiteContentSchema } from '../siteContent'
import { buildProfileJsonLd, LLMS_FILE, PROFILE_PAGES, renderLlmsTxt, renderMachineFiles, renderProfilePage } from './renderMachine'
import type { MachineInput } from './renderMachine'
import { renderStaticBody } from './renderSeo'

const en: MachineInput = { ...SiteContentSchema.parse(exampleEn), profile: EXAMPLE_PROFILES.en }
const es: MachineInput = { ...SiteContentSchema.parse(exampleEs), profile: EXAMPLE_PROFILES.es }

function jsonLd(html: string): { '@graph': Record<string, unknown>[] } {
  const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)
  return JSON.parse(match![1])
}

const node = (graph: Record<string, unknown>[], type: string) => graph.find((item) => item['@type'] === type)!

describe('llms.txt', () => {
  const text = renderLlmsTxt(en)

  it('names the owner, the role, every title and skill once, and every face', () => {
    expect(text.startsWith(`# ${en.identity.fullName}\n`)).toBe(true)
    expect(text).toContain(`> ${en.identity.role}. ${en.seo.description}`)
    const named = renderLlmsTxt({ ...en, seo: { ...en.seo, description: `Ada, ${en.identity.role}: builds with agents.` } })
    expect(named).toContain(`> Ada, ${en.identity.role}: builds with agents.\n`)
    for (const item of [...en.profile!.titles, ...en.profile!.skills]) {
      expect(text.split('\n').filter((line) => line === `- ${item}`)).toHaveLength(1)
    }
    for (const section of en.sections) expect(text).toContain(`## ${section.label}: `)
    expect(text).toContain(`**${en.profile!.roles[0].title}** (${en.profile!.roles[0].years})`)
  })

  it('is plain Markdown: no tags from the rich text', () => {
    expect(text).not.toMatch(/<[a-z][^>]*>/i)
  })

  it('points at both profile pages', () => {
    expect(text).toContain(`(/${PROFILE_PAGES.en})`)
    expect(text).toContain(`(/${PROFILE_PAGES.es})`)
  })

  it('makes this site’s paths absolute once the address is known, and drops in-page anchors', () => {
    const withUrl = renderLlmsTxt({ ...en, seo: { ...en.seo, siteUrl: 'https://example.com' } })
    expect(withUrl).toContain('(https://example.com/profile.html)')
    expect(withUrl).not.toMatch(/\]\(#/)
  })

  it('never fills a face from the example: no composition or detail of its own, heading only', () => {
    const [agentic, ...rest] = en.sections
    const bare = { ...agentic, composition: undefined, detail: undefined }
    const text = renderLlmsTxt({ ...en, sections: [bare, ...rest] })
    expect(text).toContain(`## ${agentic.label}: ${agentic.title}`)
    expect(agentic.composition?.template).toBe('showcase')
    if (agentic.composition?.template === 'showcase') expect(text).not.toContain(agentic.composition.featured.title)
  })

  it('puts a case’s steps under the case’s name, and leaves no empty line under a bare heading', () => {
    const systems = en.sections.find((section) => section.id === 'systems')!
    expect(systems.composition?.template).toBe('case')
    if (systems.composition?.template !== 'case') return
    const { caseLabel, caseName, steps, before } = systems.composition
    expect(text).toContain(`### ${caseLabel} — ${caseName}\n\n- **${steps[0].label}**`)
    expect(text.indexOf(`**${steps[0].label}**`)).toBeLessThan(text.indexOf(`### ${before.title}`))
    expect(text).not.toMatch(/\n\n\n/)
  })

  it('without a profile, renders the identity and the faces only', () => {
    const text = renderLlmsTxt({ ...en, profile: undefined })
    expect(text).not.toContain('## Skills')
    expect(text).not.toContain(en.profile!.about)
    expect(text).toContain(`## ${en.sections[0].label}: `)
  })
})

describe('profile pages', () => {
  it('one per language, each naming the other', () => {
    const page = renderProfilePage(es)
    expect(page).toContain('<html lang="es">')
    expect(page).toContain(`<h1>${es.identity.fullName}</h1>`)
    expect(page).toContain(`href="/${PROFILE_PAGES.en}" hreflang="en"`)
    expect(page).toContain(`href="/${LLMS_FILE}"`)
    // The site in the page's language, on its clean address.
    expect(page).toContain('<a href="/es">')
  })

  it('carry no inline code or style beyond the JSON-LD data', () => {
    const page = renderProfilePage(en)
    const scripts = [...page.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)].map((match) => match[0])
    expect(scripts).toEqual(['<script type="application/ld+json">'])
    expect(page).not.toMatch(/<style[\s>]|\sstyle="/)
  })

  it('escape the owner’s text in the page and in the JSON-LD', () => {
    const hostile: MachineInput = { ...en, profile: { ...en.profile!, skills: ['</script><script>alert(1)</script>'] } }
    const page = renderProfilePage(hostile)
    expect(page).not.toContain('<script>alert(1)')
    expect(page).toContain('&lt;/script&gt;')
    expect(jsonLd(page)['@graph']).toBeDefined()
  })
})

describe('the profile JSON-LD', () => {
  const graph = buildProfileJsonLd(en)['@graph'] as Record<string, unknown>[]
  const person = node(graph, 'Person')

  it('describes the person with the profile’s facts', () => {
    expect(person.name).toBe(en.identity.fullName)
    expect(person.knowsAbout).toEqual(en.profile!.skills)
    expect(person.jobTitle).toEqual([en.identity.role, ...en.profile!.titles.filter((title) => title !== en.identity.role)])
    expect(person.homeLocation).toEqual({ '@type': 'Place', name: en.profile!.location })
    expect((person.hasOccupation as unknown[]).length).toBe(en.profile!.roles.length)
  })

  it('lists only web profiles as sameAs, and the works with the person as author', () => {
    for (const href of person.sameAs as string[]) expect(href).toMatch(/^https:\/\//)
    const works = graph.filter((item) => item['@type'] === 'SoftwareSourceCode' || item['@type'] === 'CreativeWork')
    expect(works.length).toBeGreaterThan(0)
    for (const work of works) {
      expect(work.author).toEqual({ '@id': person['@id'] })
      expect(work.url).toMatch(/^https:\/\//)
      expect(work.url).not.toMatch(/linkedin\.com/)
    }
    expect(node(graph, 'ProfilePage').mainEntity).toEqual({ '@id': person['@id'] })
  })

  it('falls back to the keywords and the description without a profile', () => {
    const bare = node(buildProfileJsonLd({ ...en, profile: undefined })['@graph'] as Record<string, unknown>[], 'Person')
    expect(bare.description).toBe(en.seo.description)
    expect(bare.knowsAbout).toEqual(['AI Engineer', 'LLM agents', 'Python', 'AWS'])
    expect(bare.hasOccupation).toBeUndefined()
  })
})

describe('the files of the layer', () => {
  it('llms.txt in English and one profile page per language, with their types', () => {
    const files = renderMachineFiles({ en, es })
    expect(Object.keys(files).sort()).toEqual([LLMS_FILE, PROFILE_PAGES.es, PROFILE_PAGES.en].sort())
    expect(files[LLMS_FILE].contentType).toBe('text/plain; charset=utf-8')
    expect(files[LLMS_FILE].body).toBe(renderLlmsTxt(en))
    expect(files[PROFILE_PAGES.es].body).toContain('<html lang="es">')
  })

  it('index.html’s plain body links the profile page and llms.txt', () => {
    const body = renderStaticBody(en)
    expect(body).toContain(`<a href="/${PROFILE_PAGES.en}">`)
    expect(body).toContain(`<a href="/${LLMS_FILE}">`)
  })
})
