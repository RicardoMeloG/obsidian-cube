// Whether this browser can create a WebGL context. three.js reports a missing
// context from an async setup step that no React error boundary sees, so the
// scene checks first and shows its still image instead (ADR 006, degradation).
export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    // Release the probe context: browsers cap how many can be alive at once.
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    return context !== null
  } catch {
    return false
  }
}
