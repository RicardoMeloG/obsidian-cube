import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  AlwaysStencilFunc,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  KeepStencilOp,
  NotEqualStencilFunc,
  ReplaceStencilOp,
  ShaderMaterial,
} from 'three'
import { VectorPlexusField } from '../base/VectorPlexusField'
import { createVectorLineMaterial } from '../base/materials'
import { createDotTexture, createHorizonGlowTexture, makeSeededRandom } from '../base/textures'
import { VECTOR_WORLD_THEME } from '../base/theme'
import type { WorldProps } from '../types'

// ── Local coordinate convention ───────────────────────────────────────────────
// The containing group applies rotation [-Math.PI / 2.1, 0, 0], which tilts
// the local XY plane to appear horizontal in world space.
//   Local X = left / right   (unchanged in world)
//   Local Y = near / far     (depth into the scene)
//   Local Z = up / down      (displacement — same axis as the plexus field)
//
// Everything in this file (heightmap, trees, shrubs) uses this convention so
// the geometry aligns with the plexus surface without any coordinate transforms.

const BASE_FIELD_WIDTH = 82
const BASE_FIELD_DEPTH = 42
const BASE_FIELD_COLS  = 132
const BASE_FIELD_ROWS  = 90

const LINE_COLOR = VECTOR_WORLD_THEME.lineColorRgb
const LINE_GLOBAL_INTENSITY = VECTOR_WORLD_THEME.lineGlobalIntensity
// Trees/shrubs use the same line-darkness principle as the plexus base.
const TREE_LINE_SCALE = LINE_GLOBAL_INTENSITY * 0.24

// Temporary diagnostic overlays. Disable before keeping the final visual pass.
const DEBUG_OCCLUDER_MASK = false
const DEBUG_SKY_INFLUENCE = false

// The terrain stencil should hide star trails only where the paramo actually
// occupies the lower frame. Keeping its far edge too deep projects a high,
// horizontal no-star band in the cube composition.
const TERRAIN_OCCLUDER_NEAR_DEPTH = 0.72
const TERRAIN_OCCLUDER_FAR_DEPTH = 0.2

// ── Terrain displacement ──────────────────────────────────────────────────────
// Passed to VectorPlexusField as the displacement function.
// Returns local Z (height) for a point at local (x, y).

const BASE_Z      = -1.5

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function terrainDisplacement(x: number, y: number, fieldDepth: number, t?: number): number {
  void t
  const yNorm = clamp01((y + fieldDepth * 0.5) / fieldDepth)

  // Keep most deformation in the visible ground band.
  const nearMask = 1 - smoothstep(0.62, 0.97, yNorm)
  const midMask = smoothstep(0.14, 0.58, yNorm) * (1 - smoothstep(0.88, 0.985, yNorm))

  // Broad irregular floor waves (stronger, reference-like uneven terrain).
  let h = 0
  h += nearMask * Math.sin(0.11 * x + 0.16 * y + 0.24) * 0.62
  h += nearMask * Math.cos(0.23 * x - 0.13 * y - 0.88) * 0.46
  h += nearMask * Math.sin(0.48 * x + 0.33 * y + 1.14) * 0.18

  // Mid-plane rolling terrain, visibly stronger than previous pass.
  h += midMask * (Math.sin(0.085 * x - 0.42) * 0.44 + Math.cos(0.16 * y + 0.61) * 0.32)

  // Valley path in center, deeper and clearer.
  const centerValley = Math.exp(-Math.pow(x / 10.2, 2))
  h += -centerValley * (0.2 + smoothstep(0.3, 0.92, yNorm) * 0.58)

  // Foreground lobes to emulate irregular paramo ridges.
  const leftLobe = Math.exp(-Math.pow((x + 17) / 9.8, 2))
  const rightLobe = Math.exp(-Math.pow((x - 17) / 10.4, 2))
  h += nearMask * leftLobe * (0.38 + 0.16 * Math.sin(0.35 * y + 0.4))
  h += nearMask * rightLobe * (0.36 + 0.14 * Math.cos(0.31 * y - 0.2))

  // Lift outer sides so center reads as a true trough.
  h += Math.pow(x / 31, 2) * (0.16 + nearMask * 0.12)

  return BASE_Z + h
}

function pushCordilleraSegment(
  positions: number[],
  colors: number[],
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  intensity: number,
) {
  positions.push(x1, y1, z1, x2, y2, z2)
  colors.push(
    LINE_COLOR[0] * intensity, LINE_COLOR[1] * intensity, LINE_COLOR[2] * intensity,
    LINE_COLOR[0] * intensity, LINE_COLOR[1] * intensity, LINE_COLOR[2] * intensity,
  )
}

