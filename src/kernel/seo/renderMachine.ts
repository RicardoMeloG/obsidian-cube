// The layer for machines (spec 012, AD-07), rendered at build time from the
// same documents as the faces (vite.config.ts → machineLayer): /llms.txt and
// one plain profile page per language, which carries the fuller JSON-LD. The
// same facts as the site, more of them and in one structure; nothing a person
// cannot open, since index.html and CONTACT link the profile pages. Each
// recognised title and skill is named once: repeating keywords is stuffing.
//
// Pure and DOM-free, like renderSeo.ts.
import type { ProfileContent } from '../profileContent'
import type { SiteContent, SiteLocale } from '../siteContent'
import { faceLinks, faceText } from './faceText'
import type { FaceLink, FaceText, TextEntry } from './faceText'
import { LLMS_FILE, PROFILE_PAGES } from './machineFiles'
import { absoluteUrl, escapeHtml, isProfileUrl, jsonForScript, keywordList, toPlainText } from './renderSeo'

export { LLMS_FILE, PROFILE_PAGES }

// A language's site document with its profile, when the owner wrote one.
export type MachineInput = SiteContent & { profile?: ProfileContent }

const LABELS: Record<SiteLocale, Record<'keywords' | 'location' | 'languages' | 'titles' | 'skills' | 'roles' | 'education' | 'research' | 'profiles' | 'site' | 'other' | 'profilePage', string>> = {
  en: {
    keywords: 'Keywords',
    location: 'Location',
    languages: 'Languages',
    titles: 'Titles',
    skills: 'Skills',
    roles: 'Roles',
    education: 'Education',
    research: 'Research',
    profiles: 'Profiles',
    site: 'Interactive site',
    other: 'Versión en español',
    profilePage: 'Profile page',
  },
  es: {
    keywords: 'Palabras clave',
    location: 'Ubicación',
    languages: 'Idiomas',
    titles: 'Títulos',
    skills: 'Habilidades',
    roles: 'Roles',
    education: 'Formación',
    research: 'Investigación',
    profiles: 'Perfiles',
    site: 'Sitio interactivo',
    other: 'English version',
    profilePage: 'Página de perfil',
  },
}

const OTHER_LOCALE: Record<SiteLocale, SiteLocale> = { en: 'es', es: 'en' }

const PROFILE_HOSTS: Record<string, string> = { 'github.com': 'GitHub', 'linkedin.com': 'LinkedIn', 'orcid.org': 'ORCID' }

