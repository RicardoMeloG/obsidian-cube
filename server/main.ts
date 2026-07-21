import 'reflect-metadata'
import { existsSync, readFileSync } from 'node:fs'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

const PORT = 5182
// Localhost-only on purpose: this admin has NO authentication yet. Auth/MFA is
// Etapa 4. Never bind to 0.0.0.0 until that lands.
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
  await app.listen(PORT, HOST)
  // eslint-disable-next-line no-console
  console.log(`Obsidian Cube admin → http://${HOST}:${PORT}`)
}

void bootstrap()
