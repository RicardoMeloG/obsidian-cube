import { CubeUVReflectionMapping, LinearFilter, SRGBColorSpace, TextureLoader } from 'three'
import type { Texture } from 'three'

// The cube's reflection: a hall of black glass panels with a light ceiling, a
// dark horizon crossed by thin bright edges and one small sun (generated for
// this site, docs/assets.md; it is never visible directly). three.js reflects
// it from a prefiltered "cube UV" atlas; converting the panorama to one froze
// a first visit for ~0.45 s, so scripts/bake-reflection.mjs bakes the atlas
// from `obsidian-hall.jpg` and the scene loads it ready.
const ATLAS_URL = '/environments/obsidian-hall.cubeuv.webp'

// The atlas layout belongs to three's revision; baking again is required after
// an upgrade (reflection.test.ts fails until then).
export const ATLAS_THREE_REVISION = '184'

let reflection: Promise<Texture | null> | null = null

// Loaded once. The scene sets it as its environment before compiling, so the
// cube's glass and the platform compile once, with the reflection. A failed
// load means no reflection, never a failed scene.
export function loadReflection() {
  reflection ??= new Promise((resolve) => {
    new TextureLoader().load(
      ATLAS_URL,
      (texture) => {
        // As three's own atlas: filtered between texels, no mipmaps (the
        // atlas holds its own levels), colours decoded from sRGB by the GPU.
        texture.mapping = CubeUVReflectionMapping
        texture.colorSpace = SRGBColorSpace
        texture.generateMipmaps = false
        texture.minFilter = LinearFilter
        texture.magFilter = LinearFilter
        resolve(texture)
      },
      undefined,
      () => resolve(null),
    )
  })
  return reflection
}
