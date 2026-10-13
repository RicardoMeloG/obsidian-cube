import DOMPurify from 'dompurify'

// Single security boundary for admin-authored rich content: every rich field
// renders through this allow-list, in the browser. It needs the DOM, so it
// stays out of the kernel (ADR 005); the kernel only measures visible text.
//
// Inline-only on purpose: the layout treats each face as a single-viewport
// "poster", so block tags (p, ul, headings) are disallowed to avoid breaking it.
const ALLOWED_TAGS = [
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'a',
  'br',
  'code',
  'span',
  'sup',
  'sub',
  'mark',
  'small',
]

// Only anchors carry attributes. `javascript:`/`data:` URIs are blocked by
// DOMPurify's default URI policy; we do not add ALLOW_UNKNOWN_PROTOCOLS.
const ALLOWED_ATTR = ['href', 'target', 'rel']

let hookInstalled = false

function ensureHook() {
  if (hookInstalled) return
  // Harden any link that opens a new tab against reverse-tabnabbing.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })
  hookInstalled = true
}

export function sanitizeRichText(dirty: string): string {
  ensureHook()
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  })
}
