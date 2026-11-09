// Content contract shared by the site, its build-time SEO and the admin.
// Pure: no DOM, no React; loading and locale detection live in
// src/features/content.
import { z } from 'zod/mini'
import exampleEn from '../../public/content/site.example.en.json'
import exampleEs from '../../public/content/site.example.es.json'
import { CompositionSchema } from './compositions'
import { FACE_ORDER } from './faces'
import { CtaSchema, LinkSchema, RichTextSchema } from './fields'
import type { FaceId } from './faces'

export type SiteLocale = 'en' | 'es'

export const FaceIdSchema = z.enum(FACE_ORDER as [FaceId, ...FaceId[]])

// Metadata registered on a clone labels each field in the admin's generated form
// (spec 011, AD-04); the admin speaks Spanish.
const SiteSectionSchema = z.object({
  id: FaceIdSchema.clone().register(z.globalRegistry, { title: 'Cara', widget: 'fixed' }),
  label: z.string().check(z.minLength(1)).clone().register(z.globalRegistry, { title: 'Nombre en el cubo y el dock' }),
  title: z.string().check(z.minLength(1)).clone().register(z.globalRegistry, { title: 'Título' }),
  eyebrow: z.optional(z.string().check(z.minLength(1))).clone().register(z.globalRegistry, { title: 'Antetítulo' }),
  summary: RichTextSchema.clone().register(z.globalRegistry, { title: 'Resumen' }),
  // The line under the face name in the stage's dock (spec 011, AD-02).
  tagline: z.optional(z.string().check(z.minLength(1))).clone().register(z.globalRegistry, { title: 'Línea bajo el nombre en el dock' }),
  ctaPrimary: z.optional(CtaSchema).clone().register(z.globalRegistry, { title: 'Llamado principal' }),
  ctaSecondary: z.optional(CtaSchema).clone().register(z.globalRegistry, { title: 'Llamado secundario' }),
  // The face's composition in the stage layout (spec 011, AD-01).
  composition: z.optional(CompositionSchema),
  intro: z.optional(RichTextSchema).clone().register(z.globalRegistry, { title: 'Introducción (diálogo)' }),
  highlights: z.optional(z.array(RichTextSchema)).clone().register(z.globalRegistry, { title: 'Destacados (diálogo)' }),
  proofPoints: z.optional(z.array(RichTextSchema)).clone().register(z.globalRegistry, { title: 'Pruebas (diálogo)' }),
  links: z.optional(z.array(LinkSchema)).clone().register(z.globalRegistry, { title: 'Enlaces (diálogo)' }),
  detail: z.optional(z
    .object({
      title: z.string().check(z.minLength(1)).clone().register(z.globalRegistry, { title: 'Título' }),
      summary: RichTextSchema.clone().register(z.globalRegistry, { title: 'Resumen' }),
      points: z.optional(z.array(RichTextSchema)).clone().register(z.globalRegistry, { title: 'Puntos' }),
      links: z.optional(z.array(LinkSchema)).clone().register(z.globalRegistry, { title: 'Enlaces' }),
    }))
    .clone().register(z.globalRegistry, { title: 'Detalle (diálogo)' }),
})

