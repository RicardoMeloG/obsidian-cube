import { makeSeededRandom } from '../base/textures'
import { VECTOR_WORLD_THEME } from '../base/theme'

// The CONTACT world's network (contactWorld.tsx draws it): a sparse 3D graph
// that opens like a funnel from the right edge of the screen and narrows into
// a port beside the cube. Its nodes drift without pause, so its links keep
// forming and breaking, and sand signals travel the channels node to node
// until the cube takes them in. No React and no three: it writes plain buffers
// the component hands to the GPU.

export const CONTACT_NETWORK = {
  seed: 0x5ea1ed,
  // Where every channel ends: just right of and behind the cube.
  port: [1.05, 0.22, -0.9] as const,
  funnelNodes: 132,
  echoNodes: 34,
  funnelLength: 12.5,
  // Nothing rises into the top band beside the text, where the name and the
  // role are read; away from it, on the right, the funnel opens higher.
  maxY: 3.5,
  openMaxY: 6,
  echoMaxY: 2.4,
  linkDistance: 2.3,
  // A node keeps a few links, so the web reads as a network, not a mesh.
  linksPerNode: 3,
  maxLinks: 600,
  channels: 9,
  signalsPerChannel: 2,
  // Fraction of a channel travelled per second.
  signalSpeed: [0.045, 0.07] as const,
  trailLength: 1.1,
  trailSteps: 6,
} as const

const C = CONTACT_NETWORK
const SAND = [0xf0 / 255, 0xd2 / 255, 0xb4 / 255] as const
const VIOLET = VECTOR_WORLD_THEME.lineColorRgb
const PORT = C.port
export const SIGNALS = C.channels * C.signalsPerChannel
export const TRAIL_SEGMENTS = SIGNALS * C.trailSteps

type Vec3 = [number, number, number]

export type NetworkNode = {
  base: Vec3
  drift: Vec3
  speed: Vec3
  phase: Vec3
  // 0 at the port, 1 at the open end; the echo on the text side counts as 1.
  reach: number
  weight: number
  echo: boolean
}

export type Channel = { path: number[]; speed: number; offsets: number[] }

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}
const distance = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

function buildNodes(rand: () => number) {
  const nodes: NetworkNode[] = []
  const motion = (amplitude: number) => ({
    drift: [amplitude, amplitude * 0.7, amplitude * 0.9] as Vec3,
    speed: [0.13 + rand() * 0.2, 0.11 + rand() * 0.18, 0.09 + rand() * 0.16] as Vec3,
    phase: [rand() * 6.28, rand() * 6.28, rand() * 6.28] as Vec3,
  })
  for (let i = 0; i < C.funnelNodes; i += 1) {
    // More nodes near the port: the funnel visibly narrows into the cube.
    const reach = Math.pow(rand(), 1.25)
    const x = PORT[0] + 0.6 + reach * C.funnelLength
    const top = C.maxY + (C.openMaxY - C.maxY) * smoothstep(3, 9, x)
    const y = Math.min(top, PORT[1] + (rand() * 2 - 1) * (0.3 + reach * 6.2))
    const z = PORT[2] - 0.35 - rand() * (0.4 + reach * 9.5)
    // Quieter towards the open end and in depth: the light leads to the cube.
    const weight = (1 - 0.55 * reach * reach) * (1 - 0.45 * smoothstep(-2, -11, z))
    nodes.push({ base: [x, y, z], reach, weight, echo: false, ...motion(0.12 + reach * 0.32) })
  }
  for (let i = 0; i < C.echoNodes; i += 1) {
    const spread = rand()
    const x = -(2.2 + spread * 11)
    const y = Math.min(C.echoMaxY, -0.5 + (rand() * 2 - 1) * (0.6 + spread * 2.6))
    const z = -3 - rand() * 9
    nodes.push({ base: [x, y, z], reach: 1, weight: 0.2, echo: true, ...motion(0.3) })
  }
  return nodes
}

