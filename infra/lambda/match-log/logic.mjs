// Pure validation and routing for the match-log receiver (spec 015, D-4).
// No AWS SDK so unit tests run without a Lambda runtime.

export const MAX_BYTES = 512 * 1024
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export function objectKey(clave, now = new Date()) {
  return `partidas/${now.toISOString().slice(0, 10)}/${clave}.json`
}

export function validateLog(log) {
  if (log === null || typeof log !== 'object' || Array.isArray(log)) return 'not a plain object'
  if (log.formato !== 1 && log.formato !== 2) return 'formato must be 1 or 2'
  if (typeof log.id !== 'string' || !/^[\w-]{1,40}$/.test(log.id)) return 'id must be 1-40 word/hyphen chars'
  if (typeof log.clave !== 'string' || !UUID.test(log.clave)) return 'clave must be a valid UUID'
  if (!Array.isArray(log.oleadas) || log.oleadas.length > 40) return 'oleadas must be an array of length <= 40'
  for (const item of log.oleadas) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return 'oleadas items must be objects'
  }
  if (log.acciones !== undefined && (!Array.isArray(log.acciones) || log.acciones.length > 5000)) return 'acciones must be an array of length <= 5000'
  if (log.ordenes !== undefined && (!Array.isArray(log.ordenes) || log.ordenes.length > 5000)) return 'ordenes must be an array of length <= 5000'
  if (log.errores !== undefined && (!Array.isArray(log.errores) || log.errores.length > 20)) return 'errores must be an array of length <= 20'
  if (log.resultado !== undefined && log.resultado !== null && (typeof log.resultado !== 'object' || Array.isArray(log.resultado))) return 'resultado must be null or a plain object'
  return null
}

export function handleRequest({ method, headers, body, isBase64Encoded }, { allowedOrigins, now = new Date() }) {
  // normalise header names so matching is case-insensitive
  const h = {}
  for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = v

  if (method !== 'POST') return { status: 405, reason: 'method must be POST' }
  if (!h.origin || !allowedOrigins.includes(h.origin)) return { status: 403, reason: 'origin not allowed' }
  if (!h['content-type'] || !h['content-type'].startsWith('application/json')) return { status: 415, reason: 'content-type must be application/json' }

  // decode the payload once; base64 is the Lambda function-URL encoding
  const text = isBase64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body

  if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) return { status: 413, reason: 'body exceeds 512 KB' }

  let log
  try {
    log = JSON.parse(text)
  } catch {
    return { status: 400, reason: 'invalid json' }
  }

  const reason = validateLog(log)
  if (reason) return { status: 400, reason }

  // re-serialise from the parsed object so no header value is ever stored
  return { status: 204, key: objectKey(log.clave, now), json: JSON.stringify(log) }
}
