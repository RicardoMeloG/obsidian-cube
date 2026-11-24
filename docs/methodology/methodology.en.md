# How I Build with Agents

This site is my case study. I build it with AI agents: Claude Code writes the code, and Codex helps with design reviews and visual concepts. The decisions are written down in its public repository: {{specs}} specs, {{adrs}} architecture decisions and {{audits}} recorded audits. This page sums up the method and links the evidence.

## The loop

{{figure:loop}}

A large change goes through seven steps ([the rule, in AGENTS.md](../../AGENTS.md)):

1. **Spec.** Before the code, a document with the problem, the expected outcome, what stays out, the open decisions and how it is accepted. Example: [the spec of the proportional gates](../../specs/012-proportional-gates/spec.md).
2. **Audit without context.** An agent that took no part reads the work, checks it against the code and the written rules, and judges it against the project's goal. Its findings are recorded next to the spec: [the architecture's first audit](../../specs/010-architecture/audit-1.md).
3. **Revision.** Every finding is verified. Confirmed ones are fixed or recorded as debt, and the rest are answered in writing, because an audit is a recommendation, not an order.
4. **Build.** The agents work inside a contract, [AGENTS.md](../../AGENTS.md), which they read before every change: architecture limits, design rules and privacy.
5. **Gates.** Before every push, the privacy check and the proportional gate run: secrets, ignored files, the record of an audit of the code diff and the spec's name. In CI, types, tests, layout at the reference screen sizes, first-view weight and colours run ([the list](../../docs/architecture.md)). After a deploy, a check of the live site is run by hand.
6. **A person looks.** Green checks are not the experience. Every stage closes with a visual walk-through that I do. This is a working rule, not an automated check.
7. **A commit that names its reason.** In a large change, the commit must name its spec or decision, and the pre-push gate requires it. That way every large change can be traced to its why.

## Proportional process

Not every change deserves the full loop. The paths a push touches decide the level, not who pushes it ([the rule](../../scripts/lib/push-gate.mjs)):

- **Adjustment** (documentation, examples): reviewed when done.
- **Change** (code): also an audit of the exact diff before the push.
- **Large change** (the contract, the site's core, the infrastructure, the gates themselves): the full loop.

The gates also guard themselves: raising a weight limit or marking a failure as known is a large change ([spec 021](../../specs/021-gate-coverage/spec.md)).

## Where a person decides

- **Production.** Agents can start a deploy of the code, but the production environment waits for my approval in GitHub, and nobody else may give it. Content and infrastructure go out from my machine, with an AWS session that I start ([the procedure](../../docs/deploy-aws.md)). As a working rule, I also group several changes into each deploy.
- **Credentials, terms and payments.** No agent types a password, accepts terms or pays: those steps are mine. This is a working rule.
- **Product direction.** Agents propose options with evidence, and the decision is written down with who took it and when ([the decisions](../../docs/decisions/)).

## What went wrong

The method does not prevent mistakes. It leaves a record of how each one was found and fixed; some were already in production.

1. **A brake that trusted the visitor.** The match-log receiver limited writes per IP by reading a header the client can forge. A trip test after the deploy showed it: the header arrived as the client sent it, so each write could claim another address. Now the edge writes the address, and a client cannot replace it: in the same test after the fix, the eleventh write was refused ([fix](https://github.com/RicardoMeloG/obsidian-cube/commit/a916c24)).
2. **The root as a bucket listing.** An audit suspected a listing permission. Checking it showed the real gap was elsewhere: a `//` path reached the origin as `/`, which is a listing. The edge function now fixes it ([fix](https://github.com/RicardoMeloG/obsidian-cube/commit/871542f)).
3. **A token within reach of the build.** A re-audit noticed the build job kept the permission to ask GitHub for an AWS access token, so a build plugin could have obtained one. Building and deploying are now separate jobs, and the first lacks that permission ([fix](https://github.com/RicardoMeloG/obsidian-cube/commit/f5777fa)).
4. **An e-mail address in a spec.** The privacy check refuses any e-mail address in the repository, and a spec had one. It now names the contact without writing it ([fix](https://github.com/RicardoMeloG/obsidian-cube/commit/68f62fa)).
5. **A tone that could not be read.** Measuring the live site found a grey at 4.2:1 contrast on small text, under the AA minimum. It is now 5.2:1 ([fix](https://github.com/RicardoMeloG/obsidian-cube/commit/cf1151f)).

## What this does not prove

- The audits are done by AI models without prior context, not by an outside firm.
- Green checks say the written rules hold, not that the rules are enough.
- Pending work and its priorities live in a private panel, not in the repository.
- The record is not perfect: two specs (009 and 016) have no audit on file, and I can skip the pre-push gate, with the reason in the next commit.
- The production approval is configured in GitHub, not in the repository.
- It is one person's method with agents, not a large team's.

## To inspect

- [The repository](https://github.com/RicardoMeloG/obsidian-cube) and its [index of specs](../../specs/README.md).
- [Iron Bastion](https://github.com/RicardoMeloG/iron-bastion), a game built the same way, with its own [AGENTS.md](https://github.com/RicardoMeloG/iron-bastion/blob/main/AGENTS.md).
