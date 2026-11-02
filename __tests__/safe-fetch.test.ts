import { describe, it, expect } from 'vitest'
import { isPrivateAddress } from '@/lib/server/safe-fetch'

describe('isPrivateAddress (SSRF guard)', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1',
    '::ffff:127.0.0.1', 'not-an-ip', '::7f00:1', '64:ff9b::7f00:1', 'fec0::1',
  ])('blocks %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true)
  })

  it.each(['8.8.8.8', '142.250.72.14', '172.32.0.1', '2001:4860:4860::8888'])('allows public %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false)
  })
})

import { safeFetchBuffer } from '@/lib/server/safe-fetch'

describe('safeFetchBuffer rejects unsafe URLs before any request', () => {
  it.each([
    'http://127.0.0.1:3000/api/drive/token',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://[::127.0.0.1]/',
    'http://2130706433/',
    'http://0x7f.1/',
    'http://10.0.0.5/file.pdf',
    'file:///etc/passwd',
    'ftp://example.com/a',
    'http://user:pass@8.8.8.8/',
    'not a url',
  ])('rejects %s', async (url) => {
    await expect(safeFetchBuffer(url)).rejects.toThrow()
  })
})
