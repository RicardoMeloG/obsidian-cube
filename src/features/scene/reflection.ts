import { EquirectangularReflectionMapping, SRGBColorSpace, TextureLoader } from 'three'
import type { Texture } from 'three'

// Equirectangular panorama used only as the cube's reflection map (it is never
// visible directly): a hall of black glass panels with a light ceiling, a dark
// horizon crossed by thin bright edges and one small sun. Generated for this
// site (docs/assets.md), 1024 px wide, which is enough for a reflection.
const ENVIRONMENT_URL = '/environments/obsidian-hall.jpg'

let reflection: Promise<Texture | null> | null = null

// Loaded once. The scene sets it as its environment before compiling, so the
// cube's glass and the platform compile once, with the reflection, instead of
// once without it and again when it arrives. A failed load means no
// reflection, never a failed scene.
export function loadReflection() {
  reflection ??= new Promise((resolve) => {
    new TextureLoader().load(
      ENVIRONMENT_URL,
      (texture) => {
        texture.mapping = EquirectangularReflectionMapping
        texture.colorSpace = SRGBColorSpace
        resolve(texture)
      },
      undefined,
      () => resolve(null),
    )
  })
  return reflection
}
