// Change audit (spec 012): before a push that changes code, two local models,
// each on its own and without prior context, read the exact code diff the push
// will carry and the project's rules, and report defects they can prove by
// quoting the diff. The record goes to audit-runs/change-<hash>.json
// (gitignored), keyed to the diff, which is what the pre-push hook checks; a
// person or the agent verifies every finding and fixes or answers it.
//
//   npm run audit:change                      # HEAD against the push base
//   npm run audit:change -- --remote=origin --branch=main
//   npm run audit:change -- --again           # rerun models already done
//   AUDIT_MODELS=qwen3.8:27b,gemma4:31b       # the default pair
//
// A model that already answered for this exact diff is not run again, so a
// failed run is repeated alone.
//
// Needs Ollama on 127.0.0.1:11434 with the models pulled.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { auditModels, changedPaths, classify, codeDiff, diffHash, git, pushBase } from './lib/push-gate.mjs'
import { fitsOnGpu, gpuMemory, gpuProcesses, modelSizeMb } from './lib/gpu-guard.mjs'

const option = (name, fallback) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
const remote = option('remote', 'origin')
const head = git('rev-parse', 'HEAD')
const branch = option('branch', git('rev-parse', '--abbrev-ref', 'HEAD'))
const base = pushBase(head, remote, `refs/heads/${branch}`)
const { level, code } = classify(changedPaths(base, head))
if (code.length === 0) {
  console.log(`audit:change: ${level}, no code changed since ${base.slice(0, 7)}; nothing to audit`)
  process.exit(0)
}
if (git('status', '--porcelain', '--', ...code)) console.warn('audit:change: uncommitted edits in the audited files are not part of the audit; commit first')

const diff = codeDiff(base, head, code)
const hash = diffHash(diff)

// The diff goes in pieces small enough for both models to stay whole on the
// GPU (gemma4:31b fits with an 8192 context): split by file, and a large file
// by hunk, each piece keeping its file header.
const CHUNK = 9000
function chunks(text) {
  const pieces = []
  for (const file of text.split(/(?=^diff --git )/m).filter(Boolean)) {
    if (file.length <= CHUNK) {
      pieces.push(file)
      continue
    }
    const [header, ...hunks] = file.split(/(?=^@@ )/m)
    let piece = header
    for (const hunk of hunks) {
      if (piece.length + hunk.length > CHUNK && piece !== header) {
        pieces.push(piece)
        piece = header
      }
      // A single hunk over the limit is cut to fit beside its header, so no
      // piece overflows the context.
      const room = Math.max(CHUNK - header.length, 1000)
      for (let at = 0; at < hunk.length; at += room) {
        if (at > 0) {
          pieces.push(piece)
          piece = header
        }
        piece += hunk.slice(at, at + room)
      }
    }
    pieces.push(piece)
  }
  // Pack small files together.
  const packed = []
  for (const piece of pieces) {
    if (packed.length && packed.at(-1).length + piece.length <= CHUNK) packed[packed.length - 1] += piece
    else packed.push(piece)
  }
  return packed
}
const pieces = chunks(diff)

function section(text, start, end) {
  const from = text.indexOf(start)
  if (from === -1) return ''
  const to = end ? text.indexOf(end, from + start.length) : -1
  return text.slice(from, to === -1 ? undefined : to)
}
const agents = readFileSync('AGENTS.md', 'utf8')
const rules = [
  section(agents, '## Hard Rules', '## Engineering Contract'),
  section(agents, '## Architecture Rules', '## Content Strategy'),
  section(agents, 'Admin and backend rules:', '\n## '),
].join('\n')

const promptFor = (piece, index) => `You are an independent code reviewer with no prior context. The DIFF below is what is about to be pushed to a public repository. The RULES are the project's declared rules.

Report real defects you can prove from the diff:
- bugs: wrong logic, unhandled failure that loses or corrupts data, wrong edge case;
- security: secrets or personal data, injection, unsafe file, network or shell use, a check that can be bypassed;
- a rule of the RULES the diff breaks;
- a comment or document in the diff that claims something the code does not do.

Rules for your answer:
- Quote the exact added line (starting with +) and give the file.
- No style preferences, no hypothetical future features, nothing outside the diff.
- If there is nothing, return an empty list.
Return ONLY JSON: {"findings":[{"file":"...","code":"exact quote","problem":"one sentence","severity":"high|medium|low"}]}

RULES:
${rules}

DIFF (${base.slice(0, 7)}..${head.slice(0, 7)}, part ${index + 1} of ${pieces.length}):
${piece}`

