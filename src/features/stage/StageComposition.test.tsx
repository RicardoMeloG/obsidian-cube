// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { slotValues, TEMPLATE_BUDGETS } from '@/kernel/publishRules'
import { getDefaultSiteContent, normalizeSections } from '@/kernel/siteContent'
import { getDefaultVisualContent, resolveSections } from '@/kernel/visualContent'
import { StageComposition } from './StageComposition'

// Every text slot a template declares reaches the page: a slot the admin lets
// the owner fill but no component shows would be silent loss (spec 011, AD-01).
const text = (html: string) => {
  const element = document.createElement('div')
  element.innerHTML = html
  return element.textContent ?? ''
}

describe('stage compositions', () => {
  for (const locale of ['en', 'es'] as const) {
    const content = getDefaultSiteContent(locale)
    const faces = resolveSections(normalizeSections(content.sections, locale), getDefaultVisualContent())

    for (const face of faces) {
      it(`show every text slot of ${face.composition.template} (${face.id}, ${locale})`, () => {
        const shown = text(renderToStaticMarkup(<StageComposition face={face} counter="01 / 06" onOpenDetail={() => {}} />))
        for (const slot of Object.keys(TEMPLATE_BUDGETS[face.composition.template].chars)) {
          // The image's alt text is an attribute, not visible text.
          if (slot.endsWith('.alt')) continue
          const values = slotValues(face.composition, slot).map((found) => text(String(found.value)))
          // A catalog shows the selected item's sheet; the rest only by name.
          const required = face.composition.template === 'catalog' && slot.startsWith('items[]') && !/\.(name|meta|status)$/.test(slot) ? values.slice(0, 1) : values
          for (const value of required) expect(shown, `${slot}: ${value}`).toContain(value)
        }
        expect(shown).toContain(face.eyebrow)
        if (face.ctaPrimary) expect(shown).toContain(face.ctaPrimary.label)
      })
    }
  }
})
