import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Security headers, shared with `vite preview` so the layout check runs the
// built site under the same policy (spec 010, 5.13).
type SecurityHeaders = {
  reportOnly: boolean
  contentSecurityPolicy: Record<string, string[]>
  strictTransportSecuritySeconds: number
  referrerPolicy: string
}
const securityHeaders = JSON.parse(readFileSync(join(__dirname, '..', 'security-headers.json'), 'utf8')) as SecurityHeaders
const contentSecurityPolicy = Object.entries(securityHeaders.contentSecurityPolicy)
  .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
  .join('; ')

// Static hosting for the public Obsidian Cube site: a private S3 bucket fronted
// by CloudFront (Origin Access Control — the bucket is never public). Content is
// pushed by the deploy workflow (aws s3 sync), so this stack stays pure infra
// and `cdk synth` runs offline without needing a build.
export class StaticSiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const bucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // Keep the bucket if the stack is deleted — content is recoverable.
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // Report-only until the policy has run in production without reports; then
    // set reportOnly to false and it is enforced.
    const headersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      comment: 'Obsidian Cube security headers (infra/security-headers.json)',
      securityHeadersBehavior: {
        ...(securityHeaders.reportOnly
          ? {}
          : { contentSecurityPolicy: { contentSecurityPolicy, override: true } }),
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.seconds(securityHeaders.strictTransportSecuritySeconds),
          includeSubdomains: true,
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: securityHeaders.referrerPolicy as cloudfront.HeadersReferrerPolicy,
          override: true,
        },
      },
      customHeadersBehavior: securityHeaders.reportOnly
        ? { customHeaders: [{ header: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy, override: true }] }
        : undefined,
    })

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      comment: 'Obsidian Cube portfolio',
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: headersPolicy,
      },
      // SPA client-side routing: hand deep links back to index.html.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.minutes(5) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.minutes(5) },
      ],
    })

    // Exports consumed by the deploy workflow (S3 sync + CloudFront invalidation).
    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName })
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId })
    new cdk.CfnOutput(this, 'DistributionDomain', { value: distribution.distributionDomainName })
  }
}
