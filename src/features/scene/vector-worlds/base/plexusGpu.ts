import { AdditiveBlending, BufferAttribute, BufferGeometry, LineBasicMaterial, Vector3 } from 'three'
import type { IUniform } from 'three'
import { VECTOR_WORLD_THEME } from './theme'

// The moving plexus on the GPU (dt-12, load audit C-3). The CPU version
// displaced every point, searched the neighbours for links and uploaded about
// 21,000 segments (two 1.5 MB buffers) every other frame: with the CPU slowed
// 4x and the pointer moving, the main thread stayed at 90 %. Here the points
// and the candidate links are uploaded once; the vertex shaders displace them
// and decide, every frame, which links show and how bright, with the same
// formula the CPU loop used. A static field (a terrain) is still computed
// once on the CPU: it costs nothing per frame.

export type PlexusUniforms = Record<string, IUniform>

// A displacement the shaders can evaluate. `glsl` defines
// `float plexusDisplacement(vec2 p)`: the same surface as the field's
// JavaScript displacement. `update` writes the uniforms for the clock's time
// once per frame, before the field is drawn.
export type PlexusGpuDisplacement = {
  glsl: string
  uniforms: PlexusUniforms
  update: (t: number) => void
}

export type PlexusPairs = {
  // Per vertex: its own point (x, y, 0), its partner's (x, y) and the
  // horizon fade of the link. Two vertices per link, partners of each other.
  self: Float32Array
  other: Float32Array
  horizon: Float32Array
  links: number
}

type PairOptions = {
  baseXY: Float32Array
  cols: number
  rows: number
  neighborRadiusCells: number
  lineDistance: number
}

// Every link the CPU walk could draw: the same neighbours (the rest of the
// row, then the next rows within the radius), kept only when the two points
// are closer than the link distance on the plane. Displacement only adds
// distance along z, so a pair already too far apart on the plane is never
// linked; the set is fixed and the shader filters it every frame.
export function buildPlexusPairs({ baseXY, cols, rows, neighborRadiusCells, lineDistance }: PairOptions): PlexusPairs {
  const lineDistanceSq = lineDistance * lineDistance
  const horizonStart = rows * 0.45
  const horizonRange = rows - horizonStart
  const pairs: number[] = []
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const i = r * cols + c
      for (let dr = 0; dr <= neighborRadiusCells; dr += 1) {
        for (let dc = dr === 0 ? 1 : -neighborRadiusCells; dc <= neighborRadiusCells; dc += 1) {
          const nr = r + dr
          const nc = c + dc
          if (nr >= rows || nc < 0 || nc >= cols) continue
          const j = nr * cols + nc
          const dx = baseXY[i * 2] - baseXY[j * 2]
          const dy = baseXY[i * 2 + 1] - baseXY[j * 2 + 1]
          if (dx * dx + dy * dy < lineDistanceSq) pairs.push(i, j, r + nr)
        }
      }
    }
  }
  const links = pairs.length / 3
  const self = new Float32Array(links * 2 * 3)
  const other = new Float32Array(links * 2 * 2)
  const horizon = new Float32Array(links * 2)
  for (let k = 0; k < links; k += 1) {
    const i = pairs[k * 3]
    const j = pairs[k * 3 + 1]
    const avgRow = pairs[k * 3 + 2] * 0.5
    const fade = avgRow <= horizonStart ? 1 : Math.max(0, 1 - (avgRow - horizonStart) / horizonRange)
    for (const [v, a, b] of [[k * 2, i, j], [k * 2 + 1, j, i]]) {
      self[v * 3] = baseXY[a * 2]
      self[v * 3 + 1] = baseXY[a * 2 + 1]
      other[v * 2] = baseXY[b * 2]
      other[v * 2 + 1] = baseXY[b * 2 + 1]
      horizon[v] = fade
    }
  }
  return { self, other, horizon, links }
}

export function createPlexusPairGeometry(pairs: PlexusPairs): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(pairs.self, 3))
  geometry.setAttribute('aOther', new BufferAttribute(pairs.other, 2))
  geometry.setAttribute('aHorizon', new BufferAttribute(pairs.horizon, 1))
  return geometry
}

// The link colour of the CPU loop, per vertex: fade with distance, crest
// boost from the mean height, horizon fade. A link at or past the link
// distance is moved outside the clip volume, so it is never rasterised.
const LINE_VERTEX_HEAD = /* glsl */ `
  attribute vec2 aOther;
  attribute float aHorizon;
  uniform float uLineDistance;
  uniform vec3 uLineColor;
  uniform float uLineIntensity;
  uniform float uCrestLow;
  uniform float uCrestHigh;
`

const LINE_VERTEX_COLOR = /* glsl */ `
  float plexusZ = plexusDisplacement(position.xy);
  float plexusOtherZ = plexusDisplacement(aOther);
  float plexusFade = 1.0 - length(vec3(position.xy - aOther, plexusZ - plexusOtherZ)) / uLineDistance;
  float plexusCrest = clamp(((plexusZ + plexusOtherZ) * 0.5 - uCrestLow) / (uCrestHigh - uCrestLow), 0.0, 1.0);
  vColor.rgb = uLineColor * (uLineIntensity * plexusFade * (0.45 + plexusFade * 0.55) * (0.35 + plexusCrest * 0.85) * (0.25 + aHorizon * 0.95));
`

// three's own line material, so fog, tone mapping and the output colour space
// stay exactly those of the CPU version; only the vertex stage is extended.
export function createPlexusLineMaterial(displacement: PlexusGpuDisplacement, lineDistance: number): LineBasicMaterial {
  const material = new LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    fog: true,
    blending: AdditiveBlending,
  })
  const [r, g, b] = VECTOR_WORLD_THEME.lineColorRgb
  const uniforms: PlexusUniforms = {
    ...displacement.uniforms,
    uLineDistance: { value: lineDistance },
    // Linear values, used as the CPU version used its vertex colours.
    uLineColor: { value: new Vector3(r, g, b) },
    uLineIntensity: { value: VECTOR_WORLD_THEME.lineGlobalIntensity },
    uCrestLow: { value: VECTOR_WORLD_THEME.crestBoostLow },
    uCrestHigh: { value: VECTOR_WORLD_THEME.crestBoostHigh },
  }
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <common>', `#include <common>\n${LINE_VERTEX_HEAD}\n${displacement.glsl}`)
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <color_vertex>', `#include <color_vertex>\n${LINE_VERTEX_COLOR}`)
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <begin_vertex>', 'vec3 transformed = vec3(position.xy, plexusZ);')
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <project_vertex>', '#include <project_vertex>\n  if (plexusFade <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);')
  }
  material.customProgramCacheKey = () => `plexus-line|${displacement.glsl}`
  return material
}

// A chunk three renamed would leave the shader silently unchanged: fail loudly.
function replaceOnce(source: string, chunk: string, replacement: string): string {
  if (!source.includes(chunk)) throw new Error(`plexus line shader: ${chunk} not found`)
  return source.replace(chunk, replacement)
}

// GLSL float literal: `0` would be an int, and int * float does not compile.
export function glslFloat(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value)
}
