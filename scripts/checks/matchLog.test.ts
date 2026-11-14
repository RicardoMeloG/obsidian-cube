// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { handleRequest, objectKey, validateLog, MAX_BYTES } from '../../infra/lambda/match-log/logic.mjs'

const validLog = {
  formato: 2,
  id: '2026-11-14T10-00-00',
  clave: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e',
  oleadas: [{ oleada: 1 }],
  ordenes: [],
  resultado: null,
}
const headers = { Origin: 'https://ricardomelog.github.io', 'Content-Type': 'application/json' }
const allowedOrigins = ['https://ricardomelog.github.io']
const now = new Date('2026-11-14T12:00:00Z')

function req(overrides: Record<string, unknown> = {}) {
  return handleRequest(
    { method: 'POST', headers, body: JSON.stringify(validLog), isBase64Encoded: false, ...overrides },
    { allowedOrigins, now },
  )
}

describe('match-log receiver', () => {
  it('accepts a valid log → 204 with correct key and json', () => {
    const res = req()
    expect(res.status).toBe(204)
    expect(res.key).toBe('partidas/2026-11-14/3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e.json')
    expect(res.json).toBe(JSON.stringify(validLog))
  })

  it('rejects GET → 405', () => {
    expect(req({ method: 'GET' }).status).toBe(405)
  })

  it('rejects a different origin → 403', () => {
    expect(req({ headers: { ...headers, Origin: 'https://evil.example.com' } }).status).toBe(403)
  })

  it('rejects missing origin → 403', () => {
    expect(req({ headers: { 'Content-Type': 'application/json' } }).status).toBe(403)
  })

  it('rejects text/plain → 415', () => {
    expect(req({ headers: { ...headers, 'Content-Type': 'text/plain' } }).status).toBe(415)
  })

  it('rejects body over MAX_BYTES → 413', () => {
    expect(req({ body: 'x'.repeat(MAX_BYTES + 1) }).status).toBe(413)
  })

  it('decodes a base64 body', () => {
    const encoded = Buffer.from(JSON.stringify(validLog), 'utf8').toString('base64')
    const res = req({ body: encoded, isBase64Encoded: true })
    expect(res.status).toBe(204)
    expect(res.json).toBe(JSON.stringify(validLog))
  })

  it('rejects broken JSON → 400', () => {
    expect(req({ body: '{not json' }).status).toBe(400)
  })

  it('rejects bad clave → 400', () => {
    expect(req({ body: JSON.stringify({ ...validLog, clave: '../../x' }) }).status).toBe(400)
  })

  it('rejects formato 3 → 400', () => {
    expect(req({ body: JSON.stringify({ ...validLog, formato: 3 }) }).status).toBe(400)
  })

  it('rejects oleadas not an array → 400', () => {
    expect(req({ body: JSON.stringify({ ...validLog, oleadas: 'nope' }) }).status).toBe(400)
  })

  it('rejects 41 oleadas → 400', () => {
    const oleadas = Array.from({ length: 41 }, (_, i) => ({ oleada: i }))
    expect(req({ body: JSON.stringify({ ...validLog, oleadas }) }).status).toBe(400)
  })

  it('rejects array body → 400', () => {
    expect(req({ body: '[]' }).status).toBe(400)
  })

  it('stored json does not contain the origin string', () => {
    const res = req()
    expect(res.json).not.toContain('https://ricardomelog.github.io')
  })

  it('objectKey builds the expected path', () => {
    expect(objectKey('3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e', new Date('2026-01-02T23:59:59Z'))).toBe('partidas/2026-01-02/3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e.json')
  })

  it('validateLog returns null for valid log and a string for 21 errores', () => {
    expect(validateLog(validLog)).toBeNull()
    expect(typeof validateLog({ ...validLog, errores: new Array(21).fill({}) })).toBe('string')
  })
})
