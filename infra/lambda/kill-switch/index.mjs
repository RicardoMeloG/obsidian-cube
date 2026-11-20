// Lambda entry of the kill switch (spec 014): a 20 USD budget publishes to
// SNS, SNS invokes this function, and it disables the site's distribution.
// The AWS SDK v3 ships with the Node.js runtime, so there is nothing to bundle.
import { CloudFrontClient, GetDistributionConfigCommand, UpdateDistributionCommand } from '@aws-sdk/client-cloudfront'
import { disableDistribution, isBudgetAlert } from './logic.mjs'

const client = new CloudFrontClient({})

const cloudfront = {
  async getConfig(id) {
    const out = await client.send(new GetDistributionConfigCommand({ Id: id }))
    return { config: out.DistributionConfig, etag: out.ETag }
  },
  async updateConfig(id, config, etag) {
    await client.send(new UpdateDistributionCommand({ Id: id, DistributionConfig: config, IfMatch: etag }))
  },
}

export async function handler(event) {
  if (!isBudgetAlert(event)) {
    console.log('kill switch: not a budget alert, nothing done')
    return { action: 'ignored' }
  }
  const result = await disableDistribution(cloudfront, process.env.DISTRIBUTION_ID)
  console.log(`kill switch: distribution ${process.env.DISTRIBUTION_ID} ${result}`)
  return { action: result }
}
