import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  EdgesGeometry,
  InstancedBufferAttribute,
  type InstancedMesh,
  LineBasicMaterial,
  Object3D,
  PointsMaterial,
  ShaderMaterial,
} from 'three'
import { createVectorLineMaterial } from '../base/materials'
import { createDotTexture, createGlowTexture, makeSeededRandom } from '../base/textures'
import { VECTOR_WORLD_THEME } from '../base/theme'
import type { WorldProps } from '../types'

type ProductBox = {
  id: string
  grid: [number, number]
  position: [number, number, number]
  edgeOpacity: number
  faceOpacity: number
  // Retained for type stability; the field is now flat so every box is on the
  // same base plane (BASE_LAYER_INDEX). Not used for rendering.
  visualLayer: number
  floatPhase: number // radians — desyncs the breathing per cube
  floatAmp: number // amplitude of the Y breathing (≤ 3% of BOX_SIZE)
  scaleBias: number // small per-cube scale (0.92..1.06) reinforcing layer reads
  corePulsePhase: number // radians — desyncs the active-cube core pulse
}

// Vector wireframe modules on an obsidian field — line-first, to sit in the same
// family as `agentic`, `systems` and `research`. The box reads by its edges
// (front lines crisp, back lines much fainter), with whisper-thin faces, discreet
// corner nodes, dashed connector beams, and slow light packets. No glass, no
// volumetric halos, no luminous core orb — state changes are shifts in line
// intensity, not materiality.
const BOX_SIZE = 1.4
const GRID_COLS = 9
const GRID_ROWS = 8
const GRID_GAP_X = 4.0 // doubled spacing — airy field like the reference
const GRID_GAP_Z = 3.8
const FLOOR_Y = -0.42
const FRONT_Z = 5.5

const PACKET_COUNT = 2 // only two rays — avoids saturating the field
const TRAVEL_DUR = 1.4 // seconds per hop — slow continuous flow between boxes
const ATTACK_TAU = 0.12 // box-glow attack — smooths the light turning on (no pop)
const TRAIL_LEN = 1200 // frames of head-position history → long diffusing ray
const ENTER = 0.18 // fraction of a hop the head spends INSIDE a box (routing visit window)
const AVOID_SEC = 4 // a neighbour visited within this many seconds is "recent" — skip it
const DUST_COUNT = 360 // floating atmospheric sparkles

// Cube illumination by head proximity — a box lights ONLY when the head actually
// reaches it (no anticipation): faint as the ray touches the box, peaking at the
// centre where the packet is deflected, then fading as a short trail.
const GLOW_TOUCH_RADIUS = 1.0 // distance from a box centre at which it begins to light (≈ surface)
const GLOW_TOUCH_POWER = 1.6 // higher = sharper centre peak (dimmer touch, brighter centre)
const GLOW_TRAIL_TAU = 3.0 // s — how long a transited box keeps fading after the head leaves

// Flat field — every module sits on the same base plane at a uniform height.
// (The old 2.5D riser/sink layers were removed so the grid reads as an ordered,
// level array of modules.) Breathing still desyncs a tiny Y oscillation per cube.
const BASE_LAYER_INDEX = 0

// Breathing — pure sinusoid, never coherent across cubes. Amplitude stays
// below ~3% of BOX_SIZE so the field never reads as bouncy.
const FLOAT_OMEGA = 0.55 // rad/s → one cycle every ~11s
const FLOAT_AMP_MIN = 0.018
const FLOAT_AMP_MAX = 0.04

// Packet hop arc — disabled. The light travels in a perfectly straight line
// between cube centres. (The old parabolic lift only made sense with the 2.5D
// riser/sunken layers; on the flat field it was a pointless constant curve.)
const PACKET_ARC_BASE = 0
const PACKET_ARC_DELTA_GAIN = 0

// Connection lines between 2D neighbours — show the modular graph without
// adding 3D edges. Resting baseline is barely visible; a connection only
// brightens once BOTH its boxes are glowing (the path just travelled, behind
// the light). There is deliberately NO active-hop boost — nothing should point
// at the next cube before the light reaches it.
const CONNECTION_RESTING = 0.045 // baseline brightness on the resting graph
const CONNECTION_GLOW_GAIN = 0.7 // multiplier on min(glow[a], glow[b])

// Whisper face shader — the faces are NOT a protagonist. No fresnel rim, no
// glass volume, no silhouette flood. Just a near-invisible constant violet body
// that hints at solidity so the wireframe doesn't read as fully hollow, plus a
// faint inner fill when a packet passes. The cube must read by its edges.
const FACE_VERT = /* glsl */ `
  attribute float aGlow;
  varying float vGlow;
  void main() {
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vGlow = aGlow;
    gl_Position = projectionMatrix * mvPosition;
  }
`
const FACE_FRAG = /* glsl */ `
  uniform vec3 uColor;   // violet — faint inner fill when a packet passes
  uniform vec3 uTint;    // dark violet body whisper
  varying float vGlow;
  void main() {
    // Constant whisper body + a tiny glow response. Everything here is
    // sub-perceptual on its own — it only keeps the module from reading as an
    // empty cage. All form comes from the edge lines, not these planes.
    vec3 body = uTint * 0.012;
    vec3 fill = uColor * (vGlow * 0.05);
    gl_FragColor = vec4(body + fill, 1.0);
  }
`

// Dark violet whisper applied to every cube face — barely-there body, never a
// glass tint.
const FACE_TINT: readonly [number, number, number] = [0.30, 0.20, 0.78]

// 4 in-plane directions. Z grows toward the camera, so row+1 moves away.
const OPPOSITE = [1, 0, 3, 2] as const
const DIR_DELTA: ReadonlyArray<readonly [number, number]> = [
  [0, -1], // 0 LEFT
  [0, 1], // 1 RIGHT
  [-1, 0], // 2 NEAR (toward camera)
  [1, 0], // 3 FAR (away)
]

