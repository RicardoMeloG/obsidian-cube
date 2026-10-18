// A face title on two lines, the second in the face accent: the split that
// balances the two lines best. Shared by the rails and the stage.
export function splitTitleIntoTwoLines(title: string): [string, string?] {
  const trimmed = title.trim()
  const words = trimmed.split(/\s+/)
  if (words.length === 1) return [trimmed]

  let best = words.length - 1
  let bestDelta = Number.POSITIVE_INFINITY
  for (let i = 1; i < words.length; i += 1) {
    const left = words.slice(0, i).join(' ').length
    const right = words.slice(i).join(' ').length
    const delta = Math.abs(left - right)
    if (delta < bestDelta) {
      bestDelta = delta
      best = i
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')]
}
