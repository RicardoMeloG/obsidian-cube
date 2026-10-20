// Stress content for the layout check (spec 010, H-06b): the example content
// with every field of a face's heading, the top bar's identity and every slot
// of its composition filled to its layout budget, every list at its maximum,
// links made publishable. With `bare`, the optional blocks (the `case` map,
// the `catalog` images) are left out, the other shape the admin accepts
// (audit-3 F-6). If both fit, any content the admin accepts fits.
// stressContent.test.ts checks they pass the publish rules.

// Long words, so lines break late, as in the Spanish copy.
const WORDS = ['implementación', 'arquitectura', 'observabilidad', 'verificable', 'producción', 'integración', 'experimentación']

// Fills `text` with long words up to exactly `max` characters.
export function fillTo(text, max, upper = false) {
  let result = text.slice(0, max)
  let index = 0
  while (result.length < max) {
    const word = WORDS[index % WORDS.length]
    result = `${result} ${upper ? word.toUpperCase() : word}`.trimStart()
    index += 1
  }
  return result.slice(0, max).trimEnd().padEnd(max, upper ? 'X' : 'x')
}

// Example placeholders and images are refused by the publish rules; stress
// content stands in for owner content.
const STRESS_MEDIA = `/content/media/${'0'.repeat(64)}.webp`
function publishable(value) {
  const text = JSON.stringify(value)
    .replaceAll('your-handle', 'stress-owner')
    .replaceAll('your-project', 'stress-project')
    .replace(/\/examples\/[a-z0-9-]+\.webp/g, STRESS_MEDIA)
    .replace(/illustrative data|datos ilustrativos/gi, 'stress data')
  return JSON.parse(text)
}

// The places a slot path reaches (`a.b`, `a[]` every item, `a.*` every
// value), as the kernel's slotValues reads them, but as parent and key so the
// value can be replaced.
// With `optional`, a missing last field counts too, so optional text is filled.
function slotRefs(root, slot, optional = false) {
  let refs = [{ parent: { root }, key: 'root' }]
  const segments = slot.split('.')
  for (const [position, segment] of segments.entries()) {
    const many = segment.endsWith('[]')
    const name = many ? segment.slice(0, -2) : segment
    refs = refs.flatMap(({ parent, key }) => {
      const value = parent[key]
      if (value === null || typeof value !== 'object') return []
      const children = name === '*' ? Object.keys(value).map((child) => ({ parent: value, key: child })) : [{ parent: value, key: name }]
      const last = position === segments.length - 1
      if (!many) return children.filter((child) => child.parent[child.key] !== undefined || (optional && last))
      return children.flatMap((child) => (Array.isArray(child.parent[child.key]) ? child.parent[child.key].map((_, index) => ({ parent: child.parent[child.key], key: index })) : []))
    })
  }
  return refs
}

// A template filled to its budgets (spec 011, AD-06): lists to their maximum
// (shallow lists first, so the items they add are filled too), then every
// text slot to its length, optional ones included.
export function fillComposition(composition, budget) {
  const filled = structuredClone(composition)
  const depth = (slot) => slot.split('.').length
  for (const [slot, limits] of Object.entries(budget.counts).sort(([a], [b]) => depth(a) - depth(b))) {
    for (const { parent, key } of slotRefs(filled, slot)) {
      const items = parent[key]
      if (!Array.isArray(items) || items.length === 0) continue
      parent[key] = fillList(items, limits.max, (item, index) => {
        const copy = structuredClone(item)
        if (copy && typeof copy === 'object' && typeof copy.id === 'string') copy.id = `${item.id.replace(/-\d+$/, '')}-${index}`
        return copy
      })
    }
  }
  for (const [slot, max] of Object.entries(budget.chars)) {
    // An id is one token, with no space or hyphen to break at: the hardest
    // case to fit (a control's id painted past its column, 2026-10-20).
    const token = /\.id$/.test(slot)
    for (const { parent, key } of slotRefs(filled, slot, true)) {
      if (parent[key] === undefined || typeof parent[key] === 'string') {
        const text = fillTo(parent[key] ?? '', max)
        parent[key] = token ? text.replace(/[^\p{L}\p{N}.]/gu, '').padEnd(max, 'x') : text
      }
    }
  }
  return filled
}

function fillList(items, size, makeItem) {
  return Array.from({ length: size }, (_, index) => makeItem(items[index % items.length], index))
}

export function buildStressContent(example, budgets, { bare = false } = {}) {
  const { chars } = budgets
  const content = structuredClone(example)

  content.identity = {
    ...content.identity,
    // The top bar's texts at their budgets (audit-3 F-4).
    displayName: fillTo('Valentina Hernández', chars.name),
    fullName: 'Valentina Hernández Ugarte-Iturriaga',
    role: fillTo(content.identity.role, chars.role),
    keywords: fillTo(content.identity.keywords ?? '', chars.keywords),
    links: { github: 'https://github.com/stress-owner', linkedin: 'https://www.linkedin.com/in/stress-owner' },
  }

  content.sections = content.sections.map((section) => {
    const upperLabel = section.label === section.label.toUpperCase()
    const next = {
      ...section,
      label: fillTo(section.label, chars.label, upperLabel),
      eyebrow: fillTo(section.eyebrow ?? '', chars.eyebrow),
      title: fillTo(section.title, chars.title),
      summary: fillTo(section.summary, chars.summary),
      tagline: fillTo(section.tagline ?? '', chars.tagline),
      // Every slot of the face's template at its budget, every list at its maximum.
      composition: section.composition && fillComposition(publishable(section.composition), budgets.templates[section.composition.template]),
      // Every face links an artifact, as the publish rules require.
      ctaPrimary: { label: fillTo(section.ctaPrimary?.label ?? '', chars.ctaLabel), href: 'https://example.com/artifact' },
      ctaSecondary: { label: fillTo(section.ctaSecondary?.label ?? '', chars.ctaLabel) },
    }
    if (section.detail?.links) {
      next.detail = { ...section.detail, links: section.detail.links.map((link) => ({ ...link, href: 'https://example.com/link' })) }
    }
    return next
  })
  if (bare) {
    for (const { composition } of content.sections) {
      if (composition?.template === 'case') delete composition.map
      if (composition?.template === 'catalog') for (const item of composition.items) delete item.image
    }
  }
  return content
}
