// Face compositions (spec 011, AD-01): a fixed set of templates with named,
// typed slots. A face picks one template and fills its slots; the template's
// placement and order are code in the stage. Templates are not tied to a face.
//
// The face's heading (eyebrow, title, summary) and its two CTAs are shared
// fields of the section (siteContent.ts), read by every layout, so a template
// holds only what is particular to its shape. Text is per language: the
// composition lives in site.{lang}.json.
import { z } from 'zod/mini'
import { RichTextSchema } from './fields'
import { ICON_IDS } from './icons'
import type { IconId } from './icons'

const Text = z.string().check(z.minLength(1))
const IconSchema = z.enum(ICON_IDS as unknown as [IconId, ...IconId[]]).clone().register(z.globalRegistry, { title: 'Icono' })
const ChipsSchema = z.array(Text).clone().register(z.globalRegistry, { title: 'Etiquetas' })
const HrefSchema = z.optional(z.string().check(z.minLength(1))).clone().register(z.globalRegistry, { title: 'Enlace' })

// Owner images are uploaded through the admin and stored under their content
// hash, the thumbnail beside its image as <hash>-thumb.webp (AD-03); example
// content uses committed neutral images, which the publish rules reject in
// owner content.
export const MEDIA_SRC = /^\/(content\/media\/[a-f0-9]{64}(-thumb)?|examples\/[a-z0-9-]+)\.webp$/
export const EXAMPLE_MEDIA_PREFIX = '/examples/'

export const MediaRefSchema = z
  .object({
    src: z.string().check(z.regex(MEDIA_SRC, 'imagen subida por el admin (.webp)')),
    thumb: z.optional(z.string().check(z.regex(MEDIA_SRC, 'miniatura subida por el admin (.webp)'))),
    alt: Text.clone().register(z.globalRegistry, { title: 'Texto alternativo' }),
    width: z.int().check(z.positive()),
    height: z.int().check(z.positive()),
  })
  .clone().register(z.globalRegistry, { widget: 'media', title: 'Imagen' })

// An item with an icon: steps, facts, the reading chain.
const IconItemSchema = z.object({
  icon: IconSchema,
  label: Text.clone().register(z.globalRegistry, { title: 'Rótulo' }),
  text: RichTextSchema.clone().register(z.globalRegistry, { title: 'Texto' }),
})

const ShowcaseSchema = z
  .object({
    template: z.literal('showcase'),
    featured: z
      .object({
        icon: IconSchema,
        label: Text.clone().register(z.globalRegistry, { title: 'Rótulo' }),
        title: Text.clone().register(z.globalRegistry, { title: 'Título' }),
        text: RichTextSchema.clone().register(z.globalRegistry, { title: 'Texto' }),
        chips: ChipsSchema,
        href: HrefSchema,
      })
      .clone().register(z.globalRegistry, { title: 'Caso destacado' }),
    stepsTitle: Text.clone().register(z.globalRegistry, { title: 'Título de los pasos' }),
    steps: z.array(IconItemSchema).clone().register(z.globalRegistry, { title: 'Pasos' }),
    proofsTitle: Text.clone().register(z.globalRegistry, { title: 'Título de las pruebas' }),
    proofsTrail: z.optional(Text).clone().register(z.globalRegistry, { title: 'Línea junto al título' }),
    proofs: z
      .array(
        z.object({
          icon: IconSchema,
          kind: Text.clone().register(z.globalRegistry, { title: 'Tipo' }),
          title: Text.clone().register(z.globalRegistry, { title: 'Título' }),
          text: RichTextSchema.clone().register(z.globalRegistry, { title: 'Texto' }),
          chips: ChipsSchema,
          href: HrefSchema,
        }),
      )
      .clone().register(z.globalRegistry, { title: 'Pruebas' }),
  })
  .clone().register(z.globalRegistry, { title: 'Vitrina' })

