// Spec 013: the local admin's visits dashboard reads these CloudFront logs.
// Only seven fields are delivered — the viewer IP is never logged (privacy rule).
// Objects expire after 90 days by default.
// This construct is created only when the context key `visitLogs` is true.

import { Construct } from 'constructs'
import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface VisitLogsProps {
  distribution: cloudfront.IDistribution
  retentionDays?: number
}

export class VisitLogs extends Construct {
  public readonly bucket: s3.Bucket

  constructor(scope: Construct, id: string, props: VisitLogsProps) {
    super(scope, id)

    const retentionDays = props.retentionDays ?? 90
    const stack = cdk.Stack.of(this)
    const account = stack.account

    this.bucket = new s3.Bucket(this, 'Bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      versioned: false,
      lifecycleRules: [
        {
          id: 'expire-visit-logs',
          expiration: cdk.Duration.days(retentionDays),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    this.bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        principals: [new iam.ServicePrincipal('delivery.logs.amazonaws.com')],
        actions: ['s3:PutObject'],
        resources: [this.bucket.arnForObjects(`AWSLogs/${account}/CloudFront/*`)],
        conditions: {
          StringEquals: {
            's3:x-amz-acl': 'bucket-owner-full-control',
            'aws:SourceAccount': account,
          },
          ArnLike: {
            'aws:SourceArn': `arn:aws:logs:us-east-1:${account}:delivery-source:*`,
          },
        },
      }),
    )

    const visitLogFields: string[] = JSON.parse(
      readFileSync(join(__dirname, '..', 'visit-log-fields.json'), 'utf8'),
    ) as string[]

    const forbidden = [
      'c-ip',
      'x-forwarded-for',
      'cs(Cookie)',
      'cs-uri-query',
      'cs(Referer)',
      'x-edge-request-id',
      'asn',
      'c-port',
    ]
    const found = visitLogFields.filter((f) => forbidden.includes(f))
    if (found.length > 0) {
      throw new Error(`visit-log-fields.json contains forbidden field(s): ${found.join(', ')}`)
    }

    const source = new logs.CfnDeliverySource(this, 'Source', {
      name: 'obsidian-cube-visits',
      resourceArn: stack.formatArn({
        service: 'cloudfront',
        region: '',
        resource: 'distribution',
        resourceName: props.distribution.distributionId,
      }),
      logType: 'ACCESS_LOGS',
    })

    const destination = new logs.CfnDeliveryDestination(this, 'Destination', {
      name: 'obsidian-cube-visits-s3',
      destinationResourceArn: this.bucket.bucketArn,
      outputFormat: 'json',
    })

    const delivery = new logs.CfnDelivery(this, 'Delivery', {
      deliverySourceName: source.ref,
      deliveryDestinationArn: destination.attrArn,
      recordFields: visitLogFields,
      s3SuffixPath: '{yyyy}/{MM}/{dd}/{HH}',
      s3EnableHiveCompatiblePath: false,
    })

    delivery.node.addDependency(this.bucket.policy!)

    new cdk.CfnOutput(this, 'VisitLogsBucketName', {
      value: this.bucket.bucketName,
      description: 'Private bucket of the CloudFront visit logs (spec 013); VISITS_BUCKET in the admin .env',
    })
  }
}
