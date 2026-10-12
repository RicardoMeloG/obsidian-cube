# AWS deployment (static site)

Infrastructure-as-code for hosting the **public** Obsidian Cube frontend on AWS.
Scope of this slice: the static site only (S3 + CloudFront) plus CI/CD. The admin
backend and Postgres are **not** deployed here — they run locally today (see
`docker-compose.yml` / `server/`) and are a future slice.

## Architecture

```
GitHub Actions ──(OIDC)──> AWS
   build dist/  ──►  S3 (private bucket)  ──(OAC)──►  CloudFront  ──►  viewers
                     └── content synced by deploy.yml
```

- **S3**: private bucket (all public access blocked, SSE-S3, TLS enforced). Never
  served directly.
- **CloudFront**: fronts the bucket via Origin Access Control; redirects to HTTPS;
  serves `index.html` for 403/404 so client-side routing works.
- **CI/CD**: `.github/workflows/ci.yml` (lint/test/build + `cdk synth`) and
  `deploy.yml` (build → `aws s3 sync` → CloudFront invalidation), authenticating
  with a short-lived **OIDC role** — no long-lived AWS keys in GitHub.

Defined in `infra/` with the **AWS CDK (TypeScript)**.

## One-time setup

1. **Bootstrap CDK** in the target account/region (needs AWS credentials locally):
   ```bash
   cd infra && npm install
   npx cdk bootstrap aws://<ACCOUNT_ID>/<REGION>
   ```
2. **Deploy the stack**:
   ```bash
   npm run deploy
   ```
   Note the outputs: `BucketName`, `DistributionId`, `DistributionDomain`.
3. **Create a GitHub OIDC deploy role** in AWS (trust `token.actions.githubusercontent.com`,
   scoped to this repo) with permissions to `s3:*` on the bucket and
   `cloudfront:CreateInvalidation`.
4. **Set repo configuration** (Settings → Secrets and variables → Actions):
   - Secret `AWS_DEPLOY_ROLE_ARN` — the OIDC role ARN.
   - Variables `AWS_REGION`, `SITE_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID` — from step 2.

After that, pushing to `main` (or running the *Deploy static site* workflow)
publishes the site.

## Local verification (no AWS account needed)

```bash
cd infra
npm install
npm run synth   # generates CloudFormation into cdk.out/ — fully offline
```

## Not yet included

- RDS/Aurora Postgres + admin backend deploy (Fargate/Lambda).
- Custom domain + ACM certificate (CloudFront currently serves its default domain).
- Cognito-authenticated admin (HTTP API + Lambda + S3) — decided in ADR 004, being built.
- WAF.
