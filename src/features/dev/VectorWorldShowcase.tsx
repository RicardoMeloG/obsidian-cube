import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MathUtils, PerspectiveCamera as ThreePerspectiveCamera, Vector3 } from 'three'
import { useSiteContent } from '@/features/content/useSiteContent'
import { VECTOR_WORLD_THEME } from '@/features/scene/vector-worlds/base/theme'
import { isWorldId, WORLD_REGISTRY } from '@/features/scene/vector-worlds/registry'
import { WORLD_IDS } from '@/kernel/worlds'
import type { WorldId } from '@/kernel/worlds'
import type { WorldComposition } from '@/features/scene/vector-worlds/types'

type ProductTuneState = {
  yaw: number
  cameraX: number
  cameraY: number
  cameraZ: number
  fov: number
  lookAtX: number
  lookAtY: number
  lookAtZ: number
  pitch: number
  posY: number
  posZ: number
}

const PRODUCT_TUNE_DEFAULTS: ProductTuneState = {
  // pitch/yaw = cube orientation (do not change). Camera lowered to a near-eye
  // level so the reflective floor reads under the modules, like the reference.
  yaw: -0.68,
  cameraX: -1.4,
  cameraY: 4.6,
  cameraZ: 19.5,
  fov: 56,
  lookAtX: 0.8,
  lookAtY: 1.2,
  lookAtZ: -7.5,
  pitch: 0.48,
  posY: -0.62,
  posZ: -1.2,
}

