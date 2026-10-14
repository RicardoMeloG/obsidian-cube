import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry } from 'three'
import type { Group, LineSegments, Points } from 'three'
import { createCrestPointMaterial, createVectorLineMaterial } from './materials'
import { createDotTexture, createHorizonGlowTexture, makeSeededRandom } from './textures'
import { VECTOR_WORLD_THEME } from './theme'

// ── Shared plexus config defaults (tuned to the wave — all worlds inherit) ───
// These are the "base vector design": grid density, jitter, line proximity,
// point size and color. Changing them here shifts the look for every world.

const PLEXUS_DEFAULTS = {
  cols: 85,
  rows: 51,
  width: 32,
  depth: 28,
  jitterRatio: 0.32,
  lineDistanceRatio: 1.85,
  neighborRadiusCells: 2,
  maxLineSegments: 32000,
  horizonGlowOpacity: 0.2,
  parallaxX: 0.035,
  parallaxZ: 0.025,
  cellScaleNear: 1.0,
  cellScaleFar: 1.0,
  cellScaleCurve: 1.25,
  depthScaleNear: 1.0,
  depthScaleFar: 1.0,
} as const

const LINE_COLOR_RGB = VECTOR_WORLD_THEME.lineColorRgb
const LINE_GLOBAL_INTENSITY = VECTOR_WORLD_THEME.lineGlobalIntensity
const CREST_BOOST_LOW = VECTOR_WORLD_THEME.crestBoostLow
const CREST_BOOST_HIGH = VECTOR_WORLD_THEME.crestBoostHigh

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlexusDisplacementFn = (a: number, b: number, t: number) => number

