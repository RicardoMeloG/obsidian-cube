// The cost ceiling in the architecture (spec 014; docs/roadmap.md): resources
// billed outside the CloudFront flat-rate Free plan, or by the hour, never
// reach a deploy. Every stack is synthesised with every switch on, so a slip
// in any construct is caught here, not in the bill (pending item dt-35).
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
const { CostGuardStack } = require('../lib/cost-guard-stack.ts')

const app = new cdk.App({
  context: {
    visitLogs: true,
    wafSamples: true,
    webAclArn: 'arn:aws:wafv2:us-east-1:123456789012:global/webacl/acl-name/abc-123',
    githubDeploySubject: 'repo:owner@1/site@2',
    matchLogOrigins: ['https://example.github.io'],
    siteDomains: ['example.com'],
    certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/abc',
  },
})
const stacks = [
  new StaticSiteStack(app, 'Site'),
  new CostGuardStack(app, 'CostGuard', { distributionId: 'E123EXAMPLE', limitUsd: 20 }),
]
const resources = stacks.flatMap((stack) => Object.entries(Template.fromStack(stack).toJSON().Resources).map(([id, resource]) => ({ stack: stack.stackName, id, ...resource })))

// Billed by the hour or by capacity, or outside the flat-rate plan.
const FORBIDDEN = [
  /^AWS::EC2::(NatGateway|Instance|LaunchTemplate|VPCEndpoint|TransitGateway)/,
  /^AWS::AutoScaling::/,
  /^AWS::RDS::/,
  /^AWS::ElastiCache::/,
  /^AWS::OpenSearchService::/,
  /^AWS::ECS::|^AWS::EKS::/,
  /^AWS::KMS::Key$/,
  /^AWS::SecretsManager::/,
  /^AWS::Kinesis/,
  /^AWS::ElasticLoadBalancing/,
  // The plan's web ACL is created by the console with the subscription; a
  // second one from the stack would be billed by the pay-as-you-go WAF.
  /^AWS::WAFv2::WebACL$/,
]

test('the stacks synthesise resources of every switch', () => {
  const types = new Set(resources.map((resource) => resource.Type))
  for (const type of ['AWS::CloudFront::Distribution', 'AWS::Lambda::Function', 'AWS::S3::Bucket', 'AWS::IAM::OIDCProvider', 'AWS::Events::Rule', 'AWS::Logs::Delivery']) {
    assert.ok(types.has(type), type)
  }
})

test('no resource billed by the hour or outside the flat-rate plan', () => {
  const found = resources.filter((resource) => FORBIDDEN.some((rule) => rule.test(resource.Type))).map((resource) => `${resource.stack}/${resource.id} ${resource.Type}`)
  assert.deepEqual(found, [])
})

test('no Lambda in a VPC (it would need a NAT gateway to reach AWS)', () => {
  const inVpc = resources.filter((resource) => resource.Type === 'AWS::Lambda::Function' && resource.Properties?.VpcConfig).map((resource) => resource.id)
  assert.deepEqual(inVpc, [])
})

test('every Lambda has a reserved concurrency and a timeout of at most five minutes', () => {
  // The cost guard's own function is exempt from the concurrency rule: it must
  // always find room to disable the distribution (spec 014).
  for (const fn of resources.filter((resource) => resource.Type === 'AWS::Lambda::Function')) {
    const timeout = fn.Properties.Timeout ?? 3
    assert.ok(timeout <= 300, `${fn.id} timeout ${timeout}`)
    if (fn.stack !== 'CostGuard') assert.ok(Number.isInteger(fn.Properties.ReservedConcurrentExecutions), `${fn.id} has no reserved concurrency`)
  }
})

test('every log group expires its logs', () => {
  for (const group of resources.filter((resource) => resource.Type === 'AWS::Logs::LogGroup')) {
    assert.ok(Number.isInteger(group.Properties?.RetentionInDays), `${group.id} keeps logs forever`)
  }
})

test('the site bucket keeps old versions for a bounded time (ADR 004 slice 1, dt-32)', () => {
  const site = resources.find((resource) => resource.stack === 'Site' && resource.Type === 'AWS::S3::Bucket' && resource.id.startsWith('SiteBucket'))
  assert.equal(site.Properties.VersioningConfiguration?.Status, 'Enabled')
  const rule = site.Properties.LifecycleConfiguration?.Rules?.find((r) => r.NoncurrentVersionExpiration)
  assert.ok(rule && rule.NoncurrentVersionExpiration.NoncurrentDays <= 90, 'old versions must expire')
})

test('www answers a redirect to the bare domain on the default behaviour (dt-34)', () => {
  const fn = resources.find((resource) => resource.Type === 'AWS::CloudFront::Function' && resource.id.startsWith('CleanPaths'))
  assert.match(fn.Properties.FunctionCode, /statusCode: 301/)
})
