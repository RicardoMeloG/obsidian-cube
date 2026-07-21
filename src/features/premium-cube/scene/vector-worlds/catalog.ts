// Pure world catalog metadata — NO React/Three imports. Both the frontend scene
// AND the Node admin backend import world ids/labels from here, so the backend
// can validate visual.json against the same identifiers without dragging in the
// 3D component modules (which would pull Three.js into Node).
//
// Worlds are decoupled from cube faces: a world lives in the catalog and can be
// enabled/disabled and assigned to any face from visual.json. The string ids
// currently mirror the section ids for historical reasons, but nothing binds a
// world to a face anymore.
export type WorldId = 'agentic' | 'products' | 'systems' | 'security' | 'research' | 'contact'

export const WORLD_IDS: WorldId[] = ['agentic', 'products', 'systems', 'security', 'research', 'contact']

export const WORLD_LABELS: Record<WorldId, string> = {
  agentic: 'AGENTIC PLEXUS',
  products: 'PRODUCT BOX FIELD',
  systems: 'CITY CORRIDOR',
  security: 'ARROW SHIELD',
  research: 'PARAMO VALLEY',
  contact: 'CONTACT SIGNAL',
}
