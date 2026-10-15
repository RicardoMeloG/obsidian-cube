// Form generated from a document's JSON Schema (spec 011, AD-04). The admin
// page asks the server for the schema the kernel defines and renders it:
// objects as groups, lists with add, remove and reorder, enums as selects,
// rich text as a text area that names its allowed tags, images as an upload
// with a library, and `title` as the Spanish label. A field added to the
// kernel appears here with no change to this file. Plain script, no build
// step, like the page that loads it; it exposes window.SchemaForm.
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

  function create(root, schema, initial, options) {
    const media = (options && options.media) || null
    // stash: what each union held per option; open: list items unfolded.
    const state = { value: clone(initial), stash: {}, open: new Set() }

    const get = (path) => path.reduce((node, key) => (node === undefined || node === null ? undefined : node[key]), state.value)
    function set(path, value) {
      if (path.length === 0) return void (state.value = value)
      const parent = get(path.slice(0, -1))
      parent[path[path.length - 1]] = value
    }
    function remove(path) {
      const parent = get(path.slice(0, -1))
      const key = path[path.length - 1]
      if (Array.isArray(parent)) parent.splice(key, 1)
      else delete parent[key]
    }

    function render() {
      const scroll = root.scrollTop
      root.replaceChildren(field(schema, [], { required: true, label: schema.title || '' }))
      root.scrollTop = scroll
      root.dataset.ready = 'true'
    }

    function wrap(path, label, required, control, hint) {
      return el('div', { class: 'sf-field', 'data-path': path.join('.') }, [
        el('label', { class: 'sf-label' }, [label, required ? null : el('span', { class: 'sf-optional', text: ' (opcional)' })]),
        control,
        hint ? el('small', { class: 'sf-hint', text: hint }) : null,
      ])
    }

    function field(fieldSchema, path, { required, label }) {
      const value = get(path)
      if (fieldSchema.const !== undefined) return null
      if (fieldSchema.widget === 'fixed') return wrap(path, label, true, el('output', { class: 'sf-fixed', text: String(value) }))
      if (fieldSchema.oneOf) return union(fieldSchema, path, { required, label })
      if (isNullable(fieldSchema)) return nullable(fieldSchema, path, label)
      if (fieldSchema.widget === 'media') return image(fieldSchema, path, { required, label })
      if (fieldSchema.type === 'object') return group(fieldSchema, path, { required, label })
      if (fieldSchema.type === 'array') return list(fieldSchema, path, { required, label })
      if (fieldSchema.type === 'boolean') {
        return wrap(path, label, required, el('input', { type: 'checkbox', checked: Boolean(value), onchange: (event) => set(path, event.target.checked) }))
      }
      if (fieldSchema.type === 'number' || fieldSchema.type === 'integer') {
        return wrap(path, label, required, el('input', { type: 'number', value: value ?? '', oninput: (event) => set(path, Number(event.target.value)) }))
      }
      return text(fieldSchema, path, { required, label })
    }

    function text(fieldSchema, path, { required, label }) {
      const value = get(path)
      // An optional field left empty is absent, as the schema expects.
      const write = (next) => (next === '' && !required ? remove(path) : set(path, next))
      if (fieldSchema.enum) {
        const select = el(
          'select',
          { onchange: (event) => write(event.target.value) },
          [required ? null : el('option', { value: '', text: '—' })].concat(fieldSchema.enum.map((option) => el('option', { value: option, selected: option === value, text: option }))),
        )
        return wrap(path, label, required, select)
      }
      if (fieldSchema.widget === 'rich') {
        const area = el('textarea', { rows: 3, oninput: (event) => write(event.target.value) })
        area.value = value ?? ''
        const tags = (fieldSchema.tags || []).map((tag) => `<${tag}>`).join(' ')
        return wrap(path, label, required, area, tags ? `Etiquetas permitidas: ${tags}` : undefined)
      }
      if (fieldSchema.widget === 'color') {
        const input = el('input', { type: 'text', value: value ?? '', pattern: fieldSchema.pattern, oninput: (event) => {
          write(event.target.value)
          if (/^#[0-9a-fA-F]{6}$/.test(event.target.value)) swatch.value = event.target.value
        } })
        const swatch = el('input', { type: 'color', value: /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#000000', oninput: (event) => {
          input.value = event.target.value
          write(event.target.value)
        } })
        return wrap(path, label, required, el('span', { class: 'sf-color' }, [swatch, input]))
      }
      return wrap(path, label, required, el('input', { type: 'text', value: value ?? '', oninput: (event) => write(event.target.value) }))
    }

    function nullable(fieldSchema, path, label) {
      const inner = nonNull(fieldSchema)
      const value = get(path)
      const select = el(
        'select',
        { onchange: (event) => set(path, event.target.value === '' ? null : event.target.value) },
        [el('option', { value: '', text: '— ninguno —' })].concat((inner.enum || []).map((option) => el('option', { value: option, selected: option === value, text: option }))),
      )
      return wrap(path, label, true, select)
    }

    function group(fieldSchema, path, { required, label }) {
      const value = get(path)
      if (value === undefined) {
        return el('div', { class: 'sf-field', 'data-path': path.join('.') }, [
          el('button', { type: 'button', class: 'sf-add', onclick: () => (set(path, skeleton(fieldSchema)), render()), text: `+ Agregar ${label.toLowerCase()}` }),
        ])
      }
      const children = isRecord(fieldSchema)
        ? Object.keys(value).map((key) => field(fieldSchema.additionalProperties, path.concat(key), { required: true, label: key }))
        : Object.entries(fieldSchema.properties || {}).map(([key, child]) =>
            field(child, path.concat(key), { required: (fieldSchema.required || []).includes(key), label: child.title || humanize(key) }),
          )
      if (path.length === 0) return el('div', { class: 'sf-root' }, children)
      return el('fieldset', { class: 'sf-group', 'data-path': path.join('.') }, [
        el('legend', {}, [label, required ? null : el('button', { type: 'button', class: 'sf-remove', title: 'Quitar', onclick: () => (remove(path), render()), text: 'Quitar' })]),
        ...children,
      ])
    }

    function list(fieldSchema, path, { required, label }) {
      const items = get(path) || []
      const itemSchema = fieldSchema.items || {}
      const move = (from, to) => {
        const array = get(path)
        array.splice(to, 0, array.splice(from, 1)[0])
        render()
      }
      // Lists of plain values (tags, points) stay on one line per item; items
      // with fields fold, showing what they are about.
      const plain = itemSchema.type !== 'object' && !itemSchema.oneOf
      const controls = (index) => [
        el('button', { type: 'button', title: 'Subir', disabled: index === 0, onclick: () => move(index, index - 1), text: '↑' }),
        el('button', { type: 'button', title: 'Bajar', disabled: index === items.length - 1, onclick: () => move(index, index + 1), text: '↓' }),
        el('button', {
          type: 'button',
          title: 'Eliminar',
          class: 'sf-remove',
          onclick: () => {
            remove(path.concat(index))
            // An optional list left empty is absent.
            if (!required && get(path).length === 0) remove(path)
            render()
          },
          text: '✕',
        }),
      ]
      const rows = items.map((item, index) => {
        const itemPath = path.concat(index)
        if (plain) return el('li', { class: 'sf-item sf-inline' }, [field(itemSchema, itemPath, { required: true, label: '' }), ...controls(index)])
        const key = itemPath.join('.')
        const details = el('details', { class: 'sf-item', open: state.open.has(key), ontoggle: () => (details.open ? state.open.add(key) : state.open.delete(key)) }, [
          el('summary', { class: 'sf-item-bar' }, [el('span', { class: 'sf-index', text: `#${index + 1}` }), el('span', { class: 'sf-preview-text', text: preview(item) }), ...controls(index)]),
          field(itemSchema, itemPath, { required: true, label: itemSchema.title || '' }),
        ])
        return el('li', {}, [details])
      })
      const add = el('button', {
        type: 'button',
        class: 'sf-add',
        onclick: () => {
          if (get(path) === undefined) set(path, [])
          get(path).push(skeleton(itemSchema))
          state.open.add(path.concat(get(path).length - 1).join('.'))
          render()
        },
        text: '+ Agregar',
      })
      return el('fieldset', { class: 'sf-group sf-list', 'data-path': path.join('.') }, [el('legend', {}, [label, el('span', { class: 'sf-count', text: ` (${items.length})` })]), el('ol', {}, rows), add])
    }

    // A union (the composition): a select of its options; switching keeps
    // what was written for the previous option, so switching back restores it.
    function union(fieldSchema, path, { required, label }) {
      const key = discriminator(fieldSchema)
      const value = get(path)
      const current = value && fieldSchema.oneOf.find((option) => option.properties[key].const === value[key])
      const stashKey = path.join('.')
      const select = el(
        'select',
        {
          onchange: (event) => {
            const stash = (state.stash[stashKey] = state.stash[stashKey] || {})
            if (value) stash[value[key]] = clone(value)
            const chosen = fieldSchema.oneOf.find((option) => option.properties[key].const === event.target.value)
            if (!chosen) remove(path)
            else set(path, stash[event.target.value] || skeleton(chosen))
            render()
          },
        },
        [required ? null : el('option', { value: '', text: '— la del ejemplo —' })].concat(
          fieldSchema.oneOf.map((option) => el('option', { value: option.properties[key].const, selected: option === current, text: option.title || option.properties[key].const })),
        ),
      )
      const children = current
        ? Object.entries(current.properties)
            .filter(([name]) => name !== key)
            .map(([name, child]) => field(child, path.concat(name), { required: (current.required || []).includes(name), label: child.title || humanize(name) }))
        : []
      return el('fieldset', { class: 'sf-group sf-union', 'data-path': path.join('.') }, [
        el('legend', { text: fieldSchema.title || label }),
        wrap(path.concat(key), 'Plantilla', true, select),
        ...children,
      ])
    }

    // An image: preview, alternative text, upload and the library.
    function image(fieldSchema, path, { required, label }) {
      const value = get(path)
      const status = el('small', { class: 'sf-hint' })
      const preview = value && value.src ? el('img', { class: 'sf-preview', src: value.thumb || value.src, alt: '' }) : el('div', { class: 'sf-preview sf-empty', text: 'Sin imagen' })
      const apply = (stored) => {
        const current = get(path) || {}
        const next = { src: stored.src, alt: current.alt || '', width: stored.width, height: stored.height }
        if (stored.thumb) next.thumb = stored.thumb
        set(path, next)
        render()
      }
      const file = el('input', {
        type: 'file',
        accept: 'image/*',
        class: 'sf-file',
        onchange: async (event) => {
          const chosen = event.target.files && event.target.files[0]
          if (!chosen || !media) return
          status.textContent = 'Preparando y subiendo…'
          try {
            apply(await media.upload(chosen))
          } catch (error) {
            status.textContent = error.message
          }
        },
      })
      const library = el('div', { class: 'sf-library', hidden: true })
      const browse = el('button', {
        type: 'button',
        onclick: async () => {
          if (!library.hidden) return void (library.hidden = true)
          library.replaceChildren(el('small', { class: 'sf-hint', text: 'Cargando…' }))
          library.hidden = false
          const entries = media ? await media.list() : []
          library.replaceChildren(
            ...(entries.length
              ? entries.map((entry) => el('button', { type: 'button', class: 'sf-pick', title: `${entry.width}×${entry.height}`, onclick: () => apply(entry) }, [el('img', { src: entry.thumb || entry.src, alt: '' })]))
              : [el('small', { class: 'sf-hint', text: 'Aún no hay imágenes subidas.' })]),
          )
        },
        text: 'Elegir de la biblioteca',
      })
      const alt = el('input', { type: 'text', value: (value && value.alt) || '', placeholder: 'Qué muestra la imagen', oninput: (event) => (get(path).alt = event.target.value) })
      return el('fieldset', { class: 'sf-group sf-media', 'data-path': path.join('.') }, [
        el('legend', {}, [label || 'Imagen', required ? null : el('button', { type: 'button', class: 'sf-remove', onclick: () => (remove(path), render()), text: 'Quitar' })]),
        el('div', { class: 'sf-media-row' }, [preview, el('div', { class: 'sf-media-actions' }, [el('label', { class: 'sf-upload' }, ['Subir imagen…', file]), browse, status])]),
        library,
        wrap(path.concat('alt'), 'Texto alternativo', true, alt),
      ])
    }

    render()
    return {
      value: () => clone(state.value),
      // Marks the fields the server refused, by their path in this form.
      markErrors(paths) {
        root.querySelectorAll('.sf-error').forEach((node) => node.classList.remove('sf-error'))
        for (const path of paths) {
          const node = root.querySelector(`[data-path="${CSS.escape(path)}"]`)
          if (node) node.classList.add('sf-error')
        }
      },
    }
  }

  // Resizes an image in the browser and encodes it as WebP (spec 011, AD-03),
  // so neither the local server nor the Lambda needs an image library.
  async function toWebp(file, limit) {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, limit.width / bitmap.width, limit.height / bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86))
    if (!blob || blob.type !== 'image/webp') throw new Error('Este navegador no genera WebP: usa Chrome o Edge.')
    return blob
  }

  window.SchemaForm = { create, skeleton, toWebp }
})()