const V = VECTOR_WORLD_THEME.lineColorRgb
// Soft violet core for the laser-beam packet dots. Kept well below the previous
// near-white over-exposure so the travelling ray reads as a quiet accent and no
// longer competes with the side-panel content for attention.
const BEAM_GLOW: readonly [number, number, number] = [0.7, 0.62, 0.88]
const FACE_GLOW = 0.55 // feeds aGlow → tiny inner fill in the whisper shader
const EDGE_BOTTOM = 0.32 // how much the bottom edges keep vs the brighter top (gradient)

// Edge palette — the cube IS its wireframe. Dark violet at rest, lighter lila
// when active, but never approaching white (white belongs to the packet head
// only). Active reads as an *emphasised line*, not a lit material.
const EDGE_FRONT_IDLE: readonly [number, number, number] = [0.34, 0.22, 0.86] // dark violet
const EDGE_ACTIVE: readonly [number, number, number] = [0.62, 0.50, 1.0] // emphasised lila, still violet
// Front/back hierarchy — back vertices fall to 18% of front intensity, so the
// module reads as a solid seen in perspective, not a uniform cage.
const EDGE_BACK_FACTOR = 0.18
const EDGE_FRONT_FACTOR = 1.0
// Active multiplier — kept modest so active edges brighten as lines without
// crossing into "luminous material" territory.
const EDGE_ACTIVE_GAIN = 0.85

// Corner nodes — discreet technical points ("construction nodes"), not magic
// glints. A single crisp dot per vertex, faint at rest, slightly stronger when
// active. No glow halo behind them.
const CORNER_BASE_COL: readonly [number, number, number] = [0.52, 0.38, 0.95]
const CORNER_ACTIVE_COL: readonly [number, number, number] = [0.66, 0.54, 1.0]
const CORNER_IDLE_GAIN = 0.18
const CORNER_ACTIVE_GAIN = 0.7

// Unit-box corner offsets (×BOX_SIZE/2) for the crystal corner glints.
const CORNER_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, -1, 1],
  [-1, -1, 1],
  [-1, 1, -1],
  [1, 1, -1],
  [1, 1, 1],
  [-1, 1, 1],
]

type Packet = {
  current: number
  next: number
  dir: number // direction current -> next
  entryFace: number // face the packet entered `current` through (-1 = spawn)
  t: number // 0..1 progress along the current hop
  travelDur: number
}

type Sim = {
  rand: () => number
  glow: Float32Array // displayed brightness per box
  lastVisit: Float32Array // clock time (s) the head was last INSIDE each box (-big = never)
  breath: Float32Array // per-frame Y offset (subtle breathing) per box
  packets: Packet[]
  hist: Float32Array // per-packet ring buffer of head positions (the long ray)
  histHead: Int32Array
  dummy: Object3D
  color: Color
}

// Fill a packet's whole position history with one point (collapsed trail) — used
// at spawn and respawn so the ray grows out from the new origin instead of
// snapping a long line across the field.
function resetHistory(sim: Sim, idx: number, pos: readonly [number, number, number]) {
  const base = idx * TRAIL_LEN * 3
  for (let k = 0; k < TRAIL_LEN; k += 1) {
    sim.hist[base + k * 3] = pos[0]
    sim.hist[base + k * 3 + 1] = pos[1]
    sim.hist[base + k * 3 + 2] = pos[2]
  }
  sim.histHead[idx] = 0
}

function createSim(boxes: ProductBox[], borderIndices: number[], neighbours: Int32Array): Sim {
  const rand = makeSeededRandom(0x9b07c1d)
  const boxCount = boxes.length
  const glow = new Float32Array(boxCount)
  const lastVisit = new Float32Array(boxCount).fill(-1000)
  const breath = new Float32Array(boxCount)
  const sim: Sim = {
    rand,
    glow,
    lastVisit,
    breath,
    packets: Array.from({ length: PACKET_COUNT }, () =>
      spawnPacket(borderIndices, neighbours, rand, lastVisit, 0),
    ),
    hist: new Float32Array(PACKET_COUNT * TRAIL_LEN * 3),
    histHead: new Int32Array(PACKET_COUNT),
    dummy: new Object3D(),
    color: new Color(),
  }
  sim.packets.forEach((p, idx) => resetHistory(sim, idx, boxes[p.current].position))
  return sim
}

// Stable per-cell hash → [0, 1). Same `(row, col, seed)` always yields the
// same value, so the 2.5D layout and breathing pattern are deterministic
// across reloads (no Math.random at runtime).
function hashCell(row: number, col: number, seed: number) {
  let h = (seed ^ Math.imul(row + 0x9e3779b9, 0x85ebca6b)) | 0
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  h = (h ^ Math.imul(col + 0x27d4eb2f, 0x165667b1)) | 0
  h ^= h >>> 15
  return ((h >>> 0) % 1_000_003) / 1_000_003
}

// Single-cube sandbox — reads `?cube=solo` once at startup. When active, the
// world renders ONE big cube at the origin with no packets, no field, no
// connections, no floor; keyboard 1/3 toggles between idle and active states.
// Used to calibrate cube layers in isolation without fighting the rest of the
// scene. Development only: the published site has no such address.
function readSoloMode() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('cube') === 'solo'
}

const SOLO_SCALE = 3.2

function buildSoloBox(): ProductBox[] {
  const baseY = FLOOR_Y + BOX_SIZE * 0.5 + 0.12
  return [
    {
      id: 'solo',
      grid: [0, 0],
      position: [0, baseY, 0],
      edgeOpacity: 0.42,
      faceOpacity: 0.06,
      visualLayer: BASE_LAYER_INDEX,
      floatPhase: 0,
      floatAmp: 0, // no breathing in the sandbox — pure manual control
      scaleBias: SOLO_SCALE,
      corePulsePhase: 0,
    },
  ]
}

