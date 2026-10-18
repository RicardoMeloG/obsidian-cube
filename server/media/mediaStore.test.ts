// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MEDIA_SRC } from '../../src/kernel/compositions'
import { MediaError, MediaStore } from './mediaStore'
import { readWebpSize } from './webp'

const example = readFileSync('public/examples/project-1.webp')
const exampleThumb = readFileSync('public/examples/project-1-thumb.webp')

// A RIFF/WEBP header around one chunk, enough for the size reader.
function webp(chunk: string, body: number[]): Uint8Array {
  const bytes = new Uint8Array(40)
  bytes.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0)
  bytes.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8)
  bytes.set([...chunk].map((c) => c.charCodeAt(0)), 12)
  bytes.set(body, 20)
  return bytes
}

describe('readWebpSize', () => {
  it('reads the committed example images (lossy, from the browser encoder)', () => {
    expect(readWebpSize(example)).toEqual({ width: 1600, height: 1000 })
    expect(readWebpSize(exampleThumb)).toEqual({ width: 320, height: 200 })
  })

  it('reads lossless and extended headers', () => {
    // VP8L: signature, then width-1 and height-1 in 14 bits each (100×50).
    const bits = 99 | (49 << 14)
    expect(readWebpSize(webp('VP8L', [0x2f, bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >>> 24) & 255]))).toEqual({ width: 100, height: 50 })
    // VP8X: flags, reserved, then width-1 and height-1 in 24 bits (640×480).
    expect(readWebpSize(webp('VP8X', [0, 0, 0, 0, 639 & 255, 639 >> 8, 0, 479 & 255, 479 >> 8, 0]))).toEqual({ width: 640, height: 480 })
  })

  it('refuses anything else', () => {
    expect(readWebpSize(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg> padding padding'))).toBeNull()
    expect(readWebpSize(readFileSync('public/favicon.svg'))).toBeNull()
  })
})

describe('MediaStore', () => {
  let dir = ''
  afterEach(() => rmSync(dir, { recursive: true, force: true }))
  const store = () => new MediaStore((dir = mkdtempSync(path.join(tmpdir(), 'media-'))))

  it('stores an image under its content hash, with a thumbnail beside it, and lists the pair', async () => {
    const media = store()
    const image = await media.storeImage(example)
    expect(image.src).toMatch(MEDIA_SRC)
    expect(image).toMatchObject({ width: 1600, height: 1000 })
    const { thumb } = await media.storeThumb(image.hash, exampleThumb)
    expect(thumb).toBe(`/content/media/${image.hash}-thumb.webp`)
    expect(thumb).toMatch(MEDIA_SRC)
    expect(await media.list()).toEqual([{ src: image.src, thumb, width: 1600, height: 1000, bytes: example.length }])
    // The same bytes are the same file.
    expect((await media.storeImage(example)).src).toBe(image.src)
  })

  it('refuses what is not a WebP, an image over the size, a thumbnail too big or without its image, and paths', async () => {
    const media = store()
    await expect(media.storeImage(readFileSync('public/favicon.svg'))).rejects.toBeInstanceOf(MediaError)
    await expect(media.storeImage(webp('VP8X', [0, 0, 0, 0, 255, 6, 0, 0, 1, 0]))).rejects.toThrow(/1792×257/)
    const image = await media.storeImage(example)
    await expect(media.storeThumb(image.hash, example)).rejects.toThrow(/320×400/)
    await expect(media.storeThumb('a'.repeat(64), exampleThumb)).rejects.toThrow(/no corresponde/)
    await expect(media.storeThumb('../../etc', exampleThumb)).rejects.toBeInstanceOf(MediaError)
    await expect(media.read('../site.en.json')).rejects.toBeInstanceOf(MediaError)
  })
})
