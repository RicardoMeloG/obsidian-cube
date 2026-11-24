import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { ProfileContentSchema } from './src/kernel/profileContent.ts'
import type { ProfileContent } from './src/kernel/profileContent.ts'
import { LLMS_FILE, PROFILE_PAGES, renderMachineFiles } from './src/kernel/seo/renderMachine.ts'
import { ROBOTS_FILE, SITEMAP_FILE } from './src/kernel/seo/crawlFiles.ts'
import { countRecords, renderMethodologyBody, renderMethodologyHead } from './src/kernel/seo/renderMethodology.ts'
import type { MachineInput } from './src/kernel/seo/renderMachine.ts'
import { renderHeadTags, renderStaticBody } from './src/kernel/seo/renderSeo.ts'
import type { SeoInput } from './src/kernel/seo/renderSeo.ts'
import { SiteContentSchema } from './src/kernel/siteContent.ts'
import type { SiteLocale } from './src/kernel/siteContent.ts'
import { methodologyPages, readPagePath, sitePages } from './src/kernel/sitePaths.ts'
import type { SitePage } from './src/kernel/sitePaths.ts'

// Static SEO (src/kernel/seo/renderSeo.ts) and the layer for machines
// (renderMachine.ts): the published content of each language when it exists
// locally (gitignored, written by the admin), otherwise the committed example.
// CI has no private content, so a deploy from CI ships the example until the
// admin publish step renders the pages (ADR 004; spec 010, D-6).
const CONTENT_DIR = new URL('./public/content/', import.meta.url)
const contentSources = (locale: SiteLocale) => [`site.${locale}.json`, `site.example.${locale}.json`]

function previewSecurityHeaders(): Record<string, string> {
  const policy = JSON.parse(readFileSync(new URL('./infra/security-headers.json', import.meta.url), 'utf8')) as {
    contentSecurityPolicy: Record<string, string[]>
    referrerPolicy: string
    permissionsPolicy: string
  }
  const csp = Object.entries(policy.contentSecurityPolicy)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ')
  return {
    'Content-Security-Policy': csp,
    'Referrer-Policy': policy.referrerPolicy,
    'Permissions-Policy': policy.permissionsPolicy,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  }
}

function readDocument<T>(file: string, schema: { safeParse(data: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }): T {
  const parsed = schema.safeParse(JSON.parse(readFileSync(new URL(file, CONTENT_DIR), 'utf8')))
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new Error(`[seo] ${file} does not match its schema: ${issues}`)
  }
  return parsed.data
}

function readContent(locale: SiteLocale): { file: string; content: SeoInput } {
  for (const file of contentSources(locale)) {
    if (!existsSync(new URL(file, CONTENT_DIR))) continue
    // The same schema the page applies: a document the page would reject (and
    // replace with the example) must not reach the static HTML either.
    return { file, content: readDocument(file, SiteContentSchema) }
  }
  throw new Error(`[seo] no ${locale} site content found in public/content/`)
}

// The profile goes with the site document it describes: the owner's, or
// none; the example's only with the example, never under the owner's name.
function readMachineInput(locale: SiteLocale): MachineInput {
  const { file, content } = readContent(locale)
  const profileFile = file.includes('.example.') ? `profile.example.${locale}.json` : `profile.${locale}.json`
  const profile: ProfileContent | undefined = existsSync(new URL(profileFile, CONTENT_DIR)) ? readDocument(profileFile, ProfileContentSchema) : undefined
  return { ...content, profile }
}

// The methodology pages (spec 022): rendered from docs/methodology/*.md into
// the second HTML entry, which brings the hashed stylesheet and font and no
// script. The repository is public, so its address is not content.
const METHODOLOGY_TEMPLATE = '/methodology.html'
const REPOSITORY_URL = 'https://github.com/RicardoMeloG/obsidian-cube'
const METHODOLOGY_HEAD = /<!-- methodology:head[\s\S]*?<!-- \/methodology:head -->/
const METHODOLOGY_BODY = '<!-- methodology:body -->'