export const SiteContentSchema = z.object({
  locale: z.enum(['en', 'es']).clone().register(z.globalRegistry, { title: 'Idioma', widget: 'fixed' }),
  identity: z
    .object({
      displayName: z.string().check(z.minLength(1)).clone().register(z.globalRegistry, { title: 'Nombre visible' }),
      fullName: z.string().check(z.minLength(1)).clone().register(z.globalRegistry, { title: 'Nombre completo' }),
      // `handle` was retired on 2026-10-16 (audit-3 F-7): nothing rendered it;
      // the GitHub profile URL in `links` carries it. Older documents that
      // still have the key parse, and the key is dropped.
      role: z.string().check(z.minLength(1)).clone().register(z.globalRegistry, { title: 'Rol' }),
      // One line under the role, e.g. "AI Engineer · LLM agents · Python · AWS".
      keywords: z.optional(z.string().check(z.minLength(1))).clone().register(z.globalRegistry, { title: 'Palabras clave' }),
      // Profiles shown in the stage's top bar; e-mail is not shown there,
      // CONTACT is the channel (spec 011, AD-02).
      links: z.optional(z
        .object({
          github: z.optional(z.string().check(z.minLength(1))).clone().register(z.globalRegistry, { title: 'GitHub' }),
          linkedin: z.optional(z.string().check(z.minLength(1))).clone().register(z.globalRegistry, { title: 'LinkedIn' }),
        }))
        .clone().register(z.globalRegistry, { title: 'Perfiles' }),
    })
    .clone().register(z.globalRegistry, { title: 'Identidad' }),
  seo: z
    .object({
      title: z.string().check(z.minLength(1)).clone().register(z.globalRegistry, { title: 'Título de la página' }),
      description: z.string().check(z.minLength(1)).clone().register(z.globalRegistry, { title: 'Descripción' }),
      // Public origin of the deployed site (canonical and og:url), no trailing slash.
      siteUrl: z.optional(z.url()).clone().register(z.globalRegistry, { title: 'URL pública del sitio' }),
      // Share preview image: a path under public/ or an absolute URL.
      image: z.optional(z.string().check(z.minLength(1))).clone().register(z.globalRegistry, { title: 'Imagen al compartir' }),
    })
    .clone().register(z.globalRegistry, { title: 'SEO' }),
  hero: z
    .object({
      headline: z.string().check(z.minLength(1)).clone().register(z.globalRegistry, { title: 'Titular' }),
      summary: RichTextSchema.clone().register(z.globalRegistry, { title: 'Resumen' }),
    })
    .clone().register(z.globalRegistry, { title: 'Portada' }),
  sections: z.array(SiteSectionSchema).check(z.length(FACE_ORDER.length)).clone().register(z.globalRegistry, { title: 'Caras' }),
})

export type SiteContent = z.infer<typeof SiteContentSchema>
export type SiteSection = SiteContent['sections'][number]

// A face as the interface renders it: every field the document left empty is
// already filled from the example (normalizeSections).
export type FaceContent = Omit<SiteSection, 'eyebrow' | 'tagline' | 'composition'> & {
  eyebrow: string
  tagline: string
  composition: NonNullable<SiteSection['composition']>
}
export type FaceDetail = NonNullable<SiteSection['detail']>
export type FaceCta = NonNullable<SiteSection['ctaPrimary']>

// The committed example is the one set of defaults: it renders before the
// published content arrives, replaces it when it is missing or invalid, and
// fills fields a published face leaves empty, in the same locale.
const DEFAULT_CONTENT: Record<SiteLocale, SiteContent> = {
  en: SiteContentSchema.parse(exampleEn),
  es: SiteContentSchema.parse(exampleEs),
}

export function getDefaultSiteContent(locale: SiteLocale): SiteContent {
  return DEFAULT_CONTENT[locale]
}

export function normalizeSections(sections: SiteSection[], locale: SiteLocale): FaceContent[] {
  const defaults = DEFAULT_CONTENT[locale].sections

  return FACE_ORDER.map((id) => {
    const section = sections.find((candidate) => candidate.id === id)
    const fallback = defaults.find((candidate) => candidate.id === id)!

    return {
      id,
      label: section?.label ?? fallback.label,
      title: section?.title ?? fallback.title,
      eyebrow: section?.eyebrow ?? fallback.eyebrow ?? '',
      summary: section?.summary ?? fallback.summary,
      intro: section?.intro,
      highlights: section?.highlights,
      proofPoints: section?.proofPoints,
      links: section?.links,
      ctaPrimary: section?.ctaPrimary ?? fallback.ctaPrimary,
      ctaSecondary: section?.ctaSecondary ?? fallback.ctaSecondary,
      detail: section?.detail ?? fallback.detail,
      tagline: section?.tagline ?? fallback.tagline ?? '',
      composition: section?.composition ?? fallback.composition!,
    }
  })
}
