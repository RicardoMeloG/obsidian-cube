import type { CubeSectionId } from '../../cubeSections'
import type { WorldEntry } from './types'
import { AgenticWorld } from './worlds/agenticWorld'
import { ArrowShieldWorld } from './worlds/arrowShieldWorld'
import { ContactWorld } from './worlds/contactWorld'
import { ProductsWorld } from './worlds/productsWorld'
import { ResearchWorld } from './worlds/researchWorld'
import { SystemsWorld } from './worlds/systemsWorld'

// Adding a new background = (1) create file in worlds/, (2) register it here.
// Showcase config is used by ?bg=<id> standalone preview. Embedded defaults
// live inside each world component so the cube scene can render them with a
// single <VectorWorldStage activeSectionId={...} />.
export const WORLD_REGISTRY: Record<CubeSectionId, WorldEntry> = {
  agentic: {
    id: 'agentic',
    label: 'AGENTIC PLEXUS',
    caption: 'plexus wave field — signature ambient',
    Component: AgenticWorld,
    showcase: {
      camera: { position: [0, 0.55, 4.6], fov: 48, near: 0.1, far: 80 },
      fog: { near: 9, far: 28 },
      props: { position: [0, -0.8, -1.4], rotation: [-Math.PI / 2.3, 0, 0] },
    },
  },
  products: {
    id: 'products',
    label: 'PRODUCT BOX FIELD',
    caption: 'transparent product modules — oblique network field',
    Component: ProductsWorld,
    showcase: {
      camera: { position: [-1.4, 4.6, 19.5], fov: 56, near: 0.1, far: 110 },
      fog: { near: 16, far: 58 },
      lookAt: [0.8, 1.2, -7.5],
    },
  },
  systems: {
    id: 'systems',
    label: 'CITY CORRIDOR',
    caption: 'vector street with lamp glow',
    Component: SystemsWorld,
    showcase: {
      camera: { position: [0, 1.9, 10.8], fov: 52, near: 0.1, far: 80 },
      fog: { near: 14, far: 40 },
      props: { position: [0, 0, 0], scale: 1 },
    },
  },
  security: {
    id: 'security',
    label: 'ARROW SHIELD',
    caption: 'DDoS deflected — arrows arc in and bounce off the force field',
    Component: ArrowShieldWorld,
    showcase: {
      camera: { position: [0, 0, 11], fov: 50, near: 0.1, far: 80 },
      fog: { near: 12, far: 40 },
      props: { position: [0, 0, 0], scale: 1, glow: 1, projGlow: 1 },
    },
  },
  research: {
    id: 'research',
    label: 'PARAMO VALLEY',
    caption: 'vector meadow valley + distant mountain cordillera, sky reserved',
    Component: ResearchWorld,
    showcase: {
      camera: { position: [0, 1.2, 7.0], fov: 62, near: 0.1, far: 100 },
      fog: { near: 14, far: 60 },
      lookAt: [0, 0.85, -22],
      composition: {
        maxTerrainCoverage: 0.4,
        horizonBand: [0.58, 0.64],
        poleScreen: [0.5, 0.22],
        targetAspect: 16 / 9,
      },
      props: { position: [0, -2.2, -13], rotation: [-Math.PI / 2.1, 0, 0] },
    },
  },
  contact: {
    id: 'contact',
    label: 'CONTACT SIGNAL',
    caption: 'placeholder — design pending',
    Component: ContactWorld,
    showcase: {
      camera: { position: [0, 0.55, 4.6], fov: 48, near: 0.1, far: 80 },
      fog: { near: 9, far: 28 },
    },
  },
}

export function isWorldId(value: string): value is CubeSectionId {
  return value in WORLD_REGISTRY
}
