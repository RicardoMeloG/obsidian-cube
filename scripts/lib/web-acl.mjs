// The plan's web ACL as reviewable data (spec 016, P-2; dt-09 a). The console
// owns the web ACL (spec 014, D-4), so its rules are kept in the repository
// as the expected shape and compared with the live one. Pure functions: the
// script that calls AWS is scripts/check-waf.mjs.

/** The web ACL's name and id, from its ARN (`…:global/webacl/<name>/<id>`). */
export function webAclRef(arn) {
  const match = /^arn:aws:wafv2:us-east-1:\d{12}:global\/webacl\/([^/]+)\/([^/]+)$/.exec(arn ?? '')
  if (!match) throw new Error(`not a CloudFront web ACL ARN: ${arn}`)
  return { name: match[1], id: match[2] }
}

// Keys sorted at every depth, so the file diffs cleanly and order is no difference.
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
  return value
}

/** What a reviewer cares about: the default action and each rule, by priority,
 *  without the metric settings (VisibilityConfig) the console sets on its own. */
export function normaliseWebAcl(webAcl) {
  const rules = [...(webAcl.Rules ?? [])]
    .sort((a, b) => a.Priority - b.Priority)
    .map(({ VisibilityConfig: _metrics, ...rule }) => sortKeys(rule))
  return { DefaultAction: sortKeys(webAcl.DefaultAction), Rules: rules }
}

/** The differences between the expected and the live shape, one line each; empty when they match. */
export function compareWebAcl(expected, live) {
  const problems = []
  const text = (value) => JSON.stringify(value)
  if (text(expected.DefaultAction) !== text(live.DefaultAction)) problems.push(`default action: expected ${text(expected.DefaultAction)}, live ${text(live.DefaultAction)}`)
  const byName = (rules) => new Map(rules.map((rule) => [rule.Name, rule]))
  const want = byName(expected.Rules)
  const have = byName(live.Rules)
  for (const [name, rule] of want) {
    const found = have.get(name)
    if (!found) problems.push(`rule ${name}: missing from the live web ACL`)
    else if (text(rule) !== text(found)) problems.push(`rule ${name}: changed\n  expected ${text(rule)}\n  live     ${text(found)}`)
  }
  for (const name of have.keys()) if (!want.has(name)) problems.push(`rule ${name}: in the live web ACL, not expected`)
  return problems
}
