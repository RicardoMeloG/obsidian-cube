// Bakes the cube's reflection (spec 009, loading).
//
// The scene reflects an equirectangular image. three.js cannot use it as is:
// on every first visit it converts it to a prefiltered "cube UV" atlas
// (PMREM), compiling two shaders synchronously for it (~0.45 s with the page
// frozen). This script does that conversion once, with the three.js version
// the site ships, and writes the atlas as an sRGB WebP the scene loads
// directly. Quality 0.9: 45 KB, smaller than the source image; rendered next
// to the runtime conversion (at rest, turning and falling) no pixel of the
// cube differed by more than 4/255, less than two renders of the same scene
// differ (2026-10-15). Lossless PNG was 520 KB.
//
//   node scripts/bake-reflection.mjs
//
// Run it again after changing the image or upgrading three: reflection.ts
// names the three revision the atlas was baked with, and a unit test fails
// when the installed revision differs.

import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url))
const SOURCE = root('public/environments/obsidian-hall.jpg')
const OUTPUT = root('public/environments/obsidian-hall.cubeuv.webp')
const QUALITY = 0.9
const THREE_BUILD = root('node_modules/three/build/')

// Served from memory: no dev server needed.
const ORIGIN = 'https://bake.local'
const files = {
  '/': ['text/html', '<!doctype html><title>bake</title>'],
  '/three.module.js': ['text/javascript', readFileSync(`${THREE_BUILD}three.module.js`)],
  '/three.core.js': ['text/javascript', readFileSync(`${THREE_BUILD}three.core.js`)],
  '/source.jpg': ['image/jpeg', readFileSync(SOURCE)],
}

const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : [] })
const page = await browser.newPage()
await page.route(`${ORIGIN}/**`, (route) => {
  const file = files[new URL(route.request().url()).pathname]
  return file ? route.fulfill({ contentType: file[0], body: file[1] }) : route.abort()
})
await page.goto(`${ORIGIN}/`)

const baked = await page.evaluate(async (quality) => {
  const THREE = await import('/three.module.js')
  const renderer = new THREE.WebGLRenderer()
  const source = await new THREE.TextureLoader().loadAsync('/source.jpg')
  // As the scene sets it (reflection.ts).
  source.mapping = THREE.EquirectangularReflectionMapping
  source.colorSpace = THREE.SRGBColorSpace

  const target = new THREE.PMREMGenerator(renderer).fromEquirectangular(source)
  const { width, height } = target
  const linear = new Float32Array(width * height * 4)
  renderer.setRenderTarget(target)
  const gl = renderer.getContext()
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, linear)
  renderer.setRenderTarget(null)

  // Linear half floats to 8-bit sRGB, top row first (an image's order; the
  // texture is loaded with flipY, so row 0 of the GL target ends at the bottom).
  const pixels = new ImageData(width, height)
  let peak = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = ((height - 1 - y) * width + x) * 4
      const to = (y * width + x) * 4
      for (let c = 0; c < 3; c++) {
        const value = Math.max(0, linear[from + c])
        peak = Math.max(peak, value)
        const encoded = value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055
        pixels.data[to + c] = Math.round(Math.min(1, encoded) * 255)
      }
      pixels.data[to + 3] = 255
    }
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').putImageData(pixels, 0, 0)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
  return { width, height, peak, revision: THREE.REVISION, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) }
}, QUALITY)
await browser.close()

// Above 1 would be clipped by the 8-bit encoding; the source is an 8-bit
// image and filtering only averages it, so it should not happen.
if (baked.peak > 1.0001) throw new Error(`The atlas has values above 1 (${baked.peak}); 8-bit sRGB would clip them.`)

writeFileSync(OUTPUT, Buffer.from(baked.bytes))
console.log(`Baked ${baked.width}×${baked.height} with three r${baked.revision}, ${Math.round(baked.bytes.length / 1024)} KB → ${OUTPUT}`)
