import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import type { ZodError } from 'zod'
import { DOCS } from './docs'
import type { DocId } from './docs'

// Files are read from / published to the same static path the public site reads.
// The server runs from the project root, so this resolves to <root>/public/content.
const CONTENT_DIR = path.resolve(process.cwd(), 'public', 'content')

type ValidationError = { path: string; message: string }

@Injectable()
export class ContentService {
  listDocs() {
    return Object.values(DOCS).map(({ id, label }) => ({ id, label }))
  }

  // Load the private/published file if it exists, else fall back to the committed
  // example so the editor always opens with valid starting content.
  async read(docId: DocId): Promise<{ data: unknown; source: string }> {
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

  validate(docId: DocId, data: unknown): { ok: boolean; errors?: ValidationError[] } {
    const result = DOCS[docId].schema.safeParse(data)
    if (result.success) {
      return { ok: true }
    }
    return { ok: false, errors: formatIssues(result.error) }
  }

  // Publish = validate against the schema, then write the JSON to the static
  // path. Invalid content is rejected (400) and never written.
  async publish(docId: DocId, data: unknown): Promise<{ ok: true; file: string }> {
    const check = this.validate(docId, data)
    if (!check.ok) {
      throw new BadRequestException({ ok: false, errors: check.errors })
    }

    const target = path.join(CONTENT_DIR, DOCS[docId].file)
    await fs.writeFile(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    return { ok: true, file: DOCS[docId].file }
  }
}

function formatIssues(error: ZodError): ValidationError[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }))
}