// From the funnel's mouth, each channel hops to the node that best closes in
// on the port until the port is near. The starts go round the mouth.
function buildChannels(nodes: NetworkNode[], rand: () => number) {
  const angle = (node: NetworkNode) => Math.atan2(node.base[1] - PORT[1], node.base[2] - PORT[2])
  const mouth = nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => !node.echo && node.reach > 0.72)
    .sort((a, b) => angle(a.node) - angle(b.node))
  const channels: Channel[] = []
  for (let c = 0; c < C.channels; c += 1) {
    let current = mouth[Math.floor(((c + 0.5) / C.channels) * mouth.length)].index
    const path = [current]
    while (distance(nodes[current].base, PORT) > 1.5 && path.length < 14) {
      const here = nodes[current]
      let best = -1
      let bestScore = Infinity
      nodes.forEach((node, index) => {
        if (node.echo || distance(node.base, PORT) > distance(here.base, PORT) - 0.55) return
        const score = distance(node.base, here.base) + distance(node.base, PORT) * 0.4
        if (score < bestScore) [best, bestScore] = [index, score]
      })
      if (best === -1) break
      path.push(best)
      current = best
    }
    const speed = C.signalSpeed[0] + rand() * (C.signalSpeed[1] - C.signalSpeed[0])
    const offsets = Array.from({ length: C.signalsPerChannel }, (_, s) => (s + rand() * 0.4) / C.signalsPerChannel)
    channels.push({ path, speed, offsets })
  }
  return channels
}

export function createContactNetwork() {
  const rand = makeSeededRandom(C.seed)
  const nodes = buildNodes(rand)
  const channels = buildChannels(nodes, rand)
  const count = nodes.length
  const channelSegments = channels.reduce((sum, channel) => sum + channel.path.length, 0)
  const points = (n: number) => ({ position: new Float32Array(n * 3), aColor: new Float32Array(n * 3), aAlpha: new Float32Array(n) })
  const lines = (segments: number) => ({ position: new Float32Array(segments * 6), color: new Float32Array(segments * 6) })
  return {
    nodes,
    channels,
    buffers: {
      nodes: points(count),
      heads: points(SIGNALS),
      port: points(1),
      links: lines(C.maxLinks),
      channels: lines(channelSegments),
      trails: lines(TRAIL_SEGMENTS),
    },
    // Scratch reused every frame: live node positions, the light signals leave
    // on the nodes they pass, and each node's links so far.
    live: new Float32Array(count * 3),
    lit: new Float32Array(count),
    degree: new Uint8Array(count),
  }
}

export type ContactNetwork = ReturnType<typeof createContactNetwork>

const a = [0, 0, 0]
const b = [0, 0, 0]
const head = [0, 0, 0]
const tail = [0, 0, 0]

