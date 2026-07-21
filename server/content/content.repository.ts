import { Logger } from '@nestjs/common'
import type { Pool } from 'pg'

// Plain (no Nest decorator) so it stays trivially testable with an injected
// pg-mem pool. The DB is optional: if it can't be reached, the repository marks
// itself unavailable and the service degrades to file-only mode.

const DDL = `
CREATE TABLE IF NOT EXISTS content_drafts (
  doc_id     TEXT PRIMARY KEY,
  data       JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS content_versions (
  id           BIGSERIAL   PRIMARY KEY,
  doc_id       TEXT        NOT NULL,
  data         JSONB       NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_versions_doc
  ON content_versions (doc_id, published_at DESC);
`

export type VersionSummary = { id: string; publishedAt: string }

export class ContentRepository {
  private available = false
  private readonly logger = new Logger(ContentRepository.name)

  constructor(private readonly pool: Pool) {}

  // Create the schema; on any failure, stay unavailable so the server still boots.
  async init(): Promise<void> {
    try {
      await this.pool.query(DDL)
      this.available = true
      this.logger.log('Postgres conectado — persistencia activa')
    } catch (error) {
      this.available = false
      this.logger.warn(`Postgres no disponible (${(error as Error).message}). Modo solo-archivos.`)
    }
  }

  isAvailable(): boolean {
    return this.available
  }

  async getDraft(docId: string): Promise<unknown | null> {
    const result = await this.pool.query('SELECT data FROM content_drafts WHERE doc_id = $1', [docId])
    return result.rows[0]?.data ?? null
  }

  async upsertDraft(docId: string, data: unknown): Promise<void> {
    await this.pool.query(
      `INSERT INTO content_drafts (doc_id, data, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (doc_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [docId, JSON.stringify(data)],
    )
  }

  async insertVersion(docId: string, data: unknown): Promise<VersionSummary> {
    const result = await this.pool.query(
      'INSERT INTO content_versions (doc_id, data) VALUES ($1, $2) RETURNING id, published_at',
      [docId, JSON.stringify(data)],
    )
    const row = result.rows[0]
    return { id: String(row.id), publishedAt: new Date(row.published_at).toISOString() }
  }

  async listVersions(docId: string): Promise<VersionSummary[]> {
    const result = await this.pool.query(
      'SELECT id, published_at FROM content_versions WHERE doc_id = $1 ORDER BY published_at DESC LIMIT 50',
      [docId],
    )
    return result.rows.map((row) => ({ id: String(row.id), publishedAt: new Date(row.published_at).toISOString() }))
  }

  async getVersion(docId: string, versionId: string): Promise<unknown | null> {
    const result = await this.pool.query(
      'SELECT data FROM content_versions WHERE id = $1 AND doc_id = $2',
      [versionId, docId],
    )
    return result.rows[0]?.data ?? null
  }
}
