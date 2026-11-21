// Compares the live web ACL of the CloudFront plan with the expected rules in
// infra/web-acl.expected.json (spec 016, P-2; dt-09 a). Read-only: it calls
// `aws wafv2 get-web-acl` and changes nothing. The owner runs it after any
// console change and before a stage's acceptance; it needs the SSO profile.
//
//   npm run check:waf                    compare, exit 1 on any difference
//   npm run check:waf -- --update        write the live rules as the expected ones
//   options: --profile=<name> (default: AWS_PROFILE, then VISITS_PROFILE of .env)
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { compareWebAcl, normaliseWebAcl, webAclRef } from './lib/web-acl.mjs'

const EXPECTED = new URL('../infra/web-acl.expected.json', import.meta.url)
const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
const envFile = existsSync(new URL('../.env', import.meta.url)) ? readFileSync(new URL('../.env', import.meta.url), 'utf8') : ''
const profile = option('profile') ?? process.env.AWS_PROFILE ?? /^VISITS_PROFILE=(.+)$/m.exec(envFile)?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2')
if (!profile) throw new Error('No AWS profile: pass --profile=<name>, or set AWS_PROFILE or VISITS_PROFILE in .env')

const context = JSON.parse(readFileSync(new URL('../infra/cdk.json', import.meta.url), 'utf8')).context
const { name, id } = webAclRef(context.webAclArn)
const raw = execFileSync('aws', ['wafv2', 'get-web-acl', '--scope', 'CLOUDFRONT', '--region', 'us-east-1', '--name', name, '--id', id, '--profile', profile, '--output', 'json'], { encoding: 'utf8' })
const live = normaliseWebAcl(JSON.parse(raw).WebACL)

if (process.argv.includes('--update')) {
  writeFileSync(EXPECTED, `${JSON.stringify(live, null, 2)}\n`)
  console.log(`Web ACL: ${live.Rules.length} rules written to infra/web-acl.expected.json; review the diff before committing.`)
  process.exit(0)
}
if (!existsSync(EXPECTED)) throw new Error('infra/web-acl.expected.json is missing: run with --update once and review it')
const problems = compareWebAcl(JSON.parse(readFileSync(EXPECTED, 'utf8')), live)
for (const problem of problems) console.log(problem)
console.log(`Web ACL check: ${problems.length} differences in ${live.Rules.length} live rules.`)
process.exit(problems.length ? 1 : 0)
