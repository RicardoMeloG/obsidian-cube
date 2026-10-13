import { lazy } from 'react'
import type { WorldEntry } from './types'
import { WORLD_LABELS } from '@/kernel/worlds'
import type { WorldId } from '@/kernel/worlds'

// World identifiers and labels are the pure catalog (./catalog). Adding a new
// world = (1) create file in worlds/, (2) register its Component here, (3) add
// its id/label to ./catalog. This registry maps a WorldId to its 3D Component +
// showcase config; the catalog stays free of React/Three so the backend can
// share it. Showcase config is used by the ?bg=<id> standalone preview.
//
// Components are lazy: each world is its own chunk and only the active face's
// world is downloaded. VectorWorldStage / the showcase wrap them in Suspense.
export const WORLD_REGISTRY: Record<WorldId, WorldEntry> = {
  agentic: {
    id: 'agentic',
    label: WORLD_LABELS.agentic,
    caption: 'plexus wave field — signature ambient',
    Component: lazy(() => import('./worlds/agenticWorld').then((m) => ({ default: m.AgenticWorld }))),
    showcase: {
      camera: { position: [0, 0.55, 4.6], fov: 48, near: 0.1, far: 80 },
      fog: { near: 9, far: 28 },
      props: { position: [0, -0.8, -1.4], rotation: [-Math.PI / 2.3, 0, 0] },
    },
  },
  products: {
    id: 'products',
    label: WORLD_LABELS.products,
    caption: 'transparent product modules — oblique network field',
    Component: lazy(() => import('./worlds/productsWorld').then((m) => ({ default: m.ProductsWorld }))),
    showcase: {
      camera: { position: [-1.4, 4.6, 19.5], fov: 56, near: 0.1, far: 110 },
      fog: { near: 16, far: 58 },
      lookAt: [0.8, 1.2, -7.5],
    },
  },
  systems: {
    id: 'systems',
    label: WORLD_LABELS.systems,
    caption: 'vector street with lamp glow',
    Component: lazy(() => import('./worlds/systemsWorld').then((m) => ({ default: m.SystemsWorld }))),
    showcase: {
      camera: { position: [0, 1.9, 10.8], fov: 52, near: 0.1, far: 80 },
      fog: { near: 14, far: 40 },
      props: { position: [0, 0, 0], scale: 1 },
    },
  },
  security: {
    id: 'security',
    label: WORLD_LABELS.security,
    caption: 'DDoS deflected — arrows arc in and bounce off the force field',
    Component: lazy(() => import('./worlds/arrowShieldWorld').then((m) => ({ default: m.ArrowShieldWorld }))),
    showcase: {
      camera: { position: [0, 0, 11], fov: 50, near: 0.1, far: 80 },
      fog: { near: 12, far: 40 },
      props: { position: [0, 0, 0], scale: 1, glow: 1, projGlow: 1 },
    },
  },
  research: {
    id: 'research',
    label: WORLD_LABELS.research,
    caption: 'vector meadow valley + distant mountain cordillera, sky reserved',
    Component: lazy(() => import('./worlds/researchWorld').then((m) => ({ default: m.ResearchWorld }))),
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
    label: WORLD_LABELS.contact,
    caption: 'placeholder — design pending',
    Component: lazy(() => import('./worlds/contactWorld').then((m) => ({ default: m.ContactWorld }))),
    showcase: {
      camera: { position: [0, 0.55, 4.6], fov: 48, near: 0.1, far: 80 },
      fog: { near: 9, far: 28 },
    },
  },
}

export function isWorldId(value: string): value is WorldId {
  return value in WORLD_REGISTRY
}
