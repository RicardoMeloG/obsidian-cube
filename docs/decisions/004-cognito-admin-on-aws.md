# 004: Cognito-Authenticated Admin on AWS

**Status:** accepted
**Date:** 2026-10-10

## Context

The project has two layers. The code is public (open repository). The owner's personal content — identity, links, the copy of each face — is private: it never enters the repository and is fed into the site through the admin. The site is therefore administrable, not static, and the admin is the only way real content reaches visitors.

A review on 2026-10-10 found that no path exists from the admin to the published site:

- Publish writes `public/content/*.json` on the admin's own disk (`server/content/content.service.ts`). Nothing reaches S3 or CloudFront.
- `deploy.yml` builds from the repository, where the private files do not exist, and runs `aws s3 sync dist/ … --delete`. Any content placed in the bucket by other means would be deleted on the next push to `main`.
- The admin binds to `127.0.0.1` and has no cloud target. Its custom login (bcrypt + TOTP) lacks rate limiting, `secure` cookies, persistent sessions, password change and MFA recovery — all required before exposing it.
- Personal data arrives as JSON at runtime, so non-JS crawlers see the public `index.html` with the scaffold title and no JSON-LD.

ADR 002 deferred Cognito until the site was published. That order does not hold: with private content kept out of the repository, publishing the real identity *requires* a path from the admin to the deploy target. Fixing that path is step 1, not a later step.

The owner already builds custom public logins and wants this project to double as learning and evidence. Cognito is unknown to them and keeps the whole system inside AWS, next to S3 and CloudFront. Google (Firebase/Identity Platform) and Microsoft (Entra ID) were the alternatives; they would add a second cloud for one feature.

## Decision

The admin moves to AWS, serverless, authenticated by Amazon Cognito. The custom login is not taken to production.

- **Identity: Cognito User Pool.** Self sign-up disabled; the single admin user is created out of band (CLI or console), never in code, so the owner's email stays out of the repository. TOTP MFA required. Login through Cognito managed login with the authorization code flow and PKCE; a public app client (no secret) for the browser.
- **Admin UI: static page** served by the same CloudFront distribution under `/admin/`. It holds no secrets; it obtains tokens from Cognito and calls the API with the access token.
- **API: API Gateway HTTP API with a Cognito JWT authorizer** in front of one Lambda (Node, bundled with esbuild). The Lambda imports the same Zod schemas as the site, so publish still never writes invalid content. Throttling is set on the API stage.
- **Storage: S3 only, no database in the cloud.** Published content goes to the site bucket under `content/`, with bucket versioning on — S3 object versions are the version history and restore source. Drafts live in a separate private bucket that CloudFront does not serve.
- **Publish = validate → write to the site bucket → invalidate `/content/*`.** A later slice also renders the owner's SEO metadata and JSON-LD into `index.html` at publish time, since that data cannot live in the repository.
- **Code deploy never touches content.** `deploy.yml` excludes the private content keys from `s3 sync --delete`.

The NestJS server and Postgres remain as the local tool until the Lambda path covers read, validate, draft, publish, versions and restore; then they are retired so there is one backend, not two.

## Consequences

- Real content can reach the public site without ever entering the repository — the two-layer model works end to end.
- Password storage, brute-force lockout, MFA and recovery are Cognito's responsibility, not this codebase's. Cognito's advanced threat protection is a paid tier and is not assumed.
- No server or database runs 24/7. Cost for one admin user is expected to stay within free tiers; this is to be confirmed in the AWS billing console after the first month, not assumed.
- The custom MFA admin stops being evidence for the SECURITY face. The evidence becomes the decision itself: not running homegrown authentication in production, with this ADR as the reasoning. The custom implementation stays in git history.
- Local development of the admin depends on a deployed dev stack (or invoking the Lambda handler locally). The Lambda's logic is kept in plain functions tested with Vitest against an S3 stub.
- `AGENTS.md` (admin rules, engineering contract), `docs/roadmap.md` and `docs/deploy-aws.md` are updated to match. Federation with Google or Microsoft as identity providers remains possible later inside Cognito; it is not planned.
