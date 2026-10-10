import { Logger } from '@nestjs/common'
import bcrypt from 'bcryptjs'
import type { Pool } from 'pg'

const DDL = `
CREATE TABLE IF NOT EXISTS admin_users (
  username      TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  totp_secret   TEXT,
  totp_enabled  BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
`

export type AdminUser = {
  username: string
  passwordHash: string
  totpSecret: string | null
  totpEnabled: boolean
}

// Plain class (no Nest decorator) — testable with an injected pg-mem pool.
export class AuthRepository {
  private available = false
  private readonly logger = new Logger(AuthRepository.name)

  constructor(private readonly pool: Pool) {}

  async init(): Promise<void> {
    try {
      await this.pool.query(DDL)
      this.available = true
      await this.seedFromEnv()
    } catch (error) {
      this.available = false
      this.logger.warn(`Auth deshabilitada — Postgres no disponible (${(error as Error).message}).`)
    }
  }

  isAvailable(): boolean {
    return this.available
  }

  async getUser(username: string): Promise<AdminUser | null> {
    const result = await this.pool.query(
      'SELECT username, password_hash, totp_secret, totp_enabled FROM admin_users WHERE username = $1',
      [username],
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      username: row.username,
      passwordHash: row.password_hash,
      totpSecret: row.totp_secret,
      totpEnabled: row.totp_enabled,
    }
  }

  async setTotpSecret(username: string, secret: string): Promise<void> {
    await this.pool.query('UPDATE admin_users SET totp_secret = $2 WHERE username = $1', [username, secret])
  }

  async enableTotp(username: string): Promise<void> {
    await this.pool.query('UPDATE admin_users SET totp_enabled = true WHERE username = $1', [username])
  }

  // Create the first admin from env vars if the table is empty. The password is
  // only ever stored as a bcrypt hash; ADMIN_PASSWORD is read once at boot.
  private async seedFromEnv(): Promise<void> {
    const username = process.env.ADMIN_USERNAME
    const password = process.env.ADMIN_PASSWORD
    if (!username || !password) return

    const { rows } = await this.pool.query('SELECT count(*)::int AS n FROM admin_users')
    if (rows[0].n > 0) return

    const passwordHash = await bcrypt.hash(password, 10)
    await this.pool.query('INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)', [
      username,
      passwordHash,
    ])
    this.logger.log(`Usuario admin "${username}" creado (enrolamiento MFA pendiente en el primer login).`)
  }
}