function repositoryPaths(directory: string): string[] {
  return readdirSync(new URL(`./${directory}/`, import.meta.url), { recursive: true, encoding: 'utf8' }).map((name) => `${directory}/${name.replaceAll('\\', '/')}`)
}

function renderMethodology(template: string, locale: SiteLocale): string {
  if (!METHODOLOGY_HEAD.test(template) || !template.includes(METHODOLOGY_BODY) || !template.includes(HTML_TAG)) {
    throw new Error('[methodology] methodology.html lost its <html lang="en"> or its placeholders')
  }
  const counts = countRecords([...repositoryPaths('specs'), ...repositoryPaths('docs/decisions')])
  if (Object.values(counts).includes(0)) throw new Error(`[methodology] a count is zero: ${JSON.stringify(counts)}`)
  const input = {
    content: readContent(locale).content,
    markdown: readFileSync(new URL(`./docs/methodology/methodology.${locale}.md`, import.meta.url), 'utf8'),
    counts,
    repositoryUrl: REPOSITORY_URL,
  }
  // Functions, so a `$` in the text is not read as a replacement pattern.
  return template
    .replace(HTML_TAG, `<html lang="${locale}">`)
    .replace(METHODOLOGY_HEAD, () => renderMethodologyHead(input))
    .replace(METHODOLOGY_BODY, () => renderMethodologyBody(input))
}

function methodologyPage(): Plugin {
  let others: { fileName: string; source: string }[] = []
  return {
    name: 'methodology-page',
    enforce: 'post',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = request.url ?? ''
        const page = methodologyPages().find(({ path }) => path === url.split('?')[0])
        if (!page) return next()
        try {
          const template = readFileSync(new URL(`.${METHODOLOGY_TEMPLATE}`, import.meta.url), 'utf8')
          response.setHeader('Content-Type', 'text/html; charset=utf-8')
          response.end(await server.transformIndexHtml(METHODOLOGY_TEMPLATE, template, url))
        } catch (error) {
          next(error)
        }
      })
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (context.path !== METHODOLOGY_TEMPLATE) return
        if (context.server) {
          const path = new URL(context.originalUrl ?? '/', 'http://localhost').pathname
          return renderMethodology(html, methodologyPages().find((page) => page.path === path)?.locale ?? 'en')
        }
        if (/<script/.test(html)) throw new Error('[methodology] the page gained a script: it must stay static')
        const [english, ...rest] = methodologyPages()
        others = rest.map((page) => ({ fileName: page.file, source: renderMethodology(html, page.locale) }))
        return renderMethodology(html, english.locale)
      },
    },
    // What ships is checked, not only the template: a skipped render would
    // publish an empty page, and a script of another plugin would run on it.
    generateBundle(_options, bundle) {
      const built = bundle[methodologyPages()[0].file]
      const english = built?.type === 'asset' ? { fileName: built.fileName, source: String(built.source) } : undefined
      for (const page of [english, ...others]) {
        if (!page?.source.includes('<main class="method">')) throw new Error('[methodology] a built page lacks its text')
        if (/<script(?! type="application\/ld\+json")/.test(page.source)) throw new Error(`[methodology] ${page.fileName} has a script: it must stay static`)
      }
      if (others.length !== methodologyPages().length - 1) throw new Error('[methodology] a language was not rendered')
      for (const page of others) this.emitFile({ type: 'asset', ...page })
    },
  }
}

// One page per language and face (src/kernel/sitePaths.ts; ADR 009):
// the built index.html, with the language, the share preview and the plain
// body of that page. Rendered last, once Vite has written the scripts and
// preloads into the template, so every page loads exactly what index.html
// loads. The dev server renders the page the address names.
const SEO_HEAD = /<!-- seo:head[\s\S]*?<!-- \/seo:head -->/
const SEO_BODY = '<!-- seo:body -->'
const HTML_TAG = '<html lang="en">'

