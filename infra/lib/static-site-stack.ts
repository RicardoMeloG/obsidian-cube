import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Security headers, shared with `vite preview` so the layout check runs the
// built site under the same policy (spec 010, 5.13).
type SecurityHeaders = {
  reportOnly: boolean
  contentSecurityPolicy: Record<string, string[]>
  strictTransportSecuritySeconds: number
  referrerPolicy: string
  permissionsPolicy: string
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
      // The origin's `Server: AmazonS3` adds nothing for a visitor (ZAP 10036).
      removeHeaders: ['Server'],
      customHeadersBehavior: {
        customHeaders: [
          { header: 'Permissions-Policy', value: securityHeaders.permissionsPolicy, override: true },
          ...(securityHeaders.reportOnly
            ? [{ header: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy, override: true }]
            : []),
        ],
      },
    })

    // Clean paths (spec 012, AD-08): a path with no extension is served from
    // its page, `/es/seguridad` from `es/seguridad.html` and `/es` from
    // `es.html`, so each address gets its own language, title and share
    // preview. A trailing slash is dropped first; `/` stays on index.html.
    const cleanPaths = new cloudfront.Function(this, 'CleanPaths', {
      comment: 'Serves each clean path from its .html page (spec 012, AD-08)',
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.length > 1 && uri.endsWith('/')) uri = uri.slice(0, -1);
  if (uri !== '/' && uri.lastIndexOf('.') <= uri.lastIndexOf('/')) uri = uri + '.html';
  request.uri = uri;
  return request;
}`),
    })

    // Custom domain (D-7, decided 2026-11-12): the DNS lives in Cloudflare, not
    // Route 53, so the ACM certificate (us-east-1) is requested and validated by
    // hand with CNAMEs in Cloudflare, and only its ARN reaches the stack through
    // the context in cdk.json. Without both values the distribution keeps its
    // default *.cloudfront.net domain, so `cdk synth` still works offline.
    const siteDomains = this.node.tryGetContext('siteDomains') as string[] | undefined
    const certificateArn = this.node.tryGetContext('certificateArn') as string | undefined
    const customDomain =
      siteDomains?.length && certificateArn
        ? { domainNames: siteDomains, certificate: acm.Certificate.fromCertificateArn(this, 'SiteCertificate', certificateArn) }
        : {}

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      comment: 'Obsidian Cube portfolio',
      ...customDomain,
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: headersPolicy,
        functionAssociations: [{ function: cleanPaths, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      // Unknown paths still answer with the page (status 200); real 404s
      // come with spec 010, AD-09.
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
