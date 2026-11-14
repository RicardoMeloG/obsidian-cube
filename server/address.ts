// Where the local admin listens. Localhost-only on purpose (AGENTS.md, admin
// rules): there is no login rate limiting, the cookie is not `secure` and
// sessions are in-memory. Never bind to 0.0.0.0.
//
// ADMIN_PORT lets a second checkout or an agent run its own admin while the
// owner's runs (spec 013, D-8). It is read from the process environment at
// import, before .env is loaded, so it must be set in the shell.
export const HOST = '127.0.0.1'

function resolvePort(): number {
  const raw = process.env.ADMIN_PORT
  if (raw === undefined || raw === '') return 5182
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1024 || n > 65535) {
    throw new Error(`ADMIN_PORT debe ser un entero entre 1024 y 65535 (recibido: "${raw}").`)
  }
  return n
}

export const PORT = resolvePort()
