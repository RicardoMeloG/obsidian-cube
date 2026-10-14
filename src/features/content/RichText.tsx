import { createElement } from 'react'
import type { HTMLAttributes } from 'react'
import { sanitizeRichText } from './sanitizeRichText'

type RichTextTag = 'p' | 'span' | 'small' | 'div' | 'li'

type RichTextProps = Omit<HTMLAttributes<HTMLElement>, 'dangerouslySetInnerHTML' | 'children'> & {
  html: string
  as?: RichTextTag
  className?: string
  // Secondary lines are the first to go when a short screen compacts the
  // rails (ADR 006, layout modes).
  priority?: 'secondary'
}

// Renders admin-authored prose as a safe subset of inline HTML. All content
// flows through `sanitizeRichText` (whitelist). Plain text renders identically
// to a plain text node, so existing content needs no migration.
export function RichText({ html, as = 'p', className, priority, ...rest }: RichTextProps) {
  if (!html || html.trim() === '') return null

  return createElement(as, {
    ...rest,
    className,
    'data-priority': priority,
    dangerouslySetInnerHTML: { __html: sanitizeRichText(html) },
  })
}
