# AWS deployment (static site)

Infrastructure-as-code for hosting the **public** Obsidian Cube frontend on AWS,
live at `ricardomelog.com` since 2026-11-12. Scope: the static site (S3 +
CloudFront) and its cost guardrails (spec 014). The admin backend and Postgres
are **not** deployed here: they run locally (see `docker-compose.yml` /
`server/`), and the cloud admin is ADR 004 (Cognito).

## Architecture

```
owner's machine (SSO) ──► S3 (private bucket) ──(OAC)──► CloudFront ──► viewers
                                                          ▲
                        DNS in Cloudflare (CNAMEs, grey cloud) ──┘
```

- **S3**: private bucket (all public access blocked, SSE-S3, TLS enforced). Never
  served directly.
- **CloudFront**: fronts the bucket via Origin Access Control; redirects to HTTPS;
  a viewer-request function serves each clean path from its page
  (`/es/seguridad` from `es/seguridad.html`, ADR 009); unknown paths still get
  `index.html` with status 200 until real 404s land (spec 010, AD-09). The
  security headers of `infra/security-headers.json` are enforced, CSP included;
  from spec 014 a viewer-response function sets them (D-7).
- **Domain**: `ricardomelog.com` and `www`, registered and resolved in
  Cloudflare, not Route 53. The ACM certificate (us-east-1) was requested and
  validated by hand with CNAME records in Cloudflare; its ARN and the domains
  reach the stack through the context in `infra/cdk.json`. Both names are
  CNAMEs with the grey cloud (DNS only) to the distribution's domain.
- **CI/CD**: `.github/workflows/ci.yml` (every gate listed in
  `docs/architecture.md`) and `infra.yml` (`cdk synth`, when `infra/` changes).
  `deploy.yml` (build → `aws s3 sync` → invalidation, over a short-lived OIDC
  role) exists but is not wired yet: the OIDC role is not created, so today
  releases go out from the owner's machine (below).

Defined in `infra/` with the **AWS CDK (TypeScript)**.

## One-time setup

1. **Bootstrap CDK** in the target account/region (needs AWS credentials locally):
   ```bash
   cd infra && npm run prepare:cdk && npm ci
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

## Going to production from this machine

Until the deploy runs from GitHub with the OIDC role (spec 010, D-6), a release
goes out from the owner's machine with an SSO profile, never the root account.
`<bucket>` and `<distribution>` are the stack outputs `BucketName` and
`DistributionId`.

1. **Publish in the admin.** Check first that the drafts hold only the change
   meant to go out; publishing writes `public/content/` and records a version.
2. **Build and check:** `npm run build`, `npm run check:privacy` and
   `npm run report:objective` (nothing missing).
3. **Sign in:** `aws sso login --profile <profile>`.
4. **Upload the code** the way `deploy.yml` does: hashed assets first, never
   deleted; then the rest with `--delete`, excluding `content/*` and
   `assets/*`, because content belongs to the admin (ADR 004):
   ```bash
   aws s3 sync dist/assets/ s3://<bucket>/assets/ --profile <profile>
   aws s3 sync dist/ s3://<bucket> --delete --exclude "content/*" --exclude "assets/*" --profile <profile>
   ```
5. **Upload only the content documents published in step 1**, one by one, never
   a sync of `content/`:
   ```bash
   aws s3 cp dist/content/site.es.json s3://<bucket>/content/site.es.json --profile <profile>
   ```
6. **Invalidate and wait:**
   ```bash
   aws cloudfront create-invalidation --distribution-id <distribution> --paths "/*" --profile <profile>
   aws cloudfront wait invalidation-completed --distribution-id <distribution> --id <invalidation id> --profile <profile>
   ```
7. **Check the live site:** `npm run check:live`.
8. **Back up the content:** export the pending-work panel to `private/panel/`
   first (one JSON per item plus `pendientes.md`), then `npm run backup:content`
   (private repository; never `.env` nor `admin_users`). The backup versions the
   panel next to the content, so a formatted machine loses neither. Every
   content publish ends with this step.

## Cost guardrails (spec 014)

The account has a ceiling of about 20 USD a month, in four layers. The Free
plan does not allow custom response headers policies, so the security headers
are set by a viewer-response CloudFront Function from `infra/security-headers.json`
(spec 014, D-7); deploy that change, and check the live headers, before
subscribing.

1. **Flat-rate Free plan.** The owner subscribes the distribution in the
   CloudFront console (distribution → *Pricing plan*), which creates the web
   ACL the plan requires. Copy that web ACL's ARN into `infra/cdk.json` as
   `webAclArn` before the next `cdk deploy` of `ObsidianCubeStaticSite`, or the
   deploy would remove the association. With it the stack also stops asking
   for `PriceClass_100`, which a plan does not support (D-8).
2. **IP rate limiting** in that web ACL (console → the web ACL → rules): block a
   client above 300 requests in 5 minutes. A first visit loads about 40 files.
3. **Kill switch** (`ObsidianCubeCostGuard`): a 20 USD monthly budget publishes
   to SNS and a function disables the distribution. Deploy it with
   `npx cdk deploy ObsidianCubeCostGuard -c alertEmail=<owner email> --profile <profile>`
   from `infra/`; the email is never committed. The site stays down until it is
   turned on again:
   ```bash
   aws cloudfront get-distribution-config --id <distribution> --profile <profile> > dist.json
   # set DistributionConfig.Enabled to true, keep the rest, then:
   aws cloudfront update-distribution --id <distribution> --if-match <ETag from dist.json> \
     --distribution-config file://<only the DistributionConfig object> --profile <profile>
   ```
4. **Alerts:** the budgets for any spend and 5 USD a month, and the default
   cost anomaly monitor, by email.

## Local verification (no AWS account needed)

```bash
cd infra
npm run prepare:cdk
npm ci
npm run synth   # generates CloudFormation into cdk.out/ — fully offline
```

## Not yet included

- Deploys from GitHub with the OIDC role (spec 010, D-6; steps 3 and 4 of the setup above).
- Real 404s for unknown paths (spec 010, AD-09).
- Cognito-authenticated admin (HTTP API + Lambda + S3, no database in the cloud), decided in ADR 004.
