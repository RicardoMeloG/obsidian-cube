import { createElement } from 'react'
import { sanitizeRichText } from './sanitizeRichText'

type RichTextTag = 'p' | 'span' | 'small' | 'div' | 'li'

type RichTextProps = {
  html: string
  as?: RichTextTag
  className?: string
}

// Renders admin-authored prose as a safe subset of inline HTML. All content
// flows through `sanitizeRichText` (whitelist). Plain text renders identically
// to a plain text node, so existing content needs no migration.
export function RichText({ html, as = 'p', className }: RichTextProps) {
  if (!html || html.trim() === '') return null

  return createElement(as, {
    className,
    dangerouslySetInnerHTML: { __html: sanitizeRichText(html) },
  })
}