function ResponsiveCameraLookAt({
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

type ResponsiveShowcaseCameraProps = {
  worldId: WorldId
  baseCamera: { position: readonly [number, number, number]; fov: number; near: number; far: number }
  composition?: WorldComposition
}

function ResponsiveShowcaseCamera({ worldId, baseCamera, composition }: ResponsiveShowcaseCameraProps) {
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

function readWorldId(): WorldId {
  if (typeof window === 'undefined') return 'agentic'
  const bg = new URLSearchParams(window.location.search).get('bg')
  if (bg && isWorldId(bg)) return bg
  return 'agentic'
}

function readTuneEnabled(): boolean {
  if (typeof window === 'undefined') return false
  const value = new URLSearchParams(window.location.search).get('tune')
  return value === '1' || value === 'true'
}

export function VectorWorldShowcase() {
  const worldId = readWorldId()
  const { content } = useSiteContent()
  const entry = WORLD_REGISTRY[worldId]
  const { Component, showcase, label, caption } = entry
  const isProducts = worldId === 'products'
  const showProductTune = isProducts && readTuneEnabled()
  const [productTune, setProductTune] = useState<ProductTuneState>(PRODUCT_TUNE_DEFAULTS)

  // Arrow keys cycle through worlds — fast iteration during design work.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const currentIndex = WORLD_IDS.indexOf(worldId)
      if (currentIndex === -1) return
      const delta = event.key === 'ArrowRight' ? 1 : -1
      const nextIndex = (currentIndex + delta + WORLD_IDS.length) % WORLD_IDS.length
      window.location.search = `?bg=${WORLD_IDS[nextIndex]}`
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [worldId])

  const worldOptions = useMemo(
    () => WORLD_IDS.map((id) => ({ id, label: WORLD_REGISTRY[id].label })),
    [],
  )

  const effectiveCamera = useMemo(() => {
    if (!isProducts) return showcase.camera

    return {
      ...showcase.camera,
      position: [productTune.cameraX, productTune.cameraY, productTune.cameraZ] as const,
      fov: productTune.fov,
    }
  }, [isProducts, productTune.cameraX, productTune.cameraY, productTune.cameraZ, productTune.fov, showcase.camera])
  const effectiveLookAt = useMemo(() => {
    if (!isProducts || !showcase.lookAt) return showcase.lookAt

    return [productTune.lookAtX, productTune.lookAtY, productTune.lookAtZ] as const
  }, [isProducts, productTune.lookAtX, productTune.lookAtY, productTune.lookAtZ, showcase.lookAt])
  const effectiveShowcaseProps = useMemo(() => {
    const showcaseProps = showcase.props ?? {}
    if (!isProducts) return showcaseProps

    return {
      ...showcaseProps,
      position: [0, productTune.posY, productTune.posZ] as [number, number, number],
      rotation: [productTune.pitch, productTune.yaw, 0] as [number, number, number],
    }
  }, [isProducts, productTune.pitch, productTune.posY, productTune.posZ, productTune.yaw, showcase.props])
  // Systems world owns its CameraLookAt; expose it via prop when previewed standalone.
  const extraProps = worldId === 'systems' ? { controlsCamera: true, fogLines: true, skylineDepthTest: false } : {}
  const adjustProductTune = (key: keyof ProductTuneState, delta: number) => {
    setProductTune((current) => ({
      ...current,
      [key]: Number((current[key] + delta).toFixed(2)),
    }))
  }

  return (
    <main className="wave-showcase" aria-label="Vector world showcase">
      <div className="wave-showcase__canvas">
        <Canvas
          camera={effectiveCamera}
          dpr={[1.25, 2.5]}
          style={{ width: '100%', height: '100%' }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', stencil: true }}
        >
          <Suspense fallback={null}>
            <color attach="background" args={[VECTOR_WORLD_THEME.background]} />
            <fog attach="fog" args={[VECTOR_WORLD_THEME.background, showcase.fog.near, showcase.fog.far]} />
            <ambientLight intensity={0.18} />
            <ResponsiveShowcaseCamera
              worldId={worldId}
              baseCamera={effectiveCamera}
              composition={showcase.composition}
            />
            {effectiveLookAt && (
              <ResponsiveCameraLookAt target={effectiveLookAt} composition={showcase.composition} />
            )}
            <Suspense fallback={null}>
              <Component {...effectiveShowcaseProps} {...extraProps} />
            </Suspense>
          </Suspense>
        </Canvas>
      </div>

      <header className="wave-showcase__chrome">
          <div>
            <span>{label}</span>
            <small>?bg={worldId} — {caption} — ←/→ to cycle</small>
          </div>
          <nav className="wave-showcase__switcher" aria-label="Switch world">
            {worldOptions.map((option) => (
              <a
                key={option.id}
                href={`?bg=${option.id}`}
                aria-current={option.id === worldId ? 'page' : undefined}
                className={option.id === worldId ? 'is-active' : undefined}
              >
                {option.id}
              </a>
            ))}
          </nav>
          <a href={typeof window !== 'undefined' ? window.location.pathname : '/'}>back to cube</a>
      </header>

      {showProductTune && (
        <aside className="world-tune" aria-label="Products orientation controls">
          <header>
            <span>orientation tune</span>
            <button type="button" onClick={() => setProductTune(PRODUCT_TUNE_DEFAULTS)}>
              reset
            </button>
          </header>
          <div className="world-tune__row">
            <strong>yaw</strong>
            <button type="button" onClick={() => adjustProductTune('yaw', -0.05)}>-</button>
            <code>{productTune.yaw.toFixed(2)}</code>
            <button type="button" onClick={() => adjustProductTune('yaw', 0.05)}>+</button>
          </div>
          <div className="world-tune__row">
            <strong>cameraX</strong>
            <button type="button" onClick={() => adjustProductTune('cameraX', -0.25)}>-</button>
            <code>{productTune.cameraX.toFixed(2)}</code>
            <button type="button" onClick={() => adjustProductTune('cameraX', 0.25)}>+</button>
          </div>
          <div className="world-tune__row">
            <strong>cameraY</strong>
            <button type="button" onClick={() => adjustProductTune('cameraY', -0.15)}>-</button>
            <code>{productTune.cameraY.toFixed(2)}</code>
            <button type="button" onClick={() => adjustProductTune('cameraY', 0.15)}>+</button>
          </div>
          <div className="world-tune__row">
            <strong>cameraZ</strong>
            <button type="button" onClick={() => adjustProductTune('cameraZ', -0.25)}>-</button>
            <code>{productTune.cameraZ.toFixed(2)}</code>
            <button type="button" onClick={() => adjustProductTune('cameraZ', 0.25)}>+</button>
          </div>
          <div className="world-tune__row">
            <strong>fov</strong>
            <button type="button" onClick={() => adjustProductTune('fov', -1)}>-</button>
            <code>{productTune.fov.toFixed(0)}</code>
            <button type="button" onClick={() => adjustProductTune('fov', 1)}>+</button>
          </div>
          <div className="world-tune__row">
            <strong>lookAtX</strong>
            <button type="button" onClick={() => adjustProductTune('lookAtX', -0.1)}>-</button>
            <code>{productTune.lookAtX.toFixed(2)}</code>
            <button type="button" onClick={() => adjustProductTune('lookAtX', 0.1)}>+</button>
          </div>
          <div className="world-tune__row">
            <strong>lookAtY</strong>
            <button type="button" onClick={() => adjustProductTune('lookAtY', -0.1)}>-</button>
            <code>{productTune.lookAtY.toFixed(2)}</code>
            <button type="button" onClick={() => adjustProductTune('lookAtY', 0.1)}>+</button>
          </div>
          <div className="world-tune__row">
            <strong>lookAtZ</strong>
            <button type="button" onClick={() => adjustProductTune('lookAtZ', -0.15)}>-</button>
            <code>{productTune.lookAtZ.toFixed(2)}</code>
            <button type="button" onClick={() => adjustProductTune('lookAtZ', 0.15)}>+</button>
          </div>
          <div className="world-tune__row">
            <strong>pitch</strong>
            <button type="button" onClick={() => adjustProductTune('pitch', -0.03)}>-</button>
            <code>{productTune.pitch.toFixed(2)}</code>
            <button type="button" onClick={() => adjustProductTune('pitch', 0.03)}>+</button>
          </div>
          <div className="world-tune__row">
            <strong>posY</strong>
            <button type="button" onClick={() => adjustProductTune('posY', -0.1)}>-</button>
            <code>{productTune.posY.toFixed(2)}</code>
            <button type="button" onClick={() => adjustProductTune('posY', 0.1)}>+</button>
          </div>
          <div className="world-tune__row">
            <strong>posZ</strong>
            <button type="button" onClick={() => adjustProductTune('posZ', -0.2)}>-</button>
            <code>{productTune.posZ.toFixed(2)}</code>
            <button type="button" onClick={() => adjustProductTune('posZ', 0.2)}>+</button>
          </div>
          <p>
            position=[0,{productTune.posY.toFixed(2)},{productTune.posZ.toFixed(2)}] rotation=[{productTune.pitch.toFixed(2)},{productTune.yaw.toFixed(2)},0] camera=[{productTune.cameraX.toFixed(2)},{productTune.cameraY.toFixed(2)},{productTune.cameraZ.toFixed(2)}] fov={productTune.fov.toFixed(0)} lookAt=[{productTune.lookAtX.toFixed(2)},{productTune.lookAtY.toFixed(2)},{productTune.lookAtZ.toFixed(2)}]
          </p>
        </aside>
      )}

      <div className="wave-showcase__signature">{content.identity.fullName}</div>
    </main>
  )
}
