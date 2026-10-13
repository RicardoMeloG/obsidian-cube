import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'
import { VECTOR_WORLD_THEME } from './theme'

export function createDotTexture() {
  const s = 64
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const gradient = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.34, 'rgba(220,210,255,0.55)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, s, s)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  return texture
}

export function createGlowTexture() {
  const s = 128
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const gradient = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,0.92)')
  gradient.addColorStop(0.12, 'rgba(230,218,255,0.48)')
  gradient.addColorStop(0.4, 'rgba(160,130,255,0.13)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, s, s)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  return texture
}

export function createHorizonGlowTexture(color = VECTOR_WORLD_THEME.horizonGlowColor) {
  const w = 1024
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const gradient = ctx.createRadialGradient(w / 2, h * 0.95, 0, w / 2, h * 0.95, w * 0.55)
  gradient.addColorStop(0, color)
  gradient.addColorStop(0.18, `${color}66`)
  gradient.addColorStop(0.5, `${color}22`)
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  return texture
}

export function makeSeededRandom(seed: number) {
  let state = seed >>> 0
  return function rand() {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}