function buildCordilleraLines(fieldWidth: number, fieldDepth: number) {
  const positions: number[] = []
  const colors: number[] = []

  const extent = fieldWidth * 0.75
  const valleyHalfGap = fieldWidth * 0.112
  // Aerial perspective: widen the front→back intensity gap so the rear ranges
  // dissolve toward the sky and the scene reads as kilometres of depth.
  const mainIntensity = LINE_GLOBAL_INTENSITY * 1.12
  const midIntensity = LINE_GLOBAL_INTENSITY * 0.66
  const rearIntensity = LINE_GLOBAL_INTENSITY * 0.34

  type Layer = {
    y: number
    baseZ: number
    amp: number
    intensity: number
    seed: number
    slopeDrop: number
    facetStep: number
  }

  const layers: Layer[] = [
    { y: fieldDepth * 0.06, baseZ: BASE_Z + 2.2, amp: 8.8, intensity: mainIntensity, seed: 0x9123, slopeDrop: 2.2, facetStep: 3 },
    { y: fieldDepth * 0.12, baseZ: BASE_Z + 1.6, amp: 6.2, intensity: midIntensity, seed: 0xa145, slopeDrop: 1.6, facetStep: 4 },
    { y: fieldDepth * 0.18, baseZ: BASE_Z + 1.1, amp: 4.2, intensity: rearIntensity, seed: 0xb167, slopeDrop: 1.15, facetStep: 5 },
  ]

  function ridgeHeight(
    x: number,
    side: -1 | 1,
    amp: number,
    valleyGap: number,
    extentRef: number,
    phaseA: number,
    phaseB: number,
    phaseC: number,
    walk: number,
  ) {
    const d = clamp01((Math.abs(x) - valleyGap) / Math.max(1e-4, extentRef - valleyGap))
    const rise = Math.pow(d, 0.5)
    const cap = 1 - Math.pow(clamp01((Math.abs(x) - valleyGap) / (extentRef * 1.025 - valleyGap)), 1.42)
    const envelope = Math.max(0, rise * cap)

    // Jagged skyline built from sharp harmonics (less "hill", more "ridge").
    const j1 = Math.pow(Math.abs(Math.sin(x * 0.132 + phaseA)), 2.4)
    const j2 = Math.pow(Math.abs(Math.sin(x * 0.334 + phaseB)), 4.9)
    const j3 = Math.pow(Math.abs(Math.cos(x * 0.56 + phaseC)), 6.2)
    const jag = j1 * 0.5 + j2 * 0.36 + j3 * 0.28

    // Shoulder lift and edge bias to mimic strong side cordilleras.
    const shoulder = Math.pow(clamp01((Math.abs(x) - (valleyGap + extentRef * 0.08)) / (extentRef * 0.7)), 0.74)
    const sideBias = side === -1 ? 0.1 : 0.08

    return amp * (0.1 + envelope * (jag + shoulder * 0.54 + walk + sideBias))
  }

  function addSideRidge(side: -1 | 1, layer: Layer, seedOffset: number) {
    const rand = makeSeededRandom(layer.seed + seedOffset)
    const samples = 76
    const xStart = side === -1 ? -extent : valleyHalfGap
    const xEnd = side === -1 ? -valleyHalfGap : extent
    const phaseA = rand() * Math.PI * 2
    const phaseB = rand() * Math.PI * 2
    const phaseC = rand() * Math.PI * 2

    const crestX: number[] = []
    const crestZ: number[] = []

    let walk = 0
    let prevX = xStart
    let prevZ = layer.baseZ + ridgeHeight(prevX, side, layer.amp, valleyHalfGap, extent, phaseA, phaseB, phaseC, walk)
    crestX.push(prevX)
    crestZ.push(prevZ)

    for (let i = 1; i < samples; i += 1) {
      walk = Math.max(-0.3, Math.min(0.3, walk + (rand() - 0.5) * 0.1))
      const t = i / (samples - 1)
      const x = xStart + (xEnd - xStart) * t
      const z = layer.baseZ + ridgeHeight(x, side, layer.amp, valleyHalfGap, extent, phaseA, phaseB, phaseC, walk)
      crestX.push(x)
      crestZ.push(z)

      pushCordilleraSegment(positions, colors, prevX, layer.y, prevZ, x, layer.y, z, layer.intensity)

      // Facet lines: send geometry to far depth (+Y) to avoid foreground overlap.
      if (i % layer.facetStep === 0) {
        const valleyPull = side === -1 ? 1 : -1
        const dx = valleyPull * (0.95 + rand() * 1.42)
        const dy = 0.08 + rand() * 0.14
        const slopeX = x + dx
        const slopeY = layer.y + dy
        const slopeZ = z - layer.slopeDrop * (0.28 + rand() * 0.22)
        pushCordilleraSegment(positions, colors, x, layer.y, z, slopeX, slopeY, slopeZ, layer.intensity * 0.54)
        if (i % (layer.facetStep * 2) === 0) {
          pushCordilleraSegment(positions, colors, prevX, layer.y, prevZ, slopeX, slopeY, slopeZ, layer.intensity * 0.42)
        }
      }

      prevX = x
      prevZ = z
    }

    // Add interior contour lines to build visible mountain mass.
    const contourBands = 3
    for (let band = 1; band <= contourBands; band += 1) {
      const bandY = layer.y + band * (0.055 + band * 0.01)
      const bandDrop = layer.slopeDrop * (0.14 + band * 0.12)
      const drift = side === -1 ? 1 : -1
      const shift = drift * (0.55 + band * 0.36)

      let prevBandX = crestX[0] + shift
      let prevBandZ = crestZ[0] - bandDrop
      for (let i = 1; i < crestX.length; i += 1) {
        const jitter = (rand() - 0.5) * 0.18 * band
        const bandX = crestX[i] + shift * (1 + i / crestX.length * 0.24)
        const bandZ = crestZ[i] - bandDrop + jitter
        pushCordilleraSegment(positions, colors, prevBandX, bandY, prevBandZ, bandX, bandY, bandZ, layer.intensity * (0.38 - band * 0.06))

        if (i % (3 + band) === 0) {
          pushCordilleraSegment(positions, colors, crestX[i], layer.y, crestZ[i], bandX, bandY, bandZ, layer.intensity * 0.34)
        }

        prevBandX = bandX
        prevBandZ = bandZ
      }
    }
  }

  for (const layer of layers) {
    addSideRidge(-1, layer, 19)
    addSideRidge(1, layer, 61)
  }

  // Center massif uses the same angular language as side cordilleras.
  type CenterLayer = {
    y: number
    span: number
    baseZ: number
    amp: number
    intensity: number
    seed: number
    facetDrop: number
  }
  const centerLayers: CenterLayer[] = [
    { y: fieldDepth * 0.21, span: fieldWidth * 0.22, baseZ: BASE_Z + 1.26, amp: 2.92, intensity: rearIntensity * 0.96, seed: 0xc401, facetDrop: 0.58 },
    { y: fieldDepth * 0.27, span: fieldWidth * 0.172, baseZ: BASE_Z + 1.03, amp: 2.12, intensity: rearIntensity * 0.8, seed: 0xc521, facetDrop: 0.46 },
    { y: fieldDepth * 0.33, span: fieldWidth * 0.128, baseZ: BASE_Z + 0.84, amp: 1.52, intensity: rearIntensity * 0.64, seed: 0xc641, facetDrop: 0.34 },
  ]

  for (const layer of centerLayers) {
    const rand = makeSeededRandom(layer.seed)
    const samples = 34
    const phaseA = rand() * Math.PI * 2
    const phaseB = rand() * Math.PI * 2
    const phaseC = rand() * Math.PI * 2
    const crestX: number[] = []
    const crestZ: number[] = []

    let prevX = -layer.span
    let prevZ = layer.baseZ + 0.14
    crestX.push(prevX)
    crestZ.push(prevZ)

    for (let i = 1; i < samples; i += 1) {
      const t = i / (samples - 1)
      const x = -layer.span + t * layer.span * 2
      const env = Math.pow(Math.sin(t * Math.PI), 0.88)
      const j1 = Math.pow(Math.abs(Math.sin(x * 0.36 + phaseA)), 3.8)
      const j2 = Math.pow(Math.abs(Math.sin(x * 0.82 + phaseB)), 5.1)
      const j3 = Math.pow(Math.abs(Math.cos(x * 1.19 + phaseC)), 6.2)
      const summit = j1 * 0.5 + j2 * 0.36 + j3 * 0.2
      const notch = Math.exp(-Math.pow((t - 0.5) / 0.16, 2)) * 0.44
      const z = layer.baseZ + env * (layer.amp * (0.46 + summit)) - notch

      crestX.push(x)
      crestZ.push(z)
      pushCordilleraSegment(positions, colors, prevX, layer.y, prevZ, x, layer.y, z, layer.intensity)

      // Facets slope outward and away in depth for the "drawn mountain wall" look.
      if (i % 2 === 0) {
        const side = x < 0 ? -1 : 1
        const fx = x + side * (0.42 + rand() * 0.88)
        const fy = layer.y + 0.06 + rand() * 0.06
        const fz = z - layer.facetDrop * (0.38 + rand() * 0.28)
        pushCordilleraSegment(positions, colors, x, layer.y, z, fx, fy, fz, layer.intensity * 0.5)
        if (i % 4 === 0) {
          pushCordilleraSegment(positions, colors, prevX, layer.y, prevZ, fx, fy, fz, layer.intensity * 0.34)
        }
      }

      prevX = x
      prevZ = z
    }

    // Interior contour shelves to match the side mountain drawing style.
    for (let band = 1; band <= 2; band += 1) {
      const bandY = layer.y + 0.05 * band
      const bandDrop = layer.facetDrop * (0.34 + 0.2 * band)
      let prevBandX = crestX[0]
      let prevBandZ = crestZ[0] - bandDrop
      for (let i = 1; i < crestX.length; i += 1) {
        const bx = crestX[i]
        const bz = crestZ[i] - bandDrop + (rand() - 0.5) * 0.06
        pushCordilleraSegment(positions, colors, prevBandX, bandY, prevBandZ, bx, bandY, bz, layer.intensity * (0.33 - band * 0.07))
        if (i % (3 + band) === 0) {
          pushCordilleraSegment(positions, colors, crestX[i], layer.y, crestZ[i], bx, bandY, bz, layer.intensity * 0.28)
        }
        prevBandX = bx
        prevBandZ = bz
      }
    }
  }

  // positions holds every cordillera segment (crest + facets + contours). The
  // occluder is built directly from these by extruding each segment into a
  // vertical wall — see buildMountainOccluderGeometry.
  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
  }
}