function buildProductBoxes() {
  const boxes: ProductBox[] = []
  const midCol = (GRID_COLS - 1) / 2
  const baseYFloor = FLOOR_Y + BOX_SIZE * 0.5 + 0.12

  for (let row = 0; row < GRID_ROWS; row += 1) {
    const rowNorm = row / Math.max(1, GRID_ROWS - 1)
    const depthOpacity = 1 - rowNorm * 0.62

    for (let col = 0; col < GRID_COLS; col += 1) {
      const colNorm = Math.abs(col - midCol) / midCol
      const baseX = (col - midCol) * GRID_GAP_X
      const baseZ = FRONT_Z - row * GRID_GAP_Z

      const edgeBoost = row < 3 || colNorm > 0.8 ? 0.06 : 0

      const phaseHash = hashCell(row, col, 0x2c1f93)
      const ampHash = hashCell(row, col, 0x1a91d6)
      const pulseHash = hashCell(row, col, 0x7a3b91)

      boxes.push({
        id: `${row}-${col}`,
        grid: [row, col],
        // Uniform height — all modules on the same base plane (flat field).
        position: [baseX, baseYFloor, baseZ],
        edgeOpacity: Math.max(0.14, 0.24 * depthOpacity + edgeBoost),
        faceOpacity: Math.max(0.02, 0.05 * depthOpacity),
        visualLayer: BASE_LAYER_INDEX,
        floatPhase: phaseHash * Math.PI * 2,
        floatAmp: FLOAT_AMP_MIN + ampHash * (FLOAT_AMP_MAX - FLOAT_AMP_MIN),
        scaleBias: 1,
        corePulsePhase: pulseHash * Math.PI * 2,
      })
    }
  }

  return boxes
}

// Neighbour table: 4 entries per box, each a box index or -1 (off-grid).
function buildNeighbours(boxes: ProductBox[]) {
  const index = new Map<string, number>()
  boxes.forEach((box, i) => index.set(`${box.grid[0]}-${box.grid[1]}`, i))

  const neighbours = new Int32Array(boxes.length * 4).fill(-1)
  boxes.forEach((box, i) => {
    const [row, col] = box.grid
    for (let d = 0; d < 4; d += 1) {
      const key = `${row + DIR_DELTA[d][0]}-${col + DIR_DELTA[d][1]}`
      const found = index.get(key)
      if (found !== undefined) neighbours[i * 4 + d] = found
    }
  })
  return neighbours
}

// Pick a random valid exit, excluding the entry face (no going back the way in).
// Prefers a neighbour the ray has NOT visited recently, so it spreads into the
// dark. "Recent" is a fixed frame window — independent of how long boxes stay
// lit — so a long glow tail never traps the packet in its own trail.
function pickNext(
  neighbours: Int32Array,
  from: number,
  entryFace: number,
  rand: () => number,
  lastVisit: Float32Array,
  now: number,
): { dir: number; to: number } | null {
  const valid: number[] = []
  const fresh: number[] = []
  for (let d = 0; d < 4; d += 1) {
    if (d === entryFace) continue
    const to = neighbours[from * 4 + d]
    if (to < 0) continue
    valid.push(d)
    if (now - lastVisit[to] >= AVOID_SEC) fresh.push(d)
  }
  const pool = fresh.length > 0 ? fresh : valid
  if (pool.length === 0) return null
  const dir = pool[Math.floor(rand() * pool.length)]
  return { dir, to: neighbours[from * 4 + dir] }
}

function spawnPacket(
  borderIndices: number[],
  neighbours: Int32Array,
  rand: () => number,
  lastVisit: Float32Array,
  now: number,
): Packet {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const current = borderIndices[Math.floor(rand() * borderIndices.length)]
    const pick = pickNext(neighbours, current, -1, rand, lastVisit, now)
    if (pick) {
      return {
        current,
        next: pick.to,
        dir: pick.dir,
        entryFace: -1,
        t: rand() * 0.4, // desync packets so they don't pulse in lockstep
        travelDur: TRAVEL_DUR * (0.85 + rand() * 0.4),
      }
    }
  }
  // Fallback (should never happen on a 2D grid): sit on the first box.
  return {
    current: 0,
    next: neighbours[1] >= 0 ? neighbours[1] : 0,
    dir: 1,
    entryFace: -1,
    t: 0,
    travelDur: TRAVEL_DUR,
  }
}

function pushDashedLine(
  positions: number[],
  from: [number, number, number],
  to: [number, number, number],
  dashLength = 0.12,
  gapLength = 0.16,
) {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const dz = to[2] - from[2]
  const length = Math.hypot(dx, dy, dz)
  if (length <= 0.001) return

  const ux = dx / length
  const uy = dy / length
  const uz = dz / length
  const stride = dashLength + gapLength

  for (let d = 0; d < length; d += stride) {
    const start = d
    const end = Math.min(length, d + dashLength)
    positions.push(
      from[0] + ux * start,
      from[1] + uy * start,
      from[2] + uz * start,
      from[0] + ux * end,
      from[1] + uy * end,
      from[2] + uz * end,
    )
  }
}

// Lift a box's glow toward a head's proximity (max, never sum). The touch ramps
// from 0 at GLOW_TOUCH_RADIUS to 1 at the box centre, so the box reads faint as
// the ray reaches it and brightest at the centre where the packet deflects.
function exciteHead(
  glow: Float32Array,
  boxes: ProductBox[],
  idx: number,
  hx: number,
  hy: number,
  hz: number,
) {
  const c = boxes[idx].position
  const dx = c[0] - hx
  const dy = c[1] - hy
  const dz = c[2] - hz
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (dist >= GLOW_TOUCH_RADIUS) return
  const t = Math.pow(1 - dist / GLOW_TOUCH_RADIUS, GLOW_TOUCH_POWER)
  if (t > glow[idx]) glow[idx] = t
}

