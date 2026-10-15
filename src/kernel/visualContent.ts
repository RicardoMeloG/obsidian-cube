import { z } from 'zod'
import visualExample from '../../public/content/visual.example.json'
import { FACE_ORDER } from './faces'
import type { FaceId } from './faces'
import { ICON_IDS } from './icons'
import type { IconId } from './icons'
import { FaceIdSchema } from './siteContent'
import type { FaceContent } from './siteContent'
import { WORLD_IDS } from './worlds'
import type { WorldId } from './worlds'

// Presentation layer, apart from the per-locale text: a face's accent and
// background world are the same in every language, so they live in their own
// document (`visual.json`, gitignored, edited by the admin) with a committed
// example (`visual.example.json`) that is also the default (ADR 003).

const WorldIdSchema = z.enum(WORLD_IDS as [WorldId, ...WorldId[]])
const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'accent must be a 6-digit hex color')

// A world in the catalog: it can be enabled or disabled whether or not a face
// points at it.
const WorldCatalogEntrySchema = z.object({
  id: WorldIdSchema.meta({ title: 'Mundo', widget: 'fixed' }),
  label: z.string().min(1).meta({ title: 'Nombre' }),
  enabled: z.boolean().meta({ title: 'Activo' }),
})

// Per-face presentation: which world backs it (or none), its accent hue and
// its icon in the stage's dock (spec 011, AD-02).
const FaceVisualSchema = z.object({
  worldId: WorldIdSchema.nullable().meta({ title: 'Mundo de fondo' }),
  accent: HexColorSchema.meta({ title: 'Color de acento', widget: 'color' }),
  icon: z
    .enum(ICON_IDS as unknown as [IconId, ...IconId[]])
    .optional()
    .meta({ title: 'Icono en el dock' }),
})

export const VisualContentSchema = z.object({
  worlds: z.array(WorldCatalogEntrySchema).meta({ title: 'Mundos' }),
  faces: z.record(FaceIdSchema, FaceVisualSchema).meta({ title: 'Caras' }),
})

export type WorldCatalogEntry = z.infer<typeof WorldCatalogEntrySchema>
export type FaceVisual = z.infer<typeof FaceVisualSchema> & { icon: IconId }
export type VisualContent = {
  worlds: WorldCatalogEntry[]
  faces: Record<FaceId, FaceVisual>
}

// A face with its resolved presentation, so the render tree reads
// `face.accent` and `face.worldId` without touching the visual document.
export type ResolvedFace = FaceContent & {
  accent: string
  icon: IconId
  worldId: WorldId | null
}

// The committed example is the default: it renders before visual.json arrives
// and fills any face that document leaves out.
const DEFAULT_VISUAL: VisualContent = VisualContentSchema.parse(visualExample) as VisualContent

export function getDefaultVisualContent(): VisualContent {
  return DEFAULT_VISUAL
}

export function normalizeVisual(parsed: z.infer<typeof VisualContentSchema>): VisualContent {
  const faces = {} as Record<FaceId, FaceVisual>
  for (const id of FACE_ORDER) {
    const face = parsed.faces[id]
    faces[id] = face ? { ...face, icon: face.icon ?? DEFAULT_VISUAL.faces[id].icon } : DEFAULT_VISUAL.faces[id]
  }

  return {
    worlds: parsed.worlds.length > 0 ? parsed.worlds : DEFAULT_VISUAL.worlds,
    faces,
  }
}

// The active world of a face, honouring the catalog: a face pointing at a
// missing or disabled world renders no background (null).
export function resolveWorldId(visual: VisualContent, faceId: FaceId): WorldId | null {
  const face = visual.faces[faceId]
  if (!face || !face.worldId) return null

  const world = visual.worlds.find((entry) => entry.id === face.worldId)
  return world && world.enabled ? face.worldId : null
}

export function resolveSections(sections: FaceContent[], visual: VisualContent): ResolvedFace[] {
  return sections.map((section) => {
    const face = visual.faces[section.id] ?? DEFAULT_VISUAL.faces[section.id]
    return { ...section, accent: face.accent, icon: face.icon, worldId: resolveWorldId(visual, section.id) }
  })
}
