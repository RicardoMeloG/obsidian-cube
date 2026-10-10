import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { AdditiveBlending, CanvasTexture, Color, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three'
import type { Mesh, MeshBasicMaterial } from 'three'
import type { CubeSectionId } from '../cubeSections'
import type { ResolvedCubeSection } from '../content/visualContent'

const FACE_ACCENT_SOFT = 'rgba(170, 160, 255, 0.6)'

// Per-face glyph (ADR 003) — recovered from an earlier iteration. Every face
// keeps the shared "double-diamond" frame (the cube grammar) but carries its own
// quiet geometric symbol in the section accent, so each face reads as distinct
// without abandoning the obsidian language. Drawn at scale `s` (≈ the old single
// diamond footprint); legacy coordinates were authored around ±90, so `k` maps
// them onto the requested size.
function drawFaceGlyph(
  ctx: CanvasRenderingContext2D,
  sectionId: CubeSectionId,
  accent: string,
  x: number,
  y: number,
  s: number,
) {
  const k = s / 90

  ctx.save()
  ctx.translate(x, y)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.lineWidth = Math.max(2.5, s * 0.035)

  // Shared double-diamond frame — outer in faint ice-white, inner in the face
  // accent. This is the constant cube grammar that ties all six faces together.
  ctx.save()
  ctx.rotate(Math.PI / 4)
  ctx.shadowBlur = s * 0.1
  ctx.shadowColor = accent
  ctx.globalAlpha = 0.5
  ctx.strokeStyle = 'rgba(228, 239, 248, 0.82)'
  ctx.strokeRect(-74 * k, -74 * k, 148 * k, 148 * k)
  ctx.globalAlpha = 0.72
  ctx.strokeStyle = accent
  ctx.strokeRect(-44 * k, -44 * k, 88 * k, 88 * k)
  ctx.restore()

  // Inner symbol — tenue, in the face accent.
  ctx.strokeStyle = accent
  ctx.fillStyle = accent
  ctx.shadowBlur = s * 0.16
  ctx.shadowColor = accent
  ctx.globalAlpha = 0.88

  switch (sectionId) {
    case 'agentic': // mira / dirección — cruz con núcleo
      ctx.beginPath()
      ctx.moveTo(-94 * k, 0)
      ctx.lineTo(94 * k, 0)
      ctx.moveTo(0, -94 * k)
      ctx.lineTo(0, 94 * k)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, 9 * k, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'products': // paquetes / releases — cajas apiladas
      ctx.strokeRect(-58 * k, -42 * k, 116 * k, 84 * k)
      ctx.beginPath()
      ctx.moveTo(-36 * k, -14 * k)
      ctx.lineTo(34 * k, -14 * k)
      ctx.moveTo(-36 * k, 14 * k)
      ctx.lineTo(18 * k, 14 * k)
      ctx.stroke()
      break
    case 'systems': // arquitectura — dos nodos conectados
      ctx.beginPath()
      ctx.arc(-46 * k, -28 * k, 20 * k, 0, Math.PI * 2)
      ctx.arc(48 * k, 30 * k, 20 * k, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-30 * k, -14 * k)
      ctx.lineTo(32 * k, 16 * k)
      ctx.stroke()
      break
    case 'security': // escudo con check
      ctx.beginPath()
      ctx.moveTo(0, -62 * k)
      ctx.lineTo(54 * k, -36 * k)
      ctx.lineTo(54 * k, 14 * k)
      ctx.quadraticCurveTo(54 * k, 52 * k, 0, 70 * k)
      ctx.quadraticCurveTo(-54 * k, 52 * k, -54 * k, 14 * k)
      ctx.lineTo(-54 * k, -36 * k)
      ctx.closePath()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-24 * k, 2 * k)
      ctx.lineTo(-6 * k, 22 * k)
      ctx.lineTo(30 * k, -26 * k)
      ctx.stroke()
      break
    case 'research': // pensamiento — ondas + núcleo
      ctx.beginPath()
      ctx.moveTo(-58 * k, 34 * k)
      ctx.bezierCurveTo(-28 * k, -58 * k, 28 * k, -58 * k, 58 * k, 34 * k)
      ctx.moveTo(-58 * k, -26 * k)
      ctx.bezierCurveTo(-22 * k, 8 * k, 22 * k, 8 * k, 58 * k, -26 * k)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, 13 * k, 0, Math.PI * 2)
      ctx.stroke()
      break
    case 'contact': // canal — sobre
      ctx.strokeRect(-60 * k, -38 * k, 120 * k, 76 * k)
      ctx.beginPath()
      ctx.moveTo(-58 * k, -34 * k)
      ctx.lineTo(0, 12 * k)
      ctx.lineTo(58 * k, -34 * k)
      ctx.stroke()
      break
  }

  ctx.restore()
}

