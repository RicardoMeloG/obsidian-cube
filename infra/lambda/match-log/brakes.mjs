// Write brakes of the match-log receiver (spec 016, P-1; owner, 2026-11-21).
// Two limits, both in the instance's memory, checked only for a log that
// would be written:
//
// - Per IP: one viewer cannot store more than PER_IP_LIMIT logs in
//   PER_IP_WINDOW_MS. A real match sends one or two. The IP lives only in
//   this map, for the window, and is never written anywhere (spec 013, E-03).
// - In total: at most PER_SECOND writes a second per instance. With the
//   reserved concurrency of 3 that bounds S3 writes at 15 a second whatever
//   the number of IPs: the only brake on a flood from many addresses.
//
// Both are per instance: with three instances one IP could reach three
// times its limit, which still bounds it. A refused write answers 429.

export const PER_IP_LIMIT = 10
export const PER_IP_WINDOW_MS = 10 * 60 * 1000
export const PER_SECOND = 5
// The map is bounded too, or a flood of distinct addresses would grow it.
export const MAX_TRACKED_IPS = 5000

/** The viewer's IP: the rightmost X-Forwarded-For entry that is not the
 *  CloudFront edge that called the function URL. Entries further left are
 *  whatever the client sent and are not trusted. Null when there is none. */
export function viewerIp(headers, edgeIp) {
  const forwarded = Object.entries(headers ?? {}).find(([name]) => name.toLowerCase() === 'x-forwarded-for')?.[1]
  if (typeof forwarded !== 'string') return null
  const entries = forwarded.split(',').map((entry) => entry.trim()).filter(Boolean)
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index] !== edgeIp) return entries[index]
  }
  return null
}

/** How many entries X-Forwarded-For carries: logged instead of the address. */
export function forwardedCount(headers) {
  const forwarded = Object.entries(headers ?? {}).find(([name]) => name.toLowerCase() === 'x-forwarded-for')?.[1]
  return typeof forwarded === 'string' ? forwarded.split(',').filter((entry) => entry.trim()).length : 0
}

export function createBrakes({ perIpLimit = PER_IP_LIMIT, perIpWindowMs = PER_IP_WINDOW_MS, perSecond = PER_SECOND, maxTrackedIps = MAX_TRACKED_IPS } = {}) {
  const writesByIp = new Map() // ip → timestamps of its stored logs, oldest first
  let second = -1
  let writesThisSecond = 0

  return {
    /** Takes a write if both limits allow it; otherwise returns why not, and nothing is counted. */
    take(ip, nowMs) {
      const thisSecond = Math.floor(nowMs / 1000)
      if (thisSecond !== second) {
        second = thisSecond
        writesThisSecond = 0
      }
      if (writesThisSecond >= perSecond) return { status: 429, reason: 'too many writes, try again shortly', retryAfter: 1 }

      if (ip) {
        const recent = (writesByIp.get(ip) ?? []).filter((at) => nowMs - at < perIpWindowMs)
        if (recent.length >= perIpLimit) {
          writesByIp.set(ip, recent)
          return { status: 429, reason: 'too many logs from this address', retryAfter: Math.ceil((recent[0] + perIpWindowMs - nowMs) / 1000) }
        }
        recent.push(nowMs)
        writesByIp.delete(ip)
        writesByIp.set(ip, recent) // most recent last, so the oldest goes first below
        if (writesByIp.size > maxTrackedIps) writesByIp.delete(writesByIp.keys().next().value)
      }
      writesThisSecond += 1
      return null
    },
    trackedIps: () => writesByIp.size,
  }
}
