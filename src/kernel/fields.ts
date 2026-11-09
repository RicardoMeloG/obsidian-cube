// Field schemas shared by the face content (siteContent.ts) and the
// compositions (compositions.ts), kept apart so neither imports the other.
import { z } from 'zod/mini'

// The inline tags rich text may carry: the one list the browser sanitizer
// (src/features/content/sanitizeRichText.ts) allows and the admin shows next
// to every rich field. Inline only: a face is a single-viewport poster.
export const RICH_TEXT_TAGS = ['strong', 'em', 'b', 'i', 'u', 's', 'a', 'br', 'code', 'span', 'sup', 'sub', 'mark', 'small']

// Rich prose fields are rendered through `sanitizeRichText` (inline HTML
// whitelist) via the <RichText/> component. Still a plain string at the schema
// level — the sanitization boundary lives at render time, not validation.
export const RichTextSchema = z.string().check(z.minLength(1)).clone().register(z.globalRegistry, { widget: 'rich', tags: RICH_TEXT_TAGS })

export const CtaSchema = z.object({
  label: z.string().check(z.minLength(1)).clone().register(z.globalRegistry, { title: 'Texto' }),
  href: z.optional(z.string().check(z.minLength(1))).clone().register(z.globalRegistry, { title: 'Enlace' }),
})

export const LinkSchema = z.object({
  label: z.string().check(z.minLength(1)).clone().register(z.globalRegistry, { title: 'Texto' }),
  description: z.optional(RichTextSchema).clone().register(z.globalRegistry, { title: 'Descripción' }),
  href: z.optional(z.string().check(z.minLength(1))).clone().register(z.globalRegistry, { title: 'Enlace' }),
})
