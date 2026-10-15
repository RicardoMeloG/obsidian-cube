// The image field of the admin's generated form (spec 011, AD-03): preview,
// alternative text, upload and the library. The page resizes and encodes the
// image to WebP in the browser, so neither the local server nor the Lambda
// needs an image library. Plain script, exposes window.SchemaFormMedia; form.js
// passes it the form's own state (`form`).
;(function () {
  'use strict'

  const { el } = window.SchemaFormKit

  // An image: preview, alternative text, upload and the library.
  function field(form, fieldSchema, path, { required, label }) {
    const { get, set, remove, render, wrap, media } = form
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

  window.SchemaFormMedia = { field, toWebp }
})()
