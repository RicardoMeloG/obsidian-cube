import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { readWebpSize } from './webp'

// Owner images (spec 011, AD-03). The admin page resizes and encodes them to
// WebP in the browser; here they are checked and stored under their content
// hash, next to the published content and, like it, gitignored. A thumbnail
// is stored beside its image as <hash>-thumb.webp, so the pair needs no index.
// In production the same names live under content/media/ in the site bucket
// (ADR 004: a presigned PUT to the drafts bucket, copied on publish).

export const MEDIA_LIMITS = {
  bytes: 3 * 1024 * 1024,
  image: { width: 1600, height: 2000 },
  thumb: { width: 320, height: 400 },
}

export type StoredMedia = { src: string; thumb?: string; width: number; height: number; bytes: number }

export class MediaError extends Error {}

const HASH = /^[a-f0-9]{64}$/

function check(bytes: Uint8Array, limits: { width: number; height: number }) {
  if (bytes.length === 0 || bytes.length > MEDIA_LIMITS.bytes) {
    throw new MediaError(`La imagen debe pesar entre 1 byte y ${MEDIA_LIMITS.bytes / 1024 / 1024} MB.`)
  }
  const size = readWebpSize(bytes)
  if (!size) throw new MediaError('El archivo no es una imagen WebP.')
  if (size.width > limits.width || size.height > limits.height) {
    throw new MediaError(`La imagen mide ${size.width}×${size.height}; el máximo es ${limits.width}×${limits.height}.`)
  }
  return size
}

export class MediaStore {
  constructor(private readonly dir: string) {}

  async storeImage(bytes: Uint8Array): Promise<StoredMedia & { hash: string }> {
    const size = check(bytes, MEDIA_LIMITS.image)
    const hash = createHash('sha256').update(bytes).digest('hex')
    await fs.mkdir(this.dir, { recursive: true })
    await fs.writeFile(path.join(this.dir, `${hash}.webp`), bytes)
    return { hash, src: `/content/media/${hash}.webp`, ...size, bytes: bytes.length }
  }

  async storeThumb(hash: string, bytes: Uint8Array): Promise<{ thumb: string }> {
    if (!HASH.test(hash)) throw new MediaError('Identificador de imagen inválido.')
    check(bytes, MEDIA_LIMITS.thumb)
    try {
      await fs.access(path.join(this.dir, `${hash}.webp`))
    } catch {
      throw new MediaError('La miniatura no corresponde a ninguna imagen subida.')
    }
    await fs.writeFile(path.join(this.dir, `${hash}-thumb.webp`), bytes)
    return { thumb: `/content/media/${hash}-thumb.webp` }
  }

  // The library: every stored image with its thumbnail, newest first.
  async list(): Promise<StoredMedia[]> {
    let names: string[]
    try {
      names = await fs.readdir(this.dir)
    } catch {
      return []
    }
    const images = names.filter((name) => /^[a-f0-9]{64}\.webp$/.test(name))
    const entries = await Promise.all(
      images.map(async (name) => {
        const file = path.join(this.dir, name)
        const [bytes, stat] = await Promise.all([fs.readFile(file), fs.stat(file)])
        const size = readWebpSize(bytes)
        const hash = name.slice(0, 64)
        const thumb = names.includes(`${hash}-thumb.webp`) ? `/content/media/${hash}-thumb.webp` : undefined
        return { src: `/content/media/${name}`, thumb, width: size?.width ?? 0, height: size?.height ?? 0, bytes: bytes.length, time: stat.mtimeMs }
      }),
    )
    return entries.sort((a, b) => b.time - a.time).map((entry) => ({ src: entry.src, thumb: entry.thumb, width: entry.width, height: entry.height, bytes: entry.bytes }))
  }

  // One stored file, by its exact name: the path never comes from the request.
  async read(name: string): Promise<Buffer> {
    if (!/^[a-f0-9]{64}(-thumb)?\.webp$/.test(name)) throw new MediaError('Archivo inválido.')
    return fs.readFile(path.join(this.dir, name))
  }
}