const CatalogSchema = z
  .object({
    template: z.literal('catalog'),
    listTitle: Text.clone().register(z.globalRegistry, { title: 'Título de la lista' }),
    items: z
      .array(
        z.object({
          id: z.string().check(z.regex(/^[a-z0-9-]+$/, 'solo minúsculas, números y guiones')).clone().register(z.globalRegistry, { title: 'Identificador' }),
          name: Text.clone().register(z.globalRegistry, { title: 'Nombre' }),
          meta: Text.clone().register(z.globalRegistry, { title: 'Tipo' }),
          status: Text.clone().register(z.globalRegistry, { title: 'Estado' }),
          text: RichTextSchema.clone().register(z.globalRegistry, { title: 'Texto' }),
          chips: ChipsSchema,
          // Optional: without a real image the sheet shows none, rather than a
          // made-up one (2026-10-16).
          image: z.optional(MediaRefSchema),
          facts: z.array(IconItemSchema).clone().register(z.globalRegistry, { title: 'Datos' }),
          links: z.optional(z
            .array(z.object({ label: Text.clone().register(z.globalRegistry, { title: 'Texto' }), href: z.string().check(z.minLength(1)).clone().register(z.globalRegistry, { title: 'Enlace' }) })))
            .clone().register(z.globalRegistry, { title: 'Enlaces' }),
        }),
      )
      .clone().register(z.globalRegistry, { title: 'Elementos' }),
  })
  .clone().register(z.globalRegistry, { title: 'Catálogo' })

export const CELL_STATES = ['done', 'active', 'pending'] as const
export type CellState = (typeof CELL_STATES)[number]

const CaseSchema = z
  .object({
    template: z.literal('case'),
    caseLabel: Text.clone().register(z.globalRegistry, { title: 'Rótulo del caso' }),
    caseName: Text.clone().register(z.globalRegistry, { title: 'Nombre del caso' }),
    before: z.object({ title: Text.clone().register(z.globalRegistry, { title: 'Título' }), items: z.array(Text).clone().register(z.globalRegistry, { title: 'Puntos' }) }).clone().register(z.globalRegistry, { title: 'Antes' }),
    after: z.object({ title: Text.clone().register(z.globalRegistry, { title: 'Título' }), items: z.array(Text).clone().register(z.globalRegistry, { title: 'Puntos' }) }).clone().register(z.globalRegistry, { title: 'Después' }),
    map: z.optional(z
      .object({
        title: Text.clone().register(z.globalRegistry, { title: 'Título' }),
        note: z.optional(Text).clone().register(z.globalRegistry, { title: 'Nota' }),
        legend: z
          .object({ done: Text.clone().register(z.globalRegistry, { title: 'Hecho' }), active: Text.clone().register(z.globalRegistry, { title: 'En curso' }), pending: Text.clone().register(z.globalRegistry, { title: 'Pendiente' }) })
          .clone().register(z.globalRegistry, { title: 'Leyenda' }),
        cells: z.array(z.enum(CELL_STATES)).clone().register(z.globalRegistry, { title: 'Celdas' }),
      }))
      .clone().register(z.globalRegistry, { title: 'Mapa de estado' }),
    steps: z.array(IconItemSchema).clone().register(z.globalRegistry, { title: 'Pasos' }),
  })
  .clone().register(z.globalRegistry, { title: 'Caso' })

export const CONTROL_STATES = ['implemented', 'verified', 'planned'] as const
export type ControlState = (typeof CONTROL_STATES)[number]

