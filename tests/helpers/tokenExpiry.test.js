/* global describe, it, expect */
import {
  isTokenExpired,
  publicTokenExpiry,
  publicTokenLifetimeHours,
  publicTokenLifetimeSeconds,
  publicTokenPruneCutoff,
  publicTokenRetentionDays,
} from '../../src/helpers/tokenExpiry'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const NOW = new Date('2026-11-11T18:30:00.000Z')

describe('public client token lifetime', () => {
  it('is 12 hours, kept for 30 days after expiry', () => {
    expect(publicTokenLifetimeHours).toBe(12)
    expect(publicTokenLifetimeSeconds).toBe(12 * 60 * 60)
    expect(publicTokenRetentionDays).toBe(30)
  })

  it('expires 12 hours after issue', () => {
    expect(publicTokenExpiry(NOW).getTime() - NOW.getTime()).toBe(12 * HOUR_MS)
  })

  it('is pruned only once expiry is 30 days in the past', () => {
    expect(NOW.getTime() - publicTokenPruneCutoff(NOW).getTime()).toBe(30 * DAY_MS)
  })
})

describe('isTokenExpired', () => {
  it('never expires a token without an expiry', () => {
    expect(isTokenExpired(null, NOW)).toBe(false)
    expect(isTokenExpired(undefined, NOW)).toBe(false)
  })

  it('accepts a token whose expiry is in the future', () => {
    expect(isTokenExpired(new Date(NOW.getTime() + 1), NOW)).toBe(false)
  })

  it('rejects a token whose expiry is now or in the past', () => {
    expect(isTokenExpired(NOW, NOW)).toBe(true)
    expect(isTokenExpired(new Date(NOW.getTime() - HOUR_MS), NOW)).toBe(true)
  })

  it('accepts an ISO string expiry as stored by the database driver', () => {
    expect(isTokenExpired('2026-11-11T18:29:59.000Z', NOW)).toBe(true)
    expect(isTokenExpired('2026-11-11T18:30:01.000Z', NOW)).toBe(false)
  })
})
