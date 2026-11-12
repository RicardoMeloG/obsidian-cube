import { setConsoleFunction } from 'three'

// three.js deprecated THREE.Clock in r183, and @react-three/fiber 9 (up to
// 9.8.2) still creates one per canvas, so every visit printed a deprecation
// warning the site cannot fix. The published console must stay clean (a
// reviewer may open it), so that one known message is dropped through three's
// own console hook; every other log, warning and error passes through as is.
// Remove this when fiber stops creating a Clock.
const DROPPED = ['THREE.Clock: This module has been deprecated']

export function routeThreeConsole(): void {
  setConsoleFunction((type: 'log' | 'warn' | 'error', message: string, ...params: unknown[]) => {
    if (DROPPED.some((known) => message.startsWith(known))) return
    console[type](message, ...params)
  })
}

routeThreeConsole()
