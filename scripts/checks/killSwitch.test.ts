// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { disableDistribution, isBudgetAlert } from '../../infra/lambda/kill-switch/logic.mjs'

// The kill switch of spec 014 (layer 3): it disables the one distribution it is
// given, keeps the rest of its config, and ignores anything but a budget alert.
type Config = Record<string, unknown> & { Enabled: boolean }

function stub(config: Config) {
  const calls: { id: string; config: Record<string, unknown>; etag: string }[] = []
  return {
    calls,
    cloudfront: {
      getConfig: async () => ({ config, etag: 'E-TAG-1' }),
      updateConfig: async (id: string, next: Record<string, unknown>, etag: string) => {
        calls.push({ id, config: next, etag })
      },
    },
  }
}

const budgetEvent = {
  Records: [{ EventSource: 'aws:sns', Sns: { Message: 'AWS Budget Notification: obsidian-cube-kill-switch-20usd has exceeded 100%' } }],
}

describe('kill switch', () => {
  it('disables an enabled distribution with the ETag it read, keeping the rest of the config', async () => {
    const { cloudfront, calls } = stub({ Enabled: true, Comment: 'Obsidian Cube portfolio', Aliases: { Quantity: 2 } })
    expect(await disableDistribution(cloudfront, 'E2CFH0DDZGDBAU')).toBe('disabled')
    expect(calls).toEqual([
      { id: 'E2CFH0DDZGDBAU', etag: 'E-TAG-1', config: { Enabled: false, Comment: 'Obsidian Cube portfolio', Aliases: { Quantity: 2 } } },
    ])
  })

  it('does not write when the distribution is already disabled', async () => {
    const { cloudfront, calls } = stub({ Enabled: false })
    expect(await disableDistribution(cloudfront, 'E2CFH0DDZGDBAU')).toBe('already disabled')
    expect(calls).toEqual([])
  })

  it('refuses to run without a distribution id', async () => {
    const { cloudfront } = stub({ Enabled: true })
    await expect(disableDistribution(cloudfront, '')).rejects.toThrow(/no distribution id/)
  })

  it('acts only on a budget notification delivered by SNS', () => {
    expect(isBudgetAlert(budgetEvent)).toBe(true)
    expect(isBudgetAlert({})).toBe(false)
    expect(isBudgetAlert({ Records: [{ EventSource: 'aws:sns', Sns: { Message: 'hello' } }] })).toBe(false)
    expect(isBudgetAlert({ Records: [{ EventSource: 'aws:sqs', Sns: { Message: 'Budget' } }] })).toBe(false)
  })
})
