# Dependency security and CI

Updated 2026-11-08. Scope: the application and its local admin, the CDK package, and their CI checks. This maintenance does not publish content or deploy infrastructure.

## Application

The root package had 19 dependency findings on 2026-11-08. The corrected lockfile uses DOMPurify 3.4.17, Zod 4.6.7 and Vitest 4.1.12, together with compatible transitive updates.

Two temporary npm overrides address upstream dependency constraints:

- `minimatch` 11.0.5 for the ESLint/TypeScript-ESLint dependency graph. Earlier major versions remain affected by [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). The existing boundary lint tests and the full lint run verify the project patterns.
- `multer` 2.5.x under NestJS's Express platform. NestJS 11.2.8 still pins 2.4.0, affected by [GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m). Keep NestJS 11 and remove this override when its platform dependency includes a corrected release.

The patched Zod classic API increased the heaviest first view to 463.9 KB gzip (measured 2026-11-08), beyond the existing 457.0 KB budget. Runtime contracts now use the official `zod/mini` API. The same schemas, constraints and independent form labels remain shared by the site and admin; the server retains Zod's full JSON Schema renderer. All five generated JSON Schemas compare equal to those before the switch. The heaviest first view is 447.5 KB gzip (measured 2026-11-08); the budget was not raised.

## CDK source preparation

CDK 2.275.0 still ships minimatch 10.2.6 inside its tarball. npm overrides do not replace that bundled copy. Downgrading CDK is not a remedy: older releases introduce additional advisories. The application uses the current official CDK code with one packaging change, prepared by `infra/scripts/prepare-cdk.mjs`:

1. Download the exact official `aws-cdk-lib` 2.275.0 tarball from npm. Verify the pinned upstream SHA-512 before reading it, including when using the cached source.
2. Remove only the bundled `node_modules/minimatch/` entries. Change its dependency to minimatch 11.0.5 and remove minimatch from `bundleDependencies`. The CDK source files and its version remain unchanged.
3. Write a deterministic, uncompressed tar archive under `infra/.vendor/`, which is gitignored. `infra/package-lock.json` verifies the prepared archive's integrity during `npm ci`; npm resolves the corrected minimatch as a normal dependency.

No advisory is suppressed. The installed dependency graph is scanned by the ordinary npm audit command. The preparation fails if the upstream checksum, version, expected dependency or archive layout changes. Security tests also check rejection of incorrect input, the minimatch version actually resolved by CDK, and CDK asset exclusion behaviour.

From a clean checkout:

```sh
cd infra
npm run prepare:cdk
npm ci
node --test scripts/security.test.mjs
npm audit --audit-level=low
npm run synth
```

Node 24 is required, as in CI. Preparation needs npm registry access on its first run; subsequent preparation can use its verified cached source. Synth is offline after dependencies are installed. Do not commit `.vendor/` or edit installed dependencies by hand.

To retire this preparation: select an official CDK release whose bundled dependencies pass audit, update its CLI and lockfile together, replace the local archive dependency with the official version, remove the preparation step, and pass installation, audit, security tests and synth. Do not just lower the audit threshold.

## CI

Both dependency graphs are checked with `npm audit --audit-level=low` after a clean install. The CDK job prepares and verifies the archive first.

The layout job uses `ubuntu-24.04`, explicitly supported by [Playwright](https://playwright.dev/docs/intro#system-requirements). On 2026-11-08, `ubuntu-latest` selected Ubuntu 26.04 and Playwright 1.60.0 failed before installing Chromium. Pinning the browser runner keeps this prerequisite stable. The layout, stress-content and admin checks remain enabled.

Deployment remains manual. A passing CI does not publish the site or any local draft. The separate privacy check over the repository history remains a release prerequisite; dependency maintenance does not rewrite history or close content warnings.
