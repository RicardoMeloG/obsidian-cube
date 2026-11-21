// Lambda entry for the match-log receiver (spec 015, D-2/D-4).
// @aws-sdk/client-s3 ships with the Node.js 22 runtime; nothing is bundled.
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { handleRequest } from './logic.mjs'
import { createBrakes, viewerIp } from './brakes.mjs'

const s3 = new S3Client({})
const allowedOrigins = JSON.parse(process.env.ALLOWED_ORIGINS ?? '[]')
const bucket = process.env.BUCKET
// One per instance, kept while the instance lives (brakes.mjs).
const brakes = createBrakes()

export async function handler(event) {
  const result = handleRequest(
    {
      method: event.requestContext?.http?.method,
      headers: event.headers ?? {},
      body: event.body ?? '',
      isBase64Encoded: event.isBase64Encoded,
    },
    { allowedOrigins },
  )

  if (result.status === 204) {
    const refusal = brakes.take(viewerIp(event.headers, event.requestContext?.http?.sourceIp), Date.now())
    if (refusal) {
      console.log(`refused ${refusal.status} ${refusal.reason}`)
      return { statusCode: refusal.status, headers: { 'retry-after': String(refusal.retryAfter) }, body: refusal.reason }
    }
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: result.key,
      Body: result.json,
      ContentType: 'application/json',
    }))
    console.log(`stored ${result.key} ${Buffer.byteLength(result.json, 'utf8')} bytes`)
    return { statusCode: 204 }
  }

  console.log(`refused ${result.status} ${result.reason}`)
  return { statusCode: result.status, body: result.reason }
}
