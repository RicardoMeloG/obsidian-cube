import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { summarize, createTally, type VisitSummary } from './visitLog'
import { createS3Reader, fixtureHours, fixtureLines, forEachS3Line, forEachWafHour, visitsConfig, VisitsConfigError } from './visitSource'
import { createWafTally, type WafSummary } from './wafSamples'

type Summary = (VisitSummary | WafSummary) & { source: 'fixture' | 's3' | 'waf' | 'waf-fixture'; skipped?: number }

// Counts only, in memory, five-minute cache (spec 013, D-4 and D-5).
// No persistence: the admin is a local tool, not a reporting service.
@Injectable()
export class VisitsService {
  private readonly logger = new Logger(VisitsService.name)
  private readonly cache = new Map<string, { at: number; value: Summary }>()
  // A read already under way: a second tab or a quick click on 7, 30, 7 waits
  // for it instead of scanning the bucket again.
  private readonly inFlight = new Map<string, Promise<Summary>>()

  async summary(days: number, now: Date = new Date()): Promise<Summary> {
    const today = now.toISOString().slice(0, 10)
    const config = this.readConfig()
    const key = `${config.source}:${days}:${today}`

    const cached = this.cache.get(key)
    if (cached && now.getTime() - cached.at < 5 * 60 * 1000) {
      return cached.value
    }
    const running = this.inFlight.get(key)
    if (running) return running

    const read = this.read(config, days, today).then((value) => {
      this.cache.set(key, { at: now.getTime(), value })
      return value
    })
    this.inFlight.set(key, read)
    try {
      return await read
    } finally {
      this.inFlight.delete(key)
    }
  }

  private async read(config: ReturnType<typeof visitsConfig>, days: number, today: string): Promise<Summary> {
    let value: Summary

    if (config.source === 'fixture') {
      const lines = await fixtureLines(today)
      value = { ...summarize(lines, days, today), source: 'fixture' as const }
    } else if (config.source === 'waf-fixture') {
      const tally = createWafTally(days, today)
      for (const hour of fixtureHours(today)) tally.add(hour)
      value = { ...tally.result(), source: 'waf-fixture' as const }
    } else if (config.source === 'waf') {
      const tally = createWafTally(days, today)
      let skipped: number
      try {
        skipped = (await forEachWafHour(this.reader(config), config.prefix, today, days, (hour) => tally.add(hour))).skipped
      } catch (err) {
        throw this.unavailable(err, config.profile, 'las muestras del WAF')
      }
      if (skipped > 0) this.logger.warn(`S3: ${skipped} unreadable sample objects skipped`)
      value = { ...tally.result(), source: 'waf' as const, skipped }
    } else {
      const since = new Date(Date.parse(`${today}T00:00:00.000Z`) - (days - 1) * 86_400_000)
      const tally = createTally(days, today)
      let skipped: number
      try {
        skipped = (await forEachS3Line(this.reader(config), config.prefix, since, (line) => tally.add(line))).skipped
      } catch (err) {
        throw this.unavailable(err, config.profile, 'los registros de visitas')
      }
      if (skipped > 0) this.logger.warn(`S3: ${skipped} unreadable log objects skipped`)
      value = { ...tally.result(), source: 's3' as const, skipped }
    }
    return value
  }

  private unavailable(err: unknown, profile: string, what: string): ServiceUnavailableException {
    const name = (err as Error)?.name ?? 'Error'
    this.logger.warn(`S3 read failed: ${name}: ${(err as Error)?.message}`)
    const hint = /Credential|Token|SSO|Expired/i.test(name)
      ? `Si la sesión expiró: aws sso login --profile ${profile}`
      : `Revisa VISITS_BUCKET y los permisos del perfil ${profile}.`
    return new ServiceUnavailableException(`No se pudieron leer ${what} en S3 (${name}). ${hint}`)
  }

  protected reader(config: { bucket: string; prefix: string; profile: string; region: string }) {
    return createS3Reader({ bucket: config.bucket, profile: config.profile, region: config.region })
  }

  private readConfig() {
    try {
      return visitsConfig()
    } catch (err) {
      if (err instanceof VisitsConfigError) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }
}
