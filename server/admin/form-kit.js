// Helpers of the admin's generated form (form.js): building elements and
// reading a JSON Schema (unions, nullable values, records, empty values).
// No form state of their own. Plain script, exposes window.SchemaFormKit.
;(function () {
  'use strict'

  function el(tag, attrs, children) {
    const node = document.createElement(tag)
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === undefined || value === null || value === false) continue
      if (key === 'text') node.textContent = value
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value)
      else node.setAttribute(key, value === true ? '' : value)
    }
    for (const child of [].concat(children || [])) if (child) node.append(child)
    return node
  }

  const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
  const humanize = (key) => String(key).replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
  const isNullable = (schema) => Array.isArray(schema.anyOf) && schema.anyOf.some((option) => option.type === 'null')
  const nonNull = (schema) => schema.anyOf.find((option) => option.type !== 'null')
  const isRecord = (schema) => schema.type === 'object' && !schema.properties && typeof schema.additionalProperties === 'object'

  // The discriminator of a union: the property every option fixes with a const.
  function discriminator(schema) {
    const first = schema.oneOf[0].properties || {}
    return Object.keys(first).find((key) => schema.oneOf.every((option) => option.properties && option.properties[key] && option.properties[key].const !== undefined))
  }

  // What a folded list item is about: its first naming field, without markup.
  function preview(item) {
    if (!item || typeof item !== 'object') return ''
    const name = ['label', 'name', 'title', 'term', 'kind', 'id', 'text'].map((key) => item[key]).find((value) => typeof value === 'string' && value)
    const plain = (name || '').replace(/<[^>]*>/g, '')
    return plain.length > 70 ? `${plain.slice(0, 69)}…` : plain
  }

  // An empty value that has every required field of the schema.
  function skeleton(schema) {
    if (schema.const !== undefined) return schema.const
    if (schema.oneOf) return skeleton(schema.oneOf[0])
    if (schema.anyOf) return isNullable(schema) ? null : skeleton(schema.anyOf[0])
    if (schema.enum) return schema.enum[0]
    if (schema.widget === 'media') return { src: '', alt: '', width: 0, height: 0 }
    switch (schema.type) {
      case 'object': {
        const value = {}
        for (const key of schema.required || []) value[key] = skeleton(schema.properties[key])
        return value
      }
      case 'array':
        return []
      case 'string':
        return ''
      case 'number':
      case 'integer':
        return 0
      case 'boolean':
        return false
      default:
        return null
    }
  }

  window.SchemaFormKit = { el, clone, humanize, isNullable, nonNull, isRecord, discriminator, preview, skeleton }
})()
