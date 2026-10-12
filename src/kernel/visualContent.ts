import { z } from 'zod'
import { CUBE_FACE_ORDER, SECTION_ACCENTS } from './faces'
import type { CubeSection, CubeSectionId } from './faces'
import { WORLD_IDS, WORLD_LABELS } from './worlds'
import type { WorldId } from './worlds'

// Presentation layer, isolated from the per-locale text content. This config is
// language-independent (a background/accent is the same in EN and ES), so it
// lives in its own file (`visual.json`, gitignored) with an example fallback
// (`visual.example.json`, committed) — the future admin panel edits this schema.

const SectionIdSchema = z.enum(CUBE_FACE_ORDER as [CubeSectionId, ...CubeSectionId[]])
const WorldIdSchema = z.enum(WORLD_IDS as [WorldId, ...WorldId[]])
const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'accent must be a 6-digit hex color')

// A world in the catalog: it can be enabled/disabled independently of whether
// any face currently points at it.
const WorldCatalogEntrySchema = z.object({
  id: WorldIdSchema,
  label: z.string().min(1),
  enabled: z.boolean(),
})

// Per-face presentation: which world backs it (or none) and its accent hue.
const FaceVisualSchema = z.object({
  worldId: WorldIdSchema.nullable(),
  accent: HexColorSchema,
})

export const VisualContentSchema = z.object({
  worlds: z.array(WorldCatalogEntrySchema),
  faces: z.record(SectionIdSchema, FaceVisualSchema),
})

export type WorldCatalogEntry = z.infer<typeof WorldCatalogEntrySchema>
export type FaceVisual = z.infer<typeof FaceVisualSchema>
export type VisualContent = {
  worlds: WorldCatalogEntry[]
  faces: Record<CubeSectionId, FaceVisual>
}

// A cube section enriched with its resolved presentation, so the render tree can
// read `section.accent` / `section.worldId` without touching the visual config.
export type ResolvedCubeSection = CubeSection & {
  accent: string
  worldId: WorldId | null
}

// Embedded defaults = current hardcoded behavior (SECTION_ACCENTS + 1:1 world
// per face, all enabled). Used when no visual.json / visual.example.json loads,
// so the site looks identical to before this layer existed.
export function getDefaultVisualContent(): VisualContent {
  const faces = {} as Record<CubeSectionId, FaceVisual>
  for (const id of CUBE_FACE_ORDER) {
    faces[id] = { worldId: id as WorldId, accent: SECTION_ACCENTS[id] }
  }

  return {
    worlds: WORLD_IDS.map((id) => ({ id, label: WORLD_LABELS[id], enabled: true })),
    faces,
  }
}

export function normalizeVisual(parsed: z.infer<typeof VisualContentSchema>): VisualContent {
  const defaults = getDefaultVisualContent()
  const faces = {} as Record<CubeSectionId, FaceVisual>
  for (const id of CUBE_FACE_ORDER) {
    faces[id] = parsed.faces[id] ?? defaults.faces[id]
  }

  return {
    worlds: parsed.worlds.length > 0 ? parsed.worlds : defaults.worlds,
    faces,
  }
}

// The active worldId for a face, honoring the catalog: a face pointing at a
// missing or disabled world renders no background (null).
export function resolveWorldId(visual: VisualContent, sectionId: CubeSectionId): WorldId | null {
  const face = visual.faces[sectionId]
  if (!face || !face.worldId) return null

  const world = visual.worlds.find((entry) => entry.id === face.worldId)
  return world && world.enabled ? face.worldId : null
}

export function resolveSections(sections: CubeSection[], visual: VisualContent): ResolvedCubeSection[] {
  return sections.map((section) => ({
    ...section,
    accent: visual.faces[section.id]?.accent ?? SECTION_ACCENTS[section.id],
    worldId: resolveWorldId(visual, section.id),
  }))
}
