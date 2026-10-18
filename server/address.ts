// Where the local admin listens. Localhost-only on purpose (AGENTS.md, admin
// rules): there is no login rate limiting, the cookie is not `secure` and
// sessions are in-memory. Never bind to 0.0.0.0.
export const HOST = '127.0.0.1'
export const PORT = 5182
