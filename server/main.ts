import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

const PORT = 5182
// Localhost-only on purpose: this admin has NO authentication yet. Auth/MFA is
// Etapa 4. Never bind to 0.0.0.0 until that lands.
const HOST = '127.0.0.1'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'error', 'warn'] })
  await app.listen(PORT, HOST)
  // eslint-disable-next-line no-console
  console.log(`Obsidian Cube admin → http://${HOST}:${PORT}`)
}

void bootstrap()
