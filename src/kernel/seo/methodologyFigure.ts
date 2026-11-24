// The loop of the methodology page as inline SVG (spec 022 §3.2). Real text,
// so crawlers read it; classes only, no colour and no style attribute: the
// content security policy has no 'unsafe-inline'. One column, so its text
// stays readable on a phone. The classes are in src/methodology/methodology.css.
import type { SiteLocale } from '../siteContent'
import { escapeHtml } from './renderSeo'

type FigureText = { label: string; steps: [string, string, string, string, string, string, string]; retry: string; next: string }

const TEXT: Record<SiteLocale, FigureText> = {
  en: {
    label: 'The loop in seven steps. A failed gate, or what a person sees, sends the change back to the build; after the commit, the next change starts at its spec.',
    steps: ['Spec', 'Audit without context', 'Revision', 'Build', 'Gates', 'A person looks', 'Commit'],
    retry: 'fix',
    next: 'next change',
  },
  es: {
    label: 'El ciclo en siete pasos. Una prueba que falla, o lo que ve una persona, devuelve el cambio a la construcción; después del commit, el cambio siguiente parte en su spec.',
    steps: ['Spec', 'Auditoría sin contexto', 'Revisión', 'Construcción', 'Pruebas', 'Una persona mira', 'Commit'],
    retry: 'corregir',
    next: 'siguiente cambio',
  },
}

const BOX = { x: 52, width: 216, height: 42, gap: 22, top: 6 }
const STEP = BOX.height + BOX.gap
const RIGHT = BOX.x + BOX.width
const CENTRE = BOX.x + BOX.width / 2
const BUILD = 3
const LAST = 6
const middle = (index: number) => BOX.top + index * STEP + BOX.height / 2

const line = (d: string) => `<path class="loop-line" d="${d}"/>`
const head = (d: string) => `<path class="loop-head" d="${d}"/>`
const note = (x: number, y: number, text: string) => `<text class="loop-note" transform="translate(${x} ${y}) rotate(-90)">${escapeHtml(text)}</text>`

export function renderLoopFigure(locale: SiteLocale): string {
  const { label, steps, retry, next } = TEXT[locale]
  const boxes = steps.map((step, index) => {
    const y = BOX.top + index * STEP
    const bottom = y + BOX.height
    const down = index < LAST ? line(`M${CENTRE} ${bottom}v${BOX.gap - 6}`) + head(`M${CENTRE - 5} ${bottom + BOX.gap - 9}h10l-5 8z`) : ''
    return `<rect class="loop-box" x="${BOX.x}" y="${y}" width="${BOX.width}" height="${BOX.height}" rx="4"/><text class="loop-text" x="${CENTRE}" y="${y + 26}">${index + 1}. ${escapeHtml(step)}</text>${down}`
  })
  // Right: the gates and the person send the change back to the build.
  const back = [BUILD + 1, BUILD + 2].map((from) => line(`M${RIGHT} ${middle(from)}h14V${middle(BUILD)}`))
  const toBuild = line(`M${RIGHT + 14} ${middle(BUILD)}h-7`) + head(`M${RIGHT + 9} ${middle(BUILD) - 5}v10l-8 -5z`)
  // Left: after the commit, the next change starts at its spec.
  const again = line(`M${BOX.x} ${middle(LAST)}h-16V${middle(0)}h9`) + head(`M${BOX.x - 9} ${middle(0) - 5}v10l8 -5z`)
  return [
    '<figure class="loop">',
    `<svg viewBox="0 0 320 ${BOX.top * 2 + STEP * LAST + BOX.height}" role="img" aria-label="${escapeHtml(label)}">`,
    ...boxes,
    ...back,
    toBuild,
    again,
    note(RIGHT + 32, middle(BUILD + 1), retry),
    note(BOX.x - 24, middle(BUILD), next),
    '</svg>',
    '</figure>',
  ].join('\n')
}
