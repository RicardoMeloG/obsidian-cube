// Face compositions (spec 011, AD-01): a fixed set of templates with named,
// typed slots. A face picks one template and fills its slots; the template's
// placement and order are code in the stage. Templates are not tied to a face.
//
// The face's heading (eyebrow, title, summary) and its two CTAs are shared
// fields of the section (siteContent.ts), read by every layout, so a template
// holds only what is particular to its shape. Text is per language: the
// composition lives in site.{lang}.json.
import { z } from 'zod'
import { RichTextSchema } from './fields'
import { ICON_IDS } from './icons'
import type { IconId } from './icons'

const Text = z.string().min(1)
const IconSchema = z.enum(ICON_IDS as unknown as [IconId, ...IconId[]]).meta({ title: 'Icono' })
const ChipsSchema = z.array(Text).meta({ title: 'Etiquetas' })
const HrefSchema = z.string().min(1).optional().meta({ title: 'Enlace' })

// Owner images are uploaded through the admin and stored under their content
// hash, the thumbnail beside its image as <hash>-thumb.webp (AD-03); example
// content uses committed neutral images, which the publish rules reject in
// owner content.
export const MEDIA_SRC = /^\/(content\/media\/[a-f0-9]{64}(-thumb)?|examples\/[a-z0-9-]+)\.webp$/
export const EXAMPLE_MEDIA_PREFIX = '/examples/'

export const MediaRefSchema = z
  .object({
    src: z.string().regex(MEDIA_SRC, 'imagen subida por el admin (.webp)'),
    thumb: z.string().regex(MEDIA_SRC, 'miniatura subida por el admin (.webp)').optional(),
    alt: Text.meta({ title: 'Texto alternativo' }),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .meta({ widget: 'media', title: 'Imagen' })

// An item with an icon: steps, facts, the reading chain.
const IconItemSchema = z.object({
  icon: IconSchema,
  label: Text.meta({ title: 'Rótulo' }),
  text: RichTextSchema.meta({ title: 'Texto' }),
})

const ShowcaseSchema = z
  .object({
    template: z.literal('showcase'),
    featured: z
      .object({
        icon: IconSchema,
        label: Text.meta({ title: 'Rótulo' }),
        title: Text.meta({ title: 'Título' }),
        text: RichTextSchema.meta({ title: 'Texto' }),
        chips: ChipsSchema,
        href: HrefSchema,
      })
      .meta({ title: 'Caso destacado' }),
    stepsTitle: Text.meta({ title: 'Título de los pasos' }),
    steps: z.array(IconItemSchema).meta({ title: 'Pasos' }),
    proofsTitle: Text.meta({ title: 'Título de las pruebas' }),
    proofsTrail: Text.optional().meta({ title: 'Línea junto al título' }),
    proofs: z
      .array(
        z.object({
          icon: IconSchema,
          kind: Text.meta({ title: 'Tipo' }),
          title: Text.meta({ title: 'Título' }),
          text: RichTextSchema.meta({ title: 'Texto' }),
          chips: ChipsSchema,
          href: HrefSchema,
        }),
      )
      .meta({ title: 'Pruebas' }),
  })
  .meta({ title: 'Vitrina' })

const CatalogSchema = z
  .object({
    template: z.literal('catalog'),
    listTitle: Text.meta({ title: 'Título de la lista' }),
    items: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9-]+$/, 'solo minúsculas, números y guiones').meta({ title: 'Identificador' }),
          name: Text.meta({ title: 'Nombre' }),
          meta: Text.meta({ title: 'Tipo' }),
          status: Text.meta({ title: 'Estado' }),
          text: RichTextSchema.meta({ title: 'Texto' }),
          chips: ChipsSchema,
          image: MediaRefSchema,
          facts: z.array(IconItemSchema).meta({ title: 'Datos' }),
          links: z
            .array(z.object({ label: Text.meta({ title: 'Texto' }), href: z.string().min(1).meta({ title: 'Enlace' }) }))
            .optional()
            .meta({ title: 'Enlaces' }),
        }),
      )
      .meta({ title: 'Elementos' }),
  })
  .meta({ title: 'Catálogo' })

export const CELL_STATES = ['done', 'active', 'pending'] as const
export type CellState = (typeof CELL_STATES)[number]

