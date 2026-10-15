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
      // Spec 011 S2 fills each template to its budgets; until then the
      // example composition, made publishable.
      composition: section.composition && publishable(section.composition),
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
