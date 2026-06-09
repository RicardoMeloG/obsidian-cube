export type DiagnosticFx = {
  idle: boolean
  glints: boolean
  shadows: boolean
  bloom: boolean
  vignette: boolean
  noise: boolean
}

const FX_KEYS = ['idle', 'glints', 'shadows', 'bloom', 'vignette', 'noise'] as const

export function readDiagnosticFx(search = window.location.search): DiagnosticFx {
  const enabled = new Set(new URLSearchParams(search).get('fx')?.split(',').map((key) => key.trim()) ?? [])
  const all = enabled.has('all')

  return FX_KEYS.reduce(
    (flags, key) => ({
      ...flags,
      [key]: all || enabled.has(key),
    }),
    {
      idle: false,
      glints: false,
      shadows: false,
      bloom: false,
      vignette: false,
      noise: false,
    } satisfies DiagnosticFx,
  )
}
