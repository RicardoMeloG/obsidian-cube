// A face as plain text for the layer for machines (ADR 009): the
// heading, the composition's text by template and the detail, in reading
// order. Only what the document itself holds: a face without its own
// composition or detail gives its heading only, never the example's text,
// which would put made-up facts under the owner's name.
import type { Composition } from '../compositions'
import type { SiteSection } from '../siteContent'
import { toPlainText } from './renderSeo'

export type FaceLink = { label: string; href: string; description?: string }
export type TextEntry = { title?: string; meta?: string[]; text?: string; links?: FaceLink[] }
export type TextGroup = { heading?: string; entries: TextEntry[] }
export type FaceText = {
  label: string
  title: string
  eyebrow?: string
  summary: string
  groups: TextGroup[]
  // The calls to action that lead somewhere.
  links: FaceLink[]
}

const plain = (value: string | undefined) => (value ? toPlainText(value) : undefined)

function link(label: string, href: string | undefined, description?: string): FaceLink[] | undefined {
  return href ? [{ label, href, ...(description ? { description } : {}) }] : undefined
}

const iconItem = (item: { label: string; text: string }): TextEntry => ({ title: item.label, text: plain(item.text) })

function compositionGroups(composition: Composition): TextGroup[] {
  switch (composition.template) {
    case 'showcase': {
      const { featured } = composition
      const proofsHeading = composition.proofsTrail ? `${composition.proofsTitle} — ${composition.proofsTrail}` : composition.proofsTitle
      return [
        {
          heading: featured.label,
          entries: [{ title: featured.title, meta: featured.chips, text: plain(featured.text), links: link(featured.title, featured.href, plain(featured.text)) }],
        },
        { heading: composition.stepsTitle, entries: composition.steps.map(iconItem) },
        {
          heading: proofsHeading,
          entries: composition.proofs.map((proof) => ({
            title: proof.title,
            meta: [proof.kind, ...proof.chips],
            text: plain(proof.text),
            links: link(proof.title, proof.href, plain(proof.text)),
          })),
        },
      ]
    }
    case 'catalog':
      return [
        {
          heading: composition.listTitle,
          entries: composition.items.map((item) => {
            const text = [plain(item.text), ...item.facts.map((fact) => `${fact.label}: ${toPlainText(fact.text)}`)].filter(Boolean).join(' · ')
            return {
              title: item.name,
              meta: [item.meta, item.status, ...item.chips],
              text,
              links: item.links?.map((itemLink) => ({ label: `${item.name} — ${itemLink.label}`, href: itemLink.href, description: plain(item.text) })),
            }
          }),
        },
      ]
    case 'case': {
      const { map } = composition
      // The map is drawn as cells; its words are the count of each state.
      const counts = map
        ? (['done', 'active', 'pending'] as const).map((state) => `${map.legend[state]}: ${map.cells.filter((cell) => cell === state).length}`).join(' · ')
        : undefined
      // The steps have no title of their own: they go under the case's name,
      // which they describe, rather than under the last column's title.
      return [
        { heading: `${composition.caseLabel} — ${composition.caseName}`, entries: composition.steps.map(iconItem) },
        { heading: composition.before.title, entries: composition.before.items.map((text) => ({ text })) },
        { heading: composition.after.title, entries: composition.after.items.map((text) => ({ text })) },
        ...(map ? [{ heading: map.title, entries: [{ text: [map.note, counts].filter(Boolean).join(' · ') }] }] : []),
      ]
    }
    case 'ledger':
      return [
        { entries: composition.callouts.map((callout) => ({ title: callout.title ? `${callout.label} — ${callout.title}` : callout.label, text: plain(callout.text) })) },
        {
          heading: composition.console.title,
          entries: composition.console.rows.map((row) => ({ title: row.id, meta: [composition.console.statusLabels[row.status]], text: row.text })),
        },
      ]
    case 'reading': {
      const { document } = composition
      return [
        { heading: composition.questionLabel, entries: [{ text: plain(composition.question) }] },
        { entries: composition.chain.map(iconItem) },
        { heading: composition.distinctionsTitle, entries: composition.distinctions.map((item) => ({ title: item.term, text: plain(item.text) })) },
        { heading: document.label, entries: [{ title: document.title, meta: document.meta ? [document.meta] : undefined, links: link(document.title, document.href) }] },
      ]
    }
    case 'channels':
      return [
        {
          entries: [
            ...(composition.availability ? [{ text: composition.availability }] : []),
            ...composition.channels.map((channel) => ({ title: channel.label, text: channel.text, links: link(channel.label, channel.href, channel.text) })),
          ],
        },
      ]
  }
}

export function faceText(section: SiteSection): FaceText {
  const { detail } = section
  const groups = section.composition ? compositionGroups(section.composition) : []
  if (detail) {
    groups.push({
      heading: detail.title,
      entries: [
        { text: plain(detail.summary) },
        ...(detail.points ?? []).map((point) => ({ text: plain(point) })),
        ...(detail.links ?? []).map((item) => ({ title: item.label, text: plain(item.description), links: link(item.label, item.href, plain(item.description)) })),
      ],
    })
  }
  const ctas = [section.ctaPrimary, section.ctaSecondary, ...(section.links ?? [])].flatMap((cta) => (cta ? (link(cta.label, cta.href) ?? []) : []))
  return {
    label: section.label,
    title: toPlainText(section.title),
    eyebrow: section.eyebrow,
    summary: toPlainText(section.summary),
    groups: groups.filter((group) => group.heading || group.entries.length > 0),
    links: ctas,
  }
}

// Every link a face carries, in reading order, once each.
export function faceLinks(face: FaceText): FaceLink[] {
  const all = [...face.groups.flatMap((group) => group.entries.flatMap((entry) => entry.links ?? [])), ...face.links]
  const seen = new Set<string>()
  return all.filter((item) => !seen.has(item.href) && Boolean(seen.add(item.href)))
}
