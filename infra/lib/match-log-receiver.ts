// CDK construct for the write-only match-log receiver (spec 015, D-1/D-2/D-3).
// Creates the bucket, Lambda, function URL (OAC) and exposes a CloudFront origin.
import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import { join } from 'node:path'

export interface MatchLogReceiverProps {
  allowedOrigins: string[]
}

export class MatchLogReceiver extends Construct {
  readonly origin: cloudfront.IOrigin
  readonly bucket: s3.Bucket

  constructor(scope: Construct, id: string, props: MatchLogReceiverProps) {
    super(scope, id)

    // fail fast at synth time so a typo never reaches AWS (spec 015, D-3)
    if (!props.allowedOrigins.length) throw new Error('allowedOrigins must not be empty')
    const originPattern = /^https:\/\/[a-z0-9.-]+(:\d+)?$/
    for (const o of props.allowedOrigins) {
      if (!originPattern.test(o)) throw new Error(`invalid origin (expected https://host[:port]): ${o}`)
    }

    this.bucket = new s3.Bucket(this, 'Bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // keep data if the stack is deleted; objects expire via lifecycle
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{ id: 'expire-after-12-months', expiration: cdk.Duration.days(365) }],
    })

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    const fn = new lambda.Function(this, 'Function', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(join(__dirname, '..', 'lambda', 'match-log')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      logGroup,
      environment: {
        BUCKET: this.bucket.bucketName,
        ALLOWED_ORIGINS: JSON.stringify(props.allowedOrigins),
      },
      // no reservedConcurrentExecutions: account pool is 10, AWS keeps all unreserved (AGENTS.md cost rules)
    })

    // write-only on the partidas/ prefix; no read, no list (spec 015, D-4)
    this.bucket.grantPut(fn, 'partidas/*')

    const url = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      cors: {
        allowedOrigins: props.allowedOrigins,
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ['content-type', 'x-amz-content-sha256'],
        maxAge: cdk.Duration.hours(1),
      },
    })

    // OAC ensures only CloudFront can invoke the function URL (spec 015, D-2)
    this.origin = origins.FunctionUrlOrigin.withOriginAccessControl(url)
  }
}
