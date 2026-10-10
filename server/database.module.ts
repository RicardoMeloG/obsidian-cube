import { Global, Module } from '@nestjs/common'
import { Pool } from 'pg'
import { AuthRepository } from './auth/auth.repository'
import { ContentRepository } from './content/content.repository'

export const PG_POOL = 'PG_POOL'

// Single shared pg Pool for every repository. Each repository runs its own DDL
// (fail-soft) on boot, so the server still starts if Postgres is down.
// DATABASE_URL is read at factory time so main.ts can load .env first.
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () => {
        const connectionString =
          process.env.DATABASE_URL || 'postgres://obsidian:obsidian@localhost:5433/obsidian_cube'
        const pool = new Pool({ connectionString, connectionTimeoutMillis: 2000 })
        // Idle-client errors must not crash the process when the DB drops.
        pool.on('error', () => undefined)
        return pool
      },
    },
    {
      provide: ContentRepository,
      useFactory: async (pool: Pool) => {
        const repository = new ContentRepository(pool)
        await repository.init()
        return repository
      },
      inject: [PG_POOL],
    },
    {
      provide: AuthRepository,
      useFactory: async (pool: Pool) => {
        const repository = new AuthRepository(pool)
        await repository.init()
        return repository
      },
      inject: [PG_POOL],
    },
  ],
  exports: [ContentRepository, AuthRepository],
})
export class DatabaseModule {}