const CaseSchema = z
  .object({
    template: z.literal('case'),
    caseLabel: Text.meta({ title: 'Rótulo del caso' }),
    caseName: Text.meta({ title: 'Nombre del caso' }),
    before: z.object({ title: Text.meta({ title: 'Título' }), items: z.array(Text).meta({ title: 'Puntos' }) }).meta({ title: 'Antes' }),
    after: z.object({ title: Text.meta({ title: 'Título' }), items: z.array(Text).meta({ title: 'Puntos' }) }).meta({ title: 'Después' }),
    map: z
      .object({
        title: Text.meta({ title: 'Título' }),
        note: Text.optional().meta({ title: 'Nota' }),
        legend: z
          .object({ done: Text.meta({ title: 'Hecho' }), active: Text.meta({ title: 'En curso' }), pending: Text.meta({ title: 'Pendiente' }) })
          .meta({ title: 'Leyenda' }),
        cells: z.array(z.enum(CELL_STATES)).meta({ title: 'Celdas' }),
      })
      .meta({ title: 'Mapa de estado' }),
    steps: z.array(IconItemSchema).meta({ title: 'Pasos' }),
  })
  .meta({ title: 'Caso' })

export const CONTROL_STATES = ['implemented', 'verified', 'planned'] as const
export type ControlState = (typeof CONTROL_STATES)[number]

const LedgerSchema = z
  .object({
    template: z.literal('ledger'),
    callouts: z
      .array(
        z.object({
          icon: IconSchema,
          label: Text.meta({ title: 'Rótulo' }),
          title: Text.optional().meta({ title: 'Título' }),
          text: RichTextSchema.meta({ title: 'Texto' }),
        }),
      )
      .meta({ title: 'Destacados' }),
    console: z
      .object({
        title: Text.meta({ title: 'Título' }),
        command: Text.optional().meta({ title: 'Comando' }),
        rows: z
          .array(
            z.object({
              status: z.enum(CONTROL_STATES).meta({ title: 'Estado' }),
              id: Text.meta({ title: 'Identificador' }),
              text: Text.meta({ title: 'Texto' }),
            }),
          )
          .meta({ title: 'Filas' }),
        statusLabels: z
          .object({
            implemented: Text.meta({ title: 'Implementado' }),
            verified: Text.meta({ title: 'Verificado' }),
            planned: Text.meta({ title: 'Planificado' }),
          })
          .meta({ title: 'Nombres de los estados' }),
      })
      .meta({ title: 'Consola' }),
  })
  .meta({ title: 'Registro' })

const ReadingSchema = z
  .object({
    template: z.literal('reading'),
    questionLabel: Text.meta({ title: 'Rótulo de la pregunta' }),
    question: RichTextSchema.meta({ title: 'Pregunta' }),
    chain: z.array(IconItemSchema).meta({ title: 'Cadena' }),
    distinctionsTitle: Text.meta({ title: 'Título de las distinciones' }),
    distinctions: z
      .array(z.object({ term: Text.meta({ title: 'Término' }), text: RichTextSchema.meta({ title: 'Texto' }) }))
      .meta({ title: 'Distinciones' }),
    document: z
      .object({
        label: Text.meta({ title: 'Rótulo' }),
        title: Text.meta({ title: 'Título' }),
        meta: Text.optional().meta({ title: 'Detalle' }),
        href: HrefSchema,
      })
      .meta({ title: 'Documento' }),
  })
  .meta({ title: 'Lectura' })

export const CHANNEL_KINDS = ['email', 'github', 'linkedin', 'web'] as const
export type ChannelKind = (typeof CHANNEL_KINDS)[number]

// The request form (CV behind a captcha) arrives with the security stage
// (spec 011, E-7); until then CONTACT shows its channels only.
const ChannelsSchema = z
  .object({
    template: z.literal('channels'),
    availability: Text.optional().meta({ title: 'Disponibilidad' }),
    channels: z
      .array(
        z.object({
          kind: z.enum(CHANNEL_KINDS).meta({ title: 'Tipo' }),
          label: Text.meta({ title: 'Rótulo' }),
          text: Text.meta({ title: 'Texto' }),
          href: z.string().min(1).meta({ title: 'Enlace' }),
        }),
      )
      .meta({ title: 'Canales' }),
  })
  .meta({ title: 'Canales' })

export const CompositionSchema = z
  .discriminatedUnion('template', [ShowcaseSchema, CatalogSchema, CaseSchema, LedgerSchema, ReadingSchema, ChannelsSchema])
  .meta({ title: 'Composición' })

export type Composition = z.infer<typeof CompositionSchema>
export type TemplateId = Composition['template']
export type MediaRef = z.infer<typeof MediaRefSchema>

export const TEMPLATE_IDS: TemplateId[] = ['showcase', 'catalog', 'case', 'ledger', 'reading', 'channels']
