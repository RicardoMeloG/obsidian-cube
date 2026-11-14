// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import {
  visitsConfig,
  VisitsConfigError,
  redate,
  fixtureLines,
  forEachS3Line,
  FIXTURE_PATH,
  type S3Reader,
  type S3Object,
} from './visitSource'

describe('visitsConfig', () => {
  it('returns fixture when VISITS_SOURCE is unset', () => {
    expect(visitsConfig({})).toEqual({ source: 'fixture' })
  })

  it('returns fixture when VISITS_SOURCE is empty string', () => {
    expect(visitsConfig({ VISITS_SOURCE: '' })).toEqual({ source: 'fixture' })
  })

  it('returns fixture when VISITS_SOURCE is "fixture"', () => {
    expect(visitsConfig({ VISITS_SOURCE: 'fixture' })).toEqual({ source: 'fixture' })
  })

  it('returns s3 config when all required vars are set', () => {
    const cfg = visitsConfig({
      VISITS_SOURCE: 's3',
      VISITS_BUCKET: 'my-bucket',
      VISITS_PROFILE: 'my-profile',
      VISITS_PREFIX: 'logs/',
    })
    expect(cfg).toEqual({
      source: 's3',
      bucket: 'my-bucket',
      prefix: 'logs/',
      profile: 'my-profile',
      region: 'us-east-1',
    })
  })

  it('throws VisitsConfigError when s3 is missing profile', () => {
    expect(() =>
      visitsConfig({ VISITS_SOURCE: 's3', VISITS_BUCKET: 'my-bucket' }),
    ).toThrow(VisitsConfigError)
  })

  it('throws VisitsConfigError for unknown source value', () => {
    expect(() => visitsConfig({ VISITS_SOURCE: 'other' })).toThrow(
      'VISITS_SOURCE debe ser fixture o s3, no "other".',
    )
  })
})

describe('redate', () => {
  it('shifts the latest date to today', () => {
    const lines = ['{"date":"2025-01-01","hits":10}', '{"date":"2025-01-03","hits":20}']
    const result = redate(lines, '2025-01-05')
    expect(result[0]).toContain('"date":"2025-01-03"')
    expect(result[1]).toContain('"date":"2025-01-05"')
  })

  it('shifts all dates by the same number of days', () => {
    const lines = [
      '{"date":"2025-01-01","hits":1}',
      '{"date":"2025-01-02","hits":2}',
      '{"date":"2025-01-03","hits":3}',
    ]
    const result = redate(lines, '2025-01-10')
    expect(result[0]).toContain('"date":"2025-01-08"')
    expect(result[1]).toContain('"date":"2025-01-09"')
    expect(result[2]).toContain('"date":"2025-01-10"')
  })

  it('handles dates across a month boundary', () => {
    const lines = ['{"date":"2025-01-29","hits":1}', '{"date":"2025-01-31","hits":2}']
    const result = redate(lines, '2025-02-02')
    expect(result[0]).toContain('"date":"2025-01-31"')
    expect(result[1]).toContain('"date":"2025-02-02"')
  })

  it('leaves lines without a date unchanged', () => {
    const lines = ['no date here', '{"date":"2025-01-01","hits":1}']
    const result = redate(lines, '2025-06-15')
    expect(result[0]).toBe('no date here')
    expect(result[1]).toContain('"date":"2025-06-15"')
  })

  it('returns empty array for empty input', () => {
    expect(redate([], '2025-01-01')).toEqual([])
  })
})

describe('fixtureLines', () => {
  it('returns redated lines whose latest date equals today and count matches file', async () => {
    const today = '2027-01-31'
    const lines = await fixtureLines(today)
    expect(lines.length).toBeGreaterThan(0)

    const raw = readFileSync(FIXTURE_PATH, 'utf-8')
    const expectedCount = raw.split(/\r?\n/).filter((l) => l.length > 0).length
    expect(lines.length).toBe(expectedCount)

    const dateRe = /"date":"(\d{4}-\d{2}-\d{2})"/g
    let maxDate = ''
    for (const line of lines) {
      dateRe.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = dateRe.exec(line)) !== null) {
        if (m[1] > maxDate) maxDate = m[1]
      }
    }
    expect(maxDate).toBe(today)
  })
})

describe('forEachS3Line', () => {
  function makeFakeReader(objects: S3Object[], bodies: Map<string, Uint8Array>): S3Reader {
    return {
      async *list(): AsyncIterable<S3Object> {
        for (const obj of objects) {
          yield obj
        }
      },
      async read(key: string): Promise<Uint8Array> {
        const body = bodies.get(key)
        if (!body) throw new Error(`No body for ${key}`)
        return body
      },
    }
  }

  it('reads gzipped and plain objects, skips old ones, drops blank lines', async () => {
    const since = new Date('2025-06-15T00:00:00Z')
    // cutoff = since - 1 day = 2025-06-14T00:00:00Z

    const gzippedBody = gzipSync(
      Buffer.from('{"date":"2025-06-15","hits":5}\n\n{"date":"2025-06-15","hits":7}\n'),
    )
    const plainBody = Buffer.from('{"date":"2025-06-15","hits":3}\n\n')

    const objects: S3Object[] = [
      { key: 'logs/2025-06-15.gz', lastModified: new Date('2025-06-15T12:00:00Z') },
      { key: 'logs/2025-06-15-plain', lastModified: new Date('2025-06-15T13:00:00Z') },
      { key: 'logs/2025-06-10-old', lastModified: new Date('2025-06-10T00:00:00Z') },
    ]

    const bodies = new Map<string, Uint8Array>([
      ['logs/2025-06-15.gz', gzippedBody],
      ['logs/2025-06-15-plain', plainBody],
      ['logs/2025-06-10-old', Buffer.from('{"date":"2025-06-10","hits":99}')],
    ])

    const reader = makeFakeReader(objects, bodies)
    const collected: string[] = []
    const count = await forEachS3Line(reader, 'logs/', since, (line) => collected.push(line))

    expect(collected).toEqual([
      '{"date":"2025-06-15","hits":5}',
      '{"date":"2025-06-15","hits":7}',
      '{"date":"2025-06-15","hits":3}',
    ])
    expect(count).toBe(2)
  })
})
