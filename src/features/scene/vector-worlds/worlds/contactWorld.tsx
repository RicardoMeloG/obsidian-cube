import type { WorldProps } from '../types'
import { PlaceholderWorld } from './_placeholder'

// TODO: design a world that reads as "open channel" — single beam, sparse
// signal, antenna-like motif.
export function ContactWorld(props: WorldProps = {}) {
  return <PlaceholderWorld {...props} />
}
