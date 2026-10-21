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
  serves `index.html` for 403/404 so client-side routing works (to be removed in
  the release stage, spec 010 AD-09, when a viewer-request function starts
  serving each clean path from its page, `/es/seguridad` from
  `es/seguridad.html`, spec 012 AD-08); adds the security headers of
  `infra/security-headers.json` (content security policy report-only until it
  has run clean in production; set `reportOnly` to `false` to enforce it).
- **CI/CD**: `.github/workflows/ci.yml` (every gate listed in
  `docs/architecture.md`), `infra.yml` (`cdk synth`, when `infra/` changes)
  and `deploy.yml` (on demand only since 2026-10-16: build → `aws s3 sync` →
  CloudFront invalidation), authenticating with a short-lived **OIDC role**,
  with no long-lived AWS keys in GitHub.

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

After that, running the *Deploy static site* workflow publishes the site. It
runs on demand only (2026-10-16): after every CI on `main` it failed for lack
of the account; whether it runs on its own again is decided at the release
stage (spec 010, D-6).

## Local verification (no AWS account needed)

```bash
cd infra
npm install
npm run synth   # generates CloudFormation into cdk.out/ — fully offline
```

## Not yet included

- Custom domain + ACM certificate (CloudFront currently serves its default domain; decision D-7, release stage).
- Cognito-authenticated admin (HTTP API + Lambda + S3, no database in the cloud), decided in ADR 004, built after the release.
- WAF.
