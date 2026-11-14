import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { summarize, createTally, type VisitSummary } from './visitLog'
import { createS3Reader, fixtureLines, forEachS3Line, visitsConfig, VisitsConfigError } from './visitSource'

// Counts only, in memory, five-minute cache (spec 013, D-4 and D-5).
// No persistence: the admin is a local tool, not a reporting service.
@Injectable()
export class VisitsService {
  private readonly logger = new Logger(VisitsService.name)
  private readonly cache = new Map<string, { at: number; value: VisitSummary & { source: 'fixture' | 's3' } }>()

  async summary(days: number, now: Date = new Date()): Promise<VisitSummary & { source: 'fixture' | 's3' }> {
    const today = now.toISOString().slice(0, 10)
    const config = this.readConfig()
    const key = `${config.source}:${days}:${today}`

    const cached = this.cache.get(key)
    if (cached && now.getTime() - cached.at < 5 * 60 * 1000) {
      return cached.value
    }

    let value: VisitSummary & { source: 'fixture' | 's3' }

    if (config.source === 'fixture') {
      const lines = await fixtureLines(today)
      value = { ...summarize(lines, days, today), source: 'fixture' as const }
    } else {
      const since = new Date(Date.parse(`${today}T00:00:00.000Z`) - (days - 1) * 86_400_000)
      const tally = createTally(days, today)
      try {
        await forEachS3Line(this.reader(config), config.prefix, since, (line) => tally.add(line))
      } catch (err) {
        const name = (err as Error)?.name ?? 'Error'
        this.logger.warn(`S3 read failed: ${name}: ${(err as Error)?.message}`)
        const hint = /Credential|Token|SSO|Expired/i.test(name)
          ? `Si la sesión expiró: aws sso login --profile ${config.profile}`
          : `Revisa VISITS_BUCKET y los permisos del perfil ${config.profile}.`
        throw new ServiceUnavailableException(
          `No se pudieron leer los registros de visitas en S3 (${name}). ${hint}`,
        )
      }
      value = { ...tally.result(), source: 's3' as const }
    }

    this.cache.set(key, { at: now.getTime(), value })
    return value
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
