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

/** The viewer's IP, as the edge saw the connection: the header the
 *  viewer-request function of the receiver's behaviour writes
 *  (infra/edge/viewer-ip.cjs), replacing whatever a client sent under that
 *  name. Not X-Forwarded-For: behind the function URL it arrives as the
 *  client sent it, so it can be forged (2026-11-21). Null when absent. */
export function viewerIp(headers) {
  const value = Object.entries(headers ?? {}).find(([name]) => name.toLowerCase() === 'x-viewer-ip')?.[1]
  return typeof value === 'string' && value.trim() ? value.trim() : null
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