function renderPage(template: string, page: SitePage): string {
  const { content } = readContent(page.locale)
  return template
    .replace(HTML_TAG, `<html lang="${page.locale}">`)
    .replace(SEO_HEAD, renderHeadTags(content, page.face))
    .replace(SEO_BODY, renderStaticBody(content, page.face))
}

function seoPages(): Plugin {
  let pages: { fileName: string; source: string }[] = []
  return {
    name: 'seo-pages',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (context.path === METHODOLOGY_TEMPLATE) return
        if (!SEO_HEAD.test(html) || !html.includes(SEO_BODY) || !html.includes(HTML_TAG)) {
          throw new Error('[seo] index.html lost its <html lang="en"> or its seo:head / seo:body placeholders')
        }
        if (context.server) {
          const named = readPagePath(new URL(context.originalUrl ?? '/', 'http://localhost').pathname)
          return renderPage(html, { locale: named?.locale ?? 'en', face: named?.face ?? null })
        }
        const [root, ...others] = sitePages()
        const sources = (['en', 'es'] as const).map((locale) => `public/content/${readContent(locale).file}`)
        console.info(`[seo] ${others.length + 1} pages rendered from ${sources.join(' and ')}`)
        pages = others.map((page) => ({ fileName: page.file, source: renderPage(html, page) }))
        return renderPage(html, root)
      },
    },
    generateBundle() {
      for (const page of pages) this.emitFile({ type: 'asset', ...page })
    },
  }
}

// The layer for machines (ADR 009): /llms.txt and the plain profile
// pages, written into the build and served by the dev server. None of them is
// loaded by the first view.
const MACHINE_FILES = [LLMS_FILE, ...Object.values(PROFILE_PAGES), ROBOTS_FILE, SITEMAP_FILE]

function machineLayer(): Plugin {
  const render = () => renderMachineFiles({ en: readMachineInput('en'), es: readMachineInput('es') })
  return {
    name: 'machine-layer',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const name = (request.url ?? '').split('?')[0].replace(/^\//, '')
        if (!MACHINE_FILES.includes(name)) return next()
        // Rendered on each request, so an edit to the content shows at once.
        const file = render()[name]
        if (!file) return next() // sitemap.xml without the site's public address
        response.setHeader('Content-Type', file.contentType)
        response.end(file.body)
      })
    },
    generateBundle() {
      for (const [fileName, file] of Object.entries(render())) this.emitFile({ type: 'asset', fileName, source: file.body })
    },
  }
}

// Inter's latin file is on every first view (ADR 006): preloading it lets the
// browser fetch it with the stylesheet instead of after it. The hash is known
// only once the bundle exists, hence a post-build hook.
function preloadLatinFont(): Plugin {
  return {
    name: 'preload-latin-font',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const font = Object.keys(context.bundle ?? {}).find((file) => /inter-latin-wght-normal-[^/]+\.woff2$/.test(file))
        if (!font) return
        return [{ tag: 'link', attrs: { rel: 'preload', href: `/${font}`, as: 'font', type: 'font/woff2', crossorigin: '' }, injectTo: 'head' }]
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), seoPages(), methodologyPage(), machineLayer(), preloadLatinFont()],
  // `@/` is src/: imports across top-level modules use it (ADR 006).
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // iOS Safari before 16.4 ignores range media queries (width <= 720px), so
  // every width refinement was lost on those phones (pending item dt-33).
  // Targeting Safari 16.0 makes the CSS minifier write min-/max-width.
  build: {
    cssTarget: ['chrome111', 'edge111', 'firefox114', 'safari16'],
    rolldownOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        methodology: fileURLToPath(new URL('./methodology.html', import.meta.url)),
      },
    },
  },
  // A port of its own, so it does not clash with other projects on 5173;
  // strictPort fails instead of moving silently to another port.
  server: {
    // Listens on the local network too, to open the site from a phone.
    host: true,
    port: 5180,
    strictPort: true,
  },
  preview: {
    port: 5181,
    strictPort: true,
    // The production security headers (infra/security-headers.json), enforced,
    // so the layout check exercises the built site under its content security policy.
    headers: previewSecurityHeaders(),
  },
})
