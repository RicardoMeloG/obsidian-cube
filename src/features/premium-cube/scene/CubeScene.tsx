import { PerspectiveCamera, Stars } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Group, MeshBasicMaterial } from 'three'
import { AdditiveBlending, CanvasTexture, Color, Euler, LinearFilter, Quaternion, SRGBColorSpace, Vector3 } from 'three'
import {
  playCubeDragTickSound,
  playCubeTransitionSound,
  startCubeDragSound,
  stopCubeDragSound,
  updateCubeDragSound,
} from '../audio/cubeAudio'
import type { CubeSectionId } from '../../../kernel/faces'
import { useLayoutMode } from '../../../styles/layoutModes'
import type { ResolvedCubeSection } from '../../../kernel/visualContent'
import type { DiagnosticFx } from '../diagnosticFx'
import { CampusEnvironment } from './CampusEnvironment'
import { PremiumCube } from './PremiumCube'
import { VectorWorldStage } from './vector-worlds/VectorWorldStage'
import { IntroSparks } from './intro/IntroSparks'
import { LandingRing } from './intro/LandingRing'
import {
  INTRO,
  beamLevel,
  fallOffset,
  fallTurn,
  introPhase,
  platformGlowLevel,
  turnAngle,
} from './intro/introTimeline'
import type { IntroPhase } from './intro/introTimeline'

export type CubeSceneHandle = {
  enterSection: (sectionId: CubeSectionId) => void
  skipIntro: () => void
}

// First-visit intro (specs/009-cube-intro). `play` runs the fall; `turns` are the
// intro-time instants of the invitation turns (empty: none).
export type CubeIntroConfig = {
  play: boolean
  turns: readonly number[]
  freezeAt: number | null
}

type CubeSceneProps = {
  effects: DiagnosticFx
  onCursorModeChange: (mode: 'default' | 'grab' | 'grabbing') => void
  onSectionEnter: (sectionId: CubeSectionId) => void
  sections: ResolvedCubeSection[]
  activeSectionId: CubeSectionId
  handleRef?: RefObject<CubeSceneHandle | null>
  intro: CubeIntroConfig
  onIntroPhase?: (phase: IntroPhase) => void
  onEngaged?: () => void
}

type PointerEventLike = {
  clientX: number
  clientY: number
  pointerId?: number
  point?: Vector3
  stopPropagation?: () => void
  target?: EventTarget | null
  nativeEvent?: PointerEvent
}

// Drag sensitivity in radians per pixel. Direct (trackball) control: the cube
// follows the finger/pointer 1:1 on both axes, so reaching the polar faces
// (systems up / contact down) is as easy as the equator faces. ~0.009 means a
// ~175px swipe rotates a full 90°.
const DRAG_SENSITIVITY = 0.009

const FACE_TARGET_ROTATION: Record<CubeSectionId, [number, number, number]> = {
  agentic: [0, 0, 0],
  products: [0, -Math.PI / 2, 0],
  systems: [Math.PI / 2, 0, 0],
  security: [0, Math.PI, 0],
  research: [0, Math.PI / 2, 0],
  contact: [-Math.PI / 2, 0, 0],
}

// Canonical orientation quaternion for each face (the cube's resting pose with
// that face front and upright). Built once from the Euler targets above.
const FACE_QUATERNION = Object.fromEntries(
  (Object.entries(FACE_TARGET_ROTATION) as [CubeSectionId, [number, number, number]][]).map(
    ([id, [x, y, z]]) => [id, new Quaternion().setFromEuler(new Euler(x, y, z))],
  ),
) as Record<CubeSectionId, Quaternion>

// Scratch objects reused per frame to avoid allocations (single CubeScene).
const _dragAxis = new Vector3()
const _dragDelta = new Quaternion()
const _tiltEuler = new Euler()
const _tiltQuat = new Quaternion()
const _introEuler = new Euler()
const _introQuat = new Quaternion()
const _turnQuat = new Quaternion()
const _yAxis = new Vector3(0, 1, 0)

