// Draws the neutral example images of the composition templates (spec 011,
// AD-03): wireframe windows with no text, brands or people, so the example
// content shows where an owner's screenshot goes without claiming anything.
// Rendered on a canvas in Chromium and saved as WebP, at the sizes the admin
// produces: 1600 px wide plus a 320 px thumbnail.
//   node scripts/make-example-media.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = 'public/examples'
const IMAGES = [
  { name: 'project-1', hue: 252, layout: 'list' },
  { name: 'project-2', hue: 28, layout: 'dashboard' },
  { name: 'project-3', hue: 200, layout: 'document' },
]

function draw({ hue, layout }, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const g = canvas.getContext('2d')
  const s = width / 1600
  const box = (x, y, w, h, color, r = 10) => {
    g.fillStyle = color
    g.beginPath()
    g.roundRect(x * s, y * s, w * s, h * s, r * s)
    g.fill()
  }
  const back = g.createLinearGradient(0, 0, width, height)
  back.addColorStop(0, `hsl(${hue} 30% 9%)`)
  back.addColorStop(1, `hsl(${hue + 30} 25% 4%)`)
  g.fillStyle = back
  g.fillRect(0, 0, width, height)
  box(80, 70, 1440, 860, `hsl(${hue} 18% 12%)`, 18)
  box(80, 70, 1440, 64, `hsl(${hue} 18% 16%)`, 18)
  for (const [i, x] of [112, 144, 176].entries()) {
    g.fillStyle = `hsl(${hue} 30% ${40 + i * 8}%)`
    g.beginPath()
    g.arc(x * s, 102 * s, 9 * s, 0, Math.PI * 2)
    g.fill()
  }
  const accent = `hsl(${hue} 55% 62%)`
  const soft = `hsl(${hue} 20% 22%)`
  const line = `hsl(${hue} 14% 30%)`
  box(110, 170, 280, 730, `hsl(${hue} 18% 15%)`)
  for (let i = 0; i < 8; i += 1) box(140, 210 + i * 80, i === 1 ? 220 : 180, 22, i === 1 ? accent : line, 6)
  if (layout === 'list') {
    for (let i = 0; i < 6; i += 1) {
      box(430, 180 + i * 120, 1050, 96, soft)
      box(460, 205 + i * 120, 46, 46, i % 2 ? line : accent, 8)
      box(530, 210 + i * 120, 420, 18, line, 5)
      box(530, 240 + i * 120, 620, 14, `hsl(${hue} 12% 25%)`, 5)
    }
  } else if (layout === 'dashboard') {
    for (let i = 0; i < 3; i += 1) box(430 + i * 355, 180, 330, 150, soft)
    for (let i = 0; i < 3; i += 1) box(460 + i * 355, 270, 120 + i * 40, 26, accent, 6)
    box(430, 360, 1040, 540, soft)
    g.strokeStyle = accent
    g.lineWidth = 6 * s
    g.beginPath()
    const points = [0.7, 0.55, 0.62, 0.4, 0.46, 0.3, 0.34, 0.2]
    points.forEach((p, i) => g.lineTo((480 + i * 130) * s, (420 + p * 420) * s))
    g.stroke()
  } else {
    box(430, 180, 1040, 720, soft)
    box(500, 240, 520, 34, accent, 8)
    for (let i = 0; i < 12; i += 1) box(500, 310 + i * 44, i % 4 === 3 ? 560 : 880, 16, line, 5)
  }
  return canvas.toDataURL('image/webp', 0.86)
}

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage()
for (const image of IMAGES) {
  for (const [suffix, width] of [['', 1600], ['-thumb', 320]]) {
    const data = await page.evaluate(`(${draw.toString()})(${JSON.stringify(image)}, ${width}, ${width * 0.625})`)
    writeFileSync(`${OUT}/${image.name}${suffix}.webp`, Buffer.from(data.split(',')[1], 'base64'))
  }
}
await browser.close()
console.log(`Example media written to ${OUT}.`)