function getFaceLabelTypography(label: string) {
  const length = Array.from(label).length

  if (length >= 12) {
    return { fontSize: 82, letterSpacing: 12 }
  }

  if (length >= 10) {
    return { fontSize: 92, letterSpacing: 16 }
  }

  if (length >= 8) {
    return { fontSize: 104, letterSpacing: 20 }
  }

  return { fontSize: 116, letterSpacing: 28 }
}

function createFaceTexture(section: ResolvedCubeSection) {
  const size = 1536
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  ctx.clearRect(0, 0, size, size)

  const outerInset = 110
  const innerInset = 200
  const innerW = size - innerInset * 2
  const innerH = size - innerInset * 2
  const bracketLen = 90

  const baseShade = ctx.createLinearGradient(0, 0, 0, size)
  baseShade.addColorStop(0, 'rgba(20, 22, 50, 0.28)')
  baseShade.addColorStop(0.5, 'rgba(6, 8, 22, 0.1)')
  baseShade.addColorStop(1, 'rgba(2, 3, 10, 0.22)')
  ctx.fillStyle = baseShade
  ctx.fillRect(0, 0, size, size)

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(outerInset, outerInset + bracketLen)
  ctx.lineTo(outerInset, outerInset)
  ctx.lineTo(outerInset + bracketLen, outerInset)
  ctx.moveTo(size - outerInset - bracketLen, outerInset)
  ctx.lineTo(size - outerInset, outerInset)
  ctx.lineTo(size - outerInset, outerInset + bracketLen)
  ctx.moveTo(outerInset, size - outerInset - bracketLen)
  ctx.lineTo(outerInset, size - outerInset)
  ctx.lineTo(outerInset + bracketLen, size - outerInset)
  ctx.moveTo(size - outerInset - bracketLen, size - outerInset)
  ctx.lineTo(size - outerInset, size - outerInset)
  ctx.lineTo(size - outerInset, size - outerInset - bracketLen)
  ctx.strokeStyle = 'rgba(170, 165, 220, 0.32)'
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.restore()

  const innerShadow = ctx.createLinearGradient(0, innerInset, 0, size - innerInset)
  innerShadow.addColorStop(0, 'rgba(0, 0, 4, 0.32)')
  innerShadow.addColorStop(0.22, 'rgba(0, 0, 4, 0.06)')
  innerShadow.addColorStop(0.6, 'rgba(0, 0, 4, 0)')
  innerShadow.addColorStop(1, 'rgba(0, 0, 4, 0.22)')
  ctx.fillStyle = innerShadow
  ctx.fillRect(innerInset, innerInset, innerW, innerH)

  ctx.strokeStyle = 'rgba(0, 0, 6, 0.6)'
  ctx.lineWidth = 3
  ctx.strokeRect(innerInset, innerInset, innerW, innerH)
  ctx.strokeStyle = 'rgba(190, 185, 235, 0.38)'
  ctx.lineWidth = 1.2
  ctx.strokeRect(innerInset - 2, innerInset - 2, innerW + 4, innerH + 4)

  ctx.save()
  ctx.beginPath()
  ctx.rect(innerInset, innerInset, innerW, 18)
  const topBevel = ctx.createLinearGradient(0, innerInset, 0, innerInset + 18)
  topBevel.addColorStop(0, 'rgba(230, 230, 255, 0.28)')
  topBevel.addColorStop(1, 'rgba(230, 230, 255, 0)')
  ctx.fillStyle = topBevel
  ctx.fill()
  ctx.restore()

  const innerGlow = ctx.createRadialGradient(size * 0.5, size * 0.42, 0, size * 0.5, size * 0.5, size * 0.46)
  innerGlow.addColorStop(0, 'rgba(140, 130, 255, 0.24)')
  innerGlow.addColorStop(0.46, 'rgba(60, 50, 140, 0.08)')
  innerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = innerGlow
  ctx.fillRect(innerInset, innerInset, innerW, innerH)

  drawFaceGlyph(ctx, section.id, section.accent, size * 0.5, size * 0.38, 150)

  const faceTypography = getFaceLabelTypography(section.label)

  ctx.fillStyle = 'rgba(244, 245, 255, 0.98)'
  ctx.font = `300 ${faceTypography.fontSize}px "Inter", "Helvetica Neue", Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.letterSpacing = `${faceTypography.letterSpacing}px`
  ctx.shadowBlur = 28
  // Subtle per-face tint on the label glow ties the title to its accent.
  ctx.shadowColor = section.accent
  ctx.fillText(section.label, size * 0.5, size * 0.6)

  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(220, 218, 250, 0.78)'
  ctx.font = '300 58px "Inter", "Helvetica Neue", Arial, sans-serif'
  ctx.letterSpacing = '20px'
  ctx.fillText('OBSIDIAN CUBE', size * 0.5, size * 0.69)

  ctx.fillStyle = FACE_ACCENT_SOFT
  const dotY = size * 0.78
  const dotR = 8
  const dotGap = 40
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath()
    ctx.arc(size * 0.5 + i * dotGap, dotY, dotR, 0, Math.PI * 2)
    ctx.fill()
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 16
  texture.generateMipmaps = true
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  return texture
}

function createShineTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  const gradient = ctx.createRadialGradient(size * 0.5, size * 0.5, 0, size * 0.5, size * 0.5, size * 0.5)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.12, 'rgba(214,214,255,0.95)')
  gradient.addColorStop(0.3, 'rgba(132,123,255,0.38)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  ctx.save()
  ctx.translate(size * 0.5, size * 0.5)
  ctx.strokeStyle = 'rgba(220,222,255,0.92)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(-86, 0)
  ctx.lineTo(86, 0)
  ctx.moveTo(0, -86)
  ctx.lineTo(0, 86)
  ctx.stroke()
  ctx.restore()

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

type ShineGlintsProps = {
  animate: boolean
}

function ShineGlints({ animate }: ShineGlintsProps) {
  const shineTexture = useMemo(() => createShineTexture(), [])
  const glints = useMemo(
    () => [
      { position: [0.9, 0.86, 1.13] as const, rotation: [0.12, 0.18, 0.22] as const, scale: 0.18, delay: 0 },
      { position: [1.13, 0.05, 0.72] as const, rotation: [0.08, 1.58, -0.12] as const, scale: 0.22, delay: 1.2 },
      { position: [-0.72, -0.36, 1.13] as const, rotation: [0.1, -0.05, 0.62] as const, scale: 0.16, delay: 2.1 },
      { position: [0.2, 1.13, 0.28] as const, rotation: [-1.48, 0, 0.72] as const, scale: 0.2, delay: 3 },
      { position: [-1.13, 0.48, -0.24] as const, rotation: [0.06, -1.52, 0.4] as const, scale: 0.14, delay: 4 },
    ],
    [],
  )
  const meshRefs = useMemo(() => [] as Mesh[], [])

  // The glints are an opt-in effect. When disabled they must not render at all
  // — otherwise the sprites sit on the cube as static white flares (no pulse),
  // which clashes with the genuinely dynamic glow elsewhere in the scene.
  useFrame(({ clock }) => {
    if (!animate) {
      return
    }

    const t = clock.getElapsedTime()

    meshRefs.forEach((mesh, index) => {
      const material = mesh.material as MeshBasicMaterial
      const pulse = (Math.sin(t * 0.42 + glints[index].delay) + 1) * 0.5
      const scale = glints[index].scale * (0.94 + pulse * 0.12)

      material.opacity = 0.22 + pulse * 0.16
      mesh.scale.setScalar(scale)
      mesh.rotation.z += 0.0008 + pulse * 0.0005
    })
  })

  if (!animate) {
    return null
  }

  return (
    <>
      {glints.map((glint, index) => (
        <mesh
          key={index}
          position={glint.position}
          rotation={glint.rotation}
          scale={glint.scale}
          ref={(node) => {
            if (node) {
              meshRefs[index] = node
            }
          }}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={shineTexture}
            transparent
            opacity={0.3}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  )
}

type PremiumCubeProps = {
  animateGlints: boolean
  sections: ResolvedCubeSection[]
  shadows: boolean
}

export function PremiumCube({ animateGlints, sections, shadows }: PremiumCubeProps) {
  const faceTextures = useMemo(() => sections.map(createFaceTexture), [sections])
  const facePanels = [
    { position: [0, 0, 1.118] as const, rotation: [0, 0, 0] as const, texture: faceTextures[0] },
    { position: [1.118, 0, 0] as const, rotation: [0, Math.PI / 2, 0] as const, texture: faceTextures[1] },
    { position: [0, 1.118, 0] as const, rotation: [-Math.PI / 2, 0, 0] as const, texture: faceTextures[2] },
    { position: [0, 0, -1.118] as const, rotation: [0, Math.PI, 0] as const, texture: faceTextures[3] },
    { position: [-1.118, 0, 0] as const, rotation: [0, -Math.PI / 2, 0] as const, texture: faceTextures[4] },
    { position: [0, -1.118, 0] as const, rotation: [Math.PI / 2, 0, 0] as const, texture: faceTextures[5] },
  ]

  return (
    <group>
      <RoundedBox args={[2.18, 2.18, 2.18]} radius={0.1} smoothness={10} castShadow={shadows} receiveShadow={shadows}>
        <meshPhysicalMaterial
          color={new Color('#010208')}
          metalness={0.92}
          roughness={0.13}
          clearcoat={1}
          clearcoatRoughness={0.05}
          emissive={new Color('#020410')}
          emissiveIntensity={0.1}
          envMapIntensity={0.95}
          reflectivity={1}
          transmission={0.02}
          thickness={0.32}
          ior={1.6}
        />
      </RoundedBox>

      {facePanels.map((panel, index) => (
        <mesh key={sections[index].id} position={panel.position} rotation={panel.rotation}>
          <planeGeometry args={[2, 2]} />
          <meshBasicMaterial
            map={panel.texture}
            transparent
            opacity={0.92}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      <ShineGlints animate={animateGlints} />
    </group>
  )
}
