// @vitest-environment node
// The web ACL sample collector (spec 020): what a record keeps, how a client
// is classed, which hours and slices a run reads, and how a slice is covered.
import { describe, expect, it } from 'vitest'
import {
  OWNER_TEST_MARK,
  classify,
  coverage,
  hourKey,
  hoursToRead,
  pathOf,
  ruleMetricNames,
  slicesOf,
  targetHour,
  toRecord,
  webAclRef,
} from '../../infra/lambda/waf-samples/logic.mjs'
import { readFileSync } from 'node:fs'
import { agentOf } from '../../server/visits/visitLog'

const sample = {
  Request: {
    ClientIP: '203.0.113.7',
    Country: 'DE',
    URI: '/wp-admin/install.php?step=1&user=a@b.example',
    Method: 'get',
    HTTPVersion: 'HTTP/1.1',
    Headers: [
      { Name: 'Host', Value: 'ricardomelog.com' },
      { Name: 'User-Agent', Value: 'curl/8.21.0' },
      { Name: 'Cookie', Value: 'secret=1' },
    ],
  },
  Weight: 1,
  Timestamp: new Date('2026-11-21T03:17:42Z'),
  Action: 'BLOCK',
  RuleNameWithinRuleGroup: 'AWS#AWSManagedRulesKnownBadInputsRuleSet#ExploitablePaths_URIPATH',
}

describe('a record (D-3)', () => {
  it('keeps no IP, no header and no query, and the time in ten-minute slices', () => {
    const record = toRecord(sample, 'AWS-AWSManagedRulesKnownBadInputsRuleSet')
    expect(record).toEqual({
      t: '2026-11-21T03:10Z',
      m: 'GET',
      p: '/wp-admin/install.php',
      c: 'DE',
      a: 'BLOCK',
      r: 'AWS-AWSManagedRulesKnownBadInputsRuleSet',
      g: 'AWS#AWSManagedRulesKnownBadInputsRuleSet#ExploitablePaths_URIPATH',
      w: 1,
      k: 'library',
      n: 'curl',
    })
    const text = JSON.stringify(record)
    for (const leaked of ['203.0.113.7', 'ricardomelog.com', 'secret', 'step=1', 'a@b.example', 'curl/8.21.0', 'HTTP/1.1']) {
      expect(text, leaked).not.toContain(leaked)
    }
  })

  it('cuts a long path at 200 characters and drops the fragment', () => {
    expect(pathOf('/' + 'a'.repeat(300))).toHaveLength(200)
    expect(pathOf('/es/seguridad#x?y')).toBe('/es/seguridad')
    expect(pathOf('')).toBe('/')
  })

  it('reads the timestamp as the SDK gives it, or in seconds', () => {
    expect(toRecord({ ...sample, Timestamp: 1763695062 }, 'r').t).toBe('2025-11-21T03:10Z')
    expect(toRecord({ ...sample, Weight: 7, Request: { ...sample.Request, Country: '' } }, 'r')).toMatchObject({ w: 7, c: 'ZZ' })
  })
})

