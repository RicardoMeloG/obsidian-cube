-- Schema for the admin content store.
-- Also created idempotently by the server on boot, so this file is just a
-- convenience for a fresh Docker volume.

-- Current editable draft per document (site.en / site.es / visual).
CREATE TABLE IF NOT EXISTS content_drafts (
  doc_id     TEXT PRIMARY KEY,
  data       JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Immutable history: one row appended on every publish (audit trail).
CREATE TABLE IF NOT EXISTS content_versions (
  id           BIGSERIAL   PRIMARY KEY,
  doc_id       TEXT        NOT NULL,
  data         JSONB       NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_versions_doc
  ON content_versions (doc_id, published_at DESC);

-- Admin users (password as bcrypt hash; TOTP secret enrolled on first login).
-- Seeded by the server from ADMIN_USERNAME / ADMIN_PASSWORD when empty.
CREATE TABLE IF NOT EXISTS admin_users (
  username      TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  totp_secret   TEXT,
  totp_enabled  BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
