// Privacy check (spec 010, H-08a; spec 002).
//
// Scans every file git would publish (tracked, plus untracked files that are
// not ignored) for e-mail addresses outside an allowlist and for the owner's
// private values. The private values never enter the repository: they come
// from `.privacy-denylist` (gitignored, one value per line) and from the
// PRIVACY_DENYLIST environment variable (a CI secret, one value per line).
//
//   node scripts/check-privacy.mjs            scan the files
//   node scripts/check-privacy.mjs --history  also scan commit authors and
//                                              messages of every branch (run
//                                              before publishing a repository)

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const ALLOWED_EMAIL = [/@example\.(com|org|net|local)$/i, /@users\.noreply\.github\.com$/i, /^noreply@anthropic\.com$/i]
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
  const log = git('log', '--all', '--format=%H%x00%an <%ae>%x00%cn <%ce>%x00%B%x01')
  for (const record of log.split('\x01')) {
    const [hash, ...fields] = record.trim().split('\x00')
    if (!hash) continue
    for (const finding of new Set(findings(fields.join('\n'), values))) problems.push(`commit ${hash.slice(0, 7)}: ${finding}`)
  }
}

const scope = `${files.length} files${process.argv.includes('--history') ? ' and the history' : ''}`
const source = values.length > 0 ? `${values.length} private values` : 'no private values configured'
for (const problem of problems) console.log(problem)
console.log(`Privacy check: ${problems.length} findings in ${scope} (${source}).`)
process.exitCode = problems.length > 0 ? 1 : 0
