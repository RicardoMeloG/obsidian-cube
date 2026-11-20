import { describe, expect, it } from 'vitest'
import { ShaderLib } from 'three'
import { buildPlexusPairs, createPlexusLineMaterial, glslFloat } from './plexusGpu'
import type { PlexusGpuDisplacement } from './plexusGpu'
import { makeSeededRandom } from './textures'
import { createWaveGpu, WAVE_GLSL, waveDisplacement, waveTimePhases } from '../worlds/agenticWave'

// The agentic field's grid (VectorPlexusField defaults), jittered the same way.
const cols = 85
const rows = 51
const width = 32
const depth = 28
const stepX = width / (cols - 1)
const stepY = depth / (rows - 1)
const cell = (stepX + stepY) * 0.5
const lineDistance = cell * 1.85
const radius = 2

function jitteredGrid(): Float32Array {
  const rand = makeSeededRandom(0xc0ffee)
  const xy = new Float32Array(cols * rows * 2)
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const i = r * cols + c
      xy[i * 2] = -width / 2 + c * stepX + (rand() - 0.5) * cell * 0.32
      xy[i * 2 + 1] = -depth / 2 + r * stepY + (rand() - 0.5) * cell * 0.32 * 0.62
    }
  }
  return xy
}

const key = (ax: number, ay: number, bx: number, by: number) => [ax, ay, bx, by].map((v) => v.toFixed(5)).join(',')

// The CPU loop the GPU replaces: every neighbour within the radius, linked
// when closer than the link distance once displaced.
function cpuLinks(xy: Float32Array, t: number): Set<string> {
  const z = Array.from({ length: cols * rows }, (_, i) => waveDisplacement(xy[i * 2], xy[i * 2 + 1], t))
  const links = new Set<string>()
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const i = r * cols + c
      for (let dr = 0; dr <= radius; dr += 1) {
        for (let dc = dr === 0 ? 1 : -radius; dc <= radius; dc += 1) {
          const nr = r + dr
          const nc = c + dc
          if (nr >= rows || nc < 0 || nc >= cols) continue
          const j = nr * cols + nc
          const d = Math.hypot(xy[i * 2] - xy[j * 2], xy[i * 2 + 1] - xy[j * 2 + 1], z[i] - z[j])
          if (d < lineDistance) links.add(key(xy[i * 2], xy[i * 2 + 1], xy[j * 2], xy[j * 2 + 1]))
        }
      }
    }
  }
  return links
}

// What the line shader keeps: a candidate whose displaced length is under the
// link distance (plexusFade > 0).
function gpuLinks(xy: Float32Array, t: number): Set<string> {
  const pairs = buildPlexusPairs({ baseXY: xy, cols, rows, neighborRadiusCells: radius, lineDistance })
  const links = new Set<string>()
  for (let k = 0; k < pairs.links; k += 1) {
    const v = k * 2
    const [ax, ay] = [pairs.self[v * 3], pairs.self[v * 3 + 1]]
    const [bx, by] = [pairs.other[v * 2], pairs.other[v * 2 + 1]]
    const d = Math.hypot(ax - bx, ay - by, waveDisplacement(ax, ay, t) - waveDisplacement(bx, by, t))
    if (d < lineDistance) links.add(key(ax, ay, bx, by))
  }
  return links
}

describe('buildPlexusPairs', () => {
  const xy = jitteredGrid()

  it('links exactly what the CPU loop linked, at any moment', () => {
    for (const t of [0, 7.5, 61, 1234]) {
      const cpu = cpuLinks(xy, t)
      const gpu = gpuLinks(xy, t)
      expect(gpu.size).toBe(cpu.size)
      expect([...cpu].every((link) => gpu.has(link))).toBe(true)
    }
  })

  it('stays under the CPU buffer cap, so dropping the cap changes nothing', () => {
    expect(cpuLinks(xy, 0).size).toBeLessThan(32000)
  })

  it('gives both vertices of a link each other as partner and the same horizon fade', () => {
    const pairs = buildPlexusPairs({ baseXY: xy, cols, rows, neighborRadiusCells: radius, lineDistance })
    for (const k of [0, Math.floor(pairs.links / 2), pairs.links - 1]) {
      const [a, b] = [k * 2, k * 2 + 1]
      expect(pairs.other[a * 2]).toBe(pairs.self[b * 3])
      expect(pairs.other[b * 2 + 1]).toBe(pairs.self[a * 3 + 1])
      expect(pairs.horizon[a]).toBe(pairs.horizon[b])
    }
    // Near rows are fully bright; the far edge fades out.
    expect(pairs.horizon[0]).toBe(1)
    expect(pairs.horizon[pairs.horizon.length - 1]).toBeLessThan(0.1)
  })
})

describe('the wave on the GPU', () => {
  // The shader sums sin(fx·x + fy·y + phase): the phases must give the CPU
  // wave, also after the page has been open for a day.
  it('folds time into phases that reproduce the CPU wave', () => {
    const octaves = [...WAVE_GLSL.matchAll(/sin\((\S+) \* p\.x \+ (\S+) \* p\.y \+ uWavePhase\[(\d)\]\) \* (\S+);/g)]
    expect(octaves).toHaveLength(7)
    for (const t of [0, 3.2, 86_400]) {
      const phases = waveTimePhases(t)
      for (const [x, y] of [[0, 0], [5.3, -7.1], [-15.9, 13.4]]) {
        const z = octaves.reduce((sum, [, fx, fy, i, amp]) => sum + Math.sin(Number(fx) * x + Number(fy) * y + phases[Number(i)]) * Number(amp), 0)
        expect(z).toBeCloseTo(waveDisplacement(x, y, t), 5)
      }
    }
  })

  it('updates the shared phase uniform in place', () => {
    const gpu = createWaveGpu()
    const phases = gpu.uniforms.uWavePhase.value as Float32Array
    gpu.update(10)
    expect(phases).toBe(gpu.uniforms.uWavePhase.value)
    expect(Array.from(phases)).toEqual(Array.from(waveTimePhases(10)))
  })

  it('writes float literals', () => {
    expect(glslFloat(0)).toBe('0.0')
    expect(glslFloat(-2)).toBe('-2.0')
    expect(glslFloat(0.36)).toBe('0.36')
    expect(WAVE_GLSL).not.toMatch(/[^.\d]0 \* p/)
  })
})

describe('createPlexusLineMaterial', () => {
  it('extends three line shader at every chunk it needs', () => {
    const displacement: PlexusGpuDisplacement = { glsl: 'float plexusDisplacement(vec2 p) { return 0.0; }', uniforms: {}, update: () => {} }
    const material = createPlexusLineMaterial(displacement, 1)
    const shader = { uniforms: {}, vertexShader: ShaderLib.basic.vertexShader, fragmentShader: ShaderLib.basic.fragmentShader }
    material.onBeforeCompile(shader as never, undefined as never)
    expect(shader.vertexShader).toContain('float plexusDisplacement(vec2 p)')
    expect(shader.vertexShader).toContain('vec3 transformed = vec3(position.xy, plexusZ);')
    expect(shader.vertexShader).toContain('if (plexusFade <= 0.0)')
    expect(shader.vertexShader.indexOf('float plexusZ')).toBeLessThan(shader.vertexShader.indexOf('vec3 transformed'))
    expect(Object.keys(shader.uniforms)).toEqual(expect.arrayContaining(['uLineDistance', 'uLineColor', 'uLineIntensity']))
  })
})
