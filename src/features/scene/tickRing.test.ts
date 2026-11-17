import { describe, expect, it } from 'vitest'
import { Color, Matrix4, PlaneGeometry, Vector3 } from 'three'
import { buildTickSectors, TICK_SECTORS } from './tickRing'

// The merged sectors must draw the same quads the separate tick meshes drew
// (dt-12, C-5): a plane of the tick's length and width, turned by its angle
// about the ring's axis and moved to the ring.
function separateTickCorners(radius: number, count: number, i: number, faint: boolean) {
  const angle = (i / count) * Math.PI * 2
  const length = (i % 6 === 0 ? 0.085 : 0.04) * (faint ? 0.7 : 1)
  const plane = new PlaneGeometry(length, 0.0085)
  plane.applyMatrix4(new Matrix4().makeRotationZ(angle).setPosition(Math.cos(angle) * radius, Math.sin(angle) * radius, 0))
  const pos = plane.getAttribute('position')
  return Array.from({ length: pos.count }, (_, v) => new Vector3().fromBufferAttribute(pos, v))
}

/** Every quad of a ring, in the ring's plane, with the sector's offset added back. */
function mergedCorners(radius: number, count: number, faint: boolean) {
  return buildTickSectors({ radius, count, faint }).flatMap(({ geometry, center }) => {
    const pos = geometry.getAttribute('position')
    return Array.from({ length: pos.count }, (_, v) => new Vector3().fromBufferAttribute(pos, v).add(new Vector3(center[0], center[1], 0)))
  })
}

describe('buildTickSectors', () => {
  it('splits a ring into its sectors, one quad per tick', () => {
    const sectors = buildTickSectors({ radius: 2.08, count: 84 })
    expect(sectors).toHaveLength(TICK_SECTORS)
    expect(sectors.reduce((n, s) => n + s.geometry.getAttribute('position').count, 0)).toBe(84 * 4)
    expect(sectors.reduce((n, s) => n + (s.geometry.getIndex()?.count ?? 0), 0)).toBe(84 * 6)
  })

  it('places every tick where its separate mesh was, faint ring included', () => {
    for (const [radius, count, faint] of [
      [2.08, 84, false],
      [2.5, 120, true],
    ] as const) {
      const merged = mergedCorners(radius, count, faint)
      for (let i = 0; i < count; i++) {
        for (const corner of separateTickCorners(radius, count, i, faint)) {
          expect(merged.some((v) => v.distanceTo(corner) < 1e-5)).toBe(true)
        }
      }
    }
  })

  it('sits each sector at the centre of its ticks, so it sorts where they did', () => {
    const sectors = buildTickSectors({ radius: 2.08, count: 84 })
    for (const { center } of sectors) expect(Math.hypot(center[0], center[1])).toBeGreaterThan(2.08 * 0.9)
    // The back of the ring (local +y, world -z after the group's turn) and the front land in different sectors.
    expect(sectors.some(({ center }) => center[1] > 1.5)).toBe(true)
    expect(sectors.some(({ center }) => center[1] < -1.5)).toBe(true)
  })

  it('bakes colour times opacity, which additive blending adds as before', () => {
    const [first] = buildTickSectors({ radius: 2.5, count: 120, faint: true })
    const colors = first!.geometry.getAttribute('color')
    const major = new Color('#dcd6ff').multiplyScalar(0.55 * 0.5)
    const minor = new Color('#8d82ff').multiplyScalar(0.22 * 0.5)
    expect(colors.getX(0)).toBeCloseTo(major.r, 6)
    expect(colors.getZ(0)).toBeCloseTo(major.b, 6)
    expect(colors.getY(4)).toBeCloseTo(minor.g, 6)
  })
})
