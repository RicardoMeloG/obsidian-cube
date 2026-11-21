// The web ACL sample collector (spec 020): an hourly function copies the web
// ACL's request samples, without IP or headers, into a private bucket that
// the local admin reads. No function URL, no route on the distribution.
import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import { join } from 'node:path'

export type WafSampleCollectorProps = {
  // The CloudFront-scope web ACL the Free plan created (context webAclArn).
  webAclArn: string
}

// Records hold no IP, no user agent and ten-minute times, and the attack trend
// is worth a year (owner, 2026-11-21: D-5).
export const SAMPLE_RETENTION_DAYS = 365

export class WafSampleCollector extends Construct {
  readonly bucket: s3.Bucket

  constructor(scope: Construct, id: string, props: WafSampleCollectorProps) {
    super(scope, id)
    if (!/^arn:aws:wafv2:us-east-1:\d{12}:global\/webacl\/[^/]+\/[^/]+$/.test(props.webAclArn)) {
      throw new Error(`webAclArn must be a CloudFront-scope web ACL in us-east-1: ${props.webAclArn}`)
    }

    this.bucket = new s3.Bucket(this, 'Bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // Kept if the stack is deleted, like the site and match-log buckets.
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{ id: 'expire-samples', prefix: 'samples/', expiration: cdk.Duration.days(SAMPLE_RETENTION_DAYS) }],
    })

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    const fn = new lambda.Function(this, 'Function', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(join(__dirname, '..', 'lambda', 'waf-samples')),
      memorySize: 128,
      // A run is 30 calls; a catch-up after failures, with retries, can be
      // more than twice that.
      timeout: cdk.Duration.seconds(180),
      logGroup,
      environment: { BUCKET: this.bucket.bucketName, WEB_ACL_ARN: props.webAclArn },
      // One run at a time; a failed run is caught up by the next, so no retry.
      reservedConcurrentExecutions: 1,
      retryAttempts: 0,
    })

    // Read the web ACL's rule names and its samples, on this web ACL only.
    fn.addToRolePolicy(new iam.PolicyStatement({ actions: ['wafv2:GetSampledRequests', 'wafv2:GetWebACL'], resources: [props.webAclArn] }))
    // Its own bucket only: write the hours and the state, read the state
    // (ListBucket, so a missing state reads as missing, not as denied).
    fn.addToRolePolicy(new iam.PolicyStatement({ actions: ['s3:GetObject', 's3:PutObject'], resources: [this.bucket.arnForObjects('*')] }))
    fn.addToRolePolicy(new iam.PolicyStatement({ actions: ['s3:ListBucket'], resources: [this.bucket.bucketArn] }))

    // Ten minutes past every hour, reading the hour before (D-2).
    new events.Rule(this, 'Hourly', {
      description: 'Copies the web ACL samples of the previous hour (spec 020)',
      schedule: events.Schedule.cron({ minute: '10' }),
      targets: [new targets.LambdaFunction(fn, { retryAttempts: 0 })],
    })
  }
}
