import { useMemo } from 'react'
import { EquirectangularReflectionMapping, SRGBColorSpace, TextureLoader } from 'three'

// Equirectangular panorama used only as the cube's reflection map (it is never
// visible directly): a hall of black glass panels with a light ceiling, a dark
// horizon crossed by thin bright edges and one small sun. Generated for this
// site (docs/assets.md), 1024 px wide, which is enough for a reflection.
const ENVIRONMENT_URL = '/environments/obsidian-hall.jpg'

export function ReflectionEnvironment() {
  const environmentTexture = useMemo(() => {
    const texture = new TextureLoader().load(ENVIRONMENT_URL)
    texture.mapping = EquirectangularReflectionMapping
    texture.colorSpace = SRGBColorSpace
    return texture
  }, [])

  return <primitive object={environmentTexture} attach="environment" />
}
