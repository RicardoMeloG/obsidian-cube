// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const fields: string[] = JSON.parse(readFileSync('infra/visit-log-fields.json', 'utf8'))
const source = readFileSync('infra/lib/visit-logs.ts', 'utf8')

const expected = ['date', 'time', 'c-country', 'cs-method', 'cs-uri-stem', 'sc-status', 'cs(User-Agent)']
const forbidden = ['c-ip', 'x-forwarded-for', 'cs(Cookie)', 'cs-uri-query', 'cs(Referer)', 'x-edge-request-id', 'asn', 'c-port']

describe('visit-log-fields.json', () => {
  it('contains exactly the seven expected fields in order', () => {
    expect(fields).toEqual(expected)
  })

  it('does not contain any forbidden field', () => {
    for (const f of forbidden) {
      expect(fields).not.toContain(f)
    }
  })
})

describe('visit-logs.ts', () => {
  it('reads visit-log-fields.json', () => {
    expect(source).toContain('visit-log-fields.json')
  })

  it('passes recordFields to the delivery', () => {
    expect(source).toContain('recordFields')
  })

  it('contains every forbidden name in its guard list', () => {
    for (const f of forbidden) {
      expect(source).toContain(f)
    }
  })

  it("uses outputFormat: 'json'", () => {
    expect(source).toContain("outputFormat: 'json'")
  })

  it("uses logType: 'ACCESS_LOGS'", () => {
    expect(source).toContain("logType: 'ACCESS_LOGS'")
  })

  it('has an expiration in its lifecycle rule', () => {
    expect(source).toContain('expiration')
  })
})
