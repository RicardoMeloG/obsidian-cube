import { Global, Module } from '@nestjs/common'
import { Pool } from 'pg'
import { ContentRepository } from './content/content.repository'

// Provides a single ContentRepository backed by a pg Pool. The factory runs the
// schema init (which fails soft if Postgres is down, so the server still boots).
// DATABASE_URL is read at factory time so main.ts can load .env first.
@Global()
@Module({
  providers: [
    {
      provide: ContentRepository,
      useFactory: async () => {
        const connectionString =
          process.env.DATABASE_URL || 'postgres://obsidian:obsidian@localhost:5433/obsidian_cube'
        const pool = new Pool({ connectionString, connectionTimeoutMillis: 2000 })
        const repository = new ContentRepository(pool)
        await repository.init()
        return repository
      },
    },
  ],
  exports: [ContentRepository],
})
export class DatabaseModule {}
