// The deploy role from GitHub (spec 010, D-6; dp-04): who can take it and
// what it can touch, read from the synthesised stack.
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

function synth(context) {
  const app = new cdk.App({ context })
  return Template.fromStack(new StaticSiteStack(app, 'Site')).toJSON()
}
const ofType = (template, type) => Object.values(template.Resources).filter((resource) => resource.Type === type)

test('without the repository in the context there is no deploy role', () => {
  const template = synth({})
  assert.equal(ofType(template, 'AWS::IAM::OIDCProvider').length, 0)
  assert.equal(template.Outputs.DeployRoleArn, undefined)
})

const template = synth({ githubDeploySubject: 'repo:owner@1/site@2' })
const role = ofType(template, 'AWS::IAM::Role').find((resource) => /static site/.test(resource.Properties.Description ?? ''))
const statements = ofType(template, 'AWS::IAM::Policy')
  .flatMap((policy) => policy.Properties.PolicyDocument.Statement)
  .filter((statement) => [].concat(statement.Action).some((action) => /^(s3|cloudfront):/.test(action)))
const objectsOf = (statement) => JSON.stringify(statement.Resource)

test('only the production environment of the repository can take the role', () => {
  const [trust] = role.Properties.AssumeRolePolicyDocument.Statement
  assert.equal(trust.Action, 'sts:AssumeRoleWithWebIdentity')
  assert.deepEqual(trust.Condition, {
    StringEquals: {
      'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
      'token.actions.githubusercontent.com:sub': 'repo:owner@1/site@2:environment:production',
    },
  })
  assert.equal(role.Properties.MaxSessionDuration, 3600)
})

test('it never writes or deletes the admin content, and reads only content', () => {
  const deny = statements.find((statement) => statement.Effect === 'Deny')
  assert.deepEqual([].concat(deny.Action).sort(), ['s3:DeleteObject', 's3:PutObject'])
  assert.match(objectsOf(deny), /\/content\/\*/)
  const read = statements.find((statement) => [].concat(statement.Action).includes('s3:GetObject'))
  assert.match(objectsOf(read), /\/content\/\*/)
})

test('it touches only the site bucket and this distribution, with no wildcard action', () => {
  for (const statement of statements) {
    for (const action of [].concat(statement.Action)) assert.doesNotMatch(action, /\*/, action)
    assert.notEqual(statement.Resource, '*')
    assert.match(objectsOf(statement), /SiteBucket|SiteDistribution/)
  }
  const actions = statements.filter((statement) => statement.Effect === 'Allow').flatMap((statement) => [].concat(statement.Action)).sort()
  assert.deepEqual(actions, ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation', 's3:DeleteObject', 's3:GetObject', 's3:ListBucket', 's3:PutObject'])
})
