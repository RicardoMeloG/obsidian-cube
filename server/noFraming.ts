// The admin never renders inside another page's frame (audit-4 F-1). With the
// development bypass on, a framed admin is signed in, and a page open in the
// browser could lay a button of its own over «Publicar»; before the bypass the
// session cookie (SameSite=lax) did not reach a frame on another site, so the
// frame showed the login. The admin's own preview frames the site on 5180, not
// the admin, so nothing of it breaks.
export const NO_FRAMING = {
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
} as const

type HeaderSink = { setHeader(name: string, value: string): unknown }

export function noFraming(_request: unknown, response: HeaderSink, next: () => void): void {
  for (const [name, value] of Object.entries(NO_FRAMING)) response.setHeader(name, value)
  next()
}
