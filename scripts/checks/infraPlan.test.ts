// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The distribution is on the CloudFront flat-rate Free plan (spec 014, AGENTS.md
// "Infrastructure and cost rules"): the stack must keep the plan's web ACL and
// must not use what the plan refuses, or a deploy would fail or drop the plan.
const stack = readFileSync(new URL('../../infra/lib/static-site-stack.ts', import.meta.url), 'utf8')
const guard = readFileSync(new URL('../../infra/lib/cost-guard-stack.ts', import.meta.url), 'utf8')
const context = JSON.parse(readFileSync(new URL('../../infra/cdk.json', import.meta.url), 'utf8')).context as Record<string, unknown>

describe('flat-rate Free plan', () => {
  it('keeps the plan web ACL in the context', () => {
    expect(String(context.webAclArn)).toMatch(/^arn:aws:wafv2:us-east-1:\d{12}:global\/webacl\//)
    expect(stack).toMatch(/webAclId: webAclArn/)
  })

  it('uses none of the features the Free plan refuses', () => {
    for (const refused of ['ResponseHeadersPolicy', 'responseHeadersPolicy', 'RealtimeLogConfig', 'enableLogging', 'logBucket', 'edgeLambdas', 'EdgeFunction']) {
      expect(stack, refused).not.toContain(refused)
    }
  })

  it('sets the security headers with the viewer-response function', () => {
    expect(stack).toContain('FunctionEventType.VIEWER_RESPONSE')
    expect(stack).toContain('headersFunctionCode(securityHeaders)')
  })

  it('keeps the kill switch without reserved concurrency and without a committed email', () => {
    expect(guard).not.toMatch(/reservedConcurrentExecutions\s*:/)
    // An address, not any "@": the context keys carry "@aws-cdk/…" (gemma, audit of this push).
    expect(Object.values(context).map(String).join(' ')).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i)
    expect(context.distributionId).toBeTruthy()
  })
})
