// Docs hygiene (spec 010, H-11).
//
// Living documents must not carry measurements that silently go stale. A size
// or line count in them needs, on the same line, the date it was measured
// (YYYY-MM-DD) or the command that reproduces it (in backticks). Limits are
// rules, not measurements, and pass (≤, <, "at most", "under", "budget").
// Dated records (ADRs, specs, audits) are exempt: their date is in the header.

import { readFileSync, readdirSync } from 'node:fs'

const LIVING = ['AGENTS.md', 'CLAUDE.md', 'README.md', ...readdirSync('docs').filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`)]
const FIGURE = /\b\d[\d,.]*\s?(KB|kB|MB|GB|lines|líneas)\b/
const DATED = /\b20\d\d-\d\d-\d\d\b/
const COMMAND = /`[^`]*\b(npm|npx|node|wc|ls|du|grep|git)\b[^`]*`/
const LIMIT = /(≤|<=|<|\bat most\b|\bunder\b|\bbudget\b|\blimit\b)/i

const problems = []
for (const file of LIVING) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      if (FIGURE.test(line) && !DATED.test(line) && !COMMAND.test(line) && !LIMIT.test(line)) {
        problems.push(`${file}:${index + 1}: ${line.trim().slice(0, 120)}`)
      }
    })
}

for (const problem of problems) console.log(problem)
console.log(`Docs check: ${problems.length} undated measurements in ${LIVING.length} living documents.`)
process.exitCode = problems.length > 0 ? 1 : 0
