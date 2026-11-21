// The web ACL sample collector (spec 020): off without its switch, and when on,
// a function that can only read the web ACL's samples and write its bucket.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
// The CDK app's own compiler settings; the root is set because this test
// loads lib/ without bin/.
require('ts-node').register({ transpileOnly: true, compilerOptions: { rootDir: fileURLToPath(new URL('..', import.meta.url)) } })
const cdk = require('aws-cdk-lib')
const { Template } = require('aws-cdk-lib/assertions')
const { StaticSiteStack } = require('../lib/static-site-stack.ts')
const { SAMPLE_RETENTION_DAYS } = require('../lib/waf-sample-collector.ts')

const ACL = 'arn:aws:wafv2:us-east-1:123456789012:global/webacl/acl-name/abc-123'
const synth = (context) => Template.fromStack(new StaticSiteStack(new cdk.App({ context }), 'Site')).toJSON()
const ofType = (template, type) => Object.entries(template.Resources).filter(([, resource]) => resource.Type === type)

test('without the switch nothing of the collector is synthesised', () => {
  const template = synth({ webAclArn: ACL })
  assert.equal(Object.keys(template.Resources).filter((id) => id.startsWith('WafSamples')).length, 0)
  assert.equal(template.Outputs.WafSamplesBucket, undefined)
})

test('the switch without a web ACL fails at synth', () => {
  assert.throws(() => synth({ wafSamples: true }), /webAclArn/)
})

const template = synth({ webAclArn: ACL, wafSamples: true })
const [[fnId, fn]] = ofType(template, 'AWS::Lambda::Function').filter(([id]) => id.startsWith('WafSamples'))

test('one function, one run at a time, no retry, no URL, on an hourly schedule', () => {
  assert.equal(fn.Properties.ReservedConcurrentExecutions, 1)
  assert.equal(fn.Properties.Environment.Variables.WEB_ACL_ARN, ACL)
  assert.equal(ofType(template, 'AWS::Lambda::Url').filter(([id]) => id.startsWith('WafSamples')).length, 0)
  const [[, invoke]] = ofType(template, 'AWS::Lambda::EventInvokeConfig').filter(([id]) => id.startsWith('WafSamples'))
  assert.equal(invoke.Properties.MaximumRetryAttempts, 0)
  const [[, rule]] = ofType(template, 'AWS::Events::Rule').filter(([id]) => id.startsWith('WafSamples'))
  assert.equal(rule.Properties.ScheduleExpression, 'cron(10 * * * ? *)')
  assert.equal(rule.Properties.Targets[0].Arn['Fn::GetAtt'][0], fnId)
})

test('its role reads only this web ACL and touches only its own bucket', () => {
  const role = fn.Properties.Role['Fn::GetAtt'][0]
  const statements = ofType(template, 'AWS::IAM::Policy')
    .filter(([, policy]) => policy.Properties.Roles.some((r) => r.Ref === role))
    .flatMap(([, policy]) => policy.Properties.PolicyDocument.Statement)
  const actions = statements.flatMap((s) => [].concat(s.Action)).sort()
  assert.deepEqual(actions, ['s3:GetObject', 's3:ListBucket', 's3:PutObject', 'wafv2:GetSampledRequests', 'wafv2:GetWebACL'])
  for (const statement of statements) {
    assert.equal(statement.Effect, 'Allow')
    const resource = JSON.stringify(statement.Resource)
    if ([].concat(statement.Action).some((a) => a.startsWith('wafv2:'))) assert.equal(statement.Resource, ACL)
    else assert.match(resource, /WafSamplesBucket/)
  }
})

test('a private bucket, kept on deletion, expiring samples at the chosen retention', () => {
  const [[, bucket]] = ofType(template, 'AWS::S3::Bucket').filter(([id]) => id.startsWith('WafSamples'))
  assert.equal(bucket.DeletionPolicy, 'Retain')
  assert.deepEqual(bucket.Properties.PublicAccessBlockConfiguration, { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true })
  const [rule] = bucket.Properties.LifecycleConfiguration.Rules
  assert.equal(rule.Prefix, 'samples/')
  assert.equal(rule.ExpirationInDays, SAMPLE_RETENTION_DAYS)
  assert.equal(SAMPLE_RETENTION_DAYS, 365)
})
