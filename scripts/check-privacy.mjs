// Privacy check (spec 010, H-08a; spec 002).
//
// Scans every file git would publish (tracked, plus untracked files that are
// not ignored) for e-mail addresses outside an allowlist and for the owner's
// private values. The private values never enter the repository: they come
// from `.privacy-denylist` (gitignored, one value per line) and from the
// PRIVACY_DENYLIST environment variable (a CI secret, one value per line).
//
//   node scripts/check-privacy.mjs            scan the files
//   node scripts/check-privacy.mjs --history  also scan every branch's
//                                              authors, messages and the content
//                                              of every past version (run before
//                                              publishing a repository)

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
// Domains reserved for examples and tests (RFC 2606): example.com, .org and
// .net with their subdomains, and anything under .test, .example, .invalid or
// .localhost. Then GitHub's noreply addresses (a user's, and GitHub's own for
// web merges) and Claude's co-author.
const ALLOWED_EMAIL = [
  /@([a-z0-9-]+\.)*example\.(com|org|net)$/i,
  /@([a-z0-9-]+\.)+(test|example|invalid|localhost)$/i,
  /@users\.noreply\.github\.com$/i,
  /^noreply@github\.com$/i,
  /^noreply@anthropic\.com$/i,
]
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|glb|hdr|exr|mp3|ogg|wav|mp4)$/i

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

function denylist() {
  const sources = [process.env.PRIVACY_DENYLIST ?? '']
  if (existsSync('.privacy-denylist')) sources.push(readFileSync('.privacy-denylist', 'utf8'))
  return sources
    .join('\n')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}

function findings(text, values) {
  const found = []
  for (const email of text.match(EMAIL) ?? []) {
    if (!ALLOWED_EMAIL.some((pattern) => pattern.test(email))) found.push(`e-mail ${email}`)
  }
  const lower = text.toLowerCase()
  // Private values are reported by position only, so the log does not repeat them.
  values.forEach((value, index) => {
    if (lower.includes(value.toLowerCase())) found.push(`private value #${index + 1} of the denylist`)
  })
  return found
}

const values = denylist()
const problems = []

const files = git('ls-files', '--cached', '--others', '--exclude-standard').split('\n').filter(Boolean)
for (const file of files) {
  if (BINARY.test(file) || !existsSync(file)) continue
  for (const finding of findings(readFileSync(file, 'utf8'), values)) problems.push(`${file}: ${finding}`)
}

if (process.argv.includes('--history')) {
  // Authors, committers and messages.
  const log = git('log', '--all', '--format=%H%x00%an <%ae>%x00%cn <%ce>%x00%B%x01')
  for (const record of log.split('\x01')) {
    const [hash, ...fields] = record.trim().split('\x00')
    if (!hash) continue
    for (const finding of new Set(findings(fields.join('\n'), values))) problems.push(`commit ${hash.slice(0, 7)}: ${finding}`)
  }
  // The content of every past version: each line a commit added or removed
  // (audit-2 B-07). Binary files show no lines.
  const patches = git('log', '--all', '-p', '--no-color', '--format=%x01%H')
  for (const patch of patches.split('\x01')) {
    const [hash, ...lines] = patch.split('\n')
    if (!hash) continue
    const changed = lines.filter((line) => /^[+-](?![+-]{2} )/.test(line)).join('\n')
    for (const finding of new Set(findings(changed, values))) problems.push(`commit ${hash.slice(0, 7)} content: ${finding}`)
  }
}

const scope = `${files.length} files${process.argv.includes('--history') ? ' and the history' : ''}`
const source = values.length > 0 ? `${values.length} private values` : 'no private values configured'
for (const problem of problems) console.log(problem)
console.log(`Privacy check: ${problems.length} findings in ${scope} (${source}).`)
// On CI an empty list means the PRIVACY_DENYLIST secret did not arrive: from
// 12-11 to 19-11 CI ran without it and checked only e-mails (dt-26). A pull
// request from a fork never gets secrets, so there it is only a warning.
const listMissing = process.env.GITHUB_ACTIONS === 'true' && values.length === 0
const fork = process.env.GITHUB_EVENT_NAME === 'pull_request' && process.env.GITHUB_HEAD_REPO !== process.env.GITHUB_REPOSITORY
if (listMissing) console.log(`::${fork ? 'warning' : 'error'}::check:privacy ran without the PRIVACY_DENYLIST secret; only e-mails were checked.`)
process.exitCode = problems.length > 0 || (listMissing && !fork) ? 1 : 0
