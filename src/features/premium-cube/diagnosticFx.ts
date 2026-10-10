// Scene diagnostics, development only. `?fx=idle,glints,shadows` (or `?fx=all`)
// switches on effects that are off in production: the idle bob of the cube,
// the pulsing glints on its edges, and shadow maps. In a production build the
// URL is never read and every flag is false. Postprocessing (bloom, vignette,
// noise) was removed: bloom is prohibited by AGENTS.md and the stack cost a
// dependency for a flag nobody shipped.
export type DiagnosticFx = {
  idle: boolean
  glints: boolean
  shadows: boolean
}

const FX_KEYS = ['idle', 'glints', 'shadows'] as const

const PRODUCTION_FX: DiagnosticFx = { idle: false, glints: false, shadows: false }

export function readDiagnosticFx(search = window.location.search): DiagnosticFx {
  if (!import.meta.env.DEV) return PRODUCTION_FX

  const enabled = new Set(new URLSearchParams(search).get('fx')?.split(',').map((key) => key.trim()) ?? [])
  const all = enabled.has('all')

  return FX_KEYS.reduce(
    (flags, key) => ({
      ...flags,
      [key]: all || enabled.has(key),
    }),
    { ...PRODUCTION_FX },
  )
}
