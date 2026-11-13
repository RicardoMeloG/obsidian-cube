// Runs on `npm install` (prepare): points git at the repository's hooks, so
// the pre-push gates (privacy, spec 010 H-08a; check:push, spec 012) are on in
// every clone without anyone remembering to enable them. Outside a git clone,
// or without git, it does nothing.
import { execFileSync } from 'node:child_process'

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' })
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' })
} catch {
  // not a git clone (an npm tarball, a CI cache): no hooks to enable
}
