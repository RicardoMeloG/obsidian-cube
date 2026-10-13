// World catalog of the content kernel: ids and default names, no React or
// three. The scene and the Node admin both read it, so the admin validates
// visual.json against the same ids without loading the 3D modules.
//
// A world is not bound to a face: visual.json enables it and assigns it to any
// face. The ids equal the face ids only by origin. visual.example.json repeats
// these names (visualContent.test.ts keeps them equal).
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
