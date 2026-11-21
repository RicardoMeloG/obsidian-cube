// Lambda entry for the web ACL sample collector (spec 020). Runs on an hourly
// schedule; the AWS SDK ships with the Node.js 22 runtime, nothing is bundled.
import { WAFV2Client, GetSampledRequestsCommand, GetWebACLCommand } from '@aws-sdk/client-wafv2'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { MAX_ITEMS, coverage, hourKey, hoursToRead, ruleMetricNames, slicesOf, targetHour, toRecord, webAclRef } from './logic.mjs'

// A CloudFront-scope web ACL answers only in us-east-1 (D-7).
const waf = new WAFV2Client({ region: 'us-east-1' })
const s3 = new S3Client({})
const bucket = process.env.BUCKET
const webAclArn = process.env.WEB_ACL_ARN
const STATE_KEY = 'state.json'

const RETRYABLE = /WAFInternalErrorException|Throttling|TooManyRequests|ServiceUnavailable/
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function withRetry(call) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call()
    } catch (error) {
      if (attempt >= 3 || !RETRYABLE.test(error?.name ?? '')) throw error
      await sleep(500 * 2 ** attempt)
    }
  }
}

async function readState() {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: STATE_KEY }))
    return JSON.parse(await res.Body.transformToString()).lastHour ?? null
  } catch (error) {
    if (error?.name === 'NoSuchKey') return null
    throw error
  }
}

async function readHour(id, rules, nowMs) {
  const slices = []
  const records = []
  for (const rule of rules) {
    for (const slice of slicesOf(id, nowMs)) {
      const entry = { rule, from: new Date(slice.from).toISOString(), to: new Date(slice.to).toISOString() }
      if (!slice.readable) {
        slices.push({ ...entry, status: 'missing' })
        continue
      }
      const res = await withRetry(() =>
        waf.send(new GetSampledRequestsCommand({
          WebAclArn: webAclArn,
          RuleMetricName: rule,
          Scope: 'CLOUDFRONT',
          TimeWindow: { StartTime: new Date(slice.from), EndTime: new Date(slice.to) },
          MaxItems: MAX_ITEMS,
        })),
      )
      const samples = res.SampledRequests ?? []
      const population = res.PopulationSize ?? samples.length
      const returnedTo = res.TimeWindow?.EndTime ? new Date(res.TimeWindow.EndTime).getTime() : slice.to
      slices.push({ ...entry, status: coverage({ population, sampled: samples.length, askedTo: slice.to, returnedTo }), population, sampled: samples.length })
      for (const sample of samples) records.push(toRecord(sample, rule))
    }
  }
  return { hour: id, slices, records }
}

export async function handler(event) {
  const target = targetHour(event?.time ?? new Date().toISOString())
  const nowMs = Date.now()
  const { name, id } = webAclRef(webAclArn)
  const acl = await withRetry(() => waf.send(new GetWebACLCommand({ Name: name, Id: id, Scope: 'CLOUDFRONT' })))
  const rules = ruleMetricNames(acl.WebACL)

  const lastDone = await readState()
  for (const hour of hoursToRead(lastDone, target)) {
    const object = await readHour(hour, rules, nowMs)
    // Overwritten, never appended: a repeated run cannot duplicate an hour.
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: hourKey(hour), Body: JSON.stringify(object), ContentType: 'application/json' }))
    // The state moves only after its hour is written (D-2).
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: STATE_KEY, Body: JSON.stringify({ lastHour: hour }), ContentType: 'application/json' }))
    const counts = object.slices.reduce((m, s) => ((m[s.status] = (m[s.status] ?? 0) + 1), m), {})
    console.log(`hour ${hour}: ${object.records.length} records, slices ${JSON.stringify(counts)}`)
  }
}