describe('the client class (D-3, D-6)', () => {
  it('names crawlers, libraries, browsers and the owner own checks', () => {
    expect(classify('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toEqual({ class: 'crawler', name: 'Googlebot' })
    expect(classify('Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 (Applebot/0.1)')).toEqual({ class: 'crawler', name: 'Applebot' })
    expect(classify('curl/8.18.0')).toEqual({ class: 'library', name: 'curl' })
    expect(classify('node')).toEqual({ class: 'library', name: 'node' })
    expect(classify('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36')).toEqual({ class: 'crawler', name: 'HeadlessChrome' })
    expect(classify('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0')).toEqual({ class: 'browser', name: 'Edge' })
    expect(classify('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toEqual({ class: 'browser', name: 'Safari' })
    expect(classify('')).toEqual({ class: 'empty', name: 'none' })
    expect(classify(`Mozilla/5.0 HeadlessChrome/148 ${OWNER_TEST_MARK}`)).toEqual({ class: 'owner-test', name: 'owner' })
  })

  it('uses the same mark check:live sends', () => {
    expect(readFileSync(new URL('../check-live.mjs', import.meta.url), 'utf8')).toContain(`const CHECK_MARK = '${OWNER_TEST_MARK}'`)
  })

  it('agrees with the admin counter on who is a crawler', () => {
    for (const ua of [
      'Mozilla/5.0 (compatible; Googlebot/2.1)',
      'curl/8.21.0',
      'python-requests/2.32',
      'Mozilla/5.0 (Windows NT 10.0) HeadlessChrome/148.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/142.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
    ]) {
      expect(classify(ua).class === 'browser', ua).toBe(agentOf(ua) === 'human')
    }
  })
})

describe('the hours and slices of a run (D-2)', () => {
  it('reads the whole hour before the schedule time, not the clock', () => {
    expect(targetHour('2026-11-21T04:10:00Z')).toBe('2026-11-21T03')
    expect(targetHour('2026-11-21T00:10:00Z')).toBe('2026-11-20T23')
    expect(hourKey('2026-11-21T03')).toBe('samples/2026/11/21/03.json')
  })

  it('reads only the target without a state, catches up after a failure, and never more than the reach', () => {
    expect(hoursToRead(null, '2026-11-21T03')).toEqual(['2026-11-21T03'])
    expect(hoursToRead('2026-11-21T02', '2026-11-21T03')).toEqual(['2026-11-21T03'])
    expect(hoursToRead('2026-11-21T01', '2026-11-21T03')).toEqual(['2026-11-21T02', '2026-11-21T03'])
    expect(hoursToRead('2026-11-20T10', '2026-11-21T03')).toEqual(['2026-11-21T00', '2026-11-21T01', '2026-11-21T02', '2026-11-21T03'])
    expect(hoursToRead('2026-11-21T03', '2026-11-21T03')).toEqual([])
  })

  it('cuts an hour in six slices and marks the ones no longer whole in reach', () => {
    const now = Date.parse('2026-11-21T04:10:00Z')
    const target = slicesOf('2026-11-21T03', now)
    expect(target).toHaveLength(6)
    expect(target.every((slice) => slice.readable)).toBe(true)
    // Three hours before 04:10 is 01:10: the 01:00-01:10 slice starts too early.
    const old = slicesOf('2026-11-21T01', now)
    expect(old.map((slice) => slice.readable)).toEqual([false, false, true, true, true, true])
    expect(slicesOf('2026-11-21T00', now).some((slice) => slice.readable)).toBe(false)
  })

  it('describes each slice as complete, sampled or truncated', () => {
    expect(coverage({ population: 30, sampled: 30, askedTo: 10, returnedTo: 10 })).toBe('complete')
    expect(coverage({ population: 1200, sampled: 500, askedTo: 10, returnedTo: 10 })).toBe('sampled')
    expect(coverage({ population: 5000, sampled: 500, askedTo: 10, returnedTo: 7 })).toBe('truncated')
  })
})

describe('the web ACL (D-7)', () => {
  it('samples the default action and every rule, once each', () => {
    const acl = {
      VisibilityConfig: { MetricName: 'CreatedByCloudFront-988acf5a' },
      Rules: [{ VisibilityConfig: { MetricName: 'ip-rate-limit-300-5min' } }, { VisibilityConfig: { MetricName: 'ip-rate-limit-300-5min' } }, {}],
    }
    expect(ruleMetricNames(acl)).toEqual(['CreatedByCloudFront-988acf5a', 'ip-rate-limit-300-5min'])
  })

  it('accepts only a CloudFront-scope web ACL ARN', () => {
    expect(webAclRef('arn:aws:wafv2:us-east-1:123456789012:global/webacl/acl-name/abc-123')).toEqual({ name: 'acl-name', id: 'abc-123' })
    expect(() => webAclRef('arn:aws:wafv2:sa-east-1:123456789012:regional/webacl/acl-name/abc')).toThrow(/CloudFront-scope/)
  })
})
