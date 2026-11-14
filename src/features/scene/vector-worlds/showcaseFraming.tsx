import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, PerspectiveCamera as ThreePerspectiveCamera, Vector3 } from 'three'
import type { WorldId } from '@/kernel/worlds'
import type { WorldCamera, WorldComposition } from './types'

// The showcase framing of a world: the camera, the look-at target and the
// props each world's `showcase` entry declares (registry.ts), tuned by the
// owner in the dev showcase (?bg=<world>). Shared by that tool and by the
// visitor's art mode (spec 017), so both frame a world the same way.

export function ShowcaseLookAt({
  target,
  composition,
}: {
  target: readonly [number, number, number]
  composition?: WorldComposition
}) {
  const vec = useMemo(() => new Vector3(target[0], target[1], target[2]), [target])
  useFrame(({ camera, size }) => {
    if (!composition) {
      camera.lookAt(vec)
      return
    }
    const aspect = Math.max(0.4, size.width / Math.max(1, size.height))
    const aspectDelta = aspect - composition.targetAspect
    const yAdjust = MathUtils.clamp(-aspectDelta * 0.26, -0.16, 0.28)
    vec.set(target[0], target[1] + yAdjust, target[2])
    camera.lookAt(vec)
  })
  return null
}

type ShowcaseCameraProps = {
  worldId: WorldId
  baseCamera: WorldCamera
  composition?: WorldComposition
}

// Keeps the horizontal field of view of the tuned aspect on any window, within
// limits, so a world keeps its composition on a narrower or wider screen.
export function ShowcaseCamera({ worldId, baseCamera, composition }: ShowcaseCameraProps) {
  useFrame(({ camera, size }) => {
    if (!(camera instanceof ThreePerspectiveCamera)) return

    const aspect = Math.max(0.4, size.width / Math.max(1, size.height))
    const referenceAspect = composition?.targetAspect ?? 16 / 9
    const baseVerticalFovRad = MathUtils.degToRad(baseCamera.fov)
    const baseHorizontalFovRad = 2 * Math.atan(Math.tan(baseVerticalFovRad * 0.5) * referenceAspect)
    const adaptedVerticalFovRad = 2 * Math.atan(Math.tan(baseHorizontalFovRad * 0.5) / aspect)
    const adaptedFov = MathUtils.clamp(
      MathUtils.radToDeg(adaptedVerticalFovRad),
      baseCamera.fov * 0.84,
      baseCamera.fov * 1.38,
    )

    let y = baseCamera.position[1]
    let z = baseCamera.position[2]
    if (worldId === 'research' && composition) {
      const narrower = Math.max(0, referenceAspect - aspect)
      const wider = Math.max(0, aspect - referenceAspect)
      z += narrower * 2.1 - Math.min(0.76, wider * 0.6)
      y += narrower * 0.46 - Math.min(0.2, wider * 0.16)
    }

    camera.position.set(baseCamera.position[0], y, z)
    camera.near = baseCamera.near
    camera.far = baseCamera.far
    if (Math.abs(camera.fov - adaptedFov) > 0.01) {
      camera.fov = adaptedFov
      camera.updateProjectionMatrix()
    }
  })
  return null
}
