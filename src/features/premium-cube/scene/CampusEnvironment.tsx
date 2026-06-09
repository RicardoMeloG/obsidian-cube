import { useMemo } from 'react'
import {
  CanvasTexture,
  EquirectangularReflectionMapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  TextureLoader,
} from 'three'

const ENVIRONMENT_URL = '/environments/udec-frontis.jpg'

function readEnvironmentVariant() {
  return new URLSearchParams(window.location.search).get('env') === 'wild' ? 'wild' : 'campus'
}

function drawMountainRange(
  ctx: CanvasRenderingContext2D,
  points: number[],
  baseline: number,
  color: string,
  width: number,
) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, baseline)
  points.forEach((height, index) => {
    ctx.lineTo((width / (points.length - 1)) * index, baseline - height)
  })
  ctx.lineTo(width, baseline)
  ctx.closePath()
  ctx.fill()
}

function createWildEnvironmentTexture() {
  const width = 2048
  const height = 1024
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  const sky = ctx.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, '#f6efe0')
  sky.addColorStop(0.22, '#d8e3df')
  sky.addColorStop(0.42, '#8eaaa7')
  sky.addColorStop(0.58, '#2a3434')
  sky.addColorStop(0.78, '#080b0b')
  sky.addColorStop(1, '#020303')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, width, height)

  const glow = ctx.createRadialGradient(width * 0.38, height * 0.3, 0, width * 0.38, height * 0.3, width * 0.38)
  glow.addColorStop(0, 'rgba(255, 238, 202, 0.88)')
  glow.addColorStop(0.18, 'rgba(246, 210, 150, 0.56)')
  glow.addColorStop(0.38, 'rgba(196, 217, 214, 0.2)')
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = 'rgba(255, 248, 220, 0.11)'
  ctx.fillRect(0, height * 0.39, width, 8)
  ctx.fillStyle = 'rgba(210, 232, 230, 0.06)'
  ctx.fillRect(0, height * 0.45, width, 6)

  drawMountainRange(ctx, [42, 68, 54, 96, 62, 118, 58, 86, 44, 74, 56, 104, 48], height * 0.53, '#344140', width)
  drawMountainRange(ctx, [76, 104, 82, 138, 94, 164, 98, 124, 72, 110, 88, 144, 74], height * 0.59, '#111818', width)

  const ground = ctx.createLinearGradient(0, height * 0.56, 0, height)
  ground.addColorStop(0, '#27302b')
  ground.addColorStop(0.28, '#101513')
  ground.addColorStop(1, '#020303')
  ctx.fillStyle = ground
  ctx.fillRect(0, height * 0.56, width, height * 0.44)

  const mist = ctx.createLinearGradient(0, height * 0.48, 0, height * 0.7)
  mist.addColorStop(0, 'rgba(235, 238, 218, 0.18)')
  mist.addColorStop(1, 'rgba(235, 238, 218, 0)')
  ctx.fillStyle = mist
  ctx.fillRect(0, height * 0.46, width, height * 0.2)

  ctx.fillStyle = 'rgba(4, 9, 8, 0.96)'
  for (let x = -40; x < width + 80; x += 34) {
    const treeHeight = 88 + Math.sin(x * 0.017) * 24 + Math.cos(x * 0.041) * 14
    const base = height * (0.62 + (Math.sin(x * 0.029) + 1) * 0.035)
    ctx.beginPath()
    ctx.moveTo(x, base)
    ctx.lineTo(x + 14, base - treeHeight)
    ctx.lineTo(x + 31, base)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(x + 13, base - 18, 4, 36)
  }

  const lightColumn = ctx.createLinearGradient(width * 0.32, 0, width * 0.54, 0)
  lightColumn.addColorStop(0, 'rgba(255, 239, 196, 0)')
  lightColumn.addColorStop(0.44, 'rgba(255, 239, 196, 0.16)')
  lightColumn.addColorStop(1, 'rgba(255, 239, 196, 0)')
  ctx.fillStyle = lightColumn
  ctx.fillRect(0, 0, width, height)

  const source = document.createElement('canvas')
  source.width = width
  source.height = height
  const sourceCtx = source.getContext('2d')

  if (sourceCtx) {
    sourceCtx.drawImage(canvas, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.filter = 'blur(8px)'
    ctx.drawImage(source, -8, -8, width + 16, height + 16)
    ctx.filter = 'none'
    ctx.globalAlpha = 0.24
    ctx.drawImage(source, 0, 0)
    ctx.globalAlpha = 1
  }

  const texture = new CanvasTexture(canvas)
  texture.mapping = EquirectangularReflectionMapping
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  texture.generateMipmaps = true
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  return texture
}

export function CampusEnvironment() {
  const environmentTexture = useMemo(() => {
    if (readEnvironmentVariant() === 'wild') {
      return createWildEnvironmentTexture()
    }

    const texture = new TextureLoader().load(ENVIRONMENT_URL)
    texture.mapping = EquirectangularReflectionMapping
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    texture.repeat.set(1.8, 1)
    texture.offset.set(0.18, 0)
    texture.needsUpdate = true
    return texture
  }, [])

  if (!environmentTexture) {
    return null
  }

  return <primitive object={environmentTexture} attach="environment" />
}
