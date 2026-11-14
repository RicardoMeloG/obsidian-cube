// The kill switch's decision, without the AWS SDK so it can be unit tested
// (spec 014, D-2): read the distribution's config, and when it is enabled,
// write it back with Enabled false and the ETag it was read with. It never
// deletes anything and only ever touches the distribution it is given.

/**
 * @param {{ getConfig: (id: string) => Promise<{ config: Record<string, unknown> & { Enabled: boolean }, etag: string }>,
 *           updateConfig: (id: string, config: Record<string, unknown>, etag: string) => Promise<void> }} cloudfront
 * @param {string} distributionId
 * @returns {Promise<'disabled' | 'already disabled'>}
 */
export async function disableDistribution(cloudfront, distributionId) {
  if (!distributionId) throw new Error('kill switch: no distribution id configured')
  const { config, etag } = await cloudfront.getConfig(distributionId)
  if (config.Enabled === false) return 'already disabled'
  await cloudfront.updateConfig(distributionId, { ...config, Enabled: false }, etag)
  return 'disabled'
}

// A budget notification arrives through SNS; anything else is ignored, so a
// stray invocation cannot take the site down.
export function isBudgetAlert(event) {
  const records = Array.isArray(event?.Records) ? event.Records : []
  return records.some((record) => record?.EventSource === 'aws:sns' && typeof record?.Sns?.Message === 'string' && /budget/i.test(record.Sns.Message))
}
