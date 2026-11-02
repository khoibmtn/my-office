import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.mock('server-only', () => ({}))

import { signStaffSession, verifyStaffSession } from '@/lib/server/staff-session'

describe('staff session token', () => {
  const prev = process.env.STAFF_SESSION_SECRET
  beforeAll(() => {
    process.env.STAFF_SESSION_SECRET = 'test-secret'
  })
  afterAll(() => {
    process.env.STAFF_SESSION_SECRET = prev
  })

  it('round-trips a valid token', () => {
    const token = signStaffSession('doc123', 'abc12345')!
    expect(token.startsWith('v1.')).toBe(true)
    expect(verifyStaffSession(token)).toMatchObject({ staffDocId: 'doc123', staffId: 'abc12345' })
  })

  it('rejects a tampered payload', () => {
    const token = signStaffSession('doc123', 'abc12345')!
    const [, , sig] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ staffDocId: 'otherDoc', staffId: 'x', exp: 9999999999 })).toString('base64url')
    expect(verifyStaffSession(`v1.${forged}.${sig}`)).toBeNull()
  })

  it('rejects a token signed with another secret', () => {
    const token = signStaffSession('doc123', 'abc12345')!
    process.env.STAFF_SESSION_SECRET = 'other-secret'
    expect(verifyStaffSession(token)).toBeNull()
    process.env.STAFF_SESSION_SECRET = 'test-secret'
  })

  it('rejects an expired token', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const token = signStaffSession('doc123', 'abc12345')!
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z')) // > 30 days later
    expect(verifyStaffSession(token)).toBeNull()
    vi.useRealTimers()
  })

  it('rejects garbage', () => {
    for (const bad of [undefined, '', 'abc', 'v1.a', 'v1.a.b', 'v2.x.y', 123]) {
      expect(verifyStaffSession(bad as unknown)).toBeNull()
    }
  })
})
