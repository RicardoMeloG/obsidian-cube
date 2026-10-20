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
  }
  const csp = Object.entries(policy.contentSecurityPolicy)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ')
  return {
    'Content-Security-Policy': csp,
    'Referrer-Policy': policy.referrerPolicy,
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

function seoFromContent(): Plugin {
  let announced = false
  return {
    name: 'seo-from-content',
    transformIndexHtml(html) {
      const { file, content } = readContent('en')
      if (!announced) {
        console.info(`[seo] index.html rendered from public/content/${file}`)
        announced = true
      }
      const head = /<!-- seo:head[\s\S]*?<!-- \/seo:head -->/
      if (!head.test(html) || !html.includes('<!-- seo:body -->')) {
        throw new Error('[seo] index.html lost its seo:head / seo:body placeholders')
      }
      return html.replace(head, renderHeadTags(content)).replace('<!-- seo:body -->', renderStaticBody(content))
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
  plugins: [react(), tailwindcss(), seoFromContent(), machineLayer(), preloadLatinFont()],
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
