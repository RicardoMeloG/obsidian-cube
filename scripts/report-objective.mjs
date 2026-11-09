// Objective report (spec 012, AD-02): what a stranger and a machine find, read
// from the owner's published documents and the build. Every artifact link a
// face carries is requested without credentials, and a link that does not
// answer 200 is not an artifact. The raw HTML must name the owner, the role,
// the keywords and the links, and its description must not say "prototype";
// the layer for machines (AD-07) must carry the same. It prints the face, the
// place of the link, the host and the status, never the content's text.
//
// A local report, not a CI gate: CI has no private content. LinkedIn answers
// automated requests with 999 and its sign-in page (2026-10-19), so its links
// are listed to be opened by hand in a private window, signed out.
//
//   npm run build && npm run report:objective
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const reviewBuild = process.argv.find(arg => arg.startsWith('--out-dir='))?.slice('--out-dir='.length)
const DIST = reviewBuild ? pathToFileURL(resolve(reviewBuild) + sep) : new URL('../dist/', import.meta.url)
const CONTENT = reviewBuild ? new URL('./content/', DIST) : new URL('../public/content/', import.meta.url)
console.log(`Content reported: ${CONTENT.href}; HTML: ${DIST.href}`)
const BY_HAND = /(^|\.)linkedin\.com$/i

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { SiteContentSchema } = await vite.ssrLoadModule('/src/kernel/siteContent.ts')
const { ProfileContentSchema } = await vite.ssrLoadModule('/src/kernel/profileContent.ts')
const { faceText, faceLinks } = await vite.ssrLoadModule('/src/kernel/seo/faceText.ts')
const { escapeHtml, keywordList } = await vite.ssrLoadModule('/src/kernel/seo/renderSeo.ts')
const { LLMS_FILE, PROFILE_PAGES } = await vite.ssrLoadModule('/src/kernel/seo/machineFiles.ts')
await vite.close()

const problems = []
const problem = (text) => problems.push(text)
const read = (url) => (existsSync(url) ? readFileSync(url, 'utf8') : undefined)

const documents = {}
for (const locale of ['en', 'es']) {
  const raw = read(new URL(`site.${locale}.json`, CONTENT))
  if (!raw) {
    problem(`site.${locale}.json is not published: the report reads the owner's documents, not the example`)
    continue
  }
  const parsed = SiteContentSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) problem(`site.${locale}.json does not match the content schema`)
  else documents[locale] = parsed.data
}

// 1. Artifacts: every web link of every face, once, requested anonymously.
async function status(href) {
  try {
    const response = await fetch(href, { redirect: 'follow', headers: { 'user-agent': 'obsidian-cube report:objective' }, signal: AbortSignal.timeout(15000) })
    return response.status
  } catch (error) {
    return `error (${error.cause?.code ?? error.name})`
  }
}

console.log('Artifacts (anonymous request, redirects followed):')
const byHand = []
for (const [locale, content] of Object.entries(documents)) {
  for (const section of content.sections) {
    const links = faceLinks(faceText(section)).filter((link) => /^https:\/\//i.test(link.href))
    if (links.length === 0) problem(`${locale} ${section.id}: no web link`)
    for (const [index, link] of links.entries()) {
      const host = new URL(link.href).host
      if (BY_HAND.test(host)) {
        byHand.push(`${locale} ${section.id} #${index + 1} ${host}`)
        continue
      }
      const code = await status(link.href)
      console.log(`  ${locale} ${section.id.padEnd(8)} #${index + 1}  ${host.padEnd(22)} ${code}`)
      if (code !== 200) problem(`${locale} ${section.id} #${index + 1} (${host}) answered ${code}`)
    }
  }
}
for (const line of byHand) console.log(`  ${line}: by hand, in a private window`)

// 2. The raw HTML: what machines that do not run JavaScript read.
const html = read(new URL('index.html', DIST))
const en = documents.en
if (!html) problem('dist/index.html is missing: run `npm run build` first')
else if (en) {
  const has = (value) => html.includes(escapeHtml(value))
  const checks = [
    ['the full name', en.identity.fullName],
    ['the role', en.identity.role],
    ...keywordList(en.identity.keywords).map((keyword) => [`the keyword ${keyword}`, keyword]),
    ...Object.entries(en.identity.links ?? {}).map(([name, href]) => [`the ${name} link`, href]),
  ]
  for (const [label, value] of checks) if (!has(value)) problem(`dist/index.html does not name ${label}`)
  const description = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? ''
  if (/prototype|prototipo/i.test(description)) problem('the search description says "prototype"')
  if (!html.includes(`href="/${PROFILE_PAGES.en}"`)) problem('dist/index.html does not link the profile page')
  console.log(`Raw HTML: ${checks.length} names checked, the description and the link to the profile page.`)
}

// 3. The layer for machines: the same facts, in llms.txt and the profile pages.
for (const [locale, content] of Object.entries(documents)) {
  const files = locale === 'en' ? [LLMS_FILE, PROFILE_PAGES.en] : [PROFILE_PAGES.es]
  const rawProfile = read(new URL(`profile.${locale}.json`, CONTENT))
  const profile = rawProfile ? ProfileContentSchema.safeParse(JSON.parse(rawProfile)) : undefined
  if (!profile) problem(`profile.${locale}.json is not published: the layer carries the identity and the faces only`)
  else if (!profile.success) problem(`profile.${locale}.json does not match its schema`)
  for (const file of files) {
    const body = read(new URL(file, DIST))
    if (!body) {
      problem(`dist/${file} is missing`)
      continue
    }
    // The pages escape what they write; llms.txt is plain text.
    const contains = (value) => body.includes(file.endsWith('.html') ? escapeHtml(value) : value)
    const wanted = [content.identity.fullName, content.identity.role, ...Object.values(content.identity.links ?? {}), ...(profile?.success ? profile.data.skills : [])]
    const missing = wanted.filter((value) => !contains(value))
    if (missing.length > 0) problem(`dist/${file} misses ${missing.length} of ${wanted.length} facts (name, role, links, skills)`)
  }
}
console.log(`Layer for machines: ${LLMS_FILE} and the profile pages checked.`)

for (const line of problems) console.log(`- ${line}`)
console.log(problems.length === 0 ? 'Objective report: nothing missing.' : `Objective report: ${problems.length} things missing.`)
process.exitCode = problems.length > 0 ? 1 : 0
