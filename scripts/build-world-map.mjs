// The visits dashboard draws the world map locally (no tile server, no CDN, spec 013 D-7).
// Data is public domain (Natural Earth, credited in docs/assets.md).
// Run this script again only to change the shapes.
// Usage: node scripts/build-world-map.mjs <path to ne_110m_admin_0_countries.geojson>

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Usage: node scripts/build-world-map.mjs <path to ne_110m_admin_0_countries.geojson>')
  process.exit(1)
}

const geojson = JSON.parse(readFileSync(inputPath, 'utf8'))

const A1 = 1.340264
const A2 = -0.081106
const A3 = 0.000893
const A4 = 0.003796
const M = Math.sqrt(3) / 2

function project(lonDeg, latDeg) {
  const lambda = (lonDeg * Math.PI) / 180
  const phi = (latDeg * Math.PI) / 180
  const theta = Math.asin(M * Math.sin(phi))
  const t2 = theta * theta
  const t6 = t2 * t2 * t2
  const t8 = t6 * t2
  const x = (2 * Math.sqrt(3) * lambda * Math.cos(theta)) / (3 * (9 * A4 * t8 + 7 * A3 * t6 + 3 * A2 * t2 + A1))
  const y = theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))
  return [x, -y]
}

function getRings(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat()
  return null
}

// First pass: collect kept features and compute projected bounds
const keptFeatures = []
let minX = Infinity
let maxX = -Infinity
let minY = Infinity
let maxY = -Infinity

for (const feature of geojson.features) {
  const code = feature.properties.ISO_A2_EH
  if (code === 'AQ') continue
  const rings = getRings(feature.geometry)
  if (!rings) continue
  keptFeatures.push({ feature, rings })
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      const [x, y] = project(lon, lat)
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
}

const scale = 1000 / (maxX - minX)
const height = Math.ceil((maxY - minY) * scale)

function toSvg(x, y) {
  return [(x - minX) * scale, (y - minY) * scale]
}

function round1(n) {
  return Math.round(n * 10) / 10
}

function buildRingPath(ring) {
  const points = []
  let prevX = null
  let prevY = null
  for (const [lon, lat] of ring) {
    const [px, py] = project(lon, lat)
    const [sx, sy] = toSvg(px, py)
    const rx = round1(sx)
    const ry = round1(sy)
    if (prevX !== null && rx === prevX && ry === prevY) continue
    points.push([rx, ry])
    prevX = rx
    prevY = ry
  }
  if (points.length < 3) return null
  let d = 'M' + points[0][0] + ' ' + points[0][1]
  for (let i = 1; i < points.length; i++) {
    d += 'L' + points[i][0] + ' ' + points[i][1]
  }
  return d + 'Z'
}

function buildFeaturePath(rings) {
  const parts = []
  for (const ring of rings) {
    const path = buildRingPath(ring)
    if (path) parts.push(path)
  }
  return parts.length > 0 ? parts.join('') : null
}

// Build output structures
const countries = {}
const other = []

for (const { feature, rings } of keptFeatures) {
  const code = feature.properties.ISO_A2_EH
  const path = buildFeaturePath(rings)
  if (!path) continue

  if (/^[A-Z]{2}$/.test(code)) {
    if (countries[code]) {
      countries[code].d += path
    } else {
      const name = (typeof feature.properties.NAME_ES === 'string' && feature.properties.NAME_ES.length > 0) ? feature.properties.NAME_ES : feature.properties.NAME
      countries[code] = { name: name, d: path }
    }
  } else {
    other.push(path)
  }
}

const sortedCountries = {}
for (const key of Object.keys(countries).sort()) {
  sortedCountries[key] = countries[key]
}

const output = {
  source: 'Natural Earth 1:110m admin-0 countries v5.1.2 (public domain), projected to Equal Earth by scripts/build-world-map.mjs',
  viewBox: `0 0 1000 ${height}`,
  countries: sortedCountries,
  other
}

const json = JSON.stringify(output, null, 2) + '\n'
const outUrl = new URL('../server/admin/world.json', import.meta.url)
const outPath = fileURLToPath(outUrl)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, json)

const sizeKb = (Buffer.byteLength(json, 'utf8') / 1024).toFixed(1)
console.log(`${Object.keys(sortedCountries).length} countries, ${sizeKb} KB`)
