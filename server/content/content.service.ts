import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import type { ZodError } from 'zod'
import { templateMismatches } from '../../src/kernel/publishRules'
import { SiteContentSchema } from '../../src/kernel/siteContent'
import { ContentRepository } from './content.repository'
import type { VersionSummary } from './content.repository'
import { DOCS, formSchema, otherLanguage } from './docs'
import type { DocId } from './docs'

// Files are read from / published to the same static path the public site reads.
// The server runs from the project root, so this resolves to <root>/public/content.
const CONTENT_DIR = path.resolve(process.cwd(), 'public', 'content')

type ValidationError = { path: string; message: string }
type Validation = { ok: boolean; errors?: ValidationError[]; warnings?: ValidationError[] }

@Injectable()
export class ContentService {
  constructor(private readonly repository: ContentRepository) {}

  listDocs() {
    return Object.values(DOCS).map(({ id, label }) => ({ id, label }))
  }

  formSchema(docId: DocId) {
    return formSchema(docId)
  }

  // Prefer the DB draft when available; otherwise fall back to the published /
  // example file so the editor always opens with something valid.
  async read(docId: DocId): Promise<{ data: unknown; source: string }> {
    if (this.repository.isAvailable()) {
      const draft = await this.repository.getDraft(docId)
      if (draft !== null) {
        return { data: draft, source: 'borrador (db)' }
      }
    }
    return this.readFromFile(docId)
  }

  private async readFromFile(docId: DocId): Promise<{ data: unknown; source: string }> {
    const doc = DOCS[docId]
    for (const filename of [doc.file, doc.example]) {
      try {
        const raw = await fs.readFile(path.join(CONTENT_DIR, filename), 'utf8')
        return { data: JSON.parse(raw), source: filename }
      } catch {
        // try the next candidate
      }
    }
    throw new NotFoundException(`No content file found for ${docId}`)
  }

  async validate(docId: DocId, data: unknown): Promise<Validation> {
    const result = DOCS[docId].schema.safeParse(data)
    if (!result.success) {
      return { ok: false, errors: formatIssues(result.error) }
    }
    const warnings = await this.languageWarnings(docId, data)
    return warnings.length > 0 ? { ok: true, warnings } : { ok: true }
  }

  // Faces whose two languages use different templates (spec 011, AD-02),
  // against the other language as the editor would open it.
  private async languageWarnings(docId: DocId, data: unknown): Promise<ValidationError[]> {
    const other = otherLanguage(docId)
    if (!other) return []
    const mine = SiteContentSchema.safeParse(data)
    const theirs = SiteContentSchema.safeParse((await this.read(other).catch(() => ({ data: null }))).data)
    if (!mine.success || !theirs.success) return []
    return templateMismatches(mine.data, theirs.data).map((issue) => ({ path: issue.path.join('.') || '(root)', message: issue.message }))
  }

  // Persist a work-in-progress draft (no schema enforcement — drafts may be
  // mid-edit). Requires the DB.
  async saveDraft(docId: DocId, data: unknown): Promise<{ ok: true }> {
    this.requireDb()
    await this.repository.upsertDraft(docId, data)
    return { ok: true }
  }

  // Publish = validate, write the static JSON the site reads, and (if the DB is
  // up) append an immutable version + sync the draft. Invalid content is never
  // written.
  async publish(docId: DocId, data: unknown): Promise<{ ok: true; file: string; version: VersionSummary | null; warnings?: ValidationError[] }> {
    const check = await this.validate(docId, data)
    if (!check.ok) {
      throw new BadRequestException({ ok: false, errors: check.errors })
    }

    const target = path.join(CONTENT_DIR, DOCS[docId].file)
    await fs.writeFile(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8')

    let version: VersionSummary | null = null
    if (this.repository.isAvailable()) {
      version = await this.repository.insertVersion(docId, data)
      await this.repository.upsertDraft(docId, data)
    }
    return { ok: true, file: DOCS[docId].file, version, warnings: check.warnings }
  }

  async listVersions(docId: DocId): Promise<VersionSummary[]> {
    this.requireDb()
    return this.repository.listVersions(docId)
  }

  // Load an old version back into the draft and return it for the editor.
  async restore(docId: DocId, versionId: string): Promise<{ data: unknown }> {
    this.requireDb()
    const data = await this.repository.getVersion(docId, versionId)
    if (data === null) {
      throw new NotFoundException(`Version ${versionId} not found for ${docId}`)
    }
    await this.repository.upsertDraft(docId, data)
    return { data }
  }

  private requireDb() {
    if (!this.repository.isAvailable()) {
      throw new ServiceUnavailableException(
        'Base de datos no disponible. Levanta Postgres (docker compose up -d) y reinicia el server.',
      )
    }
  }
}

function formatIssues(error: ZodError): ValidationError[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }))
}
