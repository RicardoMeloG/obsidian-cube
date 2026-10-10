import 'reflect-metadata'
import { existsSync, readFileSync } from 'node:fs'
import session from 'express-session'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

const PORT = 5182
// Localhost-only on purpose. Password + TOTP MFA are enforced, but there is no
// login rate limiting, the cookie is not `secure` and sessions are in-memory.
// Never bind to 0.0.0.0 until those land (see AGENTS.md, admin rules).
const HOST = '127.0.0.1'

// Minimal .env loader (no dependency): populate process.env before Nest builds
// the DB pool. Existing env vars win.
function loadEnv() {
  if (!existsSync('.env')) return
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/)
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }
}

async function bootstrap() {
  loadEnv()
  const app = await NestFactory.create(AppModule, { logger: ['log', 'error', 'warn'] })

  // Signed httpOnly session cookie holds the auth stage (password → full).
  // In-memory store: a server restart simply requires re-login (fine for a
  // single local admin). secure:false because this runs on localhost http.
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-insecure-secret-change-me',
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 1000 * 60 * 60 * 8 },
    }),
  )

  await app.listen(PORT, HOST)
  // eslint-disable-next-line no-console
  console.log(`Obsidian Cube admin → http://${HOST}:${PORT}`)
}

void bootstrap()