function buildFoothillTreeBands(fieldWidth: number, fieldDepth: number) {
  const positions: number[] = []
  const colors: number[] = []
  const rand = makeSeededRandom(0xe0a517)

  function pushTree(cx: number, cy: number, baseZ: number, h: number, w: number, intensity: number) {
    const xL = cx - w * 0.5
    const xR = cx + w * 0.5
    const yB = cy
    const yA = cy + 0.02
    const zA = baseZ + h

    pushCordilleraSegment(positions, colors, xL, yB, baseZ, cx, yA, zA, intensity)
    pushCordilleraSegment(positions, colors, cx, yA, zA, xR, yB, baseZ, intensity)
    pushCordilleraSegment(positions, colors, xL, yB, baseZ, xR, yB, baseZ, intensity * 0.72)
    pushCordilleraSegment(positions, colors, cx, yB, baseZ, cx, yB, baseZ - h * 0.26, intensity * 0.48)
  }

  type Band = {
    yOffset: number
    zOffset: number
    density: number
    height: number
    width: number
    jitter: number
    intensity: number
    valleyGap: number
  }

  const bands: Band[] = [
    {
      yOffset: 0,
      zOffset: 0.04,
      density: 1.36,
      height: 0.98,
      width: 0.74,
      jitter: 0.07,
      intensity: LINE_GLOBAL_INTENSITY * 0.46,
      valleyGap: fieldWidth * 0.1,
    },
    {
      yOffset: fieldDepth * 0.03,
      zOffset: -0.02,
      density: 1.12,
      height: 0.76,
      width: 0.6,
      jitter: 0.06,
      intensity: LINE_GLOBAL_INTENSITY * 0.36,
      valleyGap: fieldWidth * 0.07,
    },
    {
      yOffset: fieldDepth * 0.056,
      zOffset: -0.1,
      density: 0.82,
      height: 0.54,
      width: 0.44,
      jitter: 0.05,
      intensity: LINE_GLOBAL_INTENSITY * 0.28,
      valleyGap: fieldWidth * 0.062,
    },
  ]

  for (const band of bands) {
    const step = 1 / band.density
    for (let x = -fieldWidth * 0.5; x <= fieldWidth * 0.5; x += step) {
      if (Math.abs(x) < band.valleyGap) continue
      const keepChance = 0.82 + Math.min(0.16, Math.abs(x) / (fieldWidth * 1.05))
      if (rand() > keepChance) continue

      const xJ = x + (rand() - 0.5) * 0.34
      const xNorm = Math.min(1, Math.abs(xJ) / (fieldWidth * 0.5))
      // Foothill transition curve: center is farther, sides are closer.
      const transitionY = fieldDepth * (0.102 + (1 - Math.pow(xNorm, 0.9)) * 0.082)
      const yJ = transitionY + band.yOffset + (rand() - 0.5) * band.jitter
      // Slight altitude lift toward side slopes.
      const slopeLift = Math.pow(xNorm, 1.1) * 0.32
      // Wider height variance + occasional emergent (taller) trees so the band
      // reads as an organic forest edge, not a uniform fence.
      const emergent = rand() < 0.13 ? 0.8 + rand() * 1.3 : 0
      const h = band.height * (0.5 + rand() * 1.0 + emergent)
      const w = band.width * (0.6 + rand() * 0.62)
      const z = BASE_Z + 0.56 + band.zOffset + slopeLift + (rand() - 0.5) * 0.05
      pushTree(xJ, yJ, z, h, w, band.intensity)
    }
  }

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
  }
}