function buildFloorGridGeometry() {
  const positions: number[] = []
  const width = (GRID_COLS + 2.2) * GRID_GAP_X
  const backZ = FRONT_Z - (GRID_ROWS - 1) * GRID_GAP_Z - GRID_GAP_Z * 1.15
  const left = -width * 0.5
  const right = width * 0.5

  for (let row = 0; row < GRID_ROWS + 2; row += 1) {
    const z = FRONT_Z + GRID_GAP_Z * 0.86 - row * GRID_GAP_Z
    pushDashedLine(positions, [left, FLOOR_Y, z], [right, FLOOR_Y, z])
  }

  for (let col = 0; col < GRID_COLS + 2; col += 1) {
    const x = left + col * GRID_GAP_X
    pushDashedLine(positions, [x, FLOOR_Y, FRONT_Z + GRID_GAP_Z * 0.86], [x, FLOOR_Y, backZ])
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  return geometry
}

function buildNodeGeometry() {
  const positions: number[] = []
  const width = (GRID_COLS + 1.5) * GRID_GAP_X
  const left = -width * 0.5

  for (let row = 0; row < GRID_ROWS + 2; row += 1) {
    const z = FRONT_Z + GRID_GAP_Z * 0.86 - row * GRID_GAP_Z
    for (let col = 0; col < GRID_COLS + 2; col += 1) {
      positions.push(left + col * GRID_GAP_X, FLOOR_Y + 0.015, z)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  return geometry
}

// Atmospheric dust: fine sparkles scattered through the volume, with per-point
// brightness variation baked in (static — calm, cheap, reads as depth haze).
function buildDustGeometry() {
  const rand = makeSeededRandom(0x1d0571)
  const width = GRID_COLS * GRID_GAP_X
  const backZ = FRONT_Z - GRID_ROWS * GRID_GAP_Z
  const positions = new Float32Array(DUST_COUNT * 3)
  const colors = new Float32Array(DUST_COUNT * 3)
  for (let i = 0; i < DUST_COUNT; i += 1) {
    positions[i * 3] = (rand() - 0.5) * width * 1.1
    positions[i * 3 + 1] = FLOOR_Y + 0.1 + rand() * 3.4
    positions[i * 3 + 2] = backZ + rand() * (FRONT_Z - backZ + 2.5)
    const b = 0.1 + rand() * rand() * 0.55 // mostly faint, a few brighter
    colors[i * 3] = V[0] * b + b * 0.25
    colors[i * 3 + 1] = V[1] * b + b * 0.2
    colors[i * 3 + 2] = V[2] * b + b * 0.3
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

export function ProductsWorld({
  // Embedded defaults (cube experience). Tuned so the field reads as a deep,
  // FULL array of modules behind the cube — scaled down and pulled back so many
  // cubes fill the frame and recede with perspective, instead of a few large
  // cubes leaving empty corners. (The ?bg=products showcase overrides these.)
  position = [0, -0.55, -3.5],
  rotation = [0.3, -0.22, 0],
  scale = 0.55,
  paused = false,
}: WorldProps = {}) {
  const soloMode = useMemo(() => readSoloMode(), [])
  const [soloState, setSoloState] = useState<'idle' | 'active'>('idle')

  useEffect(() => {
    if (!soloMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1') setSoloState('idle')
      else if (e.key === '3') setSoloState('active')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [soloMode])

  const boxes = useMemo(() => (soloMode ? buildSoloBox() : buildProductBoxes()), [soloMode])
  const neighbours = useMemo(() => buildNeighbours(boxes), [boxes])
  const borderIndices = useMemo(
    () =>
      boxes.reduce<number[]>((acc, box, i) => {
        const [r, c] = box.grid
        if (r === 0 || r === GRID_ROWS - 1 || c === 0 || c === GRID_COLS - 1) acc.push(i)
        return acc
      }, []),
    [boxes],
  )

  const cubeGeometry = useMemo(() => {
    const g = new BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE)
    g.setAttribute('aGlow', new InstancedBufferAttribute(new Float32Array(boxes.length), 1))
    return g
  }, [boxes.length])
  const floorGridGeometry = useMemo(() => buildFloorGridGeometry(), [])
  const nodeGeometry = useMemo(() => buildNodeGeometry(), [])
  const dustGeometry = useMemo(() => buildDustGeometry(), [])

  const dotTexture = useMemo(() => createDotTexture(), [])
  const glowTexture = useMemo(() => createGlowTexture(), [])

  const nodeMaterial = useMemo(
    () =>
      new PointsMaterial({
        color: VECTOR_WORLD_THEME.particleColor,
        size: 0.05,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  const dustMaterial = useMemo(
    () =>
      new PointsMaterial({
        map: dotTexture,
        vertexColors: true,
        size: 0.07,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        sizeAttenuation: true,
        toneMapped: false,
      }),
    [dotTexture],
  )

  // Per-box edge geometry baked into one buffer with a live colour attribute.
  // `vmul` carries a vertical gradient (top edges bright, bottom edges dim) so
  // the cubes read like backlit glass instead of uniform wireframes.
  const edgeGeometry = useMemo(() => {
    const unit = new EdgesGeometry(cubeGeometry)
    const unitPos = unit.getAttribute('position').array as ArrayLike<number>
    const stride = unitPos.length
    const vertsPerBox = stride / 3
    const positions = new Float32Array(boxes.length * stride)
    const basePositions = new Float32Array(boxes.length * stride)
    const vmul = new Float32Array(boxes.length * vertsPerBox)
    // Per-vertex frontness in [0, 1] — baked from the sign pattern of the
    // corner in box-local space. (+,+,+) corner reads as front-most, (-,-,-)
    // as back-most. Works because the showcase rotation has all three local
    // axes contributing similarly to the view direction (all dot ~0.6 with
    // camera dir). No shader required.
    const aFrontness = new Float32Array(boxes.length * vertsPerBox)
    boxes.forEach((box, i) => {
      const off = i * stride
      const s = box.scaleBias
      for (let v = 0; v < stride; v += 3) {
        const lx = unitPos[v]
        const ly = unitPos[v + 1]
        const lz = unitPos[v + 2]
        positions[off + v] = lx * s + box.position[0]
        positions[off + v + 1] = ly * s + box.position[1]
        positions[off + v + 2] = lz * s + box.position[2]
        const slot = i * vertsPerBox + v / 3
        vmul[slot] = ly > 0 ? 1 : EDGE_BOTTOM
        // Sum of three signs in {-3..+3}, mapped to [0, 1].
        const signSum = Math.sign(lx) + Math.sign(ly) + Math.sign(lz)
        aFrontness[slot] = (signSum + 3) / 6
      }
    })
    basePositions.set(positions)
    unit.dispose()
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(boxes.length * stride), 3))
    geometry.userData.vertsPerBox = vertsPerBox
    geometry.userData.vmul = vmul
    geometry.userData.aFrontness = aFrontness
    geometry.userData.basePositions = basePositions
    return geometry
  }, [boxes, cubeGeometry])

  // Crystal corner glints: 8 glowing points per box (top corners brighter).
  const cornerGeometry = useMemo(() => {
    const half = BOX_SIZE * 0.5
    const positions = new Float32Array(boxes.length * 8 * 3)
    const basePositions = new Float32Array(boxes.length * 8 * 3)
    boxes.forEach((box, i) => {
      const s = box.scaleBias
      for (let c = 0; c < 8; c += 1) {
        const o = (i * 8 + c) * 3
        positions[o] = box.position[0] + CORNER_OFFSETS[c][0] * half * s
        positions[o + 1] = box.position[1] + CORNER_OFFSETS[c][1] * half * s
        positions[o + 2] = box.position[2] + CORNER_OFFSETS[c][2] * half * s
      }
    })
    basePositions.set(positions)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(boxes.length * 8 * 3), 3))
    geometry.userData.basePositions = basePositions
    return geometry
  }, [boxes])

  // Tiny central technical marker — one point per box centre, brightness driven
  // by glow (active). NOT a luminous core orb: it is a small violet dot that
  // gives `active` a focal point without volume.
  const coreGeometry = useMemo(() => {
    const geometry = new BufferGeometry()
    const positions = new Float32Array(boxes.length * 3)
    const basePositions = new Float32Array(boxes.length * 3)
    boxes.forEach((box, i) => {
      positions[i * 3] = box.position[0]
      positions[i * 3 + 1] = box.position[1]
      positions[i * 3 + 2] = box.position[2]
    })
    basePositions.set(positions)
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(boxes.length * 3), 3))
    geometry.userData.basePositions = basePositions
    return geometry
  }, [boxes])

  // Connection lines between 2D neighbours — one segment per unique
  // (a, b) pair (only added when b > a). Carries position + colour buffers
  // updated per frame: breathing offsets travel through Y, and glow modulates
  // brightness once both endpoint boxes light (behind the packet, never ahead).
  const connectionGeometry = useMemo(() => {
    const segs: Array<[number, number]> = []
    for (let i = 0; i < boxes.length; i += 1) {
      for (let d = 0; d < 4; d += 1) {
        const j = neighbours[i * 4 + d]
        if (j > i) segs.push([i, j])
      }
    }
    const count = segs.length
    const positions = new Float32Array(count * 2 * 3)
    const basePositions = new Float32Array(count * 2 * 3)
    const colors = new Float32Array(count * 2 * 3)
    const segIdx = new Int32Array(count * 2)
    // Depth fade per segment — front-row connections stay near 1, back-row
    // ones fall to ~0.4. Normalised by the front-row edge baseline so the
    // hottest segments don't dim. Reinforces perspective without hiding the
    // graph.
    const depthFade = new Float32Array(count)
    const refOpacity = 0.24
    segs.forEach(([a, b], s) => {
      const oa = s * 6
      const ob = s * 6 + 3
      positions[oa] = boxes[a].position[0]
      positions[oa + 1] = boxes[a].position[1]
      positions[oa + 2] = boxes[a].position[2]
      positions[ob] = boxes[b].position[0]
      positions[ob + 1] = boxes[b].position[1]
      positions[ob + 2] = boxes[b].position[2]
      segIdx[s * 2] = a
      segIdx[s * 2 + 1] = b
      depthFade[s] = Math.min(boxes[a].edgeOpacity, boxes[b].edgeOpacity) / refOpacity
    })
    basePositions.set(positions)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('color', new BufferAttribute(colors, 3))
    geometry.userData.basePositions = basePositions
    geometry.userData.segIdx = segIdx
    geometry.userData.segCount = count
    geometry.userData.depthFade = depthFade
    return geometry
  }, [boxes, neighbours])

  // The travelling "as de luz": a stream of very fine particles, brightest at
  // the front and fading to the tail, with a little lateral scatter.
  const beamGeometry = useMemo(() => {
    const geometry = new BufferGeometry()
    const count = PACKET_COUNT * TRAIL_LEN
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(count * 3), 3))
    return geometry
  }, [])

  // ── Materials ──────────────────────────────────────────────────────────────
  const faceMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: FACE_VERT,
        fragmentShader: FACE_FRAG,
        uniforms: {
          uColor: { value: new Color(V[0], V[1], V[2]) },
          uTint: { value: new Color(FACE_TINT[0], FACE_TINT[1], FACE_TINT[2]) },
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  const edgeMaterial = useMemo(
    () => createVectorLineMaterial({ fog: false, depthTest: true, depthWrite: false }),
    [],
  )
  const connectionMaterial = useMemo(
    () =>
      new LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        depthTest: true,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  const cornerMaterial = useMemo(
    () =>
      new PointsMaterial({
        map: dotTexture,
        vertexColors: true,
        size: 0.09, // small discreet construction node — no halo behind it
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        sizeAttenuation: true,
        toneMapped: false,
      }),
    [dotTexture],
  )
  const beamMaterial = useMemo(
    () =>
      new PointsMaterial({
        map: glowTexture,
        vertexColors: true,
        size: 0.34,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        sizeAttenuation: true,
        toneMapped: false,
      }),
    [glowTexture],
  )
  // Central technical marker — a single small violet dot. No bloom, no ring, no
  // halo: just a discreet focal point that appears on active cubes.
  const coreDotMaterial = useMemo(
    () =>
      new PointsMaterial({
        map: dotTexture,
        vertexColors: true,
        size: 0.11,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        sizeAttenuation: true,
        toneMapped: false,
      }),
    [dotTexture],
  )

  // Dim reflection variants (vertexColors × grey colour + lower opacity).
  const reflEdgeMaterial = useMemo(() => {
    const m = new LineBasicMaterial({
      vertexColors: true,
      color: new Color(0.32, 0.32, 0.4),
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      toneMapped: false,
    })
    return m
  }, [])
  const reflBeamMaterial = useMemo(() => {
    const m = beamMaterial.clone()
    m.color = new Color(0.42, 0.42, 0.48)
    m.opacity = 0.42
    return m
  }, [beamMaterial])

  const facesRef = useRef<InstancedMesh>(null)

  // Mutable animation state lives in a ref (refs are the only hook value the
  // immutability lint rule lets useFrame write to). Initialised lazily inside
  // the effect / frame loop — never read during render.
  const simRef = useRef<Sim | null>(null)

  // Position the instanced face cubes once.
  useEffect(() => {
    const mesh = facesRef.current
    if (!mesh) return
    if (!simRef.current) simRef.current = createSim(boxes, borderIndices, neighbours)
    const sim = simRef.current
    boxes.forEach((box, i) => {
      sim.dummy.position.set(box.position[0], box.position[1], box.position[2])
      sim.dummy.scale.set(box.scaleBias, box.scaleBias, box.scaleBias)
      sim.dummy.updateMatrix()
      mesh.setMatrixAt(i, sim.dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [boxes, borderIndices, neighbours])

  useFrame((state, rawDelta) => {
    if (paused) return
    if (!simRef.current) simRef.current = createSim(boxes, borderIndices, neighbours)
    const sim = simRef.current
    const dt = Math.min(rawDelta, 0.05)
    const now = state.clock.getElapsedTime()
    const { glow, lastVisit, packets, rand } = sim
    ;(globalThis as unknown as { __psim?: unknown }).__psim = sim

    // 1) Breathing — one sinusoid per cube, desynced via floatPhase. Pure
    // presentation; never feeds back into graph topology. Computed once per
    // frame so the packet head, the box geometries and the InstancedMesh all
    // breathe in lockstep.
    const breath = sim.breath
    for (let i = 0; i < boxes.length; i += 1) {
      const box = boxes[i]
      breath[i] = Math.sin(now * FLOAT_OMEGA + box.floatPhase) * box.floatAmp
    }
    const lerpAt = (a: number, b: number, e: number, axis: number) => {
      const ya = axis === 1 ? breath[a] : 0
      const yb = axis === 1 ? breath[b] : 0
      const av = boxes[a].position[axis] + ya
      const bv = boxes[b].position[axis] + yb
      return av + (bv - av) * e
    }

    const attackStep = 1 - Math.exp(-dt / ATTACK_TAU)

    if (soloMode) {
      // Sandbox: drive glow[0] from the keyboard toggle, with the same
      // attack/decay shape as the normal packet-driven pipeline.
      const targetGlow = soloState === 'active' ? 1 : 0
      glow[0] += (targetGlow - glow[0]) * attackStep
    } else {
    // 2) Advance each packet; emit the continuous ray + mark visited boxes.
    const beamCol = beamGeometry.getAttribute('color') as BufferAttribute
    const beamPos = beamGeometry.getAttribute('position') as BufferAttribute
    const bc = beamCol.array as Float32Array
    const bp = beamPos.array as Float32Array

    packets.forEach((p, idx) => {
      p.t += dt / p.travelDur

      // Continuous flow: on arrival, immediately roll into the next hop — the
      // light never stops at a box. (while + guard handles big frame steps.)
      let guard = 0
      while (p.t >= 1 && guard < 4) {
        guard += 1
        p.current = p.next
        p.entryFace = OPPOSITE[p.dir]

        const pick = pickNext(neighbours, p.current, p.entryFace, rand, lastVisit, now)
        if (!pick) {
          packets[idx] = spawnPacket(borderIndices, neighbours, rand, lastVisit, now)
          resetHistory(sim, idx, boxes[packets[idx].current].position)
          return
        }
        p.next = pick.to
        p.dir = pick.dir
        p.t -= 1
      }

      const cur = packets[idx]
      const e = cur.t
      const hx = lerpAt(cur.current, cur.next, e, 0)
      // Parabolic arc on Y — zero at the endpoints (so the head still passes
      // through cube centres), peaks at e=0.5. Amplified by |ΔY| so risers
      // and sinkers read as visible up/down curves, while level hops only get
      // a small base lift.
      const dy =
        boxes[cur.next].position[1] +
        breath[cur.next] -
        (boxes[cur.current].position[1] + breath[cur.current])
      const arc =
        Math.sin(Math.PI * e) * (PACKET_ARC_BASE + PACKET_ARC_DELTA_GAIN * Math.abs(dy))
      const hy = lerpAt(cur.current, cur.next, e, 1) + arc
      const hz = lerpAt(cur.current, cur.next, e, 2)
      // Routing memory: mark a box "recently visited" when the head is inside it.
      // Drives AVOID_SEC neighbour selection only — NOT the visuals.
      if (e < ENTER) lastVisit[cur.current] = now
      else if (e > 1 - ENTER) lastVisit[cur.next] = now
      // Visual glow by head proximity — faint as the ray touches the current and
      // next boxes, peaking at their centres (the deflection point). A box never
      // lights before the head reaches it.
      exciteHead(glow, boxes, cur.current, hx, hy, hz)
      exciteHead(glow, boxes, cur.next, hx, hy, hz)
      // Record the head into this packet's ring history (the travelling ray).
      const hh = sim.histHead[idx]
      const hbase = (idx * TRAIL_LEN + hh) * 3
      sim.hist[hbase] = hx
      sim.hist[hbase + 1] = hy
      sim.hist[hbase + 2] = hz
      sim.histHead[idx] = (hh + 1) % TRAIL_LEN
    })

    // Render each packet's ray: a CONTINUOUS trail of the recent head path,
    // brightest at the leading edge and diffusing softly toward the tail.
    for (let p = 0; p < PACKET_COUNT; p += 1) {
      const head = sim.histHead[p]
      const pbase = p * TRAIL_LEN
      for (let a = 0; a < TRAIL_LEN; a += 1) {
        const slot = (head - 1 - a + TRAIL_LEN * 2) % TRAIL_LEN
        const src = (pbase + slot) * 3
        const o = (pbase + a) * 3
        bp[o] = sim.hist[src]
        bp[o + 1] = sim.hist[src + 1]
        bp[o + 2] = sim.hist[src + 2]
        const fadeAge = 1 - a / TRAIL_LEN
        // Gentler-than-quadratic fade so the long tail stays visible, still diffuse.
        const w = Math.pow(fadeAge, 1.5)
        bc[o] = BEAM_GLOW[0] * w
        bc[o + 1] = BEAM_GLOW[1] * w
        bc[o + 2] = BEAM_GLOW[2] * w
      }
    }
    beamPos.needsUpdate = true
    beamCol.needsUpdate = true

    // 2b) Cube glow trail — every box fades exponentially; the per-head proximity
    // excitation (above) lifts the boxes the ray is currently touching. Result: a
    // box stays dark until the head reaches it, brightens at its centre, then dims
    // as the light moves on. No anticipation and no separate highlight channel.
    const glowDecay = Math.exp(-dt / GLOW_TRAIL_TAU)
    for (let i = 0; i < glow.length; i += 1) glow[i] *= glowDecay
    } // ← close `else` of soloMode branch

    // 3) Edge colours — violet hierarchy. Each vertex blends two signals:
    //   resting violet (faded by depth + front/back + top/bottom),
    //   active glow (additive, never crosses into white).
    // aFrontness < 0.5 → back edges fall to EDGE_BACK_FACTOR of front intensity.
    const edgeColor = edgeGeometry.getAttribute('color') as BufferAttribute
    const edgeArr = edgeColor.array as Float32Array
    const vertsPerBox = edgeGeometry.userData.vertsPerBox as number
    const vmul = edgeGeometry.userData.vmul as Float32Array
    const aFrontness = edgeGeometry.userData.aFrontness as Float32Array
    boxes.forEach((box, i) => {
      const g = glow[i]
      const eb = box.edgeOpacity
      const off = i * vertsPerBox * 3
      const vbase = i * vertsPerBox
      for (let v = 0; v < vertsPerBox; v += 1) {
        const vm = vmul[vbase + v]
        const fn = aFrontness[vbase + v]
        const fmul = EDGE_BACK_FACTOR + (EDGE_FRONT_FACTOR - EDGE_BACK_FACTOR) * fn
        const restMul = eb * vm * fmul
        const actMul = g * EDGE_ACTIVE_GAIN * (0.7 + 0.3 * vm) * fmul
        const r = EDGE_FRONT_IDLE[0] * restMul + EDGE_ACTIVE[0] * actMul
        const gg = EDGE_FRONT_IDLE[1] * restMul + EDGE_ACTIVE[1] * actMul
        const bb = EDGE_FRONT_IDLE[2] * restMul + EDGE_ACTIVE[2] * actMul
        edgeArr[off + v * 3] = r
        edgeArr[off + v * 3 + 1] = gg
        edgeArr[off + v * 3 + 2] = bb
      }
    })
    edgeColor.needsUpdate = true

    // 4) Face glow (per-instance aGlow → whisper shader brightens the inner fill).
    const mesh = facesRef.current
    if (mesh) {
      const aGlow = mesh.geometry.getAttribute('aGlow') as BufferAttribute
      const ag = aGlow.array as Float32Array
      for (let i = 0; i < boxes.length; i += 1) {
        ag[i] = glow[i] * FACE_GLOW
      }
      aGlow.needsUpdate = true
    }

    // 4b) Corner hotspots — two signals blended on a violet palette:
    //   resting glow (visible even in idle so vertices feel "alive"),
    //   active gain (corners surge to CORNER_ACTIVE_COL — never to white).
    // The same colour buffer drives both the soft halo and the crisp dot
    // materials; material size + opacity differentiate the two layers.
    const cornerColor = cornerGeometry.getAttribute('color') as BufferAttribute
    const cc2 = cornerColor.array as Float32Array
    boxes.forEach((box, i) => {
      const g = glow[i]
      const off = i * 8 * 3
      const depthFactor = 0.7 + box.edgeOpacity
      for (let c = 0; c < 8; c += 1) {
        const top = CORNER_OFFSETS[c][1] > 0 ? 1 : 0.65
        const rest = CORNER_IDLE_GAIN * depthFactor * top
        const act = g * CORNER_ACTIVE_GAIN * (0.6 + 0.4 * top)
        const o = off + c * 3
        cc2[o] = CORNER_BASE_COL[0] * rest + CORNER_ACTIVE_COL[0] * act
        cc2[o + 1] = CORNER_BASE_COL[1] * rest + CORNER_ACTIVE_COL[1] * act
        cc2[o + 2] = CORNER_BASE_COL[2] * rest + CORNER_ACTIVE_COL[2] * act
      }
    })
    cornerColor.needsUpdate = true

    // 4c) Central marker — a small violet dot, NOT a luminous core. Brightness
    // rises with glow (active). Stays violet (never ramps to white) and never
    // grows into a volumetric orb — the marker material itself is tiny.
    const coreColor = coreGeometry.getAttribute('color') as BufferAttribute
    const co = coreColor.array as Float32Array
    for (let i = 0; i < boxes.length; i += 1) {
      const gi = glow[i]
      // Subtle pulse — amplitude 0.06, only once the marker has any glow.
      const pulse = gi > 0.2 ? 1 + Math.sin(now * 5.5 + boxes[i].corePulsePhase) * 0.06 : 1
      const intensity = gi * 0.85 * pulse
      co[i * 3] = CORNER_ACTIVE_COL[0] * intensity
      co[i * 3 + 1] = CORNER_ACTIVE_COL[1] * intensity
      co[i * 3 + 2] = CORNER_ACTIVE_COL[2] * intensity
    }
    coreColor.needsUpdate = true

    // 5) Breathing — write the per-box Y offset into every baked buffer plus
    // the InstancedMesh transform. Each vertex's Y = its baked baseY + breath[i].
    // X/Z never change, so only Y is touched (zero work per X/Z slot).
    const edgePosAttr = edgeGeometry.getAttribute('position') as BufferAttribute
    const edgePosArr = edgePosAttr.array as Float32Array
    const edgeBase = edgeGeometry.userData.basePositions as Float32Array
    const vpb = edgeGeometry.userData.vertsPerBox as number
    for (let i = 0; i < boxes.length; i += 1) {
      const dy = breath[i]
      const off = i * vpb * 3
      for (let v = 0; v < vpb; v += 1) {
        edgePosArr[off + v * 3 + 1] = edgeBase[off + v * 3 + 1] + dy
      }
    }
    edgePosAttr.needsUpdate = true

    const cornerPosAttr = cornerGeometry.getAttribute('position') as BufferAttribute
    const cornerPosArr = cornerPosAttr.array as Float32Array
    const cornerBase = cornerGeometry.userData.basePositions as Float32Array
    for (let i = 0; i < boxes.length; i += 1) {
      const dy = breath[i]
      const off = i * 8 * 3
      for (let c = 0; c < 8; c += 1) {
        cornerPosArr[off + c * 3 + 1] = cornerBase[off + c * 3 + 1] + dy
      }
    }
    cornerPosAttr.needsUpdate = true

    const corePosAttr = coreGeometry.getAttribute('position') as BufferAttribute
    const corePosArr = corePosAttr.array as Float32Array
    const coreBase = coreGeometry.userData.basePositions as Float32Array
    for (let i = 0; i < boxes.length; i += 1) {
      corePosArr[i * 3 + 1] = coreBase[i * 3 + 1] + breath[i]
    }
    corePosAttr.needsUpdate = true

    // 6) Connection lines — update per-segment positions (breathing) and
    // colours (resting baseline + past-route glow only). A segment lights once
    // both its boxes glow, i.e. behind the light — never ahead of it. Skipped in
    // soloMode since there are no neighbours and the geometry isn't rendered.
    if (!soloMode) {
    const connPosAttr = connectionGeometry.getAttribute('position') as BufferAttribute
    const connPosArr = connPosAttr.array as Float32Array
    const connBase = connectionGeometry.userData.basePositions as Float32Array
    const connColAttr = connectionGeometry.getAttribute('color') as BufferAttribute
    const connColArr = connColAttr.array as Float32Array
    const segIdx = connectionGeometry.userData.segIdx as Int32Array
    const segCount = connectionGeometry.userData.segCount as number
    const depthFade = connectionGeometry.userData.depthFade as Float32Array
    for (let s = 0; s < segCount; s += 1) {
      const a = segIdx[s * 2]
      const b = segIdx[s * 2 + 1]
      const oa = s * 6
      const ob = s * 6 + 3
      // Y from baked base + breathing of each endpoint.
      connPosArr[oa + 1] = connBase[oa + 1] + breath[a]
      connPosArr[ob + 1] = connBase[ob + 1] + breath[b]
      // Brightness: resting baseline + past-route glow, faded by depth. No
      // active-hop term → a connection only appears behind the light, never as a
      // line pointing at the next cube.
      const fade = depthFade[s]
      const resting = CONNECTION_RESTING * fade
      const energy = Math.min(glow[a], glow[b]) * CONNECTION_GLOW_GAIN * fade
      // Violet at rest, lighter lila when energised — same palette as edges so
      // connections and cube outlines belong to the same visual family.
      const r = EDGE_FRONT_IDLE[0] * resting + EDGE_ACTIVE[0] * energy * EDGE_ACTIVE_GAIN
      const g2 = EDGE_FRONT_IDLE[1] * resting + EDGE_ACTIVE[1] * energy * EDGE_ACTIVE_GAIN
      const bl = EDGE_FRONT_IDLE[2] * resting + EDGE_ACTIVE[2] * energy * EDGE_ACTIVE_GAIN
      connColArr[oa] = r
      connColArr[oa + 1] = g2
      connColArr[oa + 2] = bl
      connColArr[ob] = r
      connColArr[ob + 1] = g2
      connColArr[ob + 2] = bl
    }
    connPosAttr.needsUpdate = true
    connColAttr.needsUpdate = true
    } // ← close `if (!soloMode)` around connection updates

    // Faces (InstancedMesh): rewrite each instance matrix with the breathing Y.
    // scaleBias stays constant so the matrices effectively only translate.
    if (mesh) {
      for (let i = 0; i < boxes.length; i += 1) {
        const box = boxes[i]
        sim.dummy.position.set(box.position[0], box.position[1] + breath[i], box.position[2])
        sim.dummy.scale.set(box.scaleBias, box.scaleBias, box.scaleBias)
        sim.dummy.updateMatrix()
        mesh.setMatrixAt(i, sim.dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  const groupScale = Array.isArray(scale) ? scale : [scale, scale, scale]

  return (
    <group position={position} rotation={rotation} scale={groupScale as [number, number, number]}>
      {!soloMode && (
        <>
          <lineSegments geometry={floorGridGeometry}>
            <lineBasicMaterial
              color={VECTOR_WORLD_THEME.particleColor}
              transparent
              opacity={0.1}
              depthWrite={false}
              blending={AdditiveBlending}
              toneMapped={false}
            />
          </lineSegments>

          <points geometry={nodeGeometry} material={nodeMaterial} />
          <points geometry={dustGeometry} material={dustMaterial} />

          {/* Floor reflection: the wireframe edges + packet mirrored below the
              floor plane, dim. No core/corner glow reflection — line-first. */}
          <group position={[0, 2 * FLOOR_Y, 0]} scale={[1, -1, 1]}>
            <lineSegments geometry={edgeGeometry} material={reflEdgeMaterial} />
            <points geometry={beamGeometry} material={reflBeamMaterial} />
          </group>

          <lineSegments geometry={connectionGeometry} material={connectionMaterial} />
          <points geometry={beamGeometry} material={beamMaterial} />
        </>
      )}

      {/* Faces are a whisper; the edges carry the form. */}
      <instancedMesh ref={facesRef} args={[cubeGeometry, faceMaterial, boxes.length]} />
      <lineSegments geometry={edgeGeometry} material={edgeMaterial} />
      <points geometry={cornerGeometry} material={cornerMaterial} />
      <points geometry={coreGeometry} material={coreDotMaterial} />
    </group>
  )
}
