// Reads the size of a WebP image from its header, without decoding it, so the
// admin can refuse anything that is not a WebP of the expected size before it
// is stored (spec 011, AD-03). The browser resizes and encodes; the server only
// checks. Covers the three WebP flavours: lossy (VP8), lossless (VP8L) and
// extended (VP8X, with alpha or metadata).
export type WebpSize = { width: number; height: number }

const ascii = (bytes: Uint8Array, from: number, length: number) => String.fromCharCode(...bytes.subarray(from, from + length))
const uint24 = (bytes: Uint8Array, at: number) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16)
const uint16 = (bytes: Uint8Array, at: number) => bytes[at] | (bytes[at + 1] << 8)

export function readWebpSize(bytes: Uint8Array): WebpSize | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null
  const chunk = ascii(bytes, 12, 4)
  if (chunk === 'VP8X') {
    return { width: 1 + uint24(bytes, 24), height: 1 + uint24(bytes, 27) }
  }
  if (chunk === 'VP8 ') {
    // Key frame start code, then two 14-bit dimensions.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null
    return { width: uint16(bytes, 26) & 0x3fff, height: uint16(bytes, 28) & 0x3fff }
  }
  if (chunk === 'VP8L') {
    if (bytes[20] !== 0x2f) return null
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) }
  }
  return null
}
