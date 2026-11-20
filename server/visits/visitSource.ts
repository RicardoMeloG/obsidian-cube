// Where the dashboard's log lines come from: a committed fixture in development,
// the private CloudFront logs bucket (owner's SSO profile) otherwise.
// Nothing raw is ever written to disk. Spec 013, D-4 and D-5.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import { fromIni } from '@aws-sdk/credential-providers'

export class VisitsConfigError extends Error {}

export type VisitsConfig =
  | { source: 'fixture' }
  | { source: 's3'; bucket: string; prefix: string; profile: string; region: 'us-east-1' }

export function visitsConfig(env: NodeJS.ProcessEnv = process.env): VisitsConfig {
  const value = env.VISITS_SOURCE
  if (value === undefined || value === '' || value === 'fixture') {
    return { source: 'fixture' }
  }
  if (value === 's3') {
    const bucket = env.VISITS_BUCKET
    const profile = env.VISITS_PROFILE
    if (!bucket || !profile) {
      throw new VisitsConfigError('VISITS_SOURCE=s3 necesita VISITS_BUCKET y VISITS_PROFILE en .env.')
    }
    return {
      source: 's3',
      bucket,
      prefix: env.VISITS_PREFIX || '',
      profile,
      region: 'us-east-1',
    }
  }
  throw new VisitsConfigError(`VISITS_SOURCE debe ser fixture o s3, no "${value}".`)
}

export const FIXTURE_PATH: string = join(__dirname, 'fixtures', 'sample-logs.jsonl')

const DATE_RE = /"date":"(\d{4}-\d{2}-\d{2})"/g

function parseUtcMs(d: string): number {
  return Date.UTC(
    parseInt(d.slice(0, 4), 10),
    parseInt(d.slice(5, 7), 10) - 1,
    parseInt(d.slice(8, 10), 10),
  )
}

function formatUtc(ms: number): string {
  const dt = new Date(ms)
  const yyyy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function redate(lines: string[], today: string): string[] {
  if (lines.length === 0) return []

  const todayMs = parseUtcMs(today)
  let maxMs = -Infinity

  for (const line of lines) {
    DATE_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = DATE_RE.exec(line)) !== null) {
      const ms = parseUtcMs(m[1])
      if (ms > maxMs) maxMs = ms
    }
  }

  if (maxMs === -Infinity) return lines

  const deltaDays = Math.round((todayMs - maxMs) / 86400000)

  return lines.map((line) =>
    line.replace(/"date":"(\d{4}-\d{2}-\d{2})"/g, (_full, d: string) => {
      return `"date":"${formatUtc(parseUtcMs(d) + deltaDays * 86400000)}"`
    }),
  )
}

export async function fixtureLines(today: string, file?: string): Promise<string[]> {
  const path = file ?? FIXTURE_PATH
  const content = readFileSync(path, 'utf-8')
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0)
  return redate(lines, today)
}

export type S3Object = { key: string; lastModified: Date }
export type S3Reader = {
  list(prefix: string): AsyncIterable<S3Object>
  read(key: string): Promise<Uint8Array>
}

// Read 8 objects at a time: CloudFront delivers many small objects, and one
// at a time a 90-day view took minutes (audit of 2026-11-19).
const READ_AT_ONCE = 8
// An error that no other object will escape: stop and say so.
const FATAL_ERROR = /Credential|Token|SSO|Expired|AccessDenied|NoSuchBucket/i

export type S3ReadCount = { read: number; skipped: number }

// One unreadable object (a truncated gzip, a failed GET) is skipped and
// counted, so it does not hide the whole summary until it expires. Errors of
// the session or the bucket, or every object failing, still throw.
export async function forEachS3Line(
  reader: S3Reader,
  prefix: string,
  since: Date,
  onLine: (line: string) => void,
): Promise<S3ReadCount> {
  const cutoff = new Date(since.getTime() - 86400000)
  const count: S3ReadCount = { read: 0, skipped: 0 }
  let firstError: unknown

  const readLines = async (key: string): Promise<string[]> => {
    const bytes = await reader.read(key)
    const data: Buffer =
      bytes[0] === 0x1f && bytes[1] === 0x8b
        ? gunzipSync(Buffer.from(bytes))
        : Buffer.from(bytes)
    return data.toString('utf-8').split(/\r?\n/).filter((l) => l.length > 0)
  }

  const flush = async (keys: string[]) => {
    const results = await Promise.allSettled(keys.map(readLines))
    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const line of result.value) onLine(line)
        count.read++
        continue
      }
      if (FATAL_ERROR.test((result.reason as Error)?.name ?? '')) throw result.reason
      firstError ??= result.reason
      count.skipped++
    }
  }

  let batch: string[] = []
  for await (const obj of reader.list(prefix)) {
    if (obj.lastModified < cutoff) continue
    batch.push(obj.key)
    if (batch.length === READ_AT_ONCE) {
      await flush(batch)
      batch = []
    }
  }
  await flush(batch)

  if (count.read === 0 && count.skipped > 0) throw firstError
  return count
}

export function createS3Reader(config: { bucket: string; profile: string; region: string }): S3Reader {
  const client = new S3Client({
    region: config.region,
    credentials: fromIni({ profile: config.profile }),
  })

  return {
    async *list(prefix: string): AsyncIterable<S3Object> {
      let continuationToken: string | undefined
      do {
        const res = await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          }),
        )
        for (const obj of res.Contents ?? []) {
          if (obj.Key && obj.LastModified) {
            yield { key: obj.Key, lastModified: obj.LastModified }
          }
        }
        continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
      } while (continuationToken)
    },

    async read(key: string): Promise<Uint8Array> {
      const res = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      )
      if (!res.Body) throw new Error('S3 GetObject response missing body')
      return await res.Body.transformToByteArray()
    },
  }
}
