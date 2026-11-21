import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import type * as s3 from 'aws-cdk-lib/aws-s3'
import type * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import { Construct } from 'constructs'

// The deploy from GitHub (spec 010, D-6; dp-04): the deploy workflow signs in
// with a short-lived OIDC token, never stored keys. Only a run of the given
// repository in its `production` environment can take the role, and that
// environment asks the owner's approval before each deploy (configured in
// GitHub). The role does what deploy.yml does and nothing else:
//   - reads the published content documents (content/ belongs to the admin,
//     ADR 004) so the build renders the owner's pages, not the example;
//   - uploads and deletes the site's files, never under content/;
//   - invalidates this distribution.
export type GitHubDeployRoleProps = {
  bucket: s3.IBucket
  distribution: cloudfront.IDistribution
  // The subject prefix GitHub puts in this repository's tokens, as
  // `gh api repos/<owner>/<repo>/actions/oidc/customization/sub` reports it
  // (sub_claim_prefix). This repository uses GitHub's immutable subjects,
  // with the owner's and the repository's ids
  // (repo:Owner@id/name@id), so a renamed or recreated repository with the
  // same name cannot take the role.
  subjectPrefix: string
}

export const DEPLOY_ENVIRONMENT = 'production'
const GITHUB_OIDC = 'token.actions.githubusercontent.com'

export class GitHubDeployRole extends Construct {
  readonly role: iam.Role

  constructor(scope: Construct, id: string, props: GitHubDeployRoleProps) {
    super(scope, id)
    const { bucket, distribution, subjectPrefix } = props

    const provider = new iam.OidcProviderNative(this, 'GitHubOidc', {
      url: `https://${GITHUB_OIDC}`,
      clientIds: ['sts.amazonaws.com'],
    })

    this.role = new iam.Role(this, 'Role', {
      description: `Deploys the static site from ${subjectPrefix} (environment ${DEPLOY_ENVIRONMENT}, deploy.yml)`,
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(provider.oidcProviderArn, {
        StringEquals: {
          [`${GITHUB_OIDC}:aud`]: 'sts.amazonaws.com',
          // Exact subject: this repository, this environment. A branch, a
          // pull request or another environment gets a different subject.
          // The subject names no branch: the environment's branch policy
          // (main only) and its required reviewer, set in GitHub, are what
          // keep another branch out.
          [`${GITHUB_OIDC}:sub`]: `${subjectPrefix}:environment:${DEPLOY_ENVIRONMENT}`,
        },
      }),
    })

    const content = bucket.arnForObjects('content/*')
    this.role.addToPolicy(new iam.PolicyStatement({ actions: ['s3:ListBucket'], resources: [bucket.bucketArn] }))
    this.role.addToPolicy(new iam.PolicyStatement({ actions: ['s3:GetObject'], resources: [content] }))
    this.role.addToPolicy(new iam.PolicyStatement({ actions: ['s3:PutObject', 's3:DeleteObject'], resources: [bucket.arnForObjects('*')] }))
    // Explicit deny wins over the allow above: the code deploy never writes
    // or deletes the admin's content (deployWorkflow.test.ts checks the
    // workflow too).
    this.role.addToPolicy(new iam.PolicyStatement({ effect: iam.Effect.DENY, actions: ['s3:PutObject', 's3:DeleteObject'], resources: [content] }))
    this.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation'],
        resources: [cdk.Stack.of(this).formatArn({ service: 'cloudfront', region: '', resource: 'distribution', resourceName: distribution.distributionId })],
      }),
    )
  }
}
