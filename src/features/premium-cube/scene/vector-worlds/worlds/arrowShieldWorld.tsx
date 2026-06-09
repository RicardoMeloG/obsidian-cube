import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, PointsMaterial } from 'three'
import type { LineSegments, Points } from 'three'
import { createVectorLineMaterial } from '../base/materials'
import { createGlowTexture, makeSeededRandom } from '../base/textures'
import { VECTOR_WORLD_THEME } from '../base/theme'
import type { WorldProps } from '../types'

// 2.5D projectile-siege / "DDoS shield". A hexagonal force field (projected onto a
// hemisphere so it reads as a sphere) surrounds the cube. It is near-invisible at
// rest — only a faint Fresnel rim hints at its silhouette — and lights up where it
// is hit: each impact spawns an energy RIPPLE that propagates across the dome but
// FADES toward the center, so the shield protects the cube without ever hiding it.
// Projectiles (mostly arrows, a few spears and swords) besiege from ALL directions
// (360°) in WAVES, lobbed from far away on pronounced parabolic arcs — slow and
// small, for a sense of scale. They strike with several reactions (elastic / weak /
// glance / spin / stick-embedded), throw sparks, then fall and bury themselves in
// the ground. Plain ballistic kinematics.
const ARROW_COUNT = 72
const SHIELD_RADIUS = 3.0
const HEX_RADIUS = 0.15
const HEX_BRIGHTNESS = 2.4 // additive boost so lit cells clearly pop

// Energy ripple — concentric wave of light expanding from each impact point.
const MAX_RIPPLES = ARROW_COUNT
const RIPPLE_SPEED = 4.0 // units/sec the wavefront travels across the dome
const RIPPLE_WIDTH = 0.66 // thickness of the glowing ring
const RIPPLE_LIFE = 0.85 // seconds before a ripple dies
const RIPPLE_PEAK = 1.0 // brightness at the wavefront

// Fresnel rim — a faint constant glow near the silhouette so the SPHERE always
// reads, even with no impacts. Kept very dim to preserve the "invisible" feel.
const FRESNEL_INNER = 0.78 // fraction of R where the rim glow begins
const FRESNEL_INTENSITY = 0.14

// Center-clear mask — glow fades to nothing toward the middle of the dome so the
// shield never lights up in front of the cube (it protects, it doesn't hide).
const CLEAR_INNER = SHIELD_RADIUS * 0.32 // fully clear (dark) inside this radius
const CLEAR_OUTER = SHIELD_RADIUS * 0.68 // full glow allowed beyond this radius

// Ballistic lob: projectiles are launched from far away to a point near the cube,
// reaching it in TIME_OF_FLIGHT seconds. Long flight time → slow speed + tall,
// pronounced parabola. Velocity is solved exactly so they actually reach the dome.
const SPAWN_DIST = 8.0 // launched from out here (closer so they read up-close too)
const GRAVITY = -2.6 // magnitude used both in the solve and the per-frame fall
const TOF_MIN = 2.7
const TOF_MAX = 4.3
const TARGET_JITTER = 1.3 // aim spread around the cube center → 360° impacts
const FLOOR_Y = -4.2
const SETTLE_TIME = 1.3 // buried projectiles linger on the floor before fading
const STUCK_TIME = 1.6 // embedded projectiles linger longer
const FLASH_DUR = 0.5

// Waves — the siege arrives in bursts, then a lull, then another burst.
const WAVE_PERIOD_MIN = 1.6
const WAVE_PERIOD_MAX = 3.2
const WAVE_SPREAD = 0.9 // projectiles in a burst enter staggered within this window
const BURST_MIN = 10
const BURST_MAX = 22

// Projectile kinds (arrows dominate; spears and swords are the minority).
const KIND_ARROW = 0
const KIND_SPEAR = 1
const KIND_SWORD = 2

// Base geometry — HALF the previous size for a sense of scale/distance.
const ARROW_LEN = 0.29
const HEAD_LEN = 0.05
const FLETCH_LEN = 0.04
const BARB_ANGLE = 0.34
const FLETCH_ANGLE = 0.5
const SPEAR_LEN_MUL = 1.85 // spears are long and thin
const SWORD_LEN_MUL = 1.05 // swords are shorter, with a crossguard
const SEGS_PER_PROJ = 6 // 6 line segments per projectile (shape varies by kind)
const SCALE_MIN = 0.7 // depth: smaller, dimmer projectiles read as "farther away"
const SCALE_MAX = 1.4
const TRAIL_FACTOR = 0.06 // trail length per unit speed