const LedgerSchema = z
  .object({
    template: z.literal('ledger'),
    callouts: z
      .array(
        z.object({
          icon: IconSchema,
          label: Text.clone().register(z.globalRegistry, { title: 'Rótulo' }),
          title: z.optional(Text).clone().register(z.globalRegistry, { title: 'Título' }),
          text: RichTextSchema.clone().register(z.globalRegistry, { title: 'Texto' }),
        }),
      )
      .clone().register(z.globalRegistry, { title: 'Destacados' }),
    console: z
      .object({
        title: Text.clone().register(z.globalRegistry, { title: 'Título' }),
        command: z.optional(Text).clone().register(z.globalRegistry, { title: 'Comando' }),
        rows: z
          .array(
            z.object({
              status: z.enum(CONTROL_STATES).clone().register(z.globalRegistry, { title: 'Estado' }),
              id: Text.clone().register(z.globalRegistry, { title: 'Identificador' }),
              text: Text.clone().register(z.globalRegistry, { title: 'Texto' }),
            }),
          )
          .clone().register(z.globalRegistry, { title: 'Filas' }),
        statusLabels: z
          .object({
            implemented: Text.clone().register(z.globalRegistry, { title: 'Implementado' }),
            verified: Text.clone().register(z.globalRegistry, { title: 'Verificado' }),
            planned: Text.clone().register(z.globalRegistry, { title: 'Planificado' }),
          })
          .clone().register(z.globalRegistry, { title: 'Nombres de los estados' }),
      })
      .clone().register(z.globalRegistry, { title: 'Consola' }),
  })
  .clone().register(z.globalRegistry, { title: 'Registro' })

const ReadingSchema = z
  .object({
    template: z.literal('reading'),
    questionLabel: Text.clone().register(z.globalRegistry, { title: 'Rótulo de la pregunta' }),
    question: RichTextSchema.clone().register(z.globalRegistry, { title: 'Pregunta' }),
    chain: z.array(IconItemSchema).clone().register(z.globalRegistry, { title: 'Cadena' }),
    distinctionsTitle: Text.clone().register(z.globalRegistry, { title: 'Título de las distinciones' }),
    distinctions: z
      .array(z.object({ term: Text.clone().register(z.globalRegistry, { title: 'Término' }), text: RichTextSchema.clone().register(z.globalRegistry, { title: 'Texto' }) }))
      .clone().register(z.globalRegistry, { title: 'Distinciones' }),
    document: z
      .object({
        label: Text.clone().register(z.globalRegistry, { title: 'Rótulo' }),
        title: Text.clone().register(z.globalRegistry, { title: 'Título' }),
        meta: z.optional(Text).clone().register(z.globalRegistry, { title: 'Detalle' }),
        href: HrefSchema,
      })
      .clone().register(z.globalRegistry, { title: 'Documento' }),
  })
  .clone().register(z.globalRegistry, { title: 'Lectura' })

export const CHANNEL_KINDS = ['email', 'github', 'linkedin', 'web'] as const
export type ChannelKind = (typeof CHANNEL_KINDS)[number]

// The request form (CV behind a captcha) arrives with the security stage
// (spec 011, E-7); until then CONTACT shows its channels only.
const ChannelsSchema = z
  .object({
    template: z.literal('channels'),
    availability: z.optional(Text).clone().register(z.globalRegistry, { title: 'Disponibilidad' }),
    channels: z
      .array(
        z.object({
          kind: z.enum(CHANNEL_KINDS).clone().register(z.globalRegistry, { title: 'Tipo' }),
          label: Text.clone().register(z.globalRegistry, { title: 'Rótulo' }),
          text: Text.clone().register(z.globalRegistry, { title: 'Texto' }),
          href: z.string().check(z.minLength(1)).clone().register(z.globalRegistry, { title: 'Enlace' }),
        }),
      )
      .clone().register(z.globalRegistry, { title: 'Canales' }),
  })
  .clone().register(z.globalRegistry, { title: 'Canales' })

export const CompositionSchema = z
  .discriminatedUnion('template', [ShowcaseSchema, CatalogSchema, CaseSchema, LedgerSchema, ReadingSchema, ChannelsSchema])
  .clone().register(z.globalRegistry, { title: 'Composición' })

export type Composition = z.infer<typeof CompositionSchema>
export type TemplateId = Composition['template']
export type MediaRef = z.infer<typeof MediaRefSchema>

export const TEMPLATE_IDS: TemplateId[] = ['showcase', 'catalog', 'case', 'ledger', 'reading', 'channels']
