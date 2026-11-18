'use client'

import { authedFetch } from '@/lib/authedFetch'
import type { RichSectionKey } from '@/types/weekly-report'

const MAX_EDGE = 2000

async function compress(file: File): Promise<File> {
  if (file.type === 'image/gif') return file
  if (file.type === 'image/png' && file.size < 1.5 * 1024 * 1024) return file
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
  if (!blob || blob.size >= file.size) return file
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
}

/** Compress (≤2000px) and upload a pasted image; returns an app URL usable in <img>. */
export async function uploadWeeklyReportImage(
  file: File,
  ctx: { weekId: string; section: RichSectionKey },
): Promise<{ url: string; imageId: string }> {
  const body = new FormData()
  body.append('file', await compress(file))
  body.append('weekId', ctx.weekId)
  body.append('section', ctx.section)
  const token = typeof window !== 'undefined' ? localStorage.getItem('google_access_token') : null
  if (token) body.append('userAccessToken', token)
  const res = await authedFetch('/api/weekly-reports/images', { method: 'POST', body })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error || `Tải ảnh thất bại (${res.status})`)
  return { url: json.url, imageId: json.imageId }
}
