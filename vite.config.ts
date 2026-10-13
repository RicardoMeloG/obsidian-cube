import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { renderHeadTags, renderStaticBody } from './src/kernel/seo/renderSeo.ts'
import type { SeoInput } from './src/kernel/seo/renderSeo.ts'

// Static SEO (src/kernel/seo/renderSeo.ts): the published English content when it
// exists locally (gitignored, written by the admin), otherwise the committed
// example. CI has no private content, so a deploy from CI ships the example
// until the admin publish step renders the page (ADR 004).
const CONTENT_DIR = new URL('./public/content/', import.meta.url)
const SEO_SOURCES = ['site.en.json', 'site.example.en.json']

function readSeoContent(): { file: string; content: SeoInput } {
  for (const file of SEO_SOURCES) {
    const url = new URL(file, CONTENT_DIR)
    if (!existsSync(url)) continue
    const content = JSON.parse(readFileSync(url, 'utf8')) as SeoInput
    if (!content?.identity?.fullName || !content?.seo?.title || !Array.isArray(content.sections)) {
      throw new Error(`[seo] ${file} is missing identity, seo or sections`)
    }
    return { file, content }
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
  // Puerto propio para no chocar con otros proyectos que usan el 5173 por defecto.
  // strictPort evita que Vite salte a otro puerto en silencio si el 5180 está ocupado.
  server: {
    // host: true → escucha en 0.0.0.0 (toda la red local), no solo en localhost,
    // para poder abrir el sitio desde otros dispositivos (móvil) y desde la IP.
    host: true,
    port: 5180,
    strictPort: true,
  },
  preview: {
    port: 5181,
    strictPort: true,
  },
})