// Occluder = union of vertical "walls", one per cordillera segment. Each drawn
// line (crest, facet or contour) drops a quad straight down to a floor Z. The
// stencil union of all walls reproduces the silhouette EXACTLY in screen space
// — including far, lower lines that project high near the horizon, which a
// per-column max-Z envelope would miss (depth conflation). No camera math
// needed: each wall is real 3D geometry that projects correctly on its own.
function buildMountainOccluderGeometry(segmentPositions: Float32Array) {
  const topMargin = 0.08       // lift the wall top a hair so the line itself is covered
  const bottomZ = BASE_Z - 2.2 // overlaps the terrain occluder below
  const segCount = Math.floor(segmentPositions.length / 6)
  const positions = new Float32Array(segCount * 4 * 3)
  const indices: number[] = []

  for (let s = 0; s < segCount; s += 1) {
    const o = s * 6
    const x1 = segmentPositions[o]
    const y1 = segmentPositions[o + 1]
    const z1 = segmentPositions[o + 2]
    const x2 = segmentPositions[o + 3]
    const y2 = segmentPositions[o + 4]
    const z2 = segmentPositions[o + 5]

    const v = s * 4              // topA, botA, topB, botB
    const base = v * 3
    // topA
    positions[base] = x1
    positions[base + 1] = y1
    positions[base + 2] = z1 + topMargin
    // botA
    positions[base + 3] = x1
    positions[base + 4] = y1
    positions[base + 5] = bottomZ
    // topB
    positions[base + 6] = x2
    positions[base + 7] = y2
    positions[base + 8] = z2 + topMargin
    // botB
    positions[base + 9] = x2
    positions[base + 10] = y2
    positions[base + 11] = bottomZ

    indices.push(v, v + 1, v + 2)
    indices.push(v + 2, v + 1, v + 3)
  }

  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(positions, 3))
  g.setIndex(indices)
  return g
}

// ── Star trails (southern-hemisphere timelapse) ───────────────────────────────
// A catalogue of stars orbiting the south celestial pole. Each star keeps a
// fixed (angle, radius, brightness, size); the trail and head are recomputed per
// frame so the scene plays a timelapse "build-up": stars first read as points,
// then their arcs grow until they settle into a slow continuous spin.

const TAU = Math.PI * 2

type SkyStar = { theta0: number; r: number; bright: number; size: number }

// Animation / layout tuning.
const SKY_STAR_COUNT = 850
const SKY_TRAIL_SEGMENTS = 12        // polyline points per trail
const SKY_BUILD_DURATION = 14        // seconds for trails to reach full length
const SKY_FADE_IN = 1.2              // seconds for stars to fade in from black
const SKY_INTRO_HOLD = 3.4           // seconds stars stay static (points) before spinning
const SKY_OMEGA = 0.02               // rad/s idle rotation (calm)
const SKY_SPIN_DIR = -1              // southern hemisphere = clockwise facing south
const SKY_TRAIL_LMAX = 0.62          // rad, final trail arc length
const SKY_FLATTEN = 1.0              // 1.0 = perfectly circular trails (no squish)
const SKY_TRAIL_INTENSITY = LINE_GLOBAL_INTENSITY * 0.85
const SKY_HEAD_INTENSITY = 2.8       // head points pop brighter than trails (read as a starfield)

function buildSkyStars(fieldWidth: number, fieldDepth: number) {
  const rand = makeSeededRandom(0x5a7e13)
  const rMax = fieldWidth * 0.6
  const stars: SkyStar[] = []
  for (let i = 0; i < SKY_STAR_COUNT; i += 1) {
    // sqrt → areal-uniform density (denser toward the edges, sparse at the pole)
    const r = Math.sqrt(rand()) * rMax
    const theta0 = rand() * TAU
    // Magnitude: power law → many faint stars, a few bright ones.
    const mag = Math.pow(rand(), 2.6)
    const bright = 0.5 + mag * 1.0     // raised floor so even faint stars read as dots
    const size = 2.6 + mag * 5.4       // px point size — brighter stars are bigger
    stars.push({ theta0, r, bright, size })
  }
  // South celestial pole: centred in azimuth, low altitude above the ridge
  // (the SCP sits only ~30° up in southern skies) so the swirl centre reads
  // closer to the horizon and can be framed behind the cube.
  const pole = [0, fieldDepth * 0.4, BASE_Z + 6] as const
  return { stars, pole }
}

// Star-head point shader: per-vertex size + colour, dot-sprite alpha, additive.
const STAR_HEAD_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  uniform float uPixelRatio;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio;
  }
`
const STAR_HEAD_FRAG = /* glsl */ `
  precision mediump float;
  uniform sampler2D uMap;
  varying vec3 vColor;
  void main() {
    vec4 sprite = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor * sprite.a, sprite.a);
  }
