import type { WorldProps } from '../types'
import { PlaceholderWorld } from './_placeholder'

// TODO: design a world that suggests security — e.g. a tight defensive lattice
// of vector segments, periodic pulses, perimeter rings.
export function SecurityWorld(props: WorldProps = {}) {
  return <PlaceholderWorld {...props} />
}
