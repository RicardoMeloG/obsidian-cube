// Field schemas shared by the face content (siteContent.ts) and the
// compositions (compositions.ts), kept apart so neither imports the other.
import { z } from 'zod'

// The inline tags rich text may carry: the one list the browser sanitizer
// (src/features/content/sanitizeRichText.ts) allows and the admin shows next
// to every rich field. Inline only: a face is a single-viewport poster.
export const RICH_TEXT_TAGS = ['strong', 'em', 'b', 'i', 'u', 's', 'a', 'br', 'code', 'span', 'sup', 'sub', 'mark', 'small']

// Rich prose fields are rendered through `sanitizeRichText` (inline HTML
// whitelist) via the <RichText/> component. Still a plain string at the schema
// level — the sanitization boundary lives at render time, not validation.
export const RichTextSchema = z.string().min(1).meta({ widget: 'rich', tags: RICH_TEXT_TAGS })

export const CtaSchema = z.object({
  label: z.string().min(1).meta({ title: 'Texto' }),
  href: z.string().min(1).optional().meta({ title: 'Enlace' }),
})

export const LinkSchema = z.object({
  label: z.string().min(1).meta({ title: 'Texto' }),
  description: RichTextSchema.optional().meta({ title: 'Descripción' }),
  href: z.string().min(1).optional().meta({ title: 'Enlace' }),
})
