// Content contract shared by the site, its build-time SEO and the admin.
// Pure: no DOM, no React; loading and locale detection live in
// src/features/content.
import { z } from 'zod'
import exampleEn from '../../public/content/site.example.en.json'
import exampleEs from '../../public/content/site.example.es.json'
import { CompositionSchema } from './compositions'
import { FACE_ORDER } from './faces'
import { CtaSchema, LinkSchema, RichTextSchema } from './fields'
import type { FaceId } from './faces'

export type SiteLocale = 'en' | 'es'

export const FaceIdSchema = z.enum(FACE_ORDER as [FaceId, ...FaceId[]])

// `meta({ title })` is the field's label in the admin's generated form
// (spec 011, AD-04); the admin speaks Spanish.
const SiteSectionSchema = z.object({
  id: FaceIdSchema.meta({ title: 'Cara', widget: 'fixed' }),
  label: z.string().min(1).meta({ title: 'Nombre en el cubo y el dock' }),
  title: z.string().min(1).meta({ title: 'Título' }),
  eyebrow: z.string().min(1).optional().meta({ title: 'Antetítulo' }),
  summary: RichTextSchema.meta({ title: 'Resumen' }),
  // The line under the face name in the stage's dock (spec 011, AD-02).
  tagline: z.string().min(1).optional().meta({ title: 'Línea bajo el nombre en el dock' }),
  ctaPrimary: CtaSchema.optional().meta({ title: 'Llamado principal' }),
  ctaSecondary: CtaSchema.optional().meta({ title: 'Llamado secundario' }),
  // The face's composition in the stage layout (spec 011, AD-01).
  composition: CompositionSchema.optional(),
  intro: RichTextSchema.optional().meta({ title: 'Introducción (diálogo)' }),
  highlights: z.array(RichTextSchema).optional().meta({ title: 'Destacados (diálogo)' }),
  proofPoints: z.array(RichTextSchema).optional().meta({ title: 'Pruebas (diálogo)' }),
  links: z.array(LinkSchema).optional().meta({ title: 'Enlaces (diálogo)' }),
  // Legacy: no component draws it (only the static HTML for crawlers reads
  // it). Read-only in the admin until a content migration retires it
  // (audit-3 F-7).
  cta: CtaSchema.optional().meta({ title: 'Llamado antiguo (heredado, solo lectura)', widget: 'fixed' }),
  detail: z
    .object({
      title: z.string().min(1).meta({ title: 'Título' }),
      summary: RichTextSchema.meta({ title: 'Resumen' }),
      points: z.array(RichTextSchema).optional().meta({ title: 'Puntos' }),
      links: z.array(LinkSchema).optional().meta({ title: 'Enlaces' }),
    })
    .optional()
    .meta({ title: 'Detalle (diálogo)' }),
})

export const SiteContentSchema = z.object({
  locale: z.enum(['en', 'es']).meta({ title: 'Idioma', widget: 'fixed' }),
  identity: z
    .object({
      displayName: z.string().min(1).meta({ title: 'Nombre visible' }),
      fullName: z.string().min(1).meta({ title: 'Nombre completo' }),
      // `handle` was retired on 2026-10-16 (audit-3 F-7): nothing rendered it;
      // the GitHub profile URL in `links` carries it. Older documents that
      // still have the key parse, and the key is dropped.
      role: z.string().min(1).meta({ title: 'Rol' }),
      // One line under the role, e.g. "AI Engineer · LLM agents · Python · AWS".
      keywords: z.string().min(1).optional().meta({ title: 'Palabras clave' }),
      // Profiles shown in the stage's top bar; e-mail is not shown there,
      // CONTACT is the channel (spec 011, AD-02).
      links: z
        .object({
          github: z.string().min(1).optional().meta({ title: 'GitHub' }),
          linkedin: z.string().min(1).optional().meta({ title: 'LinkedIn' }),
        })
        .optional()
        .meta({ title: 'Perfiles' }),
    })
    .meta({ title: 'Identidad' }),
  seo: z
    .object({
      title: z.string().min(1).meta({ title: 'Título de la página' }),
      description: z.string().min(1).meta({ title: 'Descripción' }),
      // Public origin of the deployed site (canonical and og:url), no trailing slash.
      siteUrl: z.string().url().optional().meta({ title: 'URL pública del sitio' }),
      // Share preview image: a path under public/ or an absolute URL.
      image: z.string().min(1).optional().meta({ title: 'Imagen al compartir' }),
    })
    .meta({ title: 'SEO' }),
  hero: z
    .object({
      headline: z.string().min(1).meta({ title: 'Titular' }),
      summary: RichTextSchema.meta({ title: 'Resumen' }),
    })
    .meta({ title: 'Portada' }),
  sections: z.array(SiteSectionSchema).length(FACE_ORDER.length).meta({ title: 'Caras' }),
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
      cta: section?.cta,
      ctaPrimary: section?.ctaPrimary ?? fallback.ctaPrimary,
      ctaSecondary: section?.ctaSecondary ?? fallback.ctaSecondary,
      detail: section?.detail ?? fallback.detail,
      tagline: section?.tagline ?? fallback.tagline ?? '',
      composition: section?.composition ?? fallback.composition!,
    }
  })
}
