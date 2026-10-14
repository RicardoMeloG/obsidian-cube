import { AdditiveBlending, Color, LineBasicMaterial, ShaderMaterial } from 'three'
import type { Texture } from 'three'
import { VECTOR_WORLD_THEME } from './theme'
import {
  GLOW_FRAGMENT,
  GLOW_VERTEX,
  POINTS_FRAGMENT_CREST,
  POINTS_FRAGMENT_DEPTH,
  POINTS_VERTEX_CREST_Z,
  POINTS_VERTEX_HEIGHT_Y,
} from './shaders'

function readPixelRatio() {
  if (typeof window === 'undefined') return 1
  return Math.min(window.devicePixelRatio ?? 1, 2)
}

type CrestPointMaterialOptions = {
  dotTexture: Texture | null
  color?: string
  pointSizeFactor?: number
  alphaBase?: number
  alphaCrest?: number
  depthNear?: number
  depthFar?: number
  crestLow?: number
  crestHigh?: number
}

export function createCrestPointMaterial({
  dotTexture,
  color = VECTOR_WORLD_THEME.particleColor,
  pointSizeFactor = VECTOR_WORLD_THEME.pointSizeFactor,
  alphaBase = VECTOR_WORLD_THEME.pointAlphaBase,
  alphaCrest = VECTOR_WORLD_THEME.pointAlphaCrest,
  depthNear = VECTOR_WORLD_THEME.depthFadeNear,
  depthFar = VECTOR_WORLD_THEME.depthFadeFar,
  crestLow = VECTOR_WORLD_THEME.crestBoostLow,
  crestHigh = VECTOR_WORLD_THEME.crestBoostHigh,
}: CrestPointMaterialOptions) {
  return new ShaderMaterial({
    vertexShader: POINTS_VERTEX_CREST_Z,
    fragmentShader: POINTS_FRAGMENT_CREST,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uColor: { value: new Color(color) },
      uMap: { value: dotTexture },
      uPixelRatio: { value: readPixelRatio() },
      uPointSizeFactor: { value: pointSizeFactor },
      uAlphaBase: { value: alphaBase },
      uAlphaCrest: { value: alphaCrest },
      uDepthNear: { value: depthNear },
      uDepthFar: { value: depthFar },
      uCrestLow: { value: crestLow },
      uCrestHigh: { value: crestHigh },
    },
  })
}

type DepthPointMaterialOptions = {
  dotTexture: Texture | null
  color?: string
  pointSizeFactor?: number
  alphaBase?: number
  alphaCrest?: number
  depthNear?: number
  depthFar?: number
}

export function createDepthPointMaterial({
  dotTexture,
  color = VECTOR_WORLD_THEME.particleColor,
  pointSizeFactor = VECTOR_WORLD_THEME.pointSizeFactor * 1.08,
  alphaBase = VECTOR_WORLD_THEME.pointAlphaBase,
  alphaCrest = VECTOR_WORLD_THEME.pointAlphaCrest * 0.9,
  depthNear = VECTOR_WORLD_THEME.depthFadeNear,
  depthFar = VECTOR_WORLD_THEME.depthFadeFar + 8,
}: DepthPointMaterialOptions) {
  return new ShaderMaterial({
    vertexShader: POINTS_VERTEX_HEIGHT_Y,
    fragmentShader: POINTS_FRAGMENT_DEPTH,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uColor: { value: new Color(color) },
      uMap: { value: dotTexture },
      uPixelRatio: { value: readPixelRatio() },
      uPointSizeFactor: { value: pointSizeFactor },
      uAlphaBase: { value: alphaBase },
      uAlphaCrest: { value: alphaCrest },
      uDepthNear: { value: depthNear },
      uDepthFar: { value: depthFar },
    },
  })
}

type GlowMaterialOptions = {
  glowTexture: Texture | null
  color?: string
  pointSizeFactor?: number
  depthNear?: number
  depthFar?: number
}

export function createGlowMaterial({
  glowTexture,
  color = VECTOR_WORLD_THEME.lampGlowColor,
  pointSizeFactor = VECTOR_WORLD_THEME.pointSizeFactor * 5.6,
  depthNear = VECTOR_WORLD_THEME.depthFadeNear,
  depthFar = VECTOR_WORLD_THEME.depthFadeFar + 8,
}: GlowMaterialOptions) {
  return new ShaderMaterial({
    vertexShader: GLOW_VERTEX,
    fragmentShader: GLOW_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uColor: { value: new Color(color) },
      uMap: { value: glowTexture },
      uPixelRatio: { value: readPixelRatio() },
      uPointSizeFactor: { value: pointSizeFactor },
      uDepthNear: { value: depthNear },
      uDepthFar: { value: depthFar },
    },
  })
}

type LineMaterialOptions = {
  fog?: boolean
  depthTest?: boolean
  depthWrite?: boolean
}

export function createVectorLineMaterial({
  fog = true,
  depthTest = true,
  depthWrite = false,
}: LineMaterialOptions = {}) {
  return new LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthTest,
    depthWrite,
    fog,
    blending: AdditiveBlending,
  })
}