// One model at a time, unloaded when done, so the two never share the GPU.
const OPTIONS = { qwen: { think: true, num_ctx: 16384 }, gemma: { think: false, num_ctx: 8192 } }
async function ask(model, prompt) {
  const { think, num_ctx } = OPTIONS[model.split(/[\d:]/)[0]] ?? { think: false, num_ctx: 16384 }
  // Streamed, so a long reasoning never trips fetch's five-minute wait for headers.
  const response = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: true, think, options: { num_ctx, num_gpu: 999, temperature: 0.2 } }),
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  let text = ''
  let doneReason
  let buffer = ''
  for await (const chunk of response.body.pipeThrough(new TextDecoderStream())) {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines.filter(Boolean)) {
      const part = JSON.parse(line)
      if (part.error) throw new Error(part.error)
      text += part.response ?? ''
      if (part.done) doneReason = part.done_reason
    }
  }
  // 'length' means the context ran out: the answer covers part of the piece.
  if (doneReason === 'length') throw new Error('context ran out')
  const findings = JSON.parse(/\{[\s\S]*\}/.exec(text)?.[0] ?? '').findings
  if (!Array.isArray(findings)) throw new Error(`no findings list in: ${text.slice(0, 200)}`)
  return findings
}

// A model sometimes returns no JSON for a piece; it gets one more try.
async function askTwice(model, prompt) {
  try {
    return await ask(model, prompt)
  } catch (error) {
    if (/context ran out|^\d{3} /.test(error.message)) throw error
    return ask(model, prompt)
  }
}

mkdirSync('audit-runs', { recursive: true })
const record = `audit-runs/change-${hash}.json`
let previous = []
try {
  previous = existsSync(record) && !process.argv.includes('--again') ? JSON.parse(readFileSync(record, 'utf8')).models ?? [] : []
} catch {
  // an unreadable record is replaced
}
console.log(`audit:change: ${level}, ${code.length} code file(s), ${diff.length} characters in ${pieces.length} part(s)`)
const runs = []
for (const model of auditModels()) {
  const done = previous.find((run) => run.model === model && Array.isArray(run.findings))
  if (done) {
    runs.push(done)
    console.log(`${model}: already audited this diff (${done.findings.length} finding(s)); --again to rerun`)
    continue
  }
  // One large GPU job at a time: measure the card before loading the model.
  const sizeMb = await modelSizeMb(model)
  const room = fitsOnGpu(sizeMb ?? 18432, gpuMemory())
  if (!room.fits) {
    console.error(`audit:change: ${model} does not fit on the GPU now (${room.reason}). Wait for this job to end, then run again:`)
    for (const line of gpuProcesses()) console.error(`  ${line}`)
    if (runs.length) writeFileSync(record, JSON.stringify({ hash, base, head, at: new Date().toISOString(), files: code, models: runs }, null, 1))
    process.exit(2)
  }
  console.log(`${model}: GPU ${room.reason}`)
  const started = Date.now()
  const run = { model, findings: [], parts: pieces.length }
  try {
    for (const [index, piece] of pieces.entries()) run.findings.push(...(await askTwice(model, promptFor(piece, index))))
  } catch (error) {
    run.findings = null
    run.error = error.message
  }
  await fetch('http://127.0.0.1:11434/api/generate', { method: 'POST', body: JSON.stringify({ model, keep_alive: 0 }) }).catch(() => {})
  run.seconds = Math.round((Date.now() - started) / 1000)
  runs.push(run)
  console.log(`${model}: ${run.findings ? `${run.findings.length} finding(s)` : `no usable answer (${run.error})`} in ${run.seconds}s`)
  for (const finding of run.findings ?? []) console.log(`  [${finding.severity}] ${finding.file}: ${finding.problem}\n      ${finding.code}`)
}

writeFileSync(record, JSON.stringify({ hash, base, head, at: new Date().toISOString(), files: code, models: runs }, null, 1))
console.log(`audit:change: ${record}. Verify every finding; fix it or answer it in the commit.`)
if (runs.some((run) => !run.findings)) process.exit(1)
