// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { advanceContactNetwork, CONTACT_NETWORK, createContactNetwork, SIGNALS } from './contactNetwork'

// The CONTACT world's composition rules (spec 011, S5): the network keeps
// clear of the cube and of the text side, and its channels lead to the cube.
// Checked over a minute of drift, since the network never stops moving.
const network = createContactNetwork()
const times = Array.from({ length: 60 }, (_, second) => second * 1.7)
const live = (t: number) => {
  advanceContactNetwork(network, t, 1)
  return network.nodes.map((node, i) => ({ node, x: network.live[i * 3], y: network.live[i * 3 + 1], z: network.live[i * 3 + 2] }))
}

describe('the CONTACT network', () => {
  it('opens on the right and never reaches into the cube', () => {
    for (const t of times) {
      for (const { node, x } of live(t)) if (!node.echo) expect(x).toBeGreaterThan(1.1)
    }
  })

  it('stays out of the top band, where the name and the role are read', () => {
    const drift = 0.44 * 0.7
    for (const t of times) {
      for (const { node, y } of live(t)) {
        expect(y).toBeLessThan((node.echo ? CONTACT_NETWORK.echoMaxY : CONTACT_NETWORK.openMaxY) + drift)
      }
    }
  })

  it('keeps the text side to a faint echo', () => {
    const echo = network.nodes.filter((node) => node.echo)
    expect(echo.length).toBeLessThan(network.nodes.length / 4)
    for (const node of echo) expect(node.base[0]).toBeLessThan(-2)
  })

  it('leads every channel from the open end to the port, closing in at each hop', () => {
    const port = CONTACT_NETWORK.port
    const toPort = (index: number) => Math.hypot(...network.nodes[index].base.map((value, axis) => value - port[axis]))
    expect(network.channels).toHaveLength(CONTACT_NETWORK.channels)
    for (const { path } of network.channels) {
      expect(path.length).toBeGreaterThan(2)
      expect(network.nodes[path[0]].reach).toBeGreaterThan(0.72)
      for (let k = 1; k < path.length; k += 1) expect(toPort(path[k])).toBeLessThan(toPort(path[k - 1]))
      // The last hop, into the port, is drawn too: it stays short.
      expect(toPort(path[path.length - 1])).toBeLessThan(2.5)
    }
  })

  it('keeps moving: signals travel and the links change', () => {
    const heads = (t: number) => {
      advanceContactNetwork(network, t, 1)
      return Array.from(network.buffers.heads.position.slice(0, SIGNALS * 3))
    }
    expect(heads(10)).not.toEqual(heads(10.5))
    const links = new Set(times.map((t) => advanceContactNetwork(network, t, 1).links))
    expect(links.size).toBeGreaterThan(1)
  })
})
