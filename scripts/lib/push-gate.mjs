// What a push carries and what it must pass (spec 012). Pure functions plus
// the git reads both the pre-push hook (scripts/check-push.mjs) and the change
// audit (scripts/audit-change.mjs) share, so they compute the same diff.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

// Code: a change here needs an audit of its diff by the local models.
const CODE = [
  /^src\//,
  /^server\//,
  /^scripts\//,
  /^infra\//,
  /^\.githooks\//,
  /^\.github\//,
  /^package\.json$/,
  /^[^/]+\.config\.[cm]?[jt]s$/,
  /^tsconfig[^/]*\.json$/,
  /^index\.html$/,
  /^docker-compose\.ya?ml$/,
]
// The contract and the gates: a change here also names its spec or ADR.
const MAJOR = [
  /^src\/kernel\//,
  /^server\/auth\//,
  /^infra\/lib\//,
  /^infra\/security-headers\.json$/,
  /^\.githooks\//,
  /^\.github\/workflows\//,
  /^scripts\/check-[^/]+\.mjs$/,
  /^scripts\/lib\/push-gate\.mjs$/,
  /^eslint\.config\.js$/,
  /^AGENTS\.md$/,
  /^docs\/decisions\//,
]
// Lockfiles change with every dependency update; the audit reads package.json.
export const AUDIT_EXCLUDE = ['package-lock.json', 'infra/package-lock.json']

export function classify(paths) {
  const major = paths.filter((path) => MAJOR.some((rule) => rule.test(path)))
  const code = paths.filter((path) => CODE.some((rule) => rule.test(path)) && !AUDIT_EXCLUDE.includes(path))
  return { level: major.length ? 'large change' : code.length ? 'change' : 'adjustment', code, major }
}

export const SECRET_NAME = /(^|\/)(\.env(?!\.example$)[^/]*|id_(rsa|ed25519|ecdsa)[^/]*|[^/]+\.(pem|key|p12|pfx|kdbx|sqlite|db|dump|sql))$/i
// Secret values, not names: code may say DATABASE_URL, it may not carry a
// password for a host other than this machine.
export const SECRET_VALUE = new RegExp([
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /gh[opsu]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /[a-z][a-z0-9+.-]*:\/\/[^\s:/@"']+:[^\s@"'/]+@(?!localhost[:/]|127\.0\.0\.1[:/]|\[::1\][:/])/,
].map((pattern) => pattern.source).join('|'))

// Lines added by a unified diff, with the file each belongs to.
export function addedLines(diff) {
  const lines = []
  let file = null
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++ ')) file = line === '+++ /dev/null' ? null : line.replace(/^\+\+\+ b\//, '')
    else if (file && line.startsWith('+')) lines.push({ file, text: line.slice(1) })
  }
  return lines
}

export function secretLines(diff) {
  return addedLines(diff).filter(({ text }) => SECRET_VALUE.test(text))
}

export const SPEC_REFERENCE = /\b(spec|ADR)\s+0*\d{1,3}\b/i

export function namesSpec(messages) {
  return messages.some((message) => SPEC_REFERENCE.test(message))
}

export const diffHash = (diff) => createHash('sha256').update(diff).digest('hex').slice(0, 16)

// --- git ---------------------------------------------------------------------

export const ZERO = /^0+$/
export const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).replace(/\n$/, '')
const tryGit = (...args) => {
  try {
    return git(...args)
  } catch {
    return null
  }
}
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

// The commit the push builds on: where the local history meets what the
// remote already has for that branch, or its default branch for a new one.
export function pushBase(head, remote = 'origin', remoteRef = '') {
  const branch = remoteRef.replace(/^refs\/heads\//, '')
  for (const ref of [branch && `refs/remotes/${remote}/${branch}`, `refs/remotes/${remote}/HEAD`, `refs/remotes/${remote}/main`].filter(Boolean)) {
    if (tryGit('rev-parse', '--verify', '-q', ref)) {
      const base = tryGit('merge-base', head, ref)
      if (base) return base
    }
  }
  return EMPTY_TREE
}

export function changedPaths(base, head) {
  const out = git('diff', '--name-only', '--diff-filter=ACMRT', base, head)
  return out ? out.split('\n') : []
}

// Fixed prefixes, so a diff.noprefix or diff.mnemonicPrefix setting cannot
// change the file names addedLines reads.
const DIFF = ['diff', '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/']
export const fullDiff = (base, head) => git(...DIFF, base, head)

export function codeDiff(base, head, codePaths) {
  if (codePaths.length === 0) return ''
  return git(...DIFF, base, head, '--', ...codePaths)
}

export function messages(base, head) {
  const range = base === EMPTY_TREE ? head : `${base}..${head}`
  return git('log', '--format=%B%x00', range).split('\0').map((message) => message.trim()).filter(Boolean)
}

// Ignore rules apply to the path even when the file was added with --force.
export function ignoredPaths(paths) {
  if (paths.length === 0) return []
  try {
    return execFileSync('git', ['check-ignore', '--no-index', '--stdin'], { input: paths.join('\n'), encoding: 'utf8' }).split('\n').filter(Boolean)
  } catch (error) {
    if (error.status === 1) return [] // nothing ignored
    throw error
  }
}

export const DEFAULT_MODELS = ['qwen3.8:27b', 'gemma4:31b']
export const auditModels = () => (process.env.AUDIT_MODELS ? process.env.AUDIT_MODELS.split(',').map((m) => m.trim()).filter(Boolean) : DEFAULT_MODELS)
