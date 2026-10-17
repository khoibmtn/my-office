import { timingSafeEqual } from 'crypto'

/**
 * Xác thực server-to-server cho các tiện ích tự động (qlvb-watcher trên Cloudflare)
 * thay cho Firebase ID token của người dùng.
 * Hợp lệ khi body có `ingestSecret` khớp biến môi trường QLVB_INGEST_SECRET (Vercel).
 */
export function isValidIngestSecret(secret: unknown): boolean {
  const expected = process.env.QLVB_INGEST_SECRET
  if (!expected || typeof secret !== 'string' || secret.length === 0) return false
  const a = Buffer.from(secret)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
