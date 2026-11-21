# AWS deployment (static site)

Infrastructure-as-code for hosting the **public** Obsidian Cube frontend on AWS,
live at `ricardomelog.com` since 2026-11-12. Scope: the static site (S3 +
CloudFront) and its cost guardrails (spec 014). The admin backend and Postgres
are **not** deployed here: they run locally (see `docker-compose.yml` /
`server/`), and the cloud admin is ADR 004 (Cognito).

## Architecture

```
GitHub Actions (OIDC role, after the owner's approval) ─┐
owner's machine (SSO: content/, fallback deploys) ──────┴─► S3 (private bucket) ──(OAC)──► CloudFront ──► viewers
                                                                                            │   ▲
                         /api/iron-bastion/* ──(OAC)──► Lambda receiver ──► S3 (match logs) ┘   │
                                          DNS in Cloudflare (CNAMEs, grey cloud) ───────────────┘
```

- **S3**: private bucket (all public access blocked, SSE-S3, TLS enforced). Never
  served directly.
- **CloudFront**: fronts the bucket via Origin Access Control; redirects to HTTPS;
  a viewer-request function serves each clean path from its page
  (`/es/seguridad` from `es/seguridad.html`, ADR 009); an unknown path gets
  the static `404.html` with status 404 (spec 010, AD-09), and a 403 (a WAF
  block, a refusal of the match log receiver) is passed through as is. The
  security headers of `infra/security-headers.json` are enforced, CSP included;
  from spec 014 a viewer-response function sets them (D-7). The same function
  sets `Cache-Control` on successful answers (spec 018): a year and
  `immutable` for names with a content hash (`/assets/*`, the admin's
  `/content/media/<sha256>.webp`), `no-cache` for everything else, so pages and
  content documents are revalidated with their ETag on every visit. It governs
  the browser only; the edge cache follows the cache policy.
- **Match-log receiver** (spec 015, opt-in by the `matchLogOrigins` context):
  `/api/iron-bastion/*` goes to a Lambda function URL that only CloudFront may
  invoke (OAC, SigV4); it validates each match and writes one JSON into a
  private bucket that expires objects at 12 months. Reserved concurrency 3.
- **Deploy role** (`infra/lib/github-deploy-role.ts`, opt-in by the
  `githubDeploySubject` context): GitHub's OIDC provider and a role that only
  the `production` environment of this repository can take; it lists the
  bucket, writes and deletes the site's files (never `content/`) and
  invalidates the distribution. Output `DeployRoleArn`.
- **Domain**: `ricardomelog.com` and `www`, registered and resolved in
  Cloudflare, not Route 53. The ACM certificate (us-east-1) was requested and
  validated by hand with CNAME records in Cloudflare; its ARN and the domains
  reach the stack through the context in `infra/cdk.json`. Both names are
  CNAMEs with the grey cloud (DNS only) to the distribution's domain. ACM
  renews the certificate on its own only while its validation CNAMEs stay in
  Cloudflare: never delete them (dt-32). `www` answers a 301 to the bare
  domain from the viewer-request function (`infra/edge/clean-paths.cjs`,
  dt-34). The site bucket is versioned; old versions expire after 30 days
  (ADR 004, slice 1).
- **CI/CD**: `.github/workflows/ci.yml` (every gate listed in
  `docs/architecture.md`) and `infra.yml` (`cdk synth`, when `infra/` changes).
  `deploy.yml` (published content read from the live site → build, in a job
  with no AWS access → `aws s3 sync` → invalidation) runs on demand from
  `main`, over a short-lived OIDC token, in a second job, for the role of
  `infra/lib/github-deploy-role.ts` (since 2026-11-21, dp-04). Only the `production` environment of this repository can take the
  role, and that environment waits for the owner's approval in GitHub.

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
3. **The deploy role** comes with the stack when `githubDeploySubject` is in
   `infra/cdk.json`: the subject prefix of the repository's OIDC tokens, as
   `gh api repos/<owner>/<repo>/actions/oidc/customization/sub` reports it
   (`sub_claim_prefix`; this repository uses GitHub's immutable subjects, with
   the owner's and the repository's ids).
4. **Create the `production` environment** in GitHub with the owner as
   required reviewer and `main` as its only deployment branch, and set in it
   the secret `AWS_DEPLOY_ROLE_ARN` (the output `DeployRoleArn`) and the
   variables `AWS_REGION`, `SITE_BUCKET` and `CLOUDFRONT_DISTRIBUTION_ID`
   (from step 2).

After that, the *Deploy static site* workflow publishes the site, on demand,
once the owner approves it (below). Done on 2026-11-21.

## Going to production from GitHub

1. **Publish in the admin** first if content changed (step 1 and 5 below): the
   build job reads the published documents from the live site (/content/),
   so they must be published and invalidated before the deploy; it never
   writes them.
2. **Start it:** `gh workflow run deploy.yml --ref main` (or Actions → Deploy
   static site → Run workflow).
3. **Approve it:** the run waits on the `production` environment until the
   owner approves it in GitHub (Review deployments). Nobody else may approve;
   an agent never does.
4. **Check the live site:** `npm run check:live`, then the content backup
   (step 8 below).

The role, the environment and its values: the stack output `DeployRoleArn` is
the secret `AWS_DEPLOY_ROLE_ARN`; `SITE_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`
and `AWS_REGION` are variables; all four belong to the `production`
environment, so only the upload job sees them.

## Going to production from this machine

The fallback when GitHub cannot deploy: a release goes out from the owner's
machine with an SSO profile, never the root account.
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
   `npm run check:live` run twice in a row could trip it from the owner's own
   IP: every file answers 403 and the block lifts within a few minutes. The
   script now waits five minutes between live runs and stops with a clear
   message at the first sign of the block (dt-01, `docs/live-use-cases.md`).
   The console created the web ACL with three AWS managed rule groups in
   *Count*. Since 2026-11-14 they block (owner's decision, after a sample of
   the traffic showed only scanners probing `/.env`, `/.git` and WordPress):
   `AmazonIpReputationList`, `KnownBadInputsRuleSet` and `CommonRuleSet`,
   with one override: `SizeRestrictions_BODY` stays in *Count*, because the
   match log receiver (`/api/iron-bastion/*`, spec 015) has a body limit of
   512 KB and that rule's limit is 8 KB. Checked on 2026-11-14 after the change:
   a blocked path (`/.env.bak`), a 20 KB POST reaching the function (2026-11-14), and
   `check:live`. The web ACL is not in CDK; to go back, set each managed
   group's override action to *Count* in the console (one minute).
   Its rules are kept as data in `infra/web-acl.expected.json` (spec 016,
   P-2): `npm run check:waf` compares them with the live web ACL, read-only,
   under the SSO profile; run it after any console change, and after a change
   that is meant to stay, `npm run check:waf -- --update` and commit the diff.
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
   Tested on 2026-11-14: the function disabled the distribution, the site
   stopped resolving, and the commands above turned it on again in about three
   minutes. Resolvers that cached the outage (the visitor's provider) keep
   answering "no such name" until the negative TTL of the Cloudflare zone runs
   out, about 30 minutes; public resolvers (1.1.1.1) recover at once.
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

- Cognito-authenticated admin (HTTP API + Lambda + S3, no database in the cloud), decided in ADR 004.