// Advances the network to time t and fills its buffers. Returns how many
// segments of each line buffer to draw.
export function advanceContactNetwork(network: ContactNetwork, t: number, glow: number) {
  const { nodes, channels, buffers, live, lit } = network
  nodes.forEach((node, i) => {
    for (let axis = 0; axis < 3; axis += 1) {
      live[i * 3 + axis] = node.base[axis] + Math.sin(t * node.speed[axis] + node.phase[axis]) * node.drift[axis]
    }
  })

  // A channel's k-th point: its nodes, then the port.
  const pointOf = (path: number[], k: number, out: number[]) => {
    for (let axis = 0; axis < 3; axis += 1) out[axis] = k < path.length ? live[path[k] * 3 + axis] : PORT[axis]
  }
  const along = (path: number[], lengths: number[], travelled: number, out: number[]) => {
    const d = Math.min(lengths[lengths.length - 1], Math.max(0, travelled))
    let k = 1
    while (k < lengths.length - 1 && lengths[k] < d) k += 1
    pointOf(path, k - 1, a)
    pointOf(path, k, b)
    const f = (d - lengths[k - 1]) / (lengths[k] - lengths[k - 1] || 1)
    for (let axis = 0; axis < 3; axis += 1) out[axis] = a[axis] + (b[axis] - a[axis]) * f
  }

  // Channels and their signals: each head, its trail, the light it leaves.
  const { channels: lane, heads, trails } = buffers
  lit.fill(0)
  let segment = 0
  let signal = 0
  let arrival = 0
  for (const channel of channels) {
    const lengths = [0]
    for (let k = 1; k <= channel.path.length; k += 1) {
      pointOf(channel.path, k - 1, a)
      pointOf(channel.path, k, b)
      lengths.push(lengths[k - 1] + distance(a, b))
      lane.position.set(a, segment * 6)
      lane.position.set(b, segment * 6 + 3)
      // A channel warms up as it nears the cube.
      const warmth = (0.16 + 0.34 * (k / channel.path.length)) * glow
      for (let c = 0; c < 6; c += 1) lane.color[segment * 6 + c] = (SAND[c % 3] * 0.7 + VIOLET[c % 3] * 0.3) * warmth
      segment += 1
    }
    const total = lengths[lengths.length - 1]

    for (const offset of channel.offsets) {
      const progress = (t * channel.speed + offset) % 1
      // Fades in at the mouth, absorbed at the port.
      const strength = smoothstep(0, 0.12, progress) * (1 - smoothstep(0.94, 1, progress)) * glow
      along(channel.path, lengths, progress * total, head)
      heads.position.set(head, signal * 3)
      heads.aColor.set(SAND, signal * 3)
      heads.aAlpha[signal] = 0.9 * strength
      // The port flashes as a signal arrives, then settles.
      arrival = Math.max(arrival, progress < 0.08 ? 1 - progress / 0.08 : smoothstep(0.9, 1, progress))

      for (let s = 0; s < C.trailSteps; s += 1) {
        const p = (signal * C.trailSteps + s) * 6
        along(channel.path, lengths, progress * total - (C.trailLength * s) / C.trailSteps, tail)
        trails.position.set(tail, p)
        along(channel.path, lengths, progress * total - (C.trailLength * (s + 1)) / C.trailSteps, tail)
        trails.position.set(tail, p + 3)
        for (let c = 0; c < 3; c += 1) {
          trails.color[p + c] = SAND[c] * (1 - s / C.trailSteps) * strength * 0.75
          trails.color[p + 3 + c] = SAND[c] * (1 - (s + 1) / C.trailSteps) * strength * 0.75
        }
      }

      for (const index of channel.path) {
        const d2 = (live[index * 3] - head[0]) ** 2 + (live[index * 3 + 1] - head[1]) ** 2 + (live[index * 3 + 2] - head[2]) ** 2
        lit[index] = Math.max(lit[index], Math.exp(-d2 / 0.5) * strength)
      }
      signal += 1
    }
  }

  // Nodes: violet at the open end and in the echo, sand near the cube and
  // wherever a signal passes.
  buffers.nodes.position.set(live)
  nodes.forEach((node, i) => {
    const warm = Math.max(node.echo ? 0 : 1 - smoothstep(0.05, 0.6, node.reach), lit[i])
    for (let c = 0; c < 3; c += 1) buffers.nodes.aColor[i * 3 + c] = VIOLET[c] + (SAND[c] - VIOLET[c]) * warm
    buffers.nodes.aAlpha[i] = (0.42 * node.weight + lit[i] * 0.6) * glow
  })

  // Links by proximity: as the nodes drift, links form and break.
  const { links: web, degree } = { links: buffers.links, degree: network.degree }
  degree.fill(0)
  let links = 0
  outer: for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const [ni, nj] = [nodes[i], nodes[j]]
      if (ni.echo !== nj.echo || degree[i] >= C.linksPerNode || degree[j] >= C.linksPerNode) continue
      const limit = C.linkDistance * (0.7 + 0.75 * Math.max(ni.reach, nj.reach))
      const d2 = (live[i * 3] - live[j * 3]) ** 2 + (live[i * 3 + 1] - live[j * 3 + 1]) ** 2 + (live[i * 3 + 2] - live[j * 3 + 2]) ** 2
      if (d2 > limit * limit) continue
      if (links >= C.maxLinks) break outer
      const fade = 1 - Math.sqrt(d2) / limit
      const strength = fade * (0.35 + fade * 0.65) * Math.min(ni.weight, nj.weight) * 0.42 * glow
      const warm = ni.echo ? 0 : 0.8 * (1 - smoothstep(0, 0.7, Math.min(ni.reach, nj.reach)))
      web.position.set(live.subarray(i * 3, i * 3 + 3), links * 6)
      web.position.set(live.subarray(j * 3, j * 3 + 3), links * 6 + 3)
      for (let c = 0; c < 6; c += 1) web.color[links * 6 + c] = (VIOLET[c % 3] + (SAND[c % 3] - VIOLET[c % 3]) * warm) * strength
      degree[i] += 1
      degree[j] += 1
      links += 1
    }
  }

  // The port: a steady low light.
  buffers.port.position.set(PORT)
  buffers.port.aColor.set(SAND)
  buffers.port.aAlpha[0] = (0.16 + arrival * 0.3) * glow

  return { links, channelSegments: segment, trailSegments: TRAIL_SEGMENTS }
}
