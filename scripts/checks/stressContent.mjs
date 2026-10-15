// Stress content for the layout check (spec 010, H-06b): the example content
// with every rail field filled to its layout budget and every list at its
// maximum, links and identity made publishable. If this fits, any content the
// admin accepts fits. stressContent.test.ts checks it passes the publish rules.

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
    for (const { parent, key } of slotRefs(filled, slot, true)) {
      if (parent[key] === undefined || typeof parent[key] === 'string') parent[key] = fillTo(parent[key] ?? '', max)
    }
  }
  return filled
}

function fillList(items, size, makeItem) {
  return Array.from({ length: size }, (_, index) => makeItem(items[index % items.length], index))
}

export function buildStressContent(example, budgets) {
  const { chars, counts } = budgets
  const content = structuredClone(example)

  content.identity = {
    ...content.identity,
    displayName: 'Valentina Hernández',
    fullName: 'Valentina Hernández Ugarte-Iturriaga',
    handle: 'stress-owner',
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
      flowTitle: fillTo(section.flowTitle ?? '', chars.flowTitle),
      tagline: fillTo(section.tagline ?? '', chars.tagline),
      // Every slot of the face's template at its budget, every list at its maximum.
      composition: section.composition && fillComposition(publishable(section.composition), budgets.templates[section.composition.template]),
      features: fillList(section.features ?? [], counts.features.max, (feature) => ({
        ...feature,
        label: fillTo(feature.label, chars.featureLabel),
        description: fillTo(feature.description, chars.featureDescription),
      })),
      flow: fillList(section.flow ?? [], counts.flow.max, (step) => ({
        label: fillTo(step.label, chars.flowLabel),
        description: fillTo(step.description, chars.flowDescription),
      })),
      // Every face links an artifact, as the publish rules require.
      ctaPrimary: { label: fillTo(section.ctaPrimary?.label ?? '', chars.ctaLabel), href: 'https://example.com/artifact' },
      ctaSecondary: { label: fillTo(section.ctaSecondary?.label ?? '', chars.ctaLabel) },
    }
    if (section.detail?.links) {
      next.detail = { ...section.detail, links: section.detail.links.map((link) => ({ ...link, href: 'https://example.com/link' })) }
    }
    if (section.researchConcepts?.length) {
      next.researchConcepts = fillList(section.researchConcepts, counts.researchConcepts.max, (concept, index) => ({
        ...concept,
        key: `${concept.key}-${index}`,
        axis: fillTo(concept.axis, chars.conceptAxis),
        label: fillTo(concept.label, chars.conceptLabel),
        summary: fillTo(concept.summary, chars.conceptSummary),
      }))
    }
    return next
  })
  return content
}
