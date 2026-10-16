import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial } from 'three'
import type { Group, Texture } from 'three'
import { createVectorLineMaterial } from '../base/materials'
import { createDotTexture, createGlowTexture } from '../base/textures'
import type { WorldProps } from '../types'
import { advanceContactNetwork, CONTACT_NETWORK, createContactNetwork } from './contactNetwork'

// ── CONTACT: a network of channels converging on the cube ────────────────────
// The network itself (shape, drift, signals) is contactNetwork.ts; this file
// draws it. Physical register (AGENTS.md): a volume, not a surface; the motion
// is transport along a graph, inward, on the lateral axis, so it reads apart
// from AGENTIC's wave plane. The text side (left) only gets a faint echo.

const SIZES = { node: 80, head: 420, port: 700 }
// Below this aspect ratio the funnel narrows towards the port, so on a
// portrait screen part of it stays in view beside the cube.
const WIDE_ASPECT = 1.5
const MIN_SQUEEZE = 0.32

// Points with their own colour and strength per vertex, sized by depth.
const POINT_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aAlpha;
  uniform float uPixelRatio;
  uniform float uSize;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * uPixelRatio / -mvPosition.z * (0.75 + min(aAlpha, 1.5) * 0.5);
    vColor = aColor;
    vAlpha = aAlpha;
  }
`
const POINT_FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vColor, texture2D(uMap, gl_PointCoord).a * vAlpha);
  }
`

function pointMaterial(map: Texture | null, size: number) {
  return new ShaderMaterial({
    vertexShader: POINT_VERTEX,
    fragmentShader: POINT_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uMap: { value: map },
      uSize: { value: size },
      uPixelRatio: { value: typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio ?? 1, 2) },
    },
  })
}

// A geometry over the network's own buffers: the network writes, the GPU reads.
function geometryOf(buffers: Record<string, Float32Array>) {
  const geometry = new BufferGeometry()
  for (const [name, array] of Object.entries(buffers)) {
    geometry.setAttribute(name, new BufferAttribute(array, name === 'aAlpha' ? 1 : 3))
  }
  return geometry
}
function uploaded(geometry: BufferGeometry, segments?: number) {
  for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true
  if (segments !== undefined) geometry.setDrawRange(0, segments * 2)
}

export function ContactWorld({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, paused = false, glow = 1 }: WorldProps = {}) {
  const network = useMemo(() => createContactNetwork(), [])
  const geometries = useMemo(
    () => ({
      nodes: geometryOf(network.buffers.nodes),
      heads: geometryOf(network.buffers.heads),
      port: geometryOf(network.buffers.port),
      links: geometryOf(network.buffers.links),
      channels: geometryOf(network.buffers.channels),
      trails: geometryOf(network.buffers.trails),
    }),
    [network],
  )
  const textures = useMemo(() => ({ dot: createDotTexture(), glow: createGlowTexture() }), [])
  const materials = useMemo(
    () => ({
      nodes: pointMaterial(textures.dot, SIZES.node),
      heads: pointMaterial(textures.glow, SIZES.head),
      port: pointMaterial(textures.glow, SIZES.port),
      lines: createVectorLineMaterial({ fog: false }),
    }),
    [textures],
  )
  useEffect(
    () => () => {
      Object.values(geometries).forEach((item) => item.dispose())
      Object.values(materials).forEach((item) => item.dispose())
      textures.dot?.dispose()
      textures.glow?.dispose()
    },
    [geometries, materials, textures],
  )

  const squeezeRef = useRef<Group>(null)
  const parallaxRef = useRef<Group>(null)

  useFrame(({ clock, pointer, size }) => {
    if (paused) return
    const drawn = advanceContactNetwork(network, clock.getElapsedTime(), glow)
    uploaded(geometries.nodes)
    uploaded(geometries.heads)
    uploaded(geometries.port)
    uploaded(geometries.links, drawn.links)
    uploaded(geometries.channels, drawn.channelSegments)
    uploaded(geometries.trails, drawn.trailSegments)

    // Portrait screens: squeeze the funnel towards the port.
    const squeeze = Math.max(MIN_SQUEEZE, Math.min(1, size.width / Math.max(1, size.height) / WIDE_ASPECT))
    if (squeezeRef.current) {
      squeezeRef.current.scale.x = squeeze
      squeezeRef.current.position.x = CONTACT_NETWORK.port[0] * (1 - squeeze)
    }
    if (parallaxRef.current) parallaxRef.current.position.set(pointer.x * 0.1, pointer.y * 0.05, 0)
  })

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group ref={parallaxRef}>
        <group ref={squeezeRef}>
          <lineSegments geometry={geometries.links} material={materials.lines} />
          <lineSegments geometry={geometries.channels} material={materials.lines} />
          <lineSegments geometry={geometries.trails} material={materials.lines} />
          <points geometry={geometries.nodes} material={materials.nodes} />
          <points geometry={geometries.heads} material={materials.heads} />
          <points geometry={geometries.port} material={materials.port} />
        </group>
      </group>
    </group>
  )
}
