import { lookup } from 'dns/promises'
import { isIP } from 'net'
import { PublicError } from './public-error'

/**
 * Server-side fetch of a user-supplied URL with SSRF guards:
 * http(s) only, every hop's host must resolve to public addresses, ≤3 redirects,
 * timeout and body size limit. (DNS-rebinding between lookup and connect is not covered.)
 */
export const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024
const TIMEOUT_MS = 20_000
const MAX_REDIRECTS = 3

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0
}

function inCidr4(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask)
}

export function isPrivateAddress(address: string): boolean {
  let ip = address.toLowerCase()
  if (ip.startsWith('::ffff:')) ip = ip.slice(7) // IPv4-mapped IPv6
  const family = isIP(ip)
  if (family === 4) {
    return [
      ['0.0.0.0', 8],
      ['10.0.0.0', 8],
      ['100.64.0.0', 10],
      ['127.0.0.0', 8],
      ['169.254.0.0', 16],
      ['172.16.0.0', 12],
      ['192.0.0.0', 24],
      ['192.168.0.0', 16],
      ['198.18.0.0', 15],
      ['224.0.0.0', 4],
      ['240.0.0.0', 4],
    ].some(([base, bits]) => inCidr4(ip, base as string, bits as number))
  }
  if (family === 6) {
    // IPv4-compatible (::a.b.c.d → '::7f00:1'), NAT64 64:ff9b::/96, site-local fec0::/10
    if (/^::[0-9a-f]{1,4}(:[0-9a-f]{1,4})?$/.test(ip) || ip.startsWith('64:ff9b:')) return true
    if (/^fe[c-f]/.test(ip)) return true
    return (
      ip === '::' ||
      ip === '::1' ||
      ip.startsWith('fc') ||
      ip.startsWith('fd') ||
      ip.startsWith('fe8') ||
      ip.startsWith('fe9') ||
      ip.startsWith('fea') ||
      ip.startsWith('feb') ||
      ip.startsWith('ff')
    )
  }
  return true // not an IP at all → treat as unsafe
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new PublicError('Link không hợp lệ')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new PublicError('Chỉ hỗ trợ link http/https')
  }
  if (url.username || url.password) throw new PublicError('Link không được chứa thông tin đăng nhập')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true })
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new PublicError('Không được tải file từ địa chỉ nội bộ')
  }
  return url
}

export async function safeFetchBuffer(raw: string): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  let current = raw
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current)
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) throw new PublicError(`Chuyển hướng không hợp lệ (${res.status})`)
      current = new URL(location, url).toString()
      continue
    }
    if (!res.ok) throw new PublicError(`Fetch URL thất bại: ${res.status}`)

    const declared = Number(res.headers.get('content-length') || 0)
    if (declared > MAX_DOWNLOAD_BYTES) throw new PublicError('File vượt quá 25 MB')

    const chunks: Uint8Array[] = []
    let total = 0
    const reader = res.body?.getReader()
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > MAX_DOWNLOAD_BYTES) {
          await reader.cancel()
          throw new PublicError('File vượt quá 25 MB')
        }
        chunks.push(value)
      }
    }
    return {
      buffer: Buffer.concat(chunks),
      contentType: res.headers.get('content-type') ?? 'application/octet-stream',
      finalUrl: url.toString(),
    }
  }
  throw new PublicError('Quá nhiều lần chuyển hướng')
}