// Sparks — a few embers fly off each deflection.
const SPARKS_PER_HIT = 3
const SPARK_COUNT = ARROW_COUNT * SPARKS_PER_HIT
const SPARK_LIFE = 0.55
const SPARK_GRAVITY = -6.0

// Dome: the hex shield is projected onto a hemisphere so it reads as a sphere.
const DOME_DEPTH = 0.82

// Impact reactions.
const IMPACT_ELASTIC = 0
const IMPACT_WEAK = 1
const IMPACT_GLANCE = 2
const IMPACT_SPIN = 3
const IMPACT_STUCK = 4

const V = VECTOR_WORLD_THEME.lineColorRgb

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

type Projectile = {
  x: number
  y: number
  vx: number
  vy: number
  dirX: number
  dirY: number
  scale: number
  kind: number
  parked: boolean
  bounced: boolean
  landed: boolean
  stuck: boolean
  type: number
  spin: number
  spinVel: number
  fade: number
  delay: number
  flashX: number
  flashY: number
  flashAge: number
}

type Ripple = { x: number; y: number; age: number }
type Spark = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }

function spawnProjectile(a: Projectile, rand: () => number) {
  // 360° siege, lobbed from far away on a tall parabola that lands near the cube.
  const ang = rand() * Math.PI * 2
  a.x = Math.cos(ang) * SPAWN_DIST
  a.y = Math.sin(ang) * SPAWN_DIST
  const tx = (rand() - 0.5) * TARGET_JITTER
  const ty = (rand() - 0.5) * TARGET_JITTER
  const T = TOF_MIN + rand() * (TOF_MAX - TOF_MIN)
  const g = -GRAVITY // positive magnitude
  // Solve initial velocity so position(T) == target under constant gravity.
  a.vx = (tx - a.x) / T
  a.vy = (ty - a.y) / T + 0.5 * g * T
  a.dirX = a.vx
  a.dirY = a.vy
  a.scale = SCALE_MIN + rand() * (SCALE_MAX - SCALE_MIN)
  // 70% arrows, ~16% spears, ~14% swords.
  const kr = rand()
  a.kind = kr < 0.7 ? KIND_ARROW : kr < 0.86 ? KIND_SPEAR : KIND_SWORD
  a.parked = true // released by the next wave
  a.bounced = false
  a.landed = false
  a.stuck = false
  a.spin = 0
  a.spinVel = 0
  a.fade = 1
  // ~16% stick, the rest spread across the four deflections.
  a.type = rand() < 0.84 ? Math.floor(rand() * 4) : IMPACT_STUCK
}

type SimState = {
  list: Projectile[]
  ripples: Ripple[]
  sparks: Spark[]
  rand: () => number
  waveTimer: number
}

function buildSim(): SimState {
  const rand = makeSeededRandom(0x5e1e1d)
  const list: Projectile[] = []
  for (let i = 0; i < ARROW_COUNT; i += 1) {
    const a: Projectile = {
      x: 0, y: 0, vx: 0, vy: 0, dirX: 0, dirY: -1, scale: 1, kind: KIND_ARROW,
      parked: true, bounced: false, landed: false, stuck: false, type: 0,
      spin: 0, spinVel: 0, fade: 1, delay: 0,
      flashX: 0, flashY: 0, flashAge: FLASH_DUR,
    }
    spawnProjectile(a, rand) // parked until the first wave releases it
    list.push(a)
  }
  const ripples: Ripple[] = []
  for (let i = 0; i < MAX_RIPPLES; i += 1) ripples.push({ x: 0, y: 0, age: RIPPLE_LIFE })
  const sparks: Spark[] = []
  for (let i = 0; i < SPARK_COUNT; i += 1) sparks.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1 })
  return { list, ripples, sparks, rand, waveTimer: 0 }
}

function spawnRipple(ripples: Ripple[], x: number, y: number) {
  for (let i = 0; i < ripples.length; i += 1) {
    if (ripples[i].age >= RIPPLE_LIFE) {
      ripples[i].x = x
      ripples[i].y = y
      ripples[i].age = 0
      return
    }
  }
}

