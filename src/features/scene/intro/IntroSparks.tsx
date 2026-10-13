import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Euler, Quaternion, ShaderMaterial, Vector3 } from 'three'
import type { Points } from 'three'
import { INTRO, fallOffset, fallProgress, fallTurn } from './introTimeline'

// Sparks of the intro (specs/009-cube-intro): shed from the cube's edges while it
// falls, then a low burst over the platform when it lands. Every particle's
// release point, release time, velocity and size is computed once here from the
// intro timeline, so the GPU only evaluates age, drift and fade per frame — no
// per-frame allocations, one draw call. Glow is additive points, never Bloom.

const FALL_SPARKS = 320
const LANDING_SPARKS = 90
const HALF_EDGE = 1.09 // half of the 2.18 RoundedBox edge

// Deterministic PRNG so the sequence looks the same on every visit.
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let r = Math.imul(a ^ (a >>> 15), 1 | a)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

// A random point on one of the cube's twelve edges, in local space.
function edgePoint(random: () => number, out: Vector3) {
  const axis = Math.floor(random() * 3)
  const a = random() < 0.5 ? -HALF_EDGE : HALF_EDGE
  const b = random() < 0.5 ? -HALF_EDGE : HALF_EDGE
  const along = (random() * 2 - 1) * HALF_EDGE
  if (axis === 0) out.set(along, a, b)
  else if (axis === 1) out.set(a, along, b)
  else out.set(a, b, along)
  return out
}

type SparkLayout = {
  cubeScale: number
  cubeBaseY: number
  faceQuaternion: Quaternion
}

function buildGeometry({ cubeScale, cubeBaseY, faceQuaternion }: SparkLayout) {
  const total = FALL_SPARKS + LANDING_SPARKS
  const origin = new Float32Array(total * 3)
  const velocity = new Float32Array(total * 3)
  // birth, life, drag, size
  const timing = new Float32Array(total * 4)
  const tone = new Float32Array(total)
  const random = mulberry32(9)
  const local = new Vector3()
  const outward = new Vector3()
  const rotation = new Quaternion()
  const euler = new Euler()

  for (let i = 0; i < total; i += 1) {
    const isFall = i < FALL_SPARKS
    let birth: number

    if (isFall) {
      // Density proportional to the cube's speed: denser in the fast middle of
      // the fall. Rejection-sample against the slope of the fall curve.
      for (;;) {
        const p = 0.04 + random() * 0.94
        const t = INTRO.fallStart + p * (INTRO.land - INTRO.fallStart)
        const speed = (fallProgress(t + 0.01) - fallProgress(t - 0.01)) / 0.02
        if (random() * 2.2 < speed) {
          birth = t
          break
        }
      }
      const turn = fallTurn(birth)
      euler.set(turn.pitch, turn.yaw, 0)
      rotation.setFromEuler(euler).multiply(faceQuaternion)
      edgePoint(random, local)
      outward.copy(local).normalize().applyQuaternion(rotation)
      local.applyQuaternion(rotation).multiplyScalar(cubeScale)
      local.y += cubeBaseY + fallOffset(birth)

      // Left behind by the falling cube: a slow drift up and outward.
      const spread = 0.08 + random() * 0.18
      velocity.set([outward.x * spread, 0.12 + random() * 0.24, outward.z * spread], i * 3)
      timing.set([birth, 0.7 + random() * 0.6, 1.2, 6 + random() * 8], i * 4)
    } else {
      // Landing burst from the bottom edges, low and outward over the platform.
      birth = INTRO.land + random() * 0.06
      const angle = random() * Math.PI * 2
      local.set(Math.cos(angle) * HALF_EDGE * cubeScale, cubeBaseY - HALF_EDGE * cubeScale, Math.sin(angle) * HALF_EDGE * cubeScale)
      const speed = 0.8 + random() * 1.1
      velocity.set([Math.cos(angle) * speed, 0.05 + random() * 0.22, Math.sin(angle) * speed], i * 3)
      timing.set([birth, 0.8 + random() * 0.6, 2.6, 5 + random() * 6], i * 4)
    }

    origin.set([local.x, local.y, local.z], i * 3)
    tone[i] = random()
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(origin, 3))
  geometry.setAttribute('aVelocity', new BufferAttribute(velocity, 3))
  geometry.setAttribute('aTiming', new BufferAttribute(timing, 4))
  geometry.setAttribute('aTone', new BufferAttribute(tone, 1))
  return geometry
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute vec3 aVelocity;
  attribute vec4 aTiming;
  attribute float aTone;
  varying float vAlpha;
  varying float vTone;

  void main() {
    float age = uTime - aTiming.x;
    float life = aTiming.y;
    float drag = aTiming.z;

    if (age < 0.0 || age > life) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      return;
    }

    // Velocity decays with drag: distance = v * (1 - e^(-k·age)) / k.
    vec3 travelled = aVelocity * (1.0 - exp(-drag * age)) / drag;
    vec4 mv = modelViewMatrix * vec4(position + travelled, 1.0);
    gl_Position = projectionMatrix * mv;

    float fadeIn = smoothstep(0.0, 0.06, age);
    float fadeOut = 1.0 - smoothstep(life * 0.55, life, age);
    float twinkle = 0.78 + 0.22 * sin(aTone * 61.0 + age * 19.0);
    vAlpha = fadeIn * fadeOut * twinkle;
    vTone = aTone;
    // Born large and hot, shrinking as it cools.
    float shrink = mix(1.0, 0.4, clamp(age / life, 0.0, 1.0));
    gl_PointSize = aTiming.w * shrink * uPixelRatio * (7.0 / -mv.z);
  }
`

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying float vTone;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    // smoothstep needs edge0 < edge1 (reversed edges are undefined in GLSL and
    // return 0 on D3D), hence 1 - smoothstep.
    float core = 1.0 - smoothstep(0.0, 0.22, d);
    float halo = 1.0 - smoothstep(0.1, 0.5, d);
    vec3 ice = vec3(0.92, 0.96, 1.0);
    vec3 violet = vec3(0.74, 0.69, 1.0);
    gl_FragColor = vec4(mix(violet, ice, vTone), (core + 0.7 * halo * halo) * vAlpha);
  }
`

type IntroSparksProps = SparkLayout & {
  getTime: () => number
}

export function IntroSparks({ cubeScale, cubeBaseY, faceQuaternion, getTime }: IntroSparksProps) {
  const pixelRatio = useThree((state) => state.viewport.dpr)
  const geometry = useMemo(
    () => buildGeometry({ cubeScale, cubeBaseY, faceQuaternion }),
    [cubeScale, cubeBaseY, faceQuaternion],
  )
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  const pointsRef = useRef<Points>(null)

  useFrame(() => {
    const uniforms = (pointsRef.current?.material as ShaderMaterial | undefined)?.uniforms
    if (!uniforms) return
    uniforms.uTime.value = getTime()
    uniforms.uPixelRatio.value = pixelRatio
  })

  // Positions live in the shader, so bounds-based culling would be wrong.
  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
}
