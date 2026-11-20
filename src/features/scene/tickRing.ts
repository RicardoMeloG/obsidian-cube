import { BufferAttribute, BufferGeometry, Color } from 'three'

const MAJOR_COLOR = '#dcd6ff'
const MINOR_COLOR = '#8d82ff'
const TICK_WIDTH = 0.0085
// Sectors per ring. One mesh per sector keeps the depth order the separate
// tick meshes had (see buildTickSectors) at a few draw calls per ring.
export const TICK_SECTORS = 8

export type TickRingOptions = {
  radius: number
  count: number
  faint?: boolean
}

export type TickSector = {
  geometry: BufferGeometry
  /** Where the sector's mesh sits in the ring's plane; its vertices are relative to it. */
  center: [number, number]
}

/** The ticks of one pedestal ring, merged by sector (dt-12, C-5). They were one
 *  mesh and one material per tick, 204 of the scene's 224 draw calls.
 *
 *  Colour: the blending is additive (SrcAlpha, One), so a tick's colour times
 *  its opacity, baked into the vertex colour with the material at full opacity,
 *  adds exactly what the separate meshes added.
 *
 *  Order: three sorts transparent objects by their position. The ticks behind
 *  the cube used to sort farther than the pedestal's translucent disc, so the
 *  disc was drawn over them and dimmed them; the ones in front were drawn after
 *  it, at full strength. A single mesh at the ring's centre lost that and lit
 *  the back half (walkthrough, 2026-11-16). Each sector's mesh sits at the
 *  centre of its own ticks, so it sorts where they did. */
export function buildTickSectors({ radius, count, faint = false }: TickRingOptions, sectors = TICK_SECTORS): TickSector[] {
  const major = new Color(MAJOR_COLOR)
  const minor = new Color(MINOR_COLOR)
  const halfWidth = TICK_WIDTH / 2
  const bySector: number[][] = Array.from({ length: sectors }, () => [])
  for (let i = 0; i < count; i++) bySector[Math.floor((i / count) * sectors)]!.push(i)

  return bySector
    .filter((ticks) => ticks.length > 0)
    .map((ticks) => {
      const angleOf = (i: number) => (i / count) * Math.PI * 2
      const cx0 = ticks.reduce((sum, i) => sum + Math.cos(angleOf(i)) * radius, 0) / ticks.length
      const cy0 = ticks.reduce((sum, i) => sum + Math.sin(angleOf(i)) * radius, 0) / ticks.length
      const positions = new Float32Array(ticks.length * 4 * 3)
      const colors = new Float32Array(ticks.length * 4 * 3)
      const indices = new Uint16Array(ticks.length * 6)
      ticks.forEach((i, k) => {
        const angle = angleOf(i)
        const isMajor = i % 6 === 0
        const halfLength = ((isMajor ? 0.085 : 0.04) * (faint ? 0.7 : 1)) / 2
        const opacity = (isMajor ? 0.55 : 0.22) * (faint ? 0.5 : 1)
        const color = isMajor ? major : minor
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const cx = cos * radius - cx0
        const cy = sin * radius - cy0
        // Corners: radial (cos, sin) times ±halfLength, tangent (-sin, cos) times ±halfWidth.
        const corners = [
          [-halfLength, -halfWidth],
          [halfLength, -halfWidth],
          [halfLength, halfWidth],
          [-halfLength, halfWidth],
        ] as const
        corners.forEach(([along, across], c) => {
          const v = (k * 4 + c) * 3
          positions[v] = cx + cos * along - sin * across
          positions[v + 1] = cy + sin * along + cos * across
          positions[v + 2] = 0
          colors[v] = color.r * opacity
          colors[v + 1] = color.g * opacity
          colors[v + 2] = color.b * opacity
        })
        const base = k * 4
        indices.set([base, base + 1, base + 2, base, base + 2, base + 3], k * 6)
      })
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new BufferAttribute(positions, 3))
      geometry.setAttribute('color', new BufferAttribute(colors, 3))
      geometry.setIndex(new BufferAttribute(indices, 1))
      return { geometry, center: [cx0, cy0] as [number, number] }
    })
}
