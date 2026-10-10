#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { StaticSiteStack } from '../lib/static-site-stack'

// Environment-agnostic: account/region come from the deploy credentials at
// `cdk deploy` time, so `cdk synth` works offline with no AWS lookups.
const app = new cdk.App()

new StaticSiteStack(app, 'ObsidianCubeStaticSite', {
  description: 'Static hosting for the Obsidian Cube portfolio (S3 + CloudFront).',
})
