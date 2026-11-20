// Allowed link targets (dp-06): the web over HTTPS, e-mail, a path on this
// site, or an anchor in the page. The admin's publish rules ask for these
// before publishing (publishRules.ts), but only as warnings while the project
// is in development, and the site renders with the tolerant contract. So the
// site itself checks every content link it turns into an anchor: anything
// else (javascript:, data:, http:, a protocol-relative //host) is shown as
// plain text, not as a link. The CSP and React 19 are the layers behind this.
// A site path may hold no backslash and no white space: browsers read
// `/\host` and `/<tab>/host` as the protocol-relative `//host`.
export function isAllowedHref(href: string): boolean {
  return /^https:\/\/[^\s/]+\.[^\s]+$/i.test(href) || /^mailto:[^\s@]+@[^\s@]+$/i.test(href) || /^\/(?![/\\])[^\\\s]*$/.test(href) || /^#/.test(href)
}

/** The link target when it is allowed, otherwise undefined: render it as text. */
export function safeHref(href: string | undefined): string | undefined {
  return href && isAllowedHref(href.trim()) ? href.trim() : undefined
}
