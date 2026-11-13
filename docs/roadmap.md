# Roadmap

Loaded on demand. The stages to the first release, what is open after it, and the known gaps, each with its real status. The priority order follows `docs/decisions/002-evidence-before-spectacle.md` and `docs/decisions/007-staged-path-to-publishing.md`.

## Stages to the first release (ADR 007, ADR 008)

A stage starts only when the previous one met its exit criteria; its decisions are taken at its entry.

1. **Normalization** — closed 2026-10-13. Spec 010 (P0–P4): the code brought to the declared architecture, the gates in CI, two independent audits resolved.
2. **Compositions** — closed 2026-10-18. Spec 011: one template per face edited from the admin, admin forms generated from the schemas, uploaded images, the CONTACT world.
3. **Content** — closed with the release. The real identity and copy in both languages through the admin, the layer for machines and the clean addresses (ADR 009).
4. **Security** — partly done. A security review of the site before going public (OWASP Top 10:2025 and a ZAP baseline scan, no failures) and the hardened headers: enforced CSP, HSTS, Permissions-Policy, no `Server` header. Open: the contact form and the CV request behind a captcha.
5. **Release** — live on 2026-11-12 at https://ricardomelog.com: CloudFront and private S3 with OAC (`infra/`), an ACM certificate, DNS at Cloudflare, A+ on Mozilla Observatory and SSL Labs. The first content reached production from the author's machine (spec 010, D-6); the repository was published with its history rewritten (spec 010, D-5).

## Open after the release, in order

1. `seo.siteUrl` in the published content, so every page carries an absolute `og:image`, its canonical and `hreflang` (checked by `npm run check:live`, CU-09).
2. The contact form and the CV request behind a captcha, with their abuse controls (security stage).
3. Real 404s from CloudFront instead of the home page (spec 010, AD-09).
4. `robots.txt` admitting the AI crawlers, `sitemap.xml`, and `llms.txt` served as `text/plain; charset=utf-8` (ADR 009).
5. The Cognito admin (ADR 004), slices below.
6. The methodology page (spec 010, D-8), world visibility (ADR 002, point 5) and the fullscreen art mode (ADR 001).

### The Cognito admin (ADR 004)

Private content never enters the repository, so in production it reaches the site through an admin that moves to AWS. Until then the local admin keeps its own login (password and TOTP, bound to 127.0.0.1), which never goes to production.

1. `deploy.yml` stops deleting private content (done); versioning on the site bucket.
2. Cognito User Pool (TOTP required, no self sign-up) and the static admin page under `/admin/` logging in through managed login.
3. HTTP API with a JWT authorizer and a Lambda: read, validate, publish to S3, invalidate `/content/*`.
4. Drafts in a private bucket, versions and restore with S3 object versions.
5. Publish renders the static SEO and the machine files, reusing `src/kernel/seo/`.
6. Retire the NestJS server and Postgres.

Still deferred: RDS or Aurora, Fargate, WAF.

### AWS cost guardrails

AWS has no spending cap that cuts the spend, so a bot could drive the bill far past plan. Five layers, each one bounding what the previous cannot:

1. **Account hygiene** (done): Free Tier usage alerts, Cost Anomaly Detection with a daily summary, an administrator in IAM Identity Center so the root user is not used day to day. CloudWatch billing alarms stay off on purpose: once enabled they cannot be disabled, and the budgets cover them.
2. **Alerts** (done at the first deploy): a USD 5 monthly cost budget alerting at 50 % actual, 100 % actual and 100 % forecasted.
3. **Ceilings in the architecture** (with the Cognito admin, in the CDK): the CloudFront flat-rate Free plan; the HTTP API throttled (5 requests per second, bursts of 10) with every admin route behind the JWT authorizer; reserved concurrency 2 and short timeouts on the Lambdas; self sign-up off; one month of log retention; the CV captcha on a free provider. Not allowed: NAT gateways or Lambdas in a VPC, RDS or Aurora, EC2, paid WAF web ACLs, customer-managed KMS keys; secrets in SSM Parameter Store instead of Secrets Manager.
4. **Kill switch** (in the CDK): a USD 10 budget notifies SNS, and a Lambda sets the admin Lambdas' reserved concurrency and the API's throttle to zero; the public site stays up under the flat-rate plan. Billing data arrives hours late, which is why layer 3 exists. Tested by firing it by hand.
5. **A gate in the harness**: a check that synthesizes the CDK app and fails when a forbidden resource type from layer 3 appears, so a slip cannot reach a deploy.

Worst case with layers 3 and 4: the throttle lets through at most about 13 million admin API calls a month, roughly USD 15 to 20, and the kill switch cuts it at USD 10. Without them the bill has no ceiling.

## Spec-driven development: tried, not adopted

GitHub Spec Kit was tried in June 2026. The study now lives in its own repository, `RicardoMeloG/spec-kit-study`. Decision: specs here are lightweight markdown (problem, outcome, non-goals, acceptance, validation) plus ADRs.

## The local admin

Password and TOTP MFA (bcrypt, `otpauth`), an httpOnly session cookie and enrollment with a QR code; an editor for `site.en`, `site.es`, `visual` and the profiles, by face or by site-wide block, with validate, save draft, publish, versions and restore; the same Zod schemas as the site, so publish never writes invalid content; Postgres drafts and immutable versions, with a file-only mode when the database is down.

It is bound to 127.0.0.1 and is never exposed, which is why it has no login rate limiting, no `secure` cookie and in-memory sessions: its cloud form is the Cognito admin above, not a hardened copy of this one.

## Known gaps (2026-11-12)

- No backend tests beyond the units in `server/` (`pg-mem` is installed and unused) and no end-to-end test of the admin.
- Performance measured on an integrated AMD GPU (88 fps at 1600×900, DPR 1.5, 2026-10-14), not on a phone.
- Vite emits range media queries (`width <= 720px`), which iOS Safari 16.0–16.3 ignores.
- Contrast of eyebrows and footer against the obsidian field is calculated, not measured; the name and the role are measured by `npm run check:layout`, over every world with `--worlds`.

## Security baseline

- [x] No secrets in the repository (`.env` gitignored, `.env.example` committed); a privacy check over the files and the whole history.
- [x] Private content gitignored.
- [x] Dependencies audited in CI (`npm audit --audit-level=low`; `docs/dependency-security.md`).
- [x] Admin requires MFA and never leaves localhost.
- [x] Logs avoid sensitive content (passwords stored only as bcrypt hashes; no content logged).
- [ ] Contact form with abuse controls before it opens.
- [ ] Rate limiting on any public API endpoint (the Cognito admin, layer 3).
