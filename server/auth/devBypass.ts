import { appEnv } from '../appEnv'
import { PORT } from '../address'

// The development login bypass (owner, 2026-10-18): the work is agentic, so in
// development an agent must be able to use the admin without the owner at the
// keyboard. It needs both APP_ENV=development and ADMIN_AUTH=off, so it is
// never on by default; with APP_ENV=production it stops the server. Even then
// it only lets through requests made on this machine to the admin's own
// address, with no Origin from another site: a page open in the browser cannot
// call the admin's API, and a DNS name pointed at 127.0.0.1 is refused. Nor can
// it frame the admin and lay its own button over it: the admin refuses every
// frame (noFraming.ts, audit-4 F-1).
export function adminAuthOff(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.ADMIN_AUTH
  if (value === undefined || value === '' || value === 'on') return false
  if (value !== 'off') throw new Error(`ADMIN_AUTH debe ser on u off, no "${value}".`)
  if (appEnv(env.APP_ENV) === 'production') throw new Error('ADMIN_AUTH=off no se permite con APP_ENV=production.')
  return true
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
const OWN_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`])
const OWN_ORIGINS = new Set([...OWN_HOSTS].map((host) => `http://${host}`))

export type LocalRequest = {
  headers: { host?: string; origin?: string }
  socket?: { remoteAddress?: string }
}

export function isLocalRequest(request: LocalRequest): boolean {
  const { host, origin } = request.headers
  return LOOPBACK.has(request.socket?.remoteAddress ?? '') && OWN_HOSTS.has(host ?? '') && (origin === undefined || OWN_ORIGINS.has(origin))
}

export function bypasses(request: LocalRequest, env: NodeJS.ProcessEnv = process.env): boolean {
  return adminAuthOff(env) && isLocalRequest(request)
}

// The name the admin shows while the bypass is on.
export const BYPASS_USER = 'desarrollo (sin login)'