function spawnSparks(sparks: Spark[], x: number, y: number, nx: number, ny: number, rand: () => number) {
  const baseAng = Math.atan2(ny, nx)
  let made = 0
  for (let i = 0; i < sparks.length && made < SPARKS_PER_HIT; i += 1) {
    if (sparks[i].life > 0) continue
    const ang = baseAng + (rand() - 0.5) * 1.7
    const sp = 1.6 + rand() * 2.8
    const s = sparks[i]
    s.x = x
    s.y = y
    s.vx = Math.cos(ang) * sp
    s.vy = Math.sin(ang) * sp
    s.maxLife = SPARK_LIFE * (0.6 + rand() * 0.4)
    s.life = s.maxLife
    made += 1
  }
}

// Hemisphere height for the dome projection: 0 at the rim, max toward the center.
function domeZ(x: number, y: number) {
  const r2 = SHIELD_RADIUS * SHIELD_RADIUS - x * x - y * y
  return r2 > 0 ? Math.sqrt(r2) * DOME_DEPTH : 0
}

// Hexagonal grid clipped to the shield circle, projected onto a hemisphere.
// 6 edges per hex. Precomputes the Fresnel rim and the center-clear mask per cell.
function buildHexGrid() {
  const centers: [number, number][] = []
  const fresnel: number[] = []
  const clear: number[] = []
  const positions: number[] = []
  const hw = Math.sqrt(3) * HEX_RADIUS
  const vh = 1.5 * HEX_RADIUS
  const rows = Math.ceil((SHIELD_RADIUS * 2) / vh) + 2
  const cols = Math.ceil((SHIELD_RADIUS * 2) / hw) + 2
  for (let r = -rows; r <= rows; r += 1) {
    for (let c = -cols; c <= cols; c += 1) {
      const cx = c * hw + (r & 1 ? hw / 2 : 0)
      const cy = r * vh
      const rr = Math.hypot(cx, cy)
      if (rr > SHIELD_RADIUS - HEX_RADIUS * 0.3) continue
      centers.push([cx, cy])
      fresnel.push(smoothstep(SHIELD_RADIUS * FRESNEL_INNER, SHIELD_RADIUS, rr) * FRESNEL_INTENSITY)
      clear.push(smoothstep(CLEAR_INNER, CLEAR_OUTER, rr))
      for (let k = 0; k < 6; k += 1) {
        const a0 = Math.PI / 6 + (k * Math.PI) / 3
        const a1 = Math.PI / 6 + ((k + 1) * Math.PI) / 3
        const x0 = cx + Math.cos(a0) * HEX_RADIUS
        const y0 = cy + Math.sin(a0) * HEX_RADIUS
        const x1 = cx + Math.cos(a1) * HEX_RADIUS
        const y1 = cy + Math.sin(a1) * HEX_RADIUS
        positions.push(x0, y0, domeZ(x0, y0), x1, y1, domeZ(x1, y1))
      }
    }
  }
  return {
    centers,
    fresnel: new Float32Array(fresnel),
    clear: new Float32Array(clear),
    positions: new Float32Array(positions),
  }
}

function reflect(a: Projectile, nx: number, ny: number, restitution: number) {
  const vdotn = a.vx * nx + a.vy * ny
  a.vx = (a.vx - 2 * vdotn * nx) * restitution
  a.vy = (a.vy - 2 * vdotn * ny) * restitution
}

