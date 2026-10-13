import { useMemo } from 'react'
import { EquirectangularReflectionMapping, SRGBColorSpace, TextureLoader } from 'three'

// Equirectangular photo used only as the cube's reflection map (it is never
// visible directly), so it is stored small: 1536 px wide, which reflects the
// same as the 2592 px original (compared on 2026-10-12).
const ENVIRONMENT_URL = '/environments/udec-frontis.jpg'

export function CampusEnvironment() {
  const environmentTexture = useMemo(() => {
    const texture = new TextureLoader().load(ENVIRONMENT_URL)
    texture.mapping = EquirectangularReflectionMapping
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    texture.repeat.set(1.8, 1)
    texture.offset.set(0.18, 0)
    texture.needsUpdate = true
    return texture
  }, [])

  return <primitive object={environmentTexture} attach="environment" />
}
