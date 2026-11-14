// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createTally, summarize } from './visitLog'

const LINES: string[] = [
  // 3 human views across two dates and two countries
  JSON.stringify({ 'cs-method': 'GET', 'sc-status': '200', 'cs-uri-stem': '/about', date: '2026-11-10', 'c-country': 'US', 'cs(User-Agent)': 'Mozilla/5.0' }),
  JSON.stringify({ 'cs-method': 'GET', 'sc-status': '200', 'cs-uri-stem': '/about', date: '2026-11-10', 'c-country': 'DE', 'cs(User-Agent)': 'Mozilla/5.0' }),
  JSON.stringify({ 'cs-method': 'GET', 'sc-status': '200', 'cs-uri-stem': '/pricing', date: '2026-11-11', 'c-country': 'US', 'cs(User-Agent)': 'Mozilla/5.0' }),
  // 1 crawler
  JSON.stringify({ 'cs-method': 'GET', 'sc-status': '200', 'cs-uri-stem': '/about', date: '2026-11-10', 'c-country': 'US', 'cs(User-Agent)': 'Googlebot/2.1' }),
  // 1 other-path
  JSON.stringify({ 'cs-method': 'GET', 'sc-status': '200', 'cs-uri-stem': '/nonexistent-xyz', date: '2026-11-11', 'c-country': 'US', 'cs(User-Agent)': 'Mozilla/5.0' }),
]

describe('createTally', () => {
  it('produces the same result as summarize when lines are added one by one', () => {
    const tally = createTally(30, '2026-11-13')
    for (const line of LINES) {
      tally.add(line)
    }
    expect(tally.result()).toEqual(summarize(LINES, 30, '2026-11-13'))
  })

  it('throws RangeError when days is 0', () => {
    expect(() => createTally(0, '2026-11-13')).toThrow(RangeError)
  })

  it('returns equal objects when result() is called twice', () => {
    const tally = createTally(30, '2026-11-13')
    for (const line of LINES) {
      tally.add(line)
    }
    expect(tally.result()).toEqual(tally.result())
  })
})
