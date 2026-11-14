# 014: Cost Guardrails for the AWS Account

**Status:** in progress (2026-11-13). Owner's decision: the site may be left without attention for months, so the account needs limits that act on their own, not only alerts, with more than one layer in case one fails; the ceiling is about 20 USD a month for the whole account.
**Builds on:** spec 010 (the static stack, AD-11), `docs/deploy-aws.md`, ADR 004 (the admin stays local until Cognito).

## 1. Problem

| Id | Fact | Reproduce |
|---|---|---|
| E-01 | The account has budget alerts (any spend, and 5 USD a month), created by hand on 2026-11-12. An alert only sends an email: if nobody reads it, the spend goes on. | `aws budgets describe-budgets` lists two budgets with email subscribers and no action. |
| E-02 | The distribution is billed pay as you go. A viral page or a bot flood is billed in full: the perpetual free tier covers 1 TB and 10 M requests a month, about 500 000 visits at 2 MB each, and every TB after it costs about 85 to 120 USD. | CloudFront pricing; the distribution has no pricing plan. |
| E-03 | Nothing in front of the distribution blocks a single client that floods it: the distribution has no web ACL. | `aws cloudfront get-distribution-config` shows an empty `WebACLId`. |
| E-04 | Budget actions cannot stop CloudFront: they apply IAM or SCP policies or stop EC2 and RDS instances. Billing data reaches budgets a few times a day, so any budget-driven stop acts hours late. | AWS Budgets documentation, budget actions. |

## 2. Outcome

Four independent layers, the strongest first:

| Layer | What it does | Cost |
|---|---|---|
| 1. CloudFront flat-rate **Free** plan | The distribution is billed a flat 0 USD with no overage charges, whatever the traffic; a sustained excess makes delivery slower, never billed. Includes the web ACL, DDoS protection and IP rate limiting. | 0 USD |
| 2. IP rate limiting in the plan's web ACL | Blocks a client that sends too many requests in 5 minutes; blocked requests do not count against the plan's allowance. | included in the plan |
| 3. Kill switch at 20 USD | A monthly cost budget of 20 USD publishes to an SNS topic when the actual spend passes it; a Lambda function then disables the distribution. The site stays down until the owner turns it on again. | within the perpetual free tiers of Lambda and SNS |
| 4. Alerts | The two existing budgets (any spend, 5 USD) and the account's default cost anomaly monitor, all by email. | free |

## 3. Decisions

- **D-1 The plan is the cap, the kill switch the backstop.** Layer 1 acts at once and covers the likely risk (traffic); layer 3 covers whatever escapes the plan (another service, a misconfiguration) and accepts the delay of E-04.
- **D-2 The kill switch disables, it does not delete.** It sets `Enabled: false` on the distribution, which keeps every setting, the certificate and the plan; turning the site on again is one command (`docs/deploy-aws.md`). It only ever acts on the distribution named in the stack's context.
- **D-3 The owner subscribes to the plan by hand.** Subscribing accepts a pricing plan, so the owner does it in the CloudFront console; the console creates the web ACL. The stack then receives the web ACL's ARN through the context (`webAclArn` in `infra/cdk.json`) so a later `cdk deploy` keeps the association instead of removing it, which the plan forbids.
- **D-4 The rate rule lives in the plan's web ACL, configured in the console.** The plan covers the web ACL it is associated with; managing that web ACL from the stack would duplicate it. The rule and its limit are written down in `docs/deploy-aws.md`.
- **D-5 No personal data in the repository.** The alert email reaches the kill-switch budget through the context at deploy time (`-c alertEmail=…`), never committed; without it the budget still drives the switch, with no email.
- **D-6 A separate stack.** The kill switch is `ObsidianCubeCostGuard`, in its own stack, so it can be deployed, changed or removed without touching the site's distribution.

## 4. Non-goals

- Cutting the account's permissions when the budget passes (a budget action with a deny policy): it could lock the owner out. Credentials are protected by MFA and SSO instead.
- An exact ceiling: billing data is late (E-04), so 20 USD is where the switch fires, not the most the account can spend.
- Managing the existing alert budgets and the anomaly monitor from the stack: they were made by hand and work.

## 5. Acceptance

1. The distribution is subscribed to the Free plan, with a web ACL that has an IP rate rule.
2. `cdk synth` of `ObsidianCubeStaticSite` carries the web ACL ARN from the context, so a deploy leaves the association in place.
3. `ObsidianCubeCostGuard` creates a 20 USD monthly cost budget whose actual-spend notification publishes to an SNS topic that only the budgets service of this account may publish to, and a function subscribed to it that may only read and update the one distribution.
4. Invoked with a test event, the function disables the distribution; the documented command turns it on again (run once by hand, with the owner, and the site checked with `npm run check:live`).
5. The function's decision is unit tested against a stub (`scripts/checks/killSwitch.test.ts`: it disables with the ETag it read, keeps the rest of the config, does nothing when already disabled, refuses without an id, ignores anything but a budget alert). The topic policy and the function's permissions are read in the synthesized template before deploying.

## 6. Validation

The definition of done, `cdk synth` of both stacks, `npm run audit:change` on the exact diff, and acceptance 4 run by hand with the owner after deploying.