// Fill `out` (24 numbers = 6 segments × [x1,y1,x2,y2]) with the projectile's
// silhouette, shaped by kind. dir is the unit heading; (px,py) is its perpendicular.
function buildShape(
  out: number[], kind: number, tipX: number, tipY: number,
  dx: number, dy: number, scale: number, trailLen: number,
) {
  const px = -dy
  const py = dx
  const bx = -dx
  const by = -dy
  const set = (i: number, x1: number, y1: number, x2: number, y2: number) => {
    out[i] = x1; out[i + 1] = y1; out[i + 2] = x2; out[i + 3] = y2
  }

  if (kind === KIND_SWORD) {
    const L = ARROW_LEN * SWORD_LEN_MUL * scale
    const tailX = tipX + bx * L
    const tailY = tipY + by * L
    const gripLen = L * 0.24
    const guardX = tailX + dx * gripLen
    const guardY = tailY + dy * gripLen
    const gw = L * 0.18
    set(0, guardX, guardY, tipX, tipY) // blade
    set(4, tailX, tailY, guardX, guardY) // grip
    set(8, guardX + px * gw, guardY + py * gw, guardX - px * gw, guardY - py * gw) // crossguard
    set(12, tailX, tailY, tailX + bx * (L * 0.06), tailY + by * (L * 0.06)) // pommel nub
    set(16, tailX, tailY, tailX, tailY) // (unused)
    set(20, tailX, tailY, tailX - dx * trailLen, tailY - dy * trailLen) // trail
    return
  }

  if (kind === KIND_SPEAR) {
    const L = ARROW_LEN * SPEAR_LEN_MUL * scale
    const HL = HEAD_LEN * 1.3 * scale
    const tailX = tipX + bx * L
    const tailY = tipY + by * L
    const ca = Math.cos(0.26)
    const sa = Math.sin(0.26)
    set(0, tailX, tailY, tipX, tipY) // long shaft
    set(4, tipX, tipY, tipX + (bx * ca - by * sa) * HL, tipY + (bx * sa + by * ca) * HL) // barb L
    set(8, tipX, tipY, tipX + (bx * ca + by * sa) * HL, tipY + (-bx * sa + by * ca) * HL) // barb R
    // collar: a small perpendicular binding near the head base
    const colX = tipX + bx * (HL * 2.2)
    const colY = tipY + by * (HL * 2.2)
    const cw = 0.03 * scale
    set(12, colX + px * cw, colY + py * cw, colX - px * cw, colY - py * cw)
    set(16, tailX, tailY, tailX, tailY) // (unused)
    set(20, tailX, tailY, tailX - dx * trailLen, tailY - dy * trailLen) // trail
    return
  }

  // KIND_ARROW
  const L = ARROW_LEN * scale
  const HL = HEAD_LEN * scale
  const FL = FLETCH_LEN * scale
  const tailX = tipX + bx * L
  const tailY = tipY + by * L
  const cb = Math.cos(BARB_ANGLE)
  const sb = Math.sin(BARB_ANGLE)
  const cf = Math.cos(FLETCH_ANGLE)
  const sf = Math.sin(FLETCH_ANGLE)
  set(0, tailX, tailY, tipX, tipY) // shaft
  set(4, tipX, tipY, tipX + (bx * cb - by * sb) * HL, tipY + (bx * sb + by * cb) * HL) // barb L
  set(8, tipX, tipY, tipX + (bx * cb + by * sb) * HL, tipY + (-bx * sb + by * cb) * HL) // barb R
  set(12, tailX, tailY, tailX + (bx * cf - by * sf) * FL, tailY + (bx * sf + by * cf) * FL) // fletch L
  set(16, tailX, tailY, tailX + (bx * cf + by * sf) * FL, tailY + (-bx * sf + by * cf) * FL) // fletch R
  set(20, tailX, tailY, tailX - dx * trailLen, tailY - dy * trailLen) // trail
}

