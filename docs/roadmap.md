# Roadmap

Loaded on demand. The stages to the first release, what is open after it, and the known gaps, each with its real status. The priority order follows `docs/decisions/002-evidence-before-spectacle.md` and `docs/decisions/007-staged-path-to-publishing.md`; the day-to-day order of small items lives in the owner's pending-work panel.

## Stages to the first release (ADR 007, ADR 008)

1. **Normalization**: closed 2026-10-13. Spec 010 (P0 to P4): the code brought to the declared architecture, the gates in CI, two independent audits resolved.
2. **Compositions**: closed 2026-10-18. Spec 011: one template per face edited from the admin, admin forms generated from the schemas, uploaded images, the CONTACT world.
3. **Content**: closed with the release. The real identity and copy in both languages through the admin, the layer for machines and the clean addresses (ADR 009).
4. **Security**: partly done. A security review of the site before going public (OWASP Top 10:2025 and a ZAP baseline scan, no failures) and the hardened headers: enforced CSP, HSTS, Permissions-Policy, no `Server` header. Open: the contact form and the CV request behind a captcha.
5. **Release**: live on 2026-11-12 at https://ricardomelog.com: CloudFront and private S3 with OAC (`infra/`), an ACM certificate, DNS at Cloudflare, A+ on Mozilla Observatory and SSL Labs. The repository was published with its history rewritten (spec 010, D-5).

## Done since the release

- Real 404s from CloudFront (2026-11-15); absolute `og:image`, canonical and `hreflang` on every page; `robots.txt` admitting the AI crawlers, `sitemap.xml` and `llms.txt` as `text/plain; charset=utf-8` (ADR 009; `npm run check:live`, CU-09).
- Cost ceiling of about 20 USD a month (spec 014, 2026-11-14): the CloudFront flat-rate Free plan, IP rate limiting and managed rules in its web ACL, a kill switch tested by hand, and the budget alerts.
- The Iron Bastion match-log receiver (spec 015, 2026-11-14) and the fullscreen art mode with its gallery (spec 017, 2026-11-14).
- The scene at 30 frames a second at rest and cache headers by path (spec 018, 2026-11-17); the AGENTIC plexus on the GPU (2026-11-21).
- The visits view in the local admin (spec 013, in `main` since 2026-11-21; its log delivery stays off until the owner turns it on).
- Code deploys from GitHub over an OIDC role, after the owner approves the `production` environment (spec 010, D-6; 2026-11-21).

## Open after the release, in order

1. The contact form and the CV request behind a captcha, with their abuse controls (security stage).
2. A performance gate (spec 019, draft) and the scene's remaining cost (the additive rings of the load audit's C-5).
3. Layered security shown with evidence (spec 016, analysis): the owner decides its proposals.
4. The Cognito admin (ADR 004), slices below.
5. The methodology page (spec 010, D-8, open) and world visibility (ADR 002, point 5).

### The Cognito admin (ADR 004)

Private content never enters the repository. Today the local admin's published documents are copied to the bucket's `content/` by hand (`docs/deploy-aws.md`); the Cognito admin replaces that step. Until then the local admin keeps its own login (password and TOTP, bound to 127.0.0.1), which never goes to production.

1. Versioning on the site bucket (the code deploy already never touches `content/`).
2. Cognito User Pool (TOTP required, no self sign-up) and the static admin page under `/admin/` logging in through managed login.
3. HTTP API with a JWT authorizer and a Lambda: read, validate, publish to S3, invalidate `/content/*`.
4. Drafts in a private bucket, versions and restore with S3 object versions.
5. Publish renders the static SEO and the machine files, reusing `src/kernel/seo/`.
6. Retire the NestJS server and Postgres.

Its cost ceilings follow spec 014: the HTTP API throttled, every admin route behind the JWT authorizer, reserved concurrency and short timeouts on its Lambdas, one month of log retention, nothing billed outside the Free plan (no NAT gateway, RDS, EC2 or customer-managed KMS key).

## The local admin

Password and TOTP MFA (bcrypt, `otpauth`), an httpOnly session cookie and enrollment with a QR code; an editor for `site.en`, `site.es`, `visual` and the profiles, by face or by site-wide block, with validate, save draft, publish, versions and restore; the same Zod schemas as the site, so publish never writes invalid content; Postgres drafts and immutable versions, with a file-only mode when the database is down; the visits view (spec 013).

It is bound to 127.0.0.1 and is never exposed, which is why it has no login rate limiting, no `secure` cookie and in-memory sessions: its cloud form is the Cognito admin above, not a hardened copy of this one.

## Known gaps (2026-11-21)

- No backend tests beyond the units in `server/` and no end-to-end test of the admin beyond `npm run check:admin` against a stand-in API.
- Performance measured on desktop GPUs and with a 4x CPU slowdown, not on a mid-range Android phone.
- iOS Safari 16.0 to 16.3: the build writes media queries as `min-`/`max-width` since 2026-11-19 (`build.cssTarget`); the `or` and `not` combinations of the layout modes have not been tried on a real device of that range.
- Contrast of eyebrows and footer against the obsidian field is calculated, not measured; the name and the role are measured by `npm run check:layout`, over every world with `--worlds`.
- The approval of a deploy is approval of the run, not a review of the built files.

## Security baseline

- [x] No secrets in the repository (`.env` gitignored, `.env.example` committed); a privacy check over the files and the whole history, failing in CI when its private list is missing.
- [x] Private content gitignored.
- [x] Dependencies audited in CI (`npm audit --audit-level=low`; `docs/dependency-security.md`).
- [x] Admin requires MFA and never leaves localhost.
- [x] Logs avoid sensitive content (passwords stored only as bcrypt hashes; no content logged).
- [x] Deploys without stored keys: an OIDC role only the approved `production` environment can take, unable to write `content/`.
- [ ] Contact form with abuse controls before it opens.
- [ ] Rate limiting on any public API endpoint beyond the web ACL's IP rule (the Cognito admin; spec 016 for the receiver).

## Spec-driven development

GitHub Spec Kit was tried in June 2026 and not adopted: specs here are lightweight markdown (problem, outcome, non-goals, acceptance, validation) plus ADRs.