const PLATFORM_GLOW_OPACITY = 0.85
const PLATFORM_CORE_OPACITY = 1
const BEAM_OPACITY = 0.18

function createGlowTexture(inner: string, outer: string) {
  const s = 512
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const gradient = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  gradient.addColorStop(0, inner)
  gradient.addColorStop(0.4, outer)
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, s, s)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  return texture
}

function createBeamTexture() {
  const w = 256
  const h = 1024
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const gradient = ctx.createLinearGradient(0, 0, w, 0)
  gradient.addColorStop(0, 'rgba(255,255,255,0)')
  gradient.addColorStop(0.5, 'rgba(220,220,255,0.45)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)
  const vfade = ctx.createLinearGradient(0, 0, 0, h)
  vfade.addColorStop(0, 'rgba(0,0,0,0)')
  vfade.addColorStop(0.55, 'rgba(0,0,0,0.4)')
  vfade.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = vfade
  ctx.fillRect(0, 0, w, h)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  return texture
}

type PlatformTicksProps = {
  radius: number
  count: number
  faint?: boolean
}

function PlatformTicks({ radius, count, faint = false }: PlatformTicksProps) {
  const ticks = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2
    const isMajor = i % 6 === 0
    const length = (isMajor ? 0.085 : 0.04) * (faint ? 0.7 : 1)
    const opacity = (isMajor ? 0.55 : 0.22) * (faint ? 0.5 : 1)
    return { angle, length, opacity, isMajor }
  })

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.41, 0]}>
      {ticks.map((tick, i) => (
        <mesh key={i} rotation={[0, 0, tick.angle]} position={[Math.cos(tick.angle) * radius, Math.sin(tick.angle) * radius, 0]}>
          <planeGeometry args={[tick.length, 0.0085]} />
          <meshBasicMaterial
            color={tick.isMajor ? '#dcd6ff' : '#8d82ff'}
            transparent
            opacity={tick.opacity}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

export function CubeScene({
  activeSectionId,
  effects,
  onCursorModeChange,
  onSectionEnter,
  sections,
  handleRef,
  intro,
  onIntroPhase,
  onEngaged,
}: CubeSceneProps) {
  const rigRef = useRef<Group>(null)
  const platformGlowTexture = useMemo(
    () => createGlowTexture('rgba(180, 170, 255, 0.85)', 'rgba(110, 96, 230, 0.32)'),
    [],
  )
  const beamTexture = useMemo(() => createBeamTexture(), [])
  const dragRef = useRef({
    active: false, // a pointer is currently dragging
    hovering: false,
    freeMode: false, // cube is under free (trackball) control: dragging or coasting
    freeRest: false, // cube is holding a free orientation the user left it at
    pointerId: -1,
    lastX: 0,
    lastY: 0,
    spinAngle: 0, // inertia magnitude (radians per frame) after release
    totalDistance: 0,
    soundDistance: 0,
    lastResonanceAt: 0,
    clickSectionId: 'agentic' as CubeSectionId,
    target: new Quaternion(), // desired orientation (free-mode)
    spinAxis: new Vector3(0, 1, 0), // axis of the last drag step (for inertia)
  })
  const pointerSmoothRef = useRef({ x: 0, y: 0 })
  // Intro clock: starts on the first rendered frame (the scene may arrive later
  // than the DOM). `quiet` stops the invitation turns once the visitor acts.
  const introRef = useRef({
    start: -1,
    time: 0,
    skipped: false,
    phase: (intro.play ? 'hold' : 'done') as IntroPhase,
    quiet: false,
    engaged: false,
  })
  const [sparksMounted, setSparksMounted] = useState(intro.play)
  const platformGlowRef = useRef<MeshBasicMaterial>(null)
  const platformCoreRef = useRef<MeshBasicMaterial>(null)
  const beamRef = useRef<MeshBasicMaterial>(null)
  const getIntroTime = useCallback(() => introRef.current.time, [])
  const introTurns = useMemo(
    () => (intro.play ? [INTRO.firstTurn, INTRO.secondTurn] : intro.turns),
    [intro.play, intro.turns],
  )
  const { camera, gl } = useThree()
  const { narrow: isNarrow, stacked: isStackedFrame } = useLayoutMode()
  const cubeScale = isNarrow ? 0.96 : isStackedFrame ? 0.9 : 0.92
  const cubeBaseY = isNarrow ? 0.28 : isStackedFrame ? 0.42 : 0.34
  const platformScale = isNarrow ? 0.96 : isStackedFrame ? 0.9 : 0.98
  const platformBaseY = isNarrow ? 0 : isStackedFrame ? 0.04 : -0.18
  const cameraPosition = isNarrow ? ([0, 0.66, 7.4] as const) : isStackedFrame ? ([0, 0.78, 8.2] as const) : ([0, 0.78, 7.6] as const)
  const cameraTargetY = isNarrow ? 0.06 : isStackedFrame ? 0.12 : -0.04

  const getClickedSectionId = useCallback((point?: Vector3) => {
    if (!rigRef.current || !point) {
      return dragRef.current.clickSectionId
    }

    const localPoint = rigRef.current.worldToLocal(point.clone())
    const absX = Math.abs(localPoint.x)
    const absY = Math.abs(localPoint.y)
    const absZ = Math.abs(localPoint.z)

    if (absX > absY && absX > absZ) {
      return localPoint.x > 0 ? 'products' : 'research'
    }

    if (absY > absX && absY > absZ) {
      return localPoint.y > 0 ? 'systems' : 'contact'
    }

    return localPoint.z > 0 ? 'agentic' : 'security'
  }, [])

  const enterSection = useCallback((sectionId: CubeSectionId) => {
    // Leave free-mode and hand control back to the resting pose, which slerps the
    // cube toward FACE_QUATERNION[activeSectionId] once the section updates.
    const drag = dragRef.current
    drag.freeMode = false
    drag.freeRest = false
    drag.active = false
    drag.spinAngle = 0
    introRef.current.quiet = true
    onCursorModeChange('default')
    void playCubeTransitionSound()
    onSectionEnter(sectionId)
  }, [onCursorModeChange, onSectionEnter])

  const reportIntroPhase = useCallback(
    (phase: IntroPhase) => {
      const state = introRef.current
      if (state.phase === phase) return
      state.phase = phase
      if (phase === 'done') setSparksMounted(false)
      onIntroPhase?.(phase)
    },
    [onIntroPhase],
  )

  // Jump to the final state: cube at rest on its face, particles gone.
  const skipIntro = useCallback(() => {
    const state = introRef.current
    if (!intro.play || state.skipped || state.phase === 'done') return
    state.skipped = true
    reportIntroPhase('done')
  }, [intro.play, reportIntroPhase])

  useImperativeHandle(handleRef, () => ({ enterSection, skipIntro }), [enterSection, skipIntro])

  useFrame(({ clock, pointer }) => {
    const rig = rigRef.current
    if (!rig) {
      return
    }

    const drag = dragRef.current
    const t = clock.getElapsedTime()
    const introState = introRef.current
    if (introState.start < 0) introState.start = t
    const elapsed = t - introState.start
    introState.time = intro.freezeAt ?? (introState.skipped ? Math.max(elapsed, INTRO.end) : elapsed)
    const introTime = introState.time

    camera.position.set(cameraPosition[0], cameraPosition[1], cameraPosition[2])
    camera.lookAt(0, cameraTargetY, 0)

    rig.scale.setScalar(cubeScale)

    if (intro.play) {
      reportIntroPhase(introPhase(introTime))
      const glow = platformGlowLevel(introTime)
      if (platformGlowRef.current) platformGlowRef.current.opacity = Math.min(1, PLATFORM_GLOW_OPACITY * glow)
      if (platformCoreRef.current) platformCoreRef.current.opacity = Math.min(1, PLATFORM_CORE_OPACITY * glow)
      if (beamRef.current) beamRef.current.opacity = BEAM_OPACITY * beamLevel(introTime)

      // Falling: height and turn come straight from the timeline (no smoothing),
      // so the cube lands exactly at rest on the active face.
      if (introTime < INTRO.land) {
        const turn = fallTurn(introTime)
        _introEuler.set(turn.pitch, turn.yaw, 0)
        _introQuat.setFromEuler(_introEuler)
        rig.position.y = cubeBaseY + fallOffset(introTime)
        rig.quaternion.copy(_introQuat).multiply(FACE_QUATERNION[activeSectionId])
        drag.target.copy(rig.quaternion)
        return
      }
    }

    rig.position.y = cubeBaseY + (effects.idle ? Math.sin(t * 0.72) * 0.035 : 0)

    // Quaternion trackball. While dragging, drag.target follows the finger (set in
    // continueDrag). On release it coasts with inertia, then settles into FREE REST,
    // holding wherever the user left it — it no longer auto-snaps to a face or
    // selects one. Only a click commits + loads a section (see enterSection). At
    // (aligned) rest it tracks the active face's canonical orientation.
    let slerpFactor: number
    if (drag.active) {
      slerpFactor = 0.35
    } else if (drag.freeMode) {
      if (drag.spinAngle > 0.001) {
        _dragDelta.setFromAxisAngle(drag.spinAxis, drag.spinAngle)
        drag.target.premultiply(_dragDelta)
        drag.spinAngle *= 0.9
        slerpFactor = 0.3
      } else {
        // Inertia spent → hold this free orientation. No snap, no selection.
        drag.freeMode = false
        drag.freeRest = true
        slerpFactor = 0.2
      }
    } else if (drag.freeRest) {
      // Hold the free orientation the user dragged to until they click.
      slerpFactor = 0.16
    } else {
      // Resting: the active face's canonical orientation, plus a subtle tilt
      // toward the pointer (the cube "looks at" the cursor). Desktop/tablet only.
      const sp = pointerSmoothRef.current
      sp.x += (pointer.x - sp.x) * 0.06
      sp.y += (pointer.y - sp.y) * 0.06
      const tiltYaw = sp.x * (isNarrow ? 0 : isStackedFrame ? 0.2 : 0.24)
      const tiltPitch = -sp.y * (isNarrow ? 0 : isStackedFrame ? 0.1 : 0.12)
      _tiltEuler.set(tiltPitch, tiltYaw, 0)
      _tiltQuat.setFromEuler(_tiltEuler)
      drag.target.copy(FACE_QUATERNION[activeSectionId]).premultiply(_tiltQuat)
      // Invitation turn toward the next face and back, until the visitor acts.
      const turn = introState.quiet ? 0 : turnAngle(introTime, introTurns)
      if (turn !== 0) {
        _turnQuat.setFromAxisAngle(_yAxis, turn)
        drag.target.premultiply(_turnQuat)
      }
      slerpFactor = 0.12
    }

    rig.quaternion.slerp(drag.target, slerpFactor)
  })

  useEffect(() => {
    function continueDrag(event: PointerEvent) {
      const drag = dragRef.current

      if (!drag.active || drag.pointerId !== event.pointerId) {
        return
      }

      const deltaX = event.clientX - drag.lastX
      const deltaY = event.clientY - drag.lastY
      const pointerSpeed = Math.hypot(deltaX, deltaY)

      if (pointerSpeed > 0) {
        // Trackball: rotate about an axis perpendicular to the drag in screen
        // space, premultiplied so the rotation is always relative to the view
        // (full freedom on both axes, no gimbal lock). Angle ∝ drag distance.
        _dragAxis.set(deltaY, deltaX, 0).normalize()
        const angle = pointerSpeed * DRAG_SENSITIVITY
        _dragDelta.setFromAxisAngle(_dragAxis, angle)
        drag.target.premultiply(_dragDelta)
        drag.spinAxis.copy(_dragAxis)
        drag.spinAngle = angle
      }

      drag.totalDistance += pointerSpeed
      drag.soundDistance += pointerSpeed
      drag.lastX = event.clientX
      drag.lastY = event.clientY
      updateCubeDragSound(pointerSpeed)

      const now = performance.now()
      if (drag.soundDistance > 46 && now - drag.lastResonanceAt > 170) {
        playCubeDragTickSound(pointerSpeed)
        drag.soundDistance = 0
        drag.lastResonanceAt = now
      }
    }

    function endDrag(event: PointerEvent) {
      const drag = dragRef.current

      if (!drag.active || drag.pointerId !== event.pointerId) {
        return
      }

      drag.active = false
      drag.pointerId = -1
      stopCubeDragSound()

      if (drag.totalDistance < 8) {
        enterSection(drag.clickSectionId)
      }

      drag.totalDistance = 0
      drag.soundDistance = 0
      onCursorModeChange(drag.hovering ? 'grab' : 'default')
    }

    window.addEventListener('pointermove', continueDrag)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)

    return () => {
      window.removeEventListener('pointermove', continueDrag)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
    }
  }, [enterSection, onCursorModeChange])

  function handlePointerDown(event: PointerEventLike) {
    event.stopPropagation?.()

    const introState = introRef.current
    introState.quiet = true
    if (!introState.engaged) {
      introState.engaged = true
      onEngaged?.()
    }

    const drag = dragRef.current
    drag.active = true
    drag.freeMode = true
    drag.freeRest = false
    drag.pointerId = event.pointerId ?? -1
    drag.lastX = event.clientX
    drag.lastY = event.clientY
    drag.spinAngle = 0
    drag.totalDistance = 0
    drag.soundDistance = 0
    drag.lastResonanceAt = performance.now()
    drag.clickSectionId = getClickedSectionId(event.point)
    // Continue the free rotation from the cube's current orientation.
    if (rigRef.current) {
      drag.target.copy(rigRef.current.quaternion)
    }
    // Capture the pointer on the canvas itself: once you touch the cube, every
    // move is routed to the canvas until you release — so the rotation keeps
    // following your finger even when it leaves the cube (or the canvas).
    if (typeof event.pointerId === 'number') {
      gl.domElement.setPointerCapture?.(event.pointerId)
    }
    void startCubeDragSound()
    onCursorModeChange('grabbing')
  }

  function handlePointerUp(event?: PointerEventLike) {
    const drag = dragRef.current

    if (!drag.active) {
      return
    }

    const wasClick = drag.totalDistance < 8

    drag.active = false
    drag.pointerId = -1
    stopCubeDragSound()

    if (wasClick) {
      enterSection(drag.clickSectionId)
    }

    drag.totalDistance = 0
    drag.soundDistance = 0
    if (event && typeof event.pointerId === 'number') {
      gl.domElement.releasePointerCapture?.(event.pointerId)
    }
    onCursorModeChange(drag.hovering ? 'grab' : 'default')
  }

  return (
    <>
      <color attach="background" args={['#08050d']} />
      <fog attach="fog" args={['#08050d', 9, 26]} />

      <PerspectiveCamera
        makeDefault
        position={cameraPosition}
        fov={isNarrow ? 40 : isStackedFrame ? 39 : 37}
        onUpdate={(camera) => camera.lookAt(0, cameraTargetY, 0)}
      />
      <CampusEnvironment />

      <ambientLight intensity={0.08} />

      <directionalLight position={[-4.2, 2.2, -3.4]} intensity={0.55} color={new Color('#5a5cff')} />
      <pointLight position={[0, -1.32, 0.9]} intensity={7.4} color={new Color('#7a6cff')} distance={5.5} />
      <pointLight position={[1.6, 0.6, 2.4]} intensity={1.1} color={new Color('#c9d2ff')} distance={4.2} />
      <pointLight position={[-1.6, 0.6, 2.4]} intensity={1.1} color={new Color('#9387ff')} distance={4.2} />

      <spotLight
        position={[0.4, 7.6, 2.6]}
        target-position={[0, 0.4, 0]}
        angle={0.16}
        penumbra={0.25}
        intensity={22}
        color={new Color('#ffffff')}
        castShadow={effects.shadows}
      />
      <spotLight
        position={[2.4, 6.2, 1.4]}
        target-position={[0.4, 0.6, 0.4]}
        angle={0.2}
        penumbra={0.45}
        intensity={9}
        color={new Color('#e0e4ff')}
      />
      <spotLight
        position={[-2.6, 5.6, 0.8]}
        target-position={[-0.4, 0.6, 0]}
        angle={0.24}
        penumbra={0.5}
        intensity={6.4}
        color={new Color('#c4cbff')}
      />
      <spotLight
        position={[0, 5.2, -2.6]}
        target-position={[0, 0.4, 0]}
        angle={0.34}
        penumbra={0.7}
        intensity={3.4}
        color={new Color('#9aa0ff')}
      />
      <spotLight
        position={[0, -1.2, 0.05]}
        target-position={[0, 0.4, 0]}
        angle={0.62}
        penumbra={0.85}
        intensity={7.4}
        color={new Color('#7c6dff')}
      />

      <group
        ref={rigRef}
        scale={cubeScale}
        position={[0, cubeBaseY, 0]}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOver={() => {
          dragRef.current.hovering = true
          onCursorModeChange(dragRef.current.active ? 'grabbing' : 'grab')
        }}
        onPointerOut={() => {
          dragRef.current.hovering = false
          if (!dragRef.current.active) {
            onCursorModeChange('default')
          }
        }}
      >
        <PremiumCube animateGlints={effects.glints} sections={sections} shadows={effects.shadows} />
      </group>

      <group scale={platformScale} position={[0, platformBaseY, 0]}>
        <mesh position={[0, -1.455, 0]} receiveShadow={effects.shadows} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2.72, 180]} />
          <meshStandardMaterial color="#02030a" metalness={0.86} roughness={0.22} transparent opacity={0.42} />
        </mesh>

        <mesh position={[0, -1.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.2, 2.2]} />
          <meshBasicMaterial
            ref={platformGlowRef}
            map={platformGlowTexture}
            transparent
            opacity={PLATFORM_GLOW_OPACITY}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>

        <mesh position={[0, -1.422, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.12, 64]} />
          <meshBasicMaterial ref={platformCoreRef} color="#ffffff" transparent opacity={PLATFORM_CORE_OPACITY} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </mesh>

        <mesh position={[0, -1.412, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.96, 0.978, 180]} />
          <meshBasicMaterial color="#f4f2ff" transparent opacity={0.85} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </mesh>

        <mesh position={[0, -1.41, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.18, 1.196, 200]} />
          <meshBasicMaterial color="#b8aeff" transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </mesh>

        <mesh position={[0, -1.408, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.52, 1.534, 240]} />
          <meshBasicMaterial color="#8a7eff" transparent opacity={0.42} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </mesh>

        <mesh position={[0, -1.406, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.92, 1.93, 260]} />
          <meshBasicMaterial color="#6b66ff" transparent opacity={0.3} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </mesh>

        <mesh position={[0, -1.404, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.34, 2.346, 280]} />
          <meshBasicMaterial color="#cfd8ff" transparent opacity={0.14} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </mesh>

        <PlatformTicks radius={2.08} count={84} />
        <PlatformTicks radius={2.5} count={120} faint />
        {intro.play && <LandingRing getTime={getIntroTime} />}
      </group>

      {sparksMounted && (
        <IntroSparks
          cubeScale={cubeScale}
          cubeBaseY={cubeBaseY}
          faceQuaternion={FACE_QUATERNION[activeSectionId]}
          getTime={getIntroTime}
        />
      )}

      <VectorWorldStage worldId={sections.find((section) => section.id === activeSectionId)?.worldId ?? null} />

      <mesh position={[0, 4.6, -0.4]}>
        <planeGeometry args={[0.9, 5]} />
        <meshBasicMaterial
          ref={beamRef}
          map={beamTexture}
          transparent
          opacity={BEAM_OPACITY}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <Stars radius={25} depth={8} count={80} factor={0.25} saturation={0} fade speed={0} />
    </>
  )
}
