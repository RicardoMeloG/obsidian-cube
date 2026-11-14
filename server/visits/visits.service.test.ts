// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import { VisitsService } from './visits.service'

const ENV_KEYS = ['VISITS_SOURCE', 'VISITS_BUCKET', 'VISITS_PROFILE', 'VISITS_PREFIX'] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k]
    delete process.env[k]
  }
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('VisitsService', () => {
  it('fixture: source is "fixture", perDay has `days` entries, last key is today', async () => {
    const svc = new VisitsService()
    const now = new Date('2025-06-15T12:00:00.000Z')
    const result = await svc.summary(7, now)

    expect(result.source).toBe('fixture')
    expect(result.perDay.length).toBe(7)
    expect(result.perDay[result.perDay.length - 1]?.key).toBe('2025-06-15')
  })

  it('cache: same object within 5 min, new object after 6 min', async () => {
    const svc = new VisitsService()
    const t0 = new Date('2025-06-15T12:00:00.000Z')

    const first = await svc.summary(7, t0)
    const second = await svc.summary(7, new Date(t0.getTime() + 4 * 60 * 1000))
    expect(second).toBe(first)

    const third = await svc.summary(7, new Date(t0.getTime() + 6 * 60 * 1000))
    expect(third).not.toBe(first)
  })

  it('s3: summary counts the fake line', async () => {
    process.env.VISITS_SOURCE = 's3'
    process.env.VISITS_BUCKET = 'b'
    process.env.VISITS_PROFILE = 'p'
    process.env.VISITS_PREFIX = 'logs/'

    const now = new Date('2025-06-15T12:00:00.000Z')

    class S3TestService extends VisitsService {
      protected reader() {
        return {
          async *list() {
            yield { key: 'log.json', lastModified: now }
          },
          async read() {
            const line = JSON.stringify({
              date: '2025-06-15',
              time: '12:00:00',
              'c-country': 'ES',
              'cs-method': 'GET',
              'cs-uri-stem': '/es',
              'sc-status': '200',
              'cs(User-Agent)':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            })
            return new TextEncoder().encode(line)
          },
        }
      }
    }

    const svc = new S3TestService()
    const result = await svc.summary(7, now)

    expect(result.source).toBe('s3')
    expect(result.visits).toBe(1)
  })

  it('s3: reader list throws CredentialsProviderError → ServiceUnavailableException with sso hint, no original message', async () => {
    process.env.VISITS_SOURCE = 's3'
    process.env.VISITS_BUCKET = 'b'
    process.env.VISITS_PROFILE = 'p'
    process.env.VISITS_PREFIX = 'logs/'

    class FailingService extends VisitsService {
      protected reader() {
        return {
          async *list() {
            const err = new Error('The security token included in the request is invalid')
            err.name = 'CredentialsProviderError'
            throw err
            yield // unreachable – satisfies TS generator return type
          },
          async read() {
            return new Uint8Array()
          },
        }
      }
    }

    const svc = new FailingService()
    const now = new Date('2025-06-15T12:00:00.000Z')

    let caught: unknown
    try {
      await svc.summary(7, now)
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(ServiceUnavailableException)
    const msg = (caught as Error).message
    expect(msg).toContain('aws sso login --profile p')
    expect(msg).not.toContain('security token')
  })

  it('s3: reader list throws NoSuchBucket → ServiceUnavailableException with bucket hint, no sso hint', async () => {
    process.env.VISITS_SOURCE = 's3'
    process.env.VISITS_BUCKET = 'b'
    process.env.VISITS_PROFILE = 'p'
    process.env.VISITS_PREFIX = 'logs/'

    class NoSuchBucketService extends VisitsService {
      protected reader() {
        return {
          async *list() {
            const err = new Error('The specified bucket does not exist')
            err.name = 'NoSuchBucket'
            throw err
            yield // unreachable – satisfies TS generator return type
          },
          async read() {
            return new Uint8Array()
          },
        }
      }
    }

    const svc = new NoSuchBucketService()
    const now = new Date('2025-06-15T12:00:00.000Z')

    let caught: unknown
    try {
      await svc.summary(7, now)
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(ServiceUnavailableException)
    const msg = (caught as Error).message
    expect(msg).toContain('Revisa VISITS_BUCKET')
    expect(msg).not.toContain('aws sso login')
  })

  it('VISITS_SOURCE=nope → BadRequestException', async () => {
    process.env.VISITS_SOURCE = 'nope'
    const svc = new VisitsService()
    const now = new Date('2025-06-15T12:00:00.000Z')

    await expect(svc.summary(7, now)).rejects.toThrow(BadRequestException)
  })
})
