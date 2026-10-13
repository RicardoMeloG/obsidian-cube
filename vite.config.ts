import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { renderHeadTags, renderStaticBody } from './src/kernel/seo/renderSeo.ts'
import type { SeoInput } from './src/kernel/seo/renderSeo.ts'
import { SiteContentSchema } from './src/kernel/siteContent.ts'

// Static SEO (src/kernel/seo/renderSeo.ts): the published English content when it
// exists locally (gitignored, written by the admin), otherwise the committed
// example. CI has no private content, so a deploy from CI ships the example
// until the admin publish step renders the page (ADR 004).
const CONTENT_DIR = new URL('./public/content/', import.meta.url)
const SEO_SOURCES = ['site.en.json', 'site.example.en.json']

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

function readSeoContent(): { file: string; content: SeoInput } {
  for (const file of SEO_SOURCES) {
    const url = new URL(file, CONTENT_DIR)
    if (!existsSync(url)) continue
    // The same schema the page applies: a document the page would reject (and
    // replace with the example) must not reach the static HTML either.
    const parsed = SiteContentSchema.safeParse(JSON.parse(readFileSync(url, 'utf8')))
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
      throw new Error(`[seo] ${file} does not match the content schema: ${issues}`)
    }
    return { file, content: parsed.data }
  }
  throw new Error('[seo] no site content found in public/content/')
}

function seoFromContent(): Plugin {
  let announced = false
  return {
    name: 'seo-from-content',
    transformIndexHtml(html) {
      const { file, content } = readSeoContent()
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), seoFromContent()],
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