export type VectorPlexusFieldProps = {
  // Displacement function: receives (x, y, time) and returns z-offset.
  // For an animated wave: sum of sin octaves over time.
  // For a static terrain: heightmap sampled at (x, y), time ignored.
  displacement: PlexusDisplacementFn

  // Grid layout — defaults match the wave. Override for larger/denser fields.
  cols?: number
  rows?: number
  width?: number
  depth?: number
  jitterRatio?: number

  // Line connection rules
  lineDistanceRatio?: number
  neighborRadiusCells?: number
  maxLineSegments?: number

  // Whether to recompute displacement each frame (wave) or only once (terrain).
  animated?: boolean

  // Horizon glow plane — atmospheric depth haze on the far edge.
  horizonGlow?: boolean
  horizonGlowOpacity?: number

  // Mouse parallax — subtle group rotation following the pointer.
  parallax?: boolean
  parallaxX?: number
  parallaxZ?: number

  // Optional perspective scaling for the grid itself.
  // Use >1 near camera and <1 toward horizon to amplify depth sensation.
  cellScaleNear?: number
  cellScaleFar?: number
  cellScaleCurve?: number
  depthScaleNear?: number
  depthScaleFar?: number

  // Group placement in the parent scene.
  position?: [number, number, number]
  rotation?: [number, number, number]

  // Pause all animation (e.g. when cube face is inactive).
  paused?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VectorPlexusField({
  displacement,
  cols = PLEXUS_DEFAULTS.cols,
  rows = PLEXUS_DEFAULTS.rows,
  width = PLEXUS_DEFAULTS.width,
  depth = PLEXUS_DEFAULTS.depth,
  jitterRatio = PLEXUS_DEFAULTS.jitterRatio,
  lineDistanceRatio = PLEXUS_DEFAULTS.lineDistanceRatio,
  neighborRadiusCells = PLEXUS_DEFAULTS.neighborRadiusCells,
  maxLineSegments = PLEXUS_DEFAULTS.maxLineSegments,
  animated = true,
  horizonGlow = true,
  horizonGlowOpacity = PLEXUS_DEFAULTS.horizonGlowOpacity,
  parallax = true,
  parallaxX: parallaxXFactor = PLEXUS_DEFAULTS.parallaxX,
  parallaxZ: parallaxZFactor = PLEXUS_DEFAULTS.parallaxZ,
  cellScaleNear = PLEXUS_DEFAULTS.cellScaleNear,
  cellScaleFar = PLEXUS_DEFAULTS.cellScaleFar,
  cellScaleCurve = PLEXUS_DEFAULTS.cellScaleCurve,
  depthScaleNear = PLEXUS_DEFAULTS.depthScaleNear,
  depthScaleFar = PLEXUS_DEFAULTS.depthScaleFar,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  paused = false,
}: VectorPlexusFieldProps) {
  const particleCount = cols * rows
  const stepX = width / (cols - 1)
  const stepY = depth / (rows - 1)
  const cellSize = (stepX + stepY) * 0.5
  const lineDistance = cellSize * lineDistanceRatio
  const lineDistanceSq = lineDistance * lineDistance
  const invLineDistance = 1 / lineDistance

  // ── Stable jittered base grid (never changes after mount) ─────────────────
  const baseXY = useMemo(() => {
    const arr = new Float32Array(particleCount * 2)
    const rand = makeSeededRandom(0xc0ffee)
    const jitter = cellSize * jitterRatio

    const rowDepthScale = new Float32Array(rows)
    const rowY = new Float32Array(rows)
    for (let r = 0; r < rows; r += 1) {
      const rNorm = rows === 1 ? 0 : r / (rows - 1)
      const near = 1 - rNorm
      const t = Math.pow(Math.max(0, Math.min(1, near)), cellScaleCurve)
      rowDepthScale[r] = depthScaleFar + (depthScaleNear - depthScaleFar) * t
    }

    if (rows > 1) {
      let totalWeight = 0
      for (let r = 0; r < rows - 1; r += 1) {
        totalWeight += (rowDepthScale[r] + rowDepthScale[r + 1]) * 0.5
      }
      rowY[0] = -depth / 2
      let acc = 0
      for (let r = 1; r < rows; r += 1) {
        acc += (rowDepthScale[r - 1] + rowDepthScale[r]) * 0.5
        rowY[r] = -depth / 2 + (acc / totalWeight) * depth
      }
    } else {
      rowY[0] = 0
    }

    for (let r = 0; r < rows; r += 1) {
      const yNominal = rowY[r]
      const yNorm = (yNominal + depth / 2) / depth
      const near = 1 - yNorm
      const t = Math.pow(Math.max(0, Math.min(1, near)), cellScaleCurve)
      const rowScale = cellScaleFar + (cellScaleNear - cellScaleFar) * t
      for (let c = 0; c < cols; c += 1) {
        const idx = r * cols + c
        const xNominal = -width / 2 + c * stepX
        arr[idx * 2] = xNominal * rowScale + (rand() - 0.5) * jitter * rowScale
        arr[idx * 2 + 1] = yNominal + (rand() - 0.5) * jitter * 0.62 * rowDepthScale[r]
      }
    }
    return arr
  }, [
    particleCount,
    cellSize,
    jitterRatio,
    rows,
    cols,
    width,
    depth,
    stepX,
    cellScaleNear,
    cellScaleFar,
    cellScaleCurve,
    depthScaleNear,
    depthScaleFar,
  ])

  // ── Geometry buffers ───────────────────────────────────────────────────────
  const particleGeometry = useMemo(() => {
    const geo = new BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i += 1) {
      positions[i * 3]     = baseXY[i * 2]
      positions[i * 3 + 1] = baseXY[i * 2 + 1]
      positions[i * 3 + 2] = 0
    }
    geo.setAttribute('position', new BufferAttribute(positions, 3))
    return geo
  }, [baseXY, particleCount])

  const lineGeometry = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(maxLineSegments * 2 * 3), 3))
    geo.setAttribute('color',    new BufferAttribute(new Float32Array(maxLineSegments * 2 * 3), 3))
    geo.setDrawRange(0, 0)
    return geo
  }, [maxLineSegments])

  // ── Materials ──────────────────────────────────────────────────────────────
  const dotTexture          = useMemo(() => createDotTexture(), [])
  const horizonGlowTexture  = useMemo(() => createHorizonGlowTexture(), [])
  const pointMaterial       = useMemo(() => createCrestPointMaterial({ dotTexture }), [dotTexture])
  const lineMaterial        = useMemo(
    () => createVectorLineMaterial({ fog: true, depthTest: true, depthWrite: false }),
    [],
  )

  // ── Refs ───────────────────────────────────────────────────────────────────
  const groupRef  = useRef<Group>(null)
  const pointsRef = useRef<Points>(null)
  const linesRef  = useRef<LineSegments>(null)

  // ── If static (terrain), compute displacement once after mount ────────────
  const staticInitialized = useRef(false)

  // ── Frame loop ─────────────────────────────────────────────────────────────
  useFrame(({ clock, pointer }) => {
    if (paused) return
    const pointsObj = pointsRef.current
    const linesObj  = linesRef.current
    if (!pointsObj || !linesObj) return

    // Skip displacement update for static fields after first frame.
    const shouldUpdate = animated || !staticInitialized.current
    const t = clock.getElapsedTime()

    const positionAttr = pointsObj.geometry.attributes.position as BufferAttribute
    const positions    = positionAttr.array as Float32Array

    if (shouldUpdate) {
      for (let i = 0; i < particleCount; i += 1) {
        const x = baseXY[i * 2]
        const y = baseXY[i * 2 + 1]
        positions[i * 3]     = x
        positions[i * 3 + 1] = y
        positions[i * 3 + 2] = displacement(x, y, t)
      }
      positionAttr.needsUpdate = true
      staticInitialized.current = true
    }

    // Line segments — proximity-based connections, same formula as wave.
    const linePositionAttr = linesObj.geometry.attributes.position as BufferAttribute
    const lineColorAttr    = linesObj.geometry.attributes.color    as BufferAttribute
    const linePositions    = linePositionAttr.array as Float32Array
    const lineColors       = lineColorAttr.array   as Float32Array

    const horizonStart = rows * 0.45
    const horizonRange = rows - horizonStart
    let segIdx = 0

    outer: for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const i  = r * cols + c
        const xi = positions[i * 3]
        const yi = positions[i * 3 + 1]
        const zi = positions[i * 3 + 2]

        for (let dr = 0; dr <= neighborRadiusCells; dr += 1) {
          const minDc = dr === 0 ? 1 : -neighborRadiusCells
          for (let dc = minDc; dc <= neighborRadiusCells; dc += 1) {
            const nr = r + dr
            const nc = c + dc
            if (nr >= rows || nc < 0 || nc >= cols) continue
            const j  = nr * cols + nc
            const dx = xi - positions[j * 3]
            const dy = yi - positions[j * 3 + 1]
            const dz = zi - positions[j * 3 + 2]
            const d2 = dx * dx + dy * dy + dz * dz
            if (d2 < lineDistanceSq) {
              if (segIdx >= maxLineSegments) break outer
              const dist = Math.sqrt(d2)
              const fade = 1 - dist * invLineDistance
              if (fade <= 0) continue
              const avgRow = (r + nr) * 0.5
              const horizonFade =
                avgRow <= horizonStart
                  ? 1
                  : Math.max(0, 1 - (avgRow - horizonStart) / horizonRange)
              const avgHeight = (zi + positions[j * 3 + 2]) * 0.5
              const crestBoost = Math.max(
                0,
                Math.min(1, (avgHeight - CREST_BOOST_LOW) / (CREST_BOOST_HIGH - CREST_BOOST_LOW)),
              )
              // Identical intensity formula to agenticWorld:
              const intensity =
                LINE_GLOBAL_INTENSITY *
                fade *
                (0.45 + fade * 0.55) *
                (0.35 + crestBoost * 0.85) *
                (0.25 + horizonFade * 0.95)

              const r0 = LINE_COLOR_RGB[0] * intensity
              const g0 = LINE_COLOR_RGB[1] * intensity
              const b0 = LINE_COLOR_RGB[2] * intensity
              const pIdx = segIdx * 6
              linePositions[pIdx]     = xi
              linePositions[pIdx + 1] = yi
              linePositions[pIdx + 2] = zi
              linePositions[pIdx + 3] = positions[j * 3]
              linePositions[pIdx + 4] = positions[j * 3 + 1]
              linePositions[pIdx + 5] = positions[j * 3 + 2]
              lineColors[pIdx]     = r0
              lineColors[pIdx + 1] = g0
              lineColors[pIdx + 2] = b0
              lineColors[pIdx + 3] = r0
              lineColors[pIdx + 4] = g0
              lineColors[pIdx + 5] = b0
              segIdx += 1
            }
          }
        }
      }
    }

    linesObj.geometry.setDrawRange(0, segIdx * 2)
    linePositionAttr.needsUpdate = true
    lineColorAttr.needsUpdate    = true

    // Parallax — subtle group tilt following pointer.
    if (parallax) {
      const group = groupRef.current
      if (group) {
        const px = pointer.x * parallaxXFactor
        const py = pointer.y * parallaxZFactor
        group.rotation.z  = px
        group.position.x  = position[0] + px * 0.6
        group.position.z  = position[2] - py * 0.4
      }
    }
  })

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {horizonGlow && (
        <mesh position={[0, depth * 0.42, -0.4]} rotation={[Math.PI / 2.1, 0, 0]}>
          <planeGeometry args={[width * 0.7, depth * 0.32]} />
          <meshBasicMaterial
            map={horizonGlowTexture}
            transparent
            opacity={horizonGlowOpacity}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      )}
      <points    ref={pointsRef} geometry={particleGeometry} material={pointMaterial} />
      <lineSegments ref={linesRef}  geometry={lineGeometry}    material={lineMaterial}  />
    </group>
  )
}
