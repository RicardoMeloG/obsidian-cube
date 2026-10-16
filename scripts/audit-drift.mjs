// Drift audit (AGENTS.md, definition of done, item 8): two local models, each
// without prior context, read the declared rules and a set of files and report
// only drift they can prove by quoting both the code and the rule. They also
// read the project's objective (Direction, Audience, MVP Definition) and say
// whether the work brings the site closer to it or postpones it (2026-10-16:
// the gates check the code, not the objective). Their raw answers go to
// audit-runs/ (gitignored); a person verifies every finding and records the
// result next to the spec as audit-N.md.
//
//   node scripts/audit-drift.mjs --spec=specs/011-stage-compositions --label=stage \
//     --files=src/features/stage/StageView.tsx,src/features/stage/blocks.tsx
//   options: --models=qwen3.6:27b,gemma4:31b  --diff=scripts/check-layout.mjs
//            --brief="what the slice built, one sentence"
//
// Needs Ollama on 127.0.0.1:11434 with the models pulled.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const option = (name, fallback) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
const list = (value) => (value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [])

const specDir = option('spec')
const label = option('label', 'audit')
const files = list(option('files'))
const diffs = list(option('diff'))
const models = list(option('models', 'qwen3.6:27b,gemma4:31b'))
const brief = option('brief', 'the slice of the spec that was just built')
if (!specDir || files.length === 0) throw new Error('Usage: --spec=<spec dir> --files=<comma-separated paths> [--label --models --diff --brief]')

const read = (path) => readFileSync(path, 'utf8')
function section(text, start, end) {
  const from = text.indexOf(start)
  if (from === -1) return ''
  const to = end ? text.indexOf(end, from + start.length) : -1
  return text.slice(from, to === -1 ? undefined : to)
}

const agents = read('AGENTS.md')
const spec = read(`${specDir}/spec.md`)
const architecture = read('docs/architecture.md')
const objective = `# AGENTS.md: the objective\n${section(agents, '## Direction', '## Identity')}${section(agents, '## Audience', '## Narrative')}${section(agents, '## MVP Definition', '## Other References')}`
const rules = [
  objective,
  `# AGENTS.md (excerpts)\n${section(agents, '## Experience Architecture', '## Visual Strategy')}${section(agents, '## Hard Rules', '## Engineering Contract')}${section(agents, '## Architecture Rules', '## Content Strategy')}`,
  `# ${specDir}/spec.md\n${spec}`,
  `# docs/architecture.md: dependency rules\n${section(architecture, '**Dependency rules**', '## Flows')}`,
].join('\n\n')

const numbered = (path) => read(path).split('\n').map((line, index) => `${String(index + 1).padStart(4)} ${line}`).join('\n')
let code = files.map((path) => `===== FILE: ${path} =====\n${numbered(path)}`).join('\n\n')
for (const path of diffs) code += `\n\n===== DIFF: ${path} (against HEAD) =====\n${execFileSync('git', ['diff', 'HEAD', '--', path], { encoding: 'utf8' })}`

const prompt = `You are an independent architecture auditor with no prior context. The RULES below are the project's declared architecture: its constitution (AGENTS.md), the spec being built and the module dependency rules. The CODE is ${brief}.

Find DRIFT: places where the code contradicts a rule, or where a rule the spec says is enforced is not actually enforced by the code shown. Examples: owner content written in code; a module importing what its rule forbids; a gate that claims to check something it does not; a file over the size limit; a field declared in the kernel that nothing renders or edits; naming against the declared vocabulary; a security rule of the admin broken.

Then judge the work against the OBJECTIVE (the first section of the rules: Direction, Audience, MVP Definition): does it bring the site closer to that objective, is it neutral, or does it postpone it? Quote the objective text your verdict rests on.

Rules for your answer:
- Report only what you can prove by quoting both the code (file and line number as shown) and the exact rule text it breaks.
- Do not report style preferences, hypothetical future problems or things outside the rules.
- If you find nothing, return an empty list.
Return ONLY JSON: {"objective":{"verdict":"closer|neutral|postpones","quote":"exact quote of the objective","reason":"one or two sentences"},"findings":[{"file":"...","line":0,"code":"exact quote","rule":"exact quote of the rule","problem":"one sentence","severity":"high|medium|low"}]}

RULES:
${rules}

CODE:
${code}`

mkdirSync('audit-runs', { recursive: true })
for (const model of models) {
  const started = Date.now()
  // Streamed, so a long reasoning never trips fetch's five-minute wait for headers.
  const response = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // qwen reasons before answering; gemma answers directly.
    body: JSON.stringify({ model, prompt, stream: true, think: model.startsWith('qwen'), options: { num_ctx: 49152, temperature: 0.2 } }),
  })
  const result = { response: '', prompt_eval_count: undefined, error: undefined, doneReason: undefined }
  let buffer = ''
  for await (const chunk of response.body.pipeThrough(new TextDecoderStream())) {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines.filter(Boolean)) {
      const part = JSON.parse(line)
      result.response += part.response ?? ''
      if (part.error) result.error = part.error
      if (part.done) {
        result.prompt_eval_count = part.prompt_eval_count
        // 'length' means the context ran out before the answer: split the files.
        result.doneReason = part.done_reason
      }
    }
  }
  const match = /\{[\s\S]*\}/.exec(result.response)
  let findings = null
  let verdict = null
  try {
    const parsed = JSON.parse(match?.[0] ?? '')
    findings = parsed.findings
    verdict = parsed.objective ?? null
  } catch {
    // kept raw below
  }
  const seconds = Math.round((Date.now() - started) / 1000)
  const file = `audit-runs/${label}-${model.replace(/[:/]/g, '_')}.json`
  const { error, doneReason } = result
  writeFileSync(file, JSON.stringify({ model, label, seconds, tokensIn: result.prompt_eval_count, doneReason, error, objective: verdict, findings, raw: findings ? undefined : result.response }, null, 1))
  const outcome = findings ? `${findings.length} findings, objective: ${verdict?.verdict ?? '?'}` : `no answer (${error ?? `ended: ${doneReason}`})`
  console.log(`${model} ${label}: ${outcome} in ${seconds}s, ${result.prompt_eval_count ?? '?'} tokens in → ${file}`)
}
