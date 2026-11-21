// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { compareWebAcl, normaliseWebAcl, webAclRef } from '../lib/web-acl.mjs'

// The web ACL comparison of spec 016, P-2 (dt-09 a): no AWS here, only the shape.
const rate = {
  Name: 'ip-rate-limit-300-5min',
  Priority: 0,
  Action: { Block: {} },
  Statement: { RateBasedStatement: { Limit: 300, EvaluationWindowSec: 300, AggregateKeyType: 'IP' } },
  VisibilityConfig: { MetricName: 'ip-rate', CloudWatchMetricsEnabled: true, SampledRequestsEnabled: true },
}
const common = {
  Name: 'AWS-AWSManagedRulesCommonRuleSet',
  Priority: 1,
  OverrideAction: { None: {} },
  Statement: { ManagedRuleGroupStatement: { VendorName: 'AWS', Name: 'AWSManagedRulesCommonRuleSet', RuleActionOverrides: [{ Name: 'SizeRestrictions_BODY', ActionToUse: { Count: {} } }] } },
  VisibilityConfig: { MetricName: 'common', CloudWatchMetricsEnabled: true, SampledRequestsEnabled: true },
}
const acl = (rules: unknown[]) => normaliseWebAcl({ DefaultAction: { Allow: {} }, Rules: rules })

describe('web ACL comparison', () => {
  it('reads the name and id from the ARN, and refuses another kind', () => {
    expect(webAclRef('arn:aws:wafv2:us-east-1:123456789012:global/webacl/CreatedByCloudFront-1/abc-123')).toEqual({ name: 'CreatedByCloudFront-1', id: 'abc-123' })
    expect(() => webAclRef('arn:aws:wafv2:eu-west-1:123456789012:regional/webacl/x/y')).toThrow()
  })

  it('finds no difference in the same rules, whatever their order or metric names', () => {
    const renamed = { ...rate, VisibilityConfig: { MetricName: 'other', CloudWatchMetricsEnabled: false, SampledRequestsEnabled: false } }
    expect(compareWebAcl(acl([rate, common]), acl([common, renamed]))).toEqual([])
  })

  it('reports a rule turned to Count, a changed limit, a missing and an extra rule', () => {
    const counted = { ...rate, Action: { Count: {} } }
    expect(compareWebAcl(acl([rate, common]), acl([counted, common]))[0]).toMatch(/^rule ip-rate-limit-300-5min: changed/)
    const looser = { ...rate, Statement: { RateBasedStatement: { ...rate.Statement.RateBasedStatement, Limit: 2000 } } }
    expect(compareWebAcl(acl([rate]), acl([looser]))).toHaveLength(1)
    expect(compareWebAcl(acl([rate, common]), acl([rate]))).toEqual(['rule AWS-AWSManagedRulesCommonRuleSet: missing from the live web ACL'])
    expect(compareWebAcl(acl([rate]), acl([rate, common]))).toEqual(['rule AWS-AWSManagedRulesCommonRuleSet: in the live web ACL, not expected'])
  })

  it('reports a body-size rule no longer excluded (it would break the match log)', () => {
    const strict = { ...common, Statement: { ManagedRuleGroupStatement: { VendorName: 'AWS', Name: 'AWSManagedRulesCommonRuleSet' } } }
    expect(compareWebAcl(acl([common]), acl([strict]))).toHaveLength(1)
  })

  it('reports a changed default action', () => {
    expect(compareWebAcl(acl([]), normaliseWebAcl({ DefaultAction: { Block: {} }, Rules: [] }))[0]).toMatch(/^default action/)
  })
})