`

function buildSkyInfluenceGeometry(fieldWidth: number) {
  const segments = 192
  const rings = 42
  const radius = fieldWidth * 0.56
  const positions = new Float32Array((rings + 1) * segments * 3)
  const indices: number[] = []

  for (let ring = 0; ring <= rings; ring += 1) {
    const ringT = ring / rings
    const r = Math.pow(ringT, 1.08) * radius

    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2
      const idx = (ring * segments + segment) * 3
      positions[idx] = Math.cos(angle) * r
      positions[idx + 1] = 0
      positions[idx + 2] = Math.sin(angle) * r * 0.9
    }
  }

  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const nextSegment = (segment + 1) % segments
      const a = ring * segments + segment
      const b = ring * segments + nextSegment
      const c = (ring + 1) * segments + segment
      const d = (ring + 1) * segments + nextSegment
      indices.push(a, c, b)
      indices.push(b, c, d)
    }
  }

  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(positions, 3))
  g.setIndex(indices)
  return g
}

// ── Tree geometry ─────────────────────────────────────────────────────────────
// Araucaria araucana: vertical trunk along local Z + tiered umbrella canopies
// spreading in the local XY plane. Same visual logic as before, Z↔Y swapped.

const ARAUCARIAS: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
  [-6.4,  -13.1, 1.15, 6, 7, 0x9a51],
  [ 6.4,  -12.9, 1.1,  6, 7, 0x8b62],
  [-11.0,  -8.7, 0.75, 5, 6, 0x7c73],
  [ 10.4,  -8.3, 0.78, 5, 6, 0x6d84],
  [ -3.4,  -5.1, 0.55, 4, 5, 0x5e95],
  [  3.8,  -4.8, 0.55, 4, 5, 0x4fa6],
  [-15.0,   0.2, 0.42, 4, 5, 0x30b7],
  [ 14.0,   0.7, 0.44, 4, 5, 0x21c8],
  [ -8.2,  -2.0, 0.45, 4, 5, 0x41d9],
  [  8.6,  -1.6, 0.47, 4, 5, 0x52ea],
]

function buildAraucaria(
  cx: number, cy: number,
  scale: number, layerCount: number, branchesPerLayer: number, seed: number,
) {
  const rand = makeSeededRandom(seed)
  const positions: number[] = []
  const colors: number[]    = []

  const baseZ       = terrainDisplacement(cx, cy, BASE_FIELD_DEPTH) + 0.02
  const trunkHeight = (3.0 + rand() * 1.4) * scale
  const apexZ       = baseZ + trunkHeight
  const nearTopZ    = baseZ + trunkHeight * 0.97

  function seg(
    dx1: number, dy1: number, z1: number,
    dx2: number, dy2: number, z2: number,
    br: number,
  ) {
    positions.push(cx + dx1, cy + dy1, z1, cx + dx2, cy + dy2, z2)
    const i = br * TREE_LINE_SCALE
    colors.push(
      LINE_COLOR[0] * i, LINE_COLOR[1] * i, LINE_COLOR[2] * i,
      LINE_COLOR[0] * i, LINE_COLOR[1] * i, LINE_COLOR[2] * i,
    )
  }

  // Trunk spine + 4 radial verticals for wireframe volume.
  seg(0, 0, baseZ, 0, 0, nearTopZ, 0.92)
  const tr = 0.06 * scale
  seg(-tr, 0, baseZ, -tr * 0.5, 0, baseZ + trunkHeight * 0.92, 0.62)
  seg( tr, 0, baseZ,  tr * 0.5, 0, baseZ + trunkHeight * 0.92, 0.62)
  seg(0, -tr, baseZ, 0, -tr * 0.5, baseZ + trunkHeight * 0.92, 0.5)
  seg(0,  tr, baseZ, 0,  tr * 0.5, baseZ + trunkHeight * 0.92, 0.5)

  // Root flare in XY plane.
  for (let a = 0; a < 4; a += 1) {
    const ang = (a / 4) * Math.PI * 2 + 0.4
    seg(0, 0, baseZ, Math.cos(ang) * 0.13 * scale, Math.sin(ang) * 0.13 * scale, baseZ, 0.4)
  }

  // Tiered umbrella canopies — the araucaria silhouette.
  for (let layer = 0; layer < layerCount; layer += 1) {
    const layerT      = (layer + 1) / layerCount
    const layerZ      = baseZ + trunkHeight * (0.32 + layerT * 0.62)
    const taper       = 1 - layerT * 0.55
    const branchLen   = (0.85 + rand() * 0.25) * scale * taper
    const canopyR     = branchLen * 0.36
    const droop       = -0.08 - rand() * 0.07
    const jitter      = (rand() - 0.5) * 0.22

    for (let b = 0; b < branchesPerLayer; b += 1) {
      const ang  = (b / branchesPerLayer) * Math.PI * 2 + layer * 0.42 + jitter
      const tipX = Math.cos(ang) * branchLen
      const tipY = Math.sin(ang) * branchLen
      const tipZ = layerZ + droop * branchLen

      seg(0, 0, layerZ, tipX, tipY, tipZ, 0.66)

      const segs = 6
      const ring: Array<[number, number, number]> = []
      for (let s = 0; s < segs; s += 1) {
        const sa = (s / segs) * Math.PI * 2 + ang
        ring.push([tipX + Math.cos(sa) * canopyR, tipY + Math.sin(sa) * canopyR, tipZ - 0.015 * scale])
      }
      for (let s = 0; s < segs; s += 1) {
        const [x1, y1, z1] = ring[s]
        const [x2, y2, z2] = ring[(s + 1) % segs]
        seg(x1 - cx, y1 - cy, z1, x2 - cx, y2 - cy, z2, 0.58)
      }
      for (let s = 0; s < segs; s += 2) {
        const [rx, ry, rz] = ring[s]
        seg(tipX, tipY, tipZ, rx - cx, ry - cy, rz - 0.04 * scale, 0.46)
      }
      seg(tipX, tipY, tipZ, tipX, tipY, tipZ - canopyR * 0.42, 0.34)
    }
  }

  // Apex tuft.
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2
    seg(0, 0, nearTopZ, Math.cos(a) * 0.08 * scale, Math.sin(a) * 0.08 * scale, apexZ, 0.6)
  }

  return { positions, colors }
}

function buildShrub(cx: number, cy: number, scale: number, seed: number) {
  const rand = makeSeededRandom(seed)
  const positions: number[] = []
  const colors: number[]    = []

  const baseZ  = terrainDisplacement(cx, cy, BASE_FIELD_DEPTH) + 0.01
  const blades = 6 + Math.floor(rand() * 4)
  const height = (0.22 + rand() * 0.14) * scale

  function seg(
    dx1: number, dy1: number, z1: number,
    dx2: number, dy2: number, z2: number,
    br: number,
  ) {
    positions.push(cx + dx1, cy + dy1, z1, cx + dx2, cy + dy2, z2)
    const intensity = br * TREE_LINE_SCALE
    colors.push(
      LINE_COLOR[0] * intensity, LINE_COLOR[1] * intensity, LINE_COLOR[2] * intensity,
      LINE_COLOR[0] * intensity, LINE_COLOR[1] * intensity, LINE_COLOR[2] * intensity,
    )
  }

  for (let b = 0; b < blades; b += 1) {
    const angle  = rand() * Math.PI * 2
    const lean   = 0.5 + rand() * 0.5
    const length = height * (0.7 + rand() * 0.7)
    const startX = (rand() - 0.5) * 0.16 * scale
    const startY = (rand() - 0.5) * 0.16 * scale
    const tipX   = startX + Math.cos(angle) * length * (1 - lean) * 1.3
    const tipY   = startY + Math.sin(angle) * length * (1 - lean) * 1.3
    const tipZ   = baseZ + length * lean
    seg(startX, startY, baseZ, tipX, tipY, tipZ, 0.45 + rand() * 0.4)
  }

  return { positions, colors }
}

// ── React component ──────────────────────────────────────────────────────────

export function ResearchWorld({
  // Defaults below are the CUBE framing (used when rendered behind the cube).
  // The standalone showcase overrides position/rotation via registry props.
  // Lowering position.y translates the whole scene down (= "raise the camera"),
  // so the swirl centre drops to sit behind the cube without reshaping the sky.
  position = [0, -8.5, -20],
  rotation = [-Math.PI / 2.2, 0, 0],
  paused = false,
}: WorldProps = {}) {
  const SHOW_VEGETATION = false
  const { size } = useThree()
  const aspect = Math.max(0.5, size.width / Math.max(1, size.height))
  const skyTrailRef = useRef<import('three').LineSegments>(null)
  const skyHeadRef = useRef<import('three').Points>(null)

  // Adapt mesh coverage for extreme aspect ratios (5K/ultrawide/portrait).
  const wideNorm = clamp01((aspect - 16 / 9) / (32 / 9 - 16 / 9))
  const tallNorm = clamp01((16 / 9 - aspect) / (16 / 9 - 9 / 16))
  const fieldWidth = BASE_FIELD_WIDTH * (1 + wideNorm * 0.72 + tallNorm * 0.62)
  const fieldDepth = BASE_FIELD_DEPTH * (1 + wideNorm * 0.16 + tallNorm * 0.22)
  const fieldCols = Math.round(BASE_FIELD_COLS * (1 + wideNorm * 0.42 + tallNorm * 0.28))
  const fieldRows = Math.round(BASE_FIELD_ROWS * (1 + wideNorm * 0.14 + tallNorm * 0.12))
  const displacement = useMemo(
    () => (x: number, y: number, t: number) => terrainDisplacement(x, y, fieldDepth, t),
    [fieldDepth],
  )
  const cordilleraData = useMemo(() => buildCordilleraLines(fieldWidth, fieldDepth), [fieldWidth, fieldDepth])
  const foothillTreesData = useMemo(() => buildFoothillTreeBands(fieldWidth, fieldDepth), [fieldWidth, fieldDepth])
  const skyStars = useMemo(() => buildSkyStars(fieldWidth, fieldDepth), [fieldWidth, fieldDepth])
  const skyInfluenceGeometry = useMemo(() => buildSkyInfluenceGeometry(fieldWidth), [fieldWidth])
  const mountainOccluderGeometry = useMemo(
    () => buildMountainOccluderGeometry(cordilleraData.positions),
    [cordilleraData],
  )
  const terrainOccluderGeometry = useMemo(() => {
    const colCount = Math.max(10, Math.floor(fieldCols * 0.6))
    const rowCount = Math.max(10, Math.floor(fieldRows * 0.6))
    const occluderWidth = fieldWidth * 1.6
    const yMin = -fieldDepth * TERRAIN_OCCLUDER_NEAR_DEPTH
    const yMax = fieldDepth * TERRAIN_OCCLUDER_FAR_DEPTH
    const vertexCount = colCount * rowCount
    const positions = new Float32Array(vertexCount * 3)
    const indices: number[] = []

    for (let row = 0; row < rowCount; row += 1) {
      const v = row / (rowCount - 1)
      const y = yMin + v * (yMax - yMin)
      for (let col = 0; col < colCount; col += 1) {
        const u = col / (colCount - 1)
        const x = -occluderWidth * 0.5 + u * occluderWidth
        const z = displacement(x, y, 0)
        const idx = row * colCount + col
        const base = idx * 3
        positions[base] = x
        positions[base + 1] = y
        positions[base + 2] = z
      }
    }

    for (let row = 0; row < rowCount - 1; row += 1) {
      for (let col = 0; col < colCount - 1; col += 1) {
        const a = row * colCount + col
        const b = a + 1
        const c = a + colCount
        const d = c + 1
        indices.push(a, c, b)
        indices.push(b, c, d)
      }
    }

    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setIndex(indices)
    return g
  }, [fieldCols, fieldRows, fieldWidth, fieldDepth, displacement])

  const treesData = useMemo(() => {
    const positions: number[] = []
    const colors: number[]    = []
    for (const [x, y, s, layers, branches, seed] of ARAUCARIAS) {
      const tree = buildAraucaria(x, y, s, layers, branches, seed)
      positions.push(...tree.positions)
      colors.push(...tree.colors)
    }
    return { positions: new Float32Array(positions), colors: new Float32Array(colors) }
  }, [])

  const shrubsData = useMemo(() => {
    const positions: number[] = []
    const colors: number[]    = []
    const rand = makeSeededRandom(0xd1f17b3)
    for (let i = 0; i < 60; i += 1) {
      const x    = (rand() - 0.5) * 34
      const y    = -19 + rand() * 16          // local Y: near → mid
      const s    = 0.7 + rand() * 0.5
      const shrub = buildShrub(x, y, s, Math.floor(rand() * 0xffff))
      positions.push(...shrub.positions)
      colors.push(...shrub.colors)
    }
    return { positions: new Float32Array(positions), colors: new Float32Array(colors) }
  }, [])

  const treesGeometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(treesData.positions, 3))
    g.setAttribute('color',    new BufferAttribute(treesData.colors, 3))
    return g
  }, [treesData])

  const shrubsGeometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(shrubsData.positions, 3))
    g.setAttribute('color',    new BufferAttribute(shrubsData.colors, 3))
    return g
  }, [shrubsData])
  const cordilleraGeometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(cordilleraData.positions, 3))
    g.setAttribute('color', new BufferAttribute(cordilleraData.colors, 3))
    return g
  }, [cordilleraData])
  const foothillTreesGeometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(foothillTreesData.positions, 3))
    g.setAttribute('color', new BufferAttribute(foothillTreesData.colors, 3))
    return g
  }, [foothillTreesData])
  // Trail geometry: each star → (SEG-1) line segments, rebuilt every frame.
  const skyTrailGeometry = useMemo(() => {
    const g = new BufferGeometry()
    const vertCount = skyStars.stars.length * (SKY_TRAIL_SEGMENTS - 1) * 2
    g.setAttribute('position', new BufferAttribute(new Float32Array(vertCount * 3), 3))
    g.setAttribute('color', new BufferAttribute(new Float32Array(vertCount * 3), 3))
    return g
  }, [skyStars])

  // Head geometry: one point per star, with a static per-vertex size attribute.
  const skyHeadGeometry = useMemo(() => {
    const n = skyStars.stars.length
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3))
    g.setAttribute('aColor', new BufferAttribute(new Float32Array(n * 3), 3))
    const sizes = new Float32Array(n)
    for (let i = 0; i < n; i += 1) sizes[i] = skyStars.stars[i].size
    g.setAttribute('aSize', new BufferAttribute(sizes, 1))
    return g
  }, [skyStars])

  const vegMaterial = useMemo(
    () => createVectorLineMaterial({ fog: true, depthTest: true, depthWrite: false }),
    [],
  )
  // fog:false so the cube scene's aggressive fog (far ≈ 26) doesn't erase these
  // distant elements — research lives much deeper than the cube's fog range, and
  // aerial perspective is carried by per-layer intensity instead of fog.
  const cordilleraMaterial = useMemo(
    () => createVectorLineMaterial({ fog: false, depthTest: true, depthWrite: false }),
    [],
  )
  const foothillTreesMaterial = useMemo(
    () => createVectorLineMaterial({ fog: false, depthTest: true, depthWrite: false }),
    [],
  )
  const skyTrailMaterial = useMemo(() => {
    // depthTest:true so the opaque cube (which writes depth in the opaque pass)
    // occludes the trails in the transparent pass — otherwise they paint over it.
    const material = createVectorLineMaterial({ fog: false, depthTest: true, depthWrite: false })
    material.stencilWrite = true
    material.stencilRef = 1
    material.stencilFunc = NotEqualStencilFunc
    material.stencilFail = KeepStencilOp
    material.stencilZFail = KeepStencilOp
    material.stencilZPass = KeepStencilOp
    return material
  }, [])

  const dotTexture = useMemo(() => createDotTexture(), [])
  const hazeTexture = useMemo(() => createHorizonGlowTexture(), [])
  const skyHeadMaterial = useMemo(() => {
    const pixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1
    const material = new ShaderMaterial({
      vertexShader: STAR_HEAD_VERT,
      fragmentShader: STAR_HEAD_FRAG,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uMap: { value: dotTexture },
        uPixelRatio: { value: pixelRatio },
      },
    })
    material.stencilWrite = true
    material.stencilRef = 1
    material.stencilFunc = NotEqualStencilFunc
    material.stencilFail = KeepStencilOp
    material.stencilZFail = KeepStencilOp
    material.stencilZPass = KeepStencilOp
    return material
  }, [dotTexture])

  useFrame(({ clock }) => {
    if (paused) return
    const trailObj = skyTrailRef.current
    const headObj = skyHeadRef.current
    if (!trailObj || !headObj) return

    const elapsed = clock.getElapsedTime()
    // Intro: stars fade in from black, hold as static points for a few seconds,
    // then the spin + trail build-up begins (spin clock starts after the hold).
    const fadeIn = clamp01(elapsed / SKY_FADE_IN)
    const spinTime = Math.max(0, elapsed - SKY_INTRO_HOLD)
    // Trail length eases 0 → Lmax over the build-up, then holds (settles to spin).
    const buildT = clamp01(spinTime / SKY_BUILD_DURATION)
    const ease = buildT * buildT * (3 - 2 * buildT)
    const trailLen = ease * SKY_TRAIL_LMAX
    const headPhase = spinTime * SKY_OMEGA * SKY_SPIN_DIR

    const trailPos = trailObj.geometry.attributes.position.array as Float32Array
    const trailCol = trailObj.geometry.attributes.color.array as Float32Array
    const headPos = headObj.geometry.attributes.position.array as Float32Array
    const headCol = headObj.geometry.attributes.aColor.array as Float32Array

    const stars = skyStars.stars
    let vi = 0
    for (let i = 0; i < stars.length; i += 1) {
      const st = stars[i]
      const headA = st.theta0 + headPhase
      // Tail trails BEHIND the head relative to spin direction (the star's past
      // positions), so the streak always follows the motion, never leads it.
      const tailA = headA - SKY_SPIN_DIR * trailLen

      // Head (current star position) — bright point.
      const hx = Math.cos(headA) * st.r
      const hz = Math.sin(headA) * st.r * SKY_FLATTEN
      headPos[i * 3] = hx
      headPos[i * 3 + 1] = 0
      headPos[i * 3 + 2] = hz
      const headBright = st.bright * fadeIn * SKY_HEAD_INTENSITY
      headCol[i * 3] = LINE_COLOR[0] * headBright
      headCol[i * 3 + 1] = LINE_COLOR[1] * headBright
      headCol[i * 3 + 2] = LINE_COLOR[2] * headBright

      // Trail — arc from tail (dim) to head (bright).
      let prevX = 0
      let prevZ = 0
      let prevI = 0
      for (let s = 0; s < SKY_TRAIL_SEGMENTS; s += 1) {
        const u = s / (SKY_TRAIL_SEGMENTS - 1)
        const a = tailA + (headA - tailA) * u
        const px = Math.cos(a) * st.r
        const pz = Math.sin(a) * st.r * SKY_FLATTEN
        const inten = st.bright * (0.05 + 0.95 * u) * SKY_TRAIL_INTENSITY * fadeIn
        if (s > 0) {
          trailPos[vi] = prevX
          trailPos[vi + 1] = 0
          trailPos[vi + 2] = prevZ
          trailPos[vi + 3] = px
          trailPos[vi + 4] = 0
          trailPos[vi + 5] = pz
          trailCol[vi] = LINE_COLOR[0] * prevI
          trailCol[vi + 1] = LINE_COLOR[1] * prevI
          trailCol[vi + 2] = LINE_COLOR[2] * prevI
          trailCol[vi + 3] = LINE_COLOR[0] * inten
          trailCol[vi + 4] = LINE_COLOR[1] * inten
          trailCol[vi + 5] = LINE_COLOR[2] * inten
          vi += 6
        }
        prevX = px
        prevZ = pz
        prevI = inten
      }
    }

    trailObj.geometry.attributes.position.needsUpdate = true
    trailObj.geometry.attributes.color.needsUpdate = true
    headObj.geometry.attributes.position.needsUpdate = true
    headObj.geometry.attributes.aColor.needsUpdate = true
  })

  return (
    <group position={position as [number, number, number]} rotation={rotation as [number, number, number]}>
      {/* Stencil mask writer for the mountain silhouette (no visible color output). */}
      <mesh geometry={mountainOccluderGeometry} renderOrder={-50}>
        <meshBasicMaterial
          colorWrite={false}
          depthTest={false}
          depthWrite={false}
          side={DoubleSide}
          stencilWrite
          stencilRef={1}
          stencilFunc={AlwaysStencilFunc}
          stencilFail={ReplaceStencilOp}
          stencilZFail={ReplaceStencilOp}
          stencilZPass={ReplaceStencilOp}
        />
      </mesh>
      {/* Stencil mask writer for the terrain band (no visible color output). */}
      <mesh geometry={terrainOccluderGeometry} renderOrder={-45}>
        <meshBasicMaterial
          colorWrite={false}
          depthTest={false}
          depthWrite={false}
          side={DoubleSide}
          stencilWrite
          stencilRef={1}
          stencilFunc={AlwaysStencilFunc}
          stencilFail={ReplaceStencilOp}
          stencilZFail={ReplaceStencilOp}
          stencilZPass={ReplaceStencilOp}
        />
      </mesh>
      <group position={skyStars.pole as [number, number, number]} renderOrder={-40}>
        <lineSegments ref={skyTrailRef} geometry={skyTrailGeometry} material={skyTrailMaterial} />
        <points ref={skyHeadRef} geometry={skyHeadGeometry} material={skyHeadMaterial} />
      </group>
      {/* Atmospheric haze: a soft violet glow seated at the mountain horizon.
          Stencil-masked so the ranges clip its base — a gradient, never a wall. */}
      <mesh
        position={[0, fieldDepth * 0.2, BASE_Z + 5.5]}
        rotation={[Math.PI / 2.1, 0, 0]}
        renderOrder={-38}
      >
        <planeGeometry args={[fieldWidth * 1.1, 16]} />
        <meshBasicMaterial
          map={hazeTexture}
          transparent
          opacity={0.16}
          depthTest
          depthWrite={false}
          fog={false}
          blending={AdditiveBlending}
          toneMapped={false}
          stencilWrite
          stencilRef={1}
          stencilFunc={NotEqualStencilFunc}
          stencilFail={KeepStencilOp}
          stencilZFail={KeepStencilOp}
          stencilZPass={KeepStencilOp}
        />
      </mesh>
      {DEBUG_SKY_INFLUENCE && (
        <group position={skyStars.pole as [number, number, number]}>
          <mesh geometry={skyInfluenceGeometry} renderOrder={40}>
            <meshBasicMaterial
              color="#00d5ff"
              depthTest={false}
              depthWrite={false}
              opacity={0.13}
              side={DoubleSide}
              transparent
            />
          </mesh>
        </group>
      )}
      <group renderOrder={10}>
        {/* Plexus base — same grid, same points, same line logic as agenticWorld */}
        <VectorPlexusField
          displacement={displacement}
          animated={false}
          width={fieldWidth}
          depth={fieldDepth}
          cols={fieldCols}
          rows={fieldRows}
          cellScaleNear={2.15}
          cellScaleFar={0.58}
          cellScaleCurve={1.48}
          depthScaleNear={1.88}
          depthScaleFar={0.68}
          horizonGlow
          horizonGlowOpacity={0.06}
          parallax={false}
        />
        <lineSegments geometry={cordilleraGeometry} material={cordilleraMaterial} />
        <lineSegments geometry={foothillTreesGeometry} material={foothillTreesMaterial} />
        {/* Vegetation kept disabled while composition/terrain base is being tuned. */}
        {SHOW_VEGETATION && (
          <>
            <lineSegments geometry={treesGeometry} material={vegMaterial} />
            <lineSegments geometry={shrubsGeometry} material={vegMaterial} />
          </>
        )}
      </group>
      {DEBUG_OCCLUDER_MASK && (
        <>
          <mesh geometry={mountainOccluderGeometry} renderOrder={60}>
            <meshBasicMaterial
              color="#ff2bd6"
              depthTest={false}
              depthWrite={false}
              opacity={0.34}
              side={DoubleSide}
              stencilWrite={false}
              transparent
            />
          </mesh>
          <mesh geometry={terrainOccluderGeometry} renderOrder={61}>
            <meshBasicMaterial
              color="#00ff9d"
              depthTest={false}
              depthWrite={false}
              opacity={0.24}
              side={DoubleSide}
              stencilWrite={false}
              transparent
            />
          </mesh>
        </>
      )}
    </group>
  )
}
