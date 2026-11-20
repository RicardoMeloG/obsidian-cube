// How the change audit (scripts/audit-change.mjs) cuts a diff into parts the
// local models read whole (spec 012): by file, a large file by hunk, a large
// hunk by line, every part keeping its file header. Cutting a hunk by
// characters left lines and JSON broken in half, and the models reported the
// cut as truncated code (dt-05, D-3). Only a single line longer than a part is
// still cut, and it says so where it breaks.

export const CUT_MARK = '[line continues in the next part]'
export const CONTINUED_MARK = '[continued from the previous part]'

// Lines with their newline, so pieces join back into the exact diff.
const lines = (text) => text.match(/[^\n]*\n|[^\n]+$/g) ?? []

function splitFile(file, size) {
  let [header, ...hunks] = file.split(/(?=^@@ )/m)
  // A file with no hunk (a binary patch, a long rename block) is cut by line
  // like a hunk, with no header, so none of it is lost.
  if (hunks.length === 0) [header, hunks] = ['', [header]]
  const room = Math.max(size - header.length, 1000)
  const pieces = []
  let piece = header
  const flush = () => {
    if (piece !== header) pieces.push(piece)
    piece = header
  }
  for (const hunk of hunks) {
    if (piece.length + hunk.length > size) flush()
    if (header.length + hunk.length <= size) {
      piece += hunk
      continue
    }
    for (const line of lines(hunk)) {
      if (line.length <= room) {
        if (piece.length + line.length > size) flush()
        piece += line
        continue
      }
      // One line longer than a whole part (a minified file): cut where the
      // part is full, and say so on both sides of each cut.
      const sign = line[0]
      let at = 0
      while (at < line.length) {
        const prefix = at > 0 ? `${sign}${CONTINUED_MARK} ` : ''
        const space = () => size - piece.length - prefix.length - CUT_MARK.length - 2
        if (space() < 200) flush()
        // At least 200 characters a step, so a part smaller than its header
        // still advances (it then runs over the size instead of looping).
        const end = at + Math.max(space(), 200)
        const more = line.slice(end) !== '' && line.slice(end) !== '\n'
        piece += `${prefix}${line.slice(at, end).replace(/\n$/, '')}${more ? ` ${CUT_MARK}` : ''}\n`
        at = end
        if (more) flush()
      }
    }
  }
  flush()
  return pieces
}

export function diffChunks(text, size = 9000) {
  const pieces = []
  for (const file of text.split(/(?=^diff --git )/m).filter(Boolean)) {
    if (file.length <= size) pieces.push(file)
    else pieces.push(...splitFile(file, size))
  }
  // Pack small files together.
  const packed = []
  for (const piece of pieces) {
    if (packed.length && packed.at(-1).length + piece.length <= size) packed[packed.length - 1] += piece
    else packed.push(piece)
  }
  return packed
}
