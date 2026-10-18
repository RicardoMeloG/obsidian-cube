import 'reflect-metadata'
import { existsSync, readFileSync } from 'node:fs'
import session from 'express-session'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { HOST, PORT } from './address'
import { AppModule } from './app.module'
import { appEnv, publishRulesBlock } from './appEnv'
import { adminAuthOff } from './auth/devBypass'
import { noFraming } from './noFraming'

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
  appEnv() // a wrong APP_ENV stops the server before it listens
  const authOff = adminAuthOff() // and so does ADMIN_AUTH=off in production
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['log', 'error', 'warn'] })
  app.use(noFraming) // on every response, before any route (audit-4 F-1)
  // Uploaded images arrive as raw WebP (spec 011, AD-03); the media store
  // checks them. A site document with its compositions fits well under 1 MB.
  app.useBodyParser('raw', { type: 'image/webp', limit: '3mb' })
  app.useBodyParser('json', { limit: '1mb' })

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
  console.log(`Obsidian Cube admin → http://${HOST}:${PORT}`)
  console.log(`APP_ENV=${appEnv()}: las reglas de publicación ${publishRulesBlock() ? 'bloquean' : 'avisan'}.`)
  if (authOff) console.warn('ADMIN_AUTH=off: el admin no pide login a las peticiones locales (solo desarrollo).')
}

void bootstrap()
