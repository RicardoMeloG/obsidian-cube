import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { ProfileContentSchema } from './src/kernel/profileContent.ts'
import type { ProfileContent } from './src/kernel/profileContent.ts'
import { LLMS_FILE, PROFILE_PAGES, renderMachineFiles } from './src/kernel/seo/renderMachine.ts'
import type { MachineInput } from './src/kernel/seo/renderMachine.ts'
import { renderHeadTags, renderStaticBody } from './src/kernel/seo/renderSeo.ts'
import type { SeoInput } from './src/kernel/seo/renderSeo.ts'
import { SiteContentSchema } from './src/kernel/siteContent.ts'
import type { SiteLocale } from './src/kernel/siteContent.ts'
import { readPagePath, sitePages } from './src/kernel/sitePaths.ts'
import type { SitePage } from './src/kernel/sitePaths.ts'

// Static SEO (src/kernel/seo/renderSeo.ts) and the layer for machines
// (renderMachine.ts): the published content of each language when it exists
// locally (gitignored, written by the admin), otherwise the committed example.
// CI has no private content, so a deploy from CI ships the example until the
// admin publish step renders the pages (ADR 004; spec 012, D-6).
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

// One page per language and face (src/kernel/sitePaths.ts; spec 012, AD-08):
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

// The layer for machines (spec 012, AD-07): /llms.txt and the plain profile
// pages, written into the build and served by the dev server. None of them is
// loaded by the first view.
const MACHINE_FILES = [LLMS_FILE, ...Object.values(PROFILE_PAGES)]

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
  plugins: [react(), tailwindcss(), seoPages(), machineLayer(), preloadLatinFont()],
  // `@/` is src/: imports across top-level modules use it (ADR 006).
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
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
