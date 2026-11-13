// Backs up what exists only on this machine to a separate private git
// repository: the published private content, its images, the admin's drafts
// and versions from Postgres, and the local notes in private/. Secrets never
// go: not .env, not the admin users table (password hash, TOTP secret).
//
//   npm run backup:content                 # export, commit and push
//   npm run backup:content -- --no-push    # export and commit only
//
// The target is CONTENT_BACKUP_DIR (in .env or the environment), a clone of
// the private repository; it defaults to ../obsidian-cube-content.
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import pg from 'pg'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const push = !process.argv.includes('--no-push')

function loadEnv() {
  const file = join(ROOT, '.env')
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/)
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function fail(message) {
  console.error(`backup:content: ${message}`)
  process.exit(1)
}

loadEnv()
const target = resolve(ROOT, process.env.CONTENT_BACKUP_DIR || '../obsidian-cube-content')
if (!existsSync(join(target, '.git'))) fail(`${target} is not a git clone of the private backup repository`)
// Every remote of the target must differ from every remote of this public
// repository, whatever they are called.
const remotesOf = (cwd) => git(cwd, 'remote', '-v').split(/\r?\n/).map((line) => line.split(/\s+/)[1]).filter(Boolean)
const targetRemotes = remotesOf(target)
const publicRemotes = new Set(remotesOf(ROOT))
if (targetRemotes.length === 0) fail(`${target} has no remote to push to`)
if (targetRemotes.some((url) => publicRemotes.has(url))) fail('the backup target points at the public repository')
const remote = git(target, 'remote', 'get-url', 'origin')

// 1. Files: the private content documents, their images and the local notes.
const FILES = ['site.en.json', 'site.es.json', 'visual.json', 'profile.en.json', 'profile.es.json']
mkdirSync(join(target, 'content'), { recursive: true })
for (const name of FILES) {
  const source = join(ROOT, 'public/content', name)
  if (existsSync(source)) cpSync(source, join(target, 'content', name))
}
for (const [from, to] of [['public/content/media', 'content/media'], ['private', 'private']]) {
  const source = join(ROOT, from)
  // A missing source leaves the last backup in place instead of erasing it.
  if (!existsSync(source)) continue
  rmSync(join(target, to), { recursive: true, force: true })
  // Symbolic links are skipped, so a link cannot pull files from outside.
  cpSync(source, join(target, to), { recursive: true, filter: (path) => !lstatSync(path).isSymbolicLink() })
}

// 2. The admin's database: drafts (current state) and versions (append-only).
// admin_users is never read.
// A document id becomes a file name: only plain names, never a path.
const DOC_ID = /^[\w.-]+$/
const safeId = (id) => {
  if (!DOC_ID.test(id) || id.startsWith('.')) throw new Error(`unexpected document id ${JSON.stringify(id)}`)
  return id
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
let drafts = 0
let versions = 0
try {
  await client.connect()
  const draftDir = join(target, 'db/drafts')
  rmSync(draftDir, { recursive: true, force: true })
  mkdirSync(draftDir, { recursive: true })
  for (const row of (await client.query('SELECT doc_id, data, updated_at FROM content_drafts ORDER BY doc_id')).rows) {
    writeFileSync(join(draftDir, `${safeId(row.doc_id)}.json`), JSON.stringify({ updatedAt: row.updated_at, data: row.data }, null, 2) + '\n')
    drafts += 1
  }
  for (const row of (await client.query('SELECT id, doc_id, data, published_at FROM content_versions ORDER BY id')).rows) {
    const dir = join(target, 'db/versions', safeId(row.doc_id))
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `${String(row.id).padStart(6, '0')}.json`)
    if (!existsSync(file)) {
      writeFileSync(file, JSON.stringify({ publishedAt: row.published_at, data: row.data }, null, 2) + '\n')
      versions += 1
    }
  }
} catch (error) {
  console.warn(`backup:content: database not exported (${error.message}); files are still backed up`)
} finally {
  await client.end().catch(() => {})
}

// 3. No secret may reach the repository, whatever the content says. Every
// file is read except images; key and environment files are refused by name.
const SECRET = new RegExp([
  /SESSION_SECRET|ADMIN_PASSWORD|DATABASE_URL|password_hash|totp_secret/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[opsu]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{20,}/,
  /[a-z][a-z0-9+.-]*:\/\/[^\s:/@"]+:[^\s@"/]+@/, // a URL with user and password
].map((pattern) => pattern.source).join('|'))
const SECRET_NAME = /^\.env|\.(pem|key|p12|pfx|kdbx|sqlite|db|dump|sql)$|^id_(rsa|ed25519|ecdsa)/i
const IMAGE = /\.(webp|png|jpe?g|gif|avif)$/i
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === '.git') continue
    const path = join(dir, entry)
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) refuse(`refusing to commit ${relative(target, path)}: a symbolic link`)
    if (stat.isDirectory()) walk(path)
    else if (SECRET_NAME.test(entry)) refuse(`refusing to commit ${relative(target, path)}: a key, database or environment file`)
    else if (!IMAGE.test(entry) && SECRET.test(readFileSync(path, 'latin1'))) {
      refuse(`refusing to commit ${relative(target, path)}: it looks like a secret`)
    }
  }
}
function refuse(message) {
  // Put the clone back at its last commit, so a refused file is not left
  // behind for a later manual commit to pick up.
  git(target, 'reset', '--hard', '-q')
  git(target, 'clean', '-fdq')
  fail(message)
}
walk(target)

// 4. Commit and push when something changed.
git(target, 'add', '-A')
if (!git(target, 'status', '--porcelain')) {
  console.log('backup:content: nothing changed')
  process.exit(0)
}
const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16)
git(target, 'commit', '-q', '-m', `backup: ${stamp} (${drafts} drafts, ${versions} new versions)`)
if (push) git(target, 'push', '-q')
console.log(`backup:content: committed${push ? ' and pushed' : ''} to ${remote} (${drafts} drafts, ${versions} new versions)`)
