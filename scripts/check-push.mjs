// The pre-push gate (spec 012). Git gives a pre-push hook one line per ref:
//   <local ref> <local sha> <remote ref> <remote sha>
// and the remote's name as the first argument. For each ref it reads what the
// push adds and refuses it when:
//   - an added or modified file matches an ignore rule, or is named like a key,
//     database or environment file, or adds a line with a secret value;
//   - code changed and no audit of that exact diff is recorded (audit:change);
//   - a gate or the contract changed and no commit message names a spec or ADR;
//   - a commit's author or committer is not GitHub's noreply address (dt-24).
import { existsSync, readFileSync } from 'node:fs'
import {
  auditModels, changedPaths, classify, codeDiff, diffHash, fullDiff, identities, ignoredPaths, messages, namesSpec, privateIdentities,
  pushBase, SECRET_NAME, secretLines, ZERO,
} from './lib/push-gate.mjs'

const remote = process.argv[2] || 'origin'
const input = readFileSync(0, 'utf8')
const problems = []

for (const line of input.split(/\r?\n/).filter(Boolean)) {
  const [, localSha, remoteRef] = line.split(/\s+/)
  if (!localSha || ZERO.test(localSha)) continue // a branch deletion carries nothing
  const base = pushBase(localSha, remote, remoteRef)
  const paths = changedPaths(base, localSha)
  const where = `${remoteRef.replace(/^refs\/heads\//, '')}`
  // Checked before the file list: a commit that changes no file still shows its author.
  for (const identity of privateIdentities(identities(base, localSha))) {
    problems.push(`${where}: a commit is signed by ${identity}; only the GitHub noreply address may sign a public commit. Set git config user.email in this repository and rewrite those commits`)
  }
  if (paths.length === 0) continue

  for (const path of ignoredPaths(paths)) problems.push(`${where}: ${path} matches an ignore rule (.gitignore or .git/info/exclude); remove it from the commits`)
  for (const path of paths.filter((p) => SECRET_NAME.test(p))) problems.push(`${where}: ${path} is named like a key, database or environment file`)
  for (const { file, text } of secretLines(fullDiff(base, localSha))) {
    problems.push(`${where}: ${file} adds a line that looks like a secret: ${text.trim().slice(0, 60)}`)
  }

  const { level, code, major } = classify(paths)
  if (code.length) {
    const hash = diffHash(codeDiff(base, localSha, code))
    const record = `audit-runs/change-${hash}.json`
    const models = auditModels()
    let done = null
    try {
      done = existsSync(record) ? JSON.parse(readFileSync(record, 'utf8')) : null
    } catch {
      problems.push(`${where}: ${record} is not valid JSON; run the audit again`)
    }
    const missing = models.filter((model) => !done?.models?.some((run) => run.model === model && Array.isArray(run.findings)))
    if (missing.length) {
      problems.push(`${where}: ${level}: ${code.length} code file(s) changed and no audit of this exact diff by ${missing.join(', ')}. Run: npm run audit:change (then verify every finding)`)
    }
  }
  if (major.length && !namesSpec(messages(base, localSha))) {
    problems.push(`${where}: large change (${major.slice(0, 3).join(', ')}${major.length > 3 ? ', …' : ''}) and no commit message in the push names its spec or ADR (e.g. "spec 012", "ADR 009")`)
  }
  console.log(`check:push ${where}: ${level}, ${paths.length} file(s)`)
}

if (problems.length) {
  console.error(`check:push refused the push (spec 012):\n${problems.map((p) => `  - ${p}`).join('\n')}`)
  process.exit(1)
}
