import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GitHubDeployRole } from './github-deploy-role'
import { MatchLogReceiver } from './match-log-receiver'
import { VisitLogs } from './visit-logs'

// Security headers, shared with `vite preview` so the layout check runs the
// built site under the same policy (spec 010, 5.13). CloudFront sets them with
// a viewer-response function, because the flat-rate Free plan does not allow
// custom response headers policies (spec 014, D-7).
// eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS module shared with edgeHeaders.test.ts; a CommonJS package loads it with require
const { headersFunctionCode } = require('../edge/security-headers.cjs') as { headersFunctionCode: (headers: unknown) => string }
const securityHeaders = JSON.parse(readFileSync(join(__dirname, '..', 'security-headers.json'), 'utf8')) as unknown

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

    const securityHeadersFunction = new cloudfront.Function(this, 'SecurityHeadersFunction', {
      comment: 'Security headers of infra/security-headers.json; drops Server (spec 014, D-7)',
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(headersFunctionCode(securityHeaders)),
    })

    // Clean paths (ADR 009): a path with no extension is served from
    // its page, `/es/seguridad` from `es/seguridad.html` and `/es` from
    // `es.html`, so each address gets its own language, title and share
    // preview. A trailing slash is dropped first. The root becomes
    // `/index.html` here, not by the default root object: since S3 grants
    // CloudFront s3:ListBucket (AD-09), a bare `/` reaching the origin would
    // be a bucket listing, so no path (`//` included) may arrive as `/`.
    const cleanPaths = new cloudfront.Function(this, 'CleanPaths', {
      comment: 'Serves each clean path from its .html page (ADR 009)',
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`function handler(event) {
  var request = event.request;
  // Empty segments out: '//' and a trailing slash collapse, no backslash
  // needed inside this template string.
  var uri = '/' + request.uri.split('/').filter(function (part) { return part !== ''; }).join('/');
  if (uri === '/') uri = '/index.html';
  else if (uri.lastIndexOf('.') <= uri.lastIndexOf('/')) uri = uri + '.html';
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

    // CloudFront flat-rate Free plan (spec 014, D-3): the owner subscribes in
    // the console, which creates the web ACL the plan requires; its ARN comes
    // back through the context so a deploy keeps the association (the plan
    // forbids removing it). Without it the distribution has no web ACL.
    const webAclArn = this.node.tryGetContext('webAclArn') as string | undefined

    // Match-log receiver (spec 015, D-1/D-3): opt-in by context; without it
    // nothing changes. A string from `-c` is JSON-parsed; an array from
    // cdk.json is used as is.
    const rawMatchLogOrigins = this.node.tryGetContext('matchLogOrigins') as string[] | string | undefined
    const matchLogOrigins: string[] | undefined =
      rawMatchLogOrigins === undefined
        ? undefined
        : typeof rawMatchLogOrigins === 'string'
          ? (JSON.parse(rawMatchLogOrigins) as string[])
          : rawMatchLogOrigins

    let matchLog: MatchLogReceiver | undefined
    let matchLogBehavior: Record<string, unknown> = {}
    if (matchLogOrigins) {
      matchLog = new MatchLogReceiver(this, 'MatchLog', { allowedOrigins: matchLogOrigins })
      matchLogBehavior = {
        additionalBehaviors: {
          '/api/iron-bastion/*': {
            origin: matchLog.origin,
            // HTTPS_ONLY: a redirect would drop the POST body
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
            functionAssociations: [
              { function: securityHeadersFunction, eventType: cloudfront.FunctionEventType.VIEWER_RESPONSE },
            ],
          },
        },
      }
    }

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      comment: 'Obsidian Cube portfolio',
      ...customDomain,
      ...(webAclArn ? { webAclId: webAclArn } : {}),
      ...matchLogBehavior,
      defaultRootObject: 'index.html',
      // Pay as you go serves from the cheapest edges only; a flat-rate plan does
      // not support price classes and removes the setting (spec 014).
      priceClass: webAclArn ? cloudfront.PriceClass.PRICE_CLASS_ALL : cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        // LIST lets S3 answer 404 instead of 403 for a missing object, so
        // CloudFront can tell an unknown path from a refused one (spec 010,
        // AD-09). Viewers cannot list: the cache policy forwards no query string.
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket, {
          originAccessLevels: [cloudfront.AccessLevel.READ, cloudfront.AccessLevel.LIST],
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          { function: cleanPaths, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
          { function: securityHeadersFunction, eventType: cloudfront.FunctionEventType.VIEWER_RESPONSE },
        ],
      },
      // Real 404s (spec 010, AD-09): an unknown path gets the static 404 page
      // with status 404. A 403 is no longer rewritten, so a WAF block, the
      // match log receiver's refusals and S3 denials reach the client as what
      // they are instead of looking like the home page.
      errorResponses: [
        { httpStatus: 404, responseHttpStatus: 404, responsePagePath: '/404.html', ttl: cdk.Duration.minutes(1) },
      ],
    })

    // Spec 013 / D-6: visit logs are off by default.
    // The owner turns this on after approving the stack diff.
    // Context key: visitLogs (boolean true or the string 'true').
    const visitLogsEnabled = this.node.tryGetContext('visitLogs')
    if (visitLogsEnabled === true || visitLogsEnabled === 'true') {
      new VisitLogs(this, 'VisitLogs', { distribution })
    }

    // The deploy from GitHub (spec 010, D-6; dp-04): only when the subject prefix of the
    // repository's tokens is in the context, so a fresh clone synthesises
    // without it.
    const githubDeploySubject = this.node.tryGetContext('githubDeploySubject') as string | undefined
    if (githubDeploySubject) {
      const deploy = new GitHubDeployRole(this, 'GitHubDeploy', { bucket, distribution, subjectPrefix: githubDeploySubject })
      new cdk.CfnOutput(this, 'DeployRoleArn', { value: deploy.role.roleArn })
    }

    // Exports consumed by the deploy workflow (S3 sync + CloudFront invalidation).
    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName })
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId })
    new cdk.CfnOutput(this, 'DistributionDomain', { value: distribution.distributionDomainName })
    if (matchLog) new cdk.CfnOutput(this, 'MatchLogBucket', { value: matchLog.bucket.bucketName })
  }
}