export function ArrowShieldWorld({
  position = [0, 0.32, -1.2],
  rotation = [0, 0, 0],
  // Embedded the close cube-scene camera makes the radius-3 sphere overflow the
  // whole frame (its hex pattern tiles into the corners and leaves no room to see
  // the siege arrive). Shrink it to a contained shield around the cube with dark
  // breathing room around it. The showcase (far camera) overrides this back to 1.
  scale = 0.6,
  paused = false,
  // Embedded behind the cube: the shield is a whisper (scene bloom amplifies it,
  // and it must not steal attention or hide the cube). The projectiles, however,
  // stay brighter so the incoming siege still READS up-close. The showcase
  // overrides both to ~1 for the full spectacle.
  glow = 0.28,
  projGlow = 0.85,
}: WorldProps = {}) {
  const glowTexture = useMemo(() => createGlowTexture(), [])
  const hex = useMemo(() => buildHexGrid(), [])

  const simRef = useRef<SimState | null>(null)
  const shapeRef = useRef<number[]>(new Array(SEGS_PER_PROJ * 4).fill(0))

  const hexGeometry = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(hex.positions, 3))
    geo.setAttribute('color', new BufferAttribute(new Float32Array(hex.positions.length), 3))
    return geo
  }, [hex])

  const projGeometry = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(ARROW_COUNT * SEGS_PER_PROJ * 2 * 3), 3))
    geo.setAttribute('color', new BufferAttribute(new Float32Array(ARROW_COUNT * SEGS_PER_PROJ * 2 * 3), 3))
    return geo
  }, [])

  const impactGeometry = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(ARROW_COUNT * 3), 3))
    geo.setAttribute('color', new BufferAttribute(new Float32Array(ARROW_COUNT * 3), 3))
    return geo
  }, [])

  const sparkGeometry = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(SPARK_COUNT * 3), 3))
    geo.setAttribute('color', new BufferAttribute(new Float32Array(SPARK_COUNT * 3), 3))
    return geo
  }, [])

  const lineMaterial = useMemo(
    () => createVectorLineMaterial({ fog: false, depthTest: true, depthWrite: false }),
    [],
  )
  const hexMaterial = useMemo(
    () => createVectorLineMaterial({ fog: false, depthTest: true, depthWrite: false }),
    [],
  )
  const impactMaterial = useMemo(
    () =>
      new PointsMaterial({
        map: glowTexture, vertexColors: true, size: 0.7, sizeAttenuation: true,
        transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false,
      }),
    [glowTexture],
  )
  const sparkMaterial = useMemo(
    () =>
      new PointsMaterial({
        map: glowTexture, vertexColors: true, size: 0.18, sizeAttenuation: true,
        transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false,
      }),
    [glowTexture],
  )

  const projRef = useRef<LineSegments>(null)
  const impactRef = useRef<Points>(null)
  const sparkRef = useRef<Points>(null)
  const hexRef = useRef<LineSegments>(null)

  useFrame((_, rawDelta) => {
    if (paused) return
    const projObj = projRef.current
    const impactObj = impactRef.current
    const sparkObj = sparkRef.current
    const hexObj = hexRef.current
    if (!projObj || !impactObj || !sparkObj || !hexObj) return
    const dt = Math.min(rawDelta, 0.05)
    if (!simRef.current) simRef.current = buildSim()
    const sim = simRef.current
    const { list, ripples, sparks, rand } = sim
    const shape = shapeRef.current

    const ap = projObj.geometry.getAttribute('position') as BufferAttribute
    const ac = projObj.geometry.getAttribute('color') as BufferAttribute
    const apos = ap.array as Float32Array
    const acol = ac.array as Float32Array
    const ip = impactObj.geometry.getAttribute('position') as BufferAttribute
    const ic = impactObj.geometry.getAttribute('color') as BufferAttribute
    const ipos = ip.array as Float32Array
    const icol = ic.array as Float32Array

    // Waves: release a burst of parked projectiles, then wait.
    sim.waveTimer -= dt
    if (sim.waveTimer <= 0) {
      const burst = BURST_MIN + Math.floor(rand() * (BURST_MAX - BURST_MIN + 1))
      let launched = 0
      for (let i = 0; i < list.length && launched < burst; i += 1) {
        if (list[i].parked) {
          list[i].parked = false
          list[i].delay = rand() * WAVE_SPREAD
          launched += 1
        }
      }
      sim.waveTimer = WAVE_PERIOD_MIN + rand() * (WAVE_PERIOD_MAX - WAVE_PERIOD_MIN)
    }

    // Age ripples.
    for (let i = 0; i < ripples.length; i += 1) {
      if (ripples[i].age < RIPPLE_LIFE) ripples[i].age += dt
    }

    for (let i = 0; i < list.length; i += 1) {
      const a = list[i]
      const segBase = i * SEGS_PER_PROJ * 6

      if (a.parked || a.delay > 0) {
        if (!a.parked) a.delay -= dt
        for (let k = 0; k < SEGS_PER_PROJ * 6; k += 1) {
          apos[segBase + k] = 0
          acol[segBase + k] = 0
        }
      } else {
        if (a.stuck) {
          a.fade -= dt / STUCK_TIME
          if (a.fade <= 0) spawnProjectile(a, rand)
        } else if (!a.landed) {
          a.vy += GRAVITY * dt
          a.x += a.vx * dt
          a.y += a.vy * dt
          const r = Math.hypot(a.x, a.y) || 0.0001

          if (!a.bounced && r < SHIELD_RADIUS) {
            const nx = a.x / r
            const ny = a.y / r
            a.x = nx * SHIELD_RADIUS
            a.y = ny * SHIELD_RADIUS
            a.bounced = true
            a.flashX = a.x
            a.flashY = a.y
            a.flashAge = 0
            spawnRipple(ripples, a.x, a.y)

            if (a.type === IMPACT_STUCK) {
              a.stuck = true
              a.vx = 0
              a.vy = 0
              a.dirX = -nx
              a.dirY = -ny
              a.fade = 1
            } else if (a.type === IMPACT_ELASTIC) {
              reflect(a, nx, ny, 0.62)
              spawnSparks(sparks, a.x, a.y, nx, ny, rand)
            } else if (a.type === IMPACT_WEAK) {
              reflect(a, nx, ny, 0.22)
              spawnSparks(sparks, a.x, a.y, nx, ny, rand)
            } else if (a.type === IMPACT_GLANCE) {
              const vdotn = a.vx * nx + a.vy * ny
              a.vx = (a.vx - vdotn * nx) * 0.85
              a.vy = (a.vy - vdotn * ny) * 0.85
              spawnSparks(sparks, a.x, a.y, nx, ny, rand)
            } else if (a.type === IMPACT_SPIN) {
              reflect(a, nx, ny, 0.5)
              a.spin = Math.atan2(a.vy, a.vx)
              a.spinVel = (rand() < 0.5 ? -1 : 1) * (6 + rand() * 6)
              spawnSparks(sparks, a.x, a.y, nx, ny, rand)
            }
          }

          if (a.bounced && a.y <= FLOOR_Y) {
            // Bury the projectile at a slightly varied lean — not all identical.
            const lean = (rand() - 0.5) * 0.85
            a.dirX = Math.sin(lean)
            a.dirY = -Math.cos(lean)
            a.y = FLOOR_Y - 0.12
            a.vx = 0
            a.vy = 0
            a.spinVel = 0
            a.landed = true
            a.fade = 1
          }

          // Missed the dome entirely and fell off-screen → recycle.
          if (!a.bounced && a.y < FLOOR_Y - 1) spawnProjectile(a, rand)
        } else {
          a.fade -= dt / SETTLE_TIME
          if (a.fade <= 0) spawnProjectile(a, rand)
        }

        // Safety respawn if it wanders far without resolving.
        if (!a.landed && !a.stuck && Math.hypot(a.x, a.y) > SPAWN_DIST * 2.4) {
          spawnProjectile(a, rand)
        }

        // Orientation.
        if (a.type === IMPACT_SPIN && a.bounced && !a.landed) {
          a.spin += a.spinVel * dt
          a.dirX = Math.cos(a.spin)
          a.dirY = Math.sin(a.spin)
        } else if (!a.stuck && !a.landed) {
          const vlen = Math.hypot(a.vx, a.vy)
          if (vlen > 0.001) {
            a.dirX = a.vx / vlen
            a.dirY = a.vy / vlen
          }
        }

        // Brightness by depth + state.
        const depth = 0.62 + a.scale * 0.38
        let intensity = 0.95 * depth
        if (a.landed) intensity = Math.max(0, a.fade) * 0.5 * depth
        else if (a.stuck) intensity = Math.max(0, a.fade) * 0.85 * depth
        intensity *= projGlow
        const trailI = intensity * 0.45

        // Shape (varies by kind), then write the 6 segments.
        const flying = !a.landed && !a.stuck
        const speed = Math.hypot(a.vx, a.vy)
        const trailLen = flying ? Math.min(speed * TRAIL_FACTOR, 0.35) * a.scale : 0
        buildShape(shape, a.kind, a.x, a.y, a.dirX, a.dirY, a.scale, trailLen)

        for (let s = 0; s < SEGS_PER_PROJ; s += 1) {
          const o = segBase + s * 6
          const q = s * 4
          apos[o] = shape[q]
          apos[o + 1] = shape[q + 1]
          apos[o + 2] = 0
          apos[o + 3] = shape[q + 2]
          apos[o + 4] = shape[q + 3]
          apos[o + 5] = 0
          // The last segment is the motion trail → fades to nothing at its end.
          const i1 = s === SEGS_PER_PROJ - 1 ? trailI : intensity
          const i2 = s === SEGS_PER_PROJ - 1 ? 0 : intensity
          acol[o] = V[0] * i1
          acol[o + 1] = V[1] * i1
          acol[o + 2] = V[2] * i1
          acol[o + 3] = V[0] * i2
          acol[o + 4] = V[1] * i2
          acol[o + 5] = V[2] * i2
        }
      }

      // Central impact flash.
      a.flashAge += dt
      const fo = i * 3
      ipos[fo] = a.flashX
      ipos[fo + 1] = a.flashY
      ipos[fo + 2] = 0
      const fa = a.flashAge < FLASH_DUR ? 1 - a.flashAge / FLASH_DUR : 0
      const fi = fa * fa * 2.2 * projGlow
      icol[fo] = (V[0] + 0.45) * fi
      icol[fo + 1] = (V[1] + 0.35) * fi
      icol[fo + 2] = V[2] * fi
    }

    // Sparks.
    const sp = sparkObj.geometry.getAttribute('position') as BufferAttribute
    const sc = sparkObj.geometry.getAttribute('color') as BufferAttribute
    const spos = sp.array as Float32Array
    const scol = sc.array as Float32Array
    for (let i = 0; i < sparks.length; i += 1) {
      const s = sparks[i]
      const o = i * 3
      if (s.life > 0) {
        s.life -= dt
        s.vy += SPARK_GRAVITY * dt
        s.x += s.vx * dt
        s.y += s.vy * dt
        const f = Math.max(0, s.life / s.maxLife)
        const fi = f * f * 2.0 * projGlow
        spos[o] = s.x
        spos[o + 1] = s.y
        spos[o + 2] = 0
        scol[o] = (V[0] + 0.4) * fi
        scol[o + 1] = (V[1] + 0.3) * fi
        scol[o + 2] = V[2] * fi
      } else {
        scol[o] = 0
        scol[o + 1] = 0
        scol[o + 2] = 0
      }
    }

    // Hex cell colors: Fresnel rim + expanding ripples, masked clear toward center.
    const hc = hexObj.geometry.getAttribute('color') as BufferAttribute
    const hcol = hc.array as Float32Array
    for (let h = 0; h < hex.centers.length; h += 1) {
      const cx = hex.centers[h][0]
      const cy = hex.centers[h][1]
      let g = hex.fresnel[h]
      for (let ri = 0; ri < ripples.length; ri += 1) {
        const rp = ripples[ri]
        if (rp.age >= RIPPLE_LIFE) continue
        const d = Math.hypot(cx - rp.x, cy - rp.y)
        const front = rp.age * RIPPLE_SPEED
        const rd = Math.abs(d - front)
        if (rd < RIPPLE_WIDTH) {
          const fade = 1 - rp.age / RIPPLE_LIFE
          const contrib = (1 - rd / RIPPLE_WIDTH) * fade * RIPPLE_PEAK
          if (contrib > g) g = contrib
        }
      }
      const b = g * HEX_BRIGHTNESS * glow * hex.clear[h]
      const cr = V[0] * b
      const cg = V[1] * b
      const cbb = V[2] * b
      const base = h * 6 * 2 * 3
      for (let v = 0; v < 12; v += 1) {
        hcol[base + v * 3] = cr
        hcol[base + v * 3 + 1] = cg
        hcol[base + v * 3 + 2] = cbb
      }
    }

    hc.needsUpdate = true
    ap.needsUpdate = true
    ac.needsUpdate = true
    ip.needsUpdate = true
    ic.needsUpdate = true
    sp.needsUpdate = true
    sc.needsUpdate = true
  })

  const groupScale = Array.isArray(scale) ? scale : [scale, scale, scale]

  return (
    <group position={position} rotation={rotation} scale={groupScale as [number, number, number]}>
      <lineSegments ref={hexRef} geometry={hexGeometry} material={hexMaterial} />
      <lineSegments ref={projRef} geometry={projGeometry} material={lineMaterial} />
      <points ref={impactRef} geometry={impactGeometry} material={impactMaterial} />
      <points ref={sparkRef} geometry={sparkGeometry} material={sparkMaterial} />
    </group>
  )
}
