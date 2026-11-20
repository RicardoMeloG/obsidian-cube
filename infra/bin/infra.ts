#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { StaticSiteStack } from '../lib/static-site-stack'
import { CostGuardStack } from '../lib/cost-guard-stack'

// Environment-agnostic: account/region come from the deploy credentials at
// `cdk deploy` time, so `cdk synth` works offline with no AWS lookups.
const app = new cdk.App()

new StaticSiteStack(app, 'ObsidianCubeStaticSite', {
  description: 'Static hosting for the Obsidian Cube portfolio (S3 + CloudFront).',
})

// Cost ceiling (spec 014, layer 3): only when the distribution id is in the
// context, so `cdk synth` of a fresh clone still works without it. The alert
// email is passed at deploy time (`-c alertEmail=...`), never committed.
const distributionId = app.node.tryGetContext('distributionId') as string | undefined
if (distributionId) {
  new CostGuardStack(app, 'ObsidianCubeCostGuard', {
    description: 'Disables the Obsidian Cube distribution when the monthly cost ceiling is passed (spec 014).',
    distributionId,
    limitUsd: Number(app.node.tryGetContext('costCeilingUsd') ?? 20),
    alertEmail: app.node.tryGetContext('alertEmail') as string | undefined,
  })
}