function hostOf(href: string): string | undefined {
  return /^https?:\/\/(?:www\.)?([^/?#:]+)/i.exec(href)?.[1].toLowerCase()
}

const isWeb = (href: string) => /^https:\/\//i.test(href)

// An in-page anchor means nothing outside the page; a path on this site
// becomes absolute when the site's address is known.
function resolveHref(href: string, siteUrl?: string): string | undefined {
  if (href.startsWith('#')) return undefined
  return href.startsWith('/') ? absoluteUrl(href, siteUrl) : href
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

// The owner's own profiles elsewhere: the identity's, the profile's, and any
// profile page a face links.
function profileLinks(content: MachineInput, faces: FaceText[]): FaceLink[] {
  const hrefs = unique([
    ...Object.values(content.identity.links ?? {}),
    ...(content.profile?.profiles ?? []),
    ...faces.flatMap(faceLinks).map((item) => item.href).filter(isProfileUrl),
  ]).filter((href): href is string => Boolean(href) && isWeb(href as string))
  return hrefs.map((href) => ({ label: PROFILE_HOSTS[hostOf(href) ?? ''] ?? hostOf(href) ?? href, href }))
}

// Public works: every web link a face carries that is not a profile.
function works(faces: FaceText[]): FaceLink[] {
  const seen = new Set<string>()
  return faces
    .flatMap(faceLinks)
    .filter((item) => isWeb(item.href) && !isProfileUrl(item.href) && hostOf(item.href) !== 'linkedin.com')
    .filter((item) => !seen.has(item.href) && Boolean(seen.add(item.href)))
}

const isRepository = (href: string) => hostOf(href) === 'github.com' && /^https:\/\/(?:www\.)?github\.com\/[^/]+\/[^/?#]+\/?$/i.test(href)

// Drops empty values, so the JSON-LD names only what the owner wrote.
function compact(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0)))
}

export function buildProfileJsonLd(content: MachineInput): Record<string, unknown> {
  const { identity, seo, profile, locale } = content
  const faces = content.sections.map(faceText)
  const personId = `${seo.siteUrl ?? ''}/#person`
  const person = compact({
    '@type': 'Person',
    '@id': personId,
    name: identity.fullName,
    alternateName: identity.displayName !== identity.fullName ? identity.displayName : undefined,
    jobTitle: unique([identity.role, ...(profile?.titles ?? [])]),
    description: profile ? toPlainText(profile.about) : seo.description,
    knowsAbout: profile?.skills.length ? profile.skills : keywordList(identity.keywords),
    knowsLanguage: profile?.languages,
    homeLocation: profile?.location ? { '@type': 'Place', name: profile.location } : undefined,
    alumniOf: unique((profile?.education ?? []).flatMap((item) => (item.institution ? [item.institution] : []))).map((name) => ({ '@type': 'EducationalOrganization', name })),
    hasCredential: (profile?.education ?? []).map((item) =>
      compact({ '@type': 'EducationalOccupationalCredential', name: item.name, recognizedBy: item.institution ? { '@type': 'EducationalOrganization', name: item.institution } : undefined }),
    ),
    hasOccupation: (profile?.roles ?? []).map((role) => ({
      '@type': 'Occupation',
      name: role.title,
      description: [role.years, toPlainText(role.text)].filter(Boolean).join('. '),
    })),
    sameAs: profileLinks(content, faces).map((item) => item.href),
    url: seo.siteUrl,
  })
  const workNodes = works(faces).map((work) =>
    compact({
      '@type': isRepository(work.href) ? 'SoftwareSourceCode' : 'CreativeWork',
      name: work.label,
      url: work.href,
      codeRepository: isRepository(work.href) ? work.href : undefined,
      description: work.description,
      author: { '@id': personId },
    }),
  )
  const page = compact({
    '@type': 'ProfilePage',
    url: seo.siteUrl ? absoluteUrl(PROFILE_PAGES[locale], seo.siteUrl) : undefined,
    name: `${identity.fullName} — ${identity.role}`,
    inLanguage: locale,
    mainEntity: { '@id': personId },
  })
  return { '@context': 'https://schema.org', '@graph': [page, person, ...workNodes] }
}

// --- llms.txt: Markdown, as the convention proposes (llmstxt.org) ---

function markdownLink(item: FaceLink, siteUrl?: string): string | undefined {
  const href = resolveHref(item.href, siteUrl)
  return href ? `[${item.label}](${href})` : undefined
}

// An entry whose one link carries its own title shows the title as the link.
function titleLink(entry: TextEntry): FaceLink | undefined {
  const [only, ...more] = entry.links ?? []
  return only && more.length === 0 && only.label === entry.title ? only : undefined
}

function markdownEntry(entry: TextEntry, siteUrl?: string): string {
  const meta = entry.meta?.filter(Boolean).join(' · ')
  const own = titleLink(entry)
  // An in-page anchor resolves to nothing: the title stays as text.
  const ownLink = own && markdownLink(own, siteUrl)
  const title = ownLink ?? (entry.title ? `**${entry.title}**` : undefined)
  const head = [title, meta ? `(${meta})` : undefined].filter(Boolean).join(' ')
  const links = own ? [] : (entry.links ?? []).map((item) => markdownLink(item, siteUrl)).filter(Boolean)
  const body = [entry.text, ...links].filter(Boolean).join(' ')
  return `- ${[head, body].filter(Boolean).join(': ')}`
}

function markdownFace(face: FaceText, siteUrl?: string): string[] {
  const lines = ['', `## ${face.label}: ${face.title}`, '']
  if (face.eyebrow) lines.push(face.eyebrow, '')
  lines.push(face.summary)
  for (const group of face.groups) {
    lines.push('')
    if (group.heading) lines.push(`### ${group.heading}`, '')
    for (const entry of group.entries) lines.push(markdownEntry(entry, siteUrl))
  }
  const links = face.links.map((item) => markdownLink(item, siteUrl)).filter(Boolean)
  if (links.length > 0) lines.push('', ...links.map((item) => `- ${item}`))
  return lines
}

export function renderLlmsTxt(content: MachineInput): string {
  const { identity, seo, profile, locale } = content
  const label = LABELS[locale]
  const faces = content.sections.map(faceText)
  const page = (target: SiteLocale) => absoluteUrl(`/${PROFILE_PAGES[target]}`, seo.siteUrl)
  const lines = [`# ${identity.fullName}`, '', `> ${identity.role}. ${seo.description}`, '']
  if (profile) lines.push(toPlainText(profile.about), '')
  if (identity.keywords) lines.push(`- ${label.keywords}: ${keywordList(identity.keywords).join(', ')}`)
  if (profile?.location) lines.push(`- ${label.location}: ${profile.location}`)
  if (profile?.languages?.length) lines.push(`- ${label.languages}: ${profile.languages.join(', ')}`)
  if (seo.siteUrl) lines.push(`- ${label.site}: ${seo.siteUrl}`)
  lines.push(`- ${label.profilePage}: [${locale}](${page(locale)}) · [${OTHER_LOCALE[locale]}](${page(OTHER_LOCALE[locale])})`)

  const list = (heading: string, items: string[]) => {
    if (items.length > 0) lines.push('', `## ${heading}`, '', ...items.map((item) => `- ${item}`))
  }
  if (profile) {
    list(label.titles, profile.titles)
    list(label.skills, profile.skills)
    list(label.roles, profile.roles.map((role) => `**${role.title}**${role.years ? ` (${role.years})` : ''}: ${toPlainText(role.text)}`))
    list(label.education, (profile.education ?? []).map((item) => [item.name, item.institution].filter(Boolean).join(', ')))
    if (profile.research) lines.push('', `## ${label.research}`, '', toPlainText(profile.research))
  }
  list(label.profiles, profileLinks(content, faces).map((item) => `[${item.label}](${item.href})`))
  for (const face of faces) lines.push(...markdownFace(face, seo.siteUrl))
  return `${lines.join('\n')}\n`
}

// --- The profile page: the same text as HTML, for crawlers and people ---

function htmlLink(item: FaceLink, siteUrl?: string): string | undefined {
  const href = resolveHref(item.href, siteUrl)
  return href ? `<a href="${escapeHtml(href)}">${escapeHtml(item.label)}</a>` : undefined
}

function htmlEntry(entry: TextEntry, siteUrl?: string): string {
  const meta = entry.meta?.filter(Boolean).join(' · ')
  const own = titleLink(entry)
  const title = (own && htmlLink(own, siteUrl)) ?? (entry.title ? escapeHtml(entry.title) : undefined)
  const head = [title ? `<strong>${title}</strong>` : undefined, meta ? `(${escapeHtml(meta)})` : undefined].filter(Boolean).join(' ')
  const links = own ? [] : (entry.links ?? []).map((item) => htmlLink(item, siteUrl)).filter(Boolean)
  const body = [entry.text ? escapeHtml(entry.text) : undefined, ...links].filter(Boolean).join(' ')
  return `<li>${[head, body].filter(Boolean).join(': ')}</li>`
}

const htmlList = (items: string[]) => (items.length > 0 ? `<ul>${items.map((item) => `\n          <li>${item}</li>`).join('')}\n        </ul>` : '')

function htmlFace(face: FaceText, siteUrl?: string): string {
  const parts = [`<h2>${escapeHtml(face.label)} — ${escapeHtml(face.title)}</h2>`]
  if (face.eyebrow) parts.push(`<p>${escapeHtml(face.eyebrow)}</p>`)
  parts.push(`<p>${escapeHtml(face.summary)}</p>`)
  for (const group of face.groups) {
    if (group.heading) parts.push(`<h3>${escapeHtml(group.heading)}</h3>`)
    if (group.entries.length > 0) parts.push(`<ul>${group.entries.map((entry) => htmlEntry(entry, siteUrl)).join('')}</ul>`)
  }
  const links = face.links.map((item) => htmlLink(item, siteUrl)).filter((item): item is string => Boolean(item))
  if (links.length > 0) parts.push(htmlList(links))
  return `\n        <section>\n          ${parts.join('\n          ')}\n        </section>`
}

export function renderProfilePage(content: MachineInput): string {
  const { identity, seo, profile, locale } = content
  const label = LABELS[locale]
  const other = OTHER_LOCALE[locale]
  const faces = content.sections.map(faceText)
  const section = (heading: string, body: string) => (body ? `\n        <h2>${escapeHtml(heading)}</h2>\n        ${body}` : '')
  const facts = [
    identity.keywords ? `${label.keywords}: ${escapeHtml(keywordList(identity.keywords).join(', '))}` : '',
    profile?.location ? `${label.location}: ${escapeHtml(profile.location)}` : '',
    profile?.languages?.length ? `${label.languages}: ${escapeHtml(profile.languages.join(', '))}` : '',
  ].filter(Boolean)
  const body = [
    `<p><a href="/?lang=${locale}">${escapeHtml(label.site)}</a> · <a href="/${PROFILE_PAGES[other]}" hreflang="${other}" lang="${other}">${escapeHtml(label.other)}</a></p>`,
    `<h1>${escapeHtml(identity.fullName)}</h1>`,
    `<p>${escapeHtml(identity.role)}</p>`,
    `<p>${escapeHtml(profile ? toPlainText(profile.about) : seo.description)}</p>`,
    htmlList(facts),
    profile ? section(label.titles, htmlList(profile.titles.map(escapeHtml))) : '',
    profile ? section(label.skills, htmlList(profile.skills.map(escapeHtml))) : '',
    profile
      ? section(
          label.roles,
          htmlList(profile.roles.map((role) => `<strong>${escapeHtml(role.title)}</strong>${role.years ? ` (${escapeHtml(role.years)})` : ''}: ${escapeHtml(toPlainText(role.text))}`)),
        )
      : '',
    profile ? section(label.education, htmlList((profile.education ?? []).map((item) => escapeHtml([item.name, item.institution].filter(Boolean).join(', '))))) : '',
    profile?.research ? section(label.research, `<p>${escapeHtml(toPlainText(profile.research))}</p>`) : '',
    section(label.profiles, htmlList(profileLinks(content, faces).map((item) => htmlLink(item, seo.siteUrl)!))),
    ...faces.map((face) => htmlFace(face, seo.siteUrl)),
    `<p><a href="/${LLMS_FILE}">${LLMS_FILE}</a></p>`,
  ].filter(Boolean)
  const canonical = seo.siteUrl ? `\n    <link rel="canonical" href="${escapeHtml(absoluteUrl(PROFILE_PAGES[locale], seo.siteUrl))}" />` : ''
  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(`${identity.fullName} — ${identity.role}`)}</title>
    <meta name="description" content="${escapeHtml(seo.description)}" />
    <meta name="author" content="${escapeHtml(identity.fullName)}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />${canonical}
    <link rel="alternate" hreflang="${locale}" href="/${PROFILE_PAGES[locale]}" />
    <link rel="alternate" hreflang="${other}" href="/${PROFILE_PAGES[other]}" />
    <link rel="stylesheet" href="/seo-fallback.css" />
    <script type="application/ld+json">${jsonForScript(buildProfileJsonLd(content))}</script>
  </head>
  <body>
    <main class="seo-fallback">
        ${body.join('\n        ')}
    </main>
  </body>
</html>
`
}

export type MachineFile = { contentType: string; body: string }

// Every file of the layer, by its path under the site root. llms.txt is one
// file by convention, in the site's primary language.
export function renderMachineFiles(documents: Record<SiteLocale, MachineInput>): Record<string, MachineFile> {
  return {
    [LLMS_FILE]: { contentType: 'text/plain; charset=utf-8', body: renderLlmsTxt(documents.en) },
    [PROFILE_PAGES.en]: { contentType: 'text/html; charset=utf-8', body: renderProfilePage(documents.en) },
    [PROFILE_PAGES.es]: { contentType: 'text/html; charset=utf-8', body: renderProfilePage(documents.es) },
  }
}
