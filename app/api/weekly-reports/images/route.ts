import { NextResponse } from 'next/server'
import { Readable } from 'stream'
import { authenticateRequest } from '@/lib/api-auth'
import { getAdminFirestore } from '@/lib/firebase-admin'
import { getServerDriveClient } from '@/lib/weekly-report/server'

export const runtime = 'nodejs'

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const MAX_BYTES = 4 * 1024 * 1024
const SECTIONS = new Set(['opinions', 'nextWeek', 'proposedSchedule', 'deputyOpinions'])

/** Upload an image pasted into a weekly report rich section → Drive (app folder), register it. */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request, { adminOnly: true })
  if (!auth.ok) return auth.response
  try {
    const form = await request.formData()
    const file = form.get('file')
    const weekId = String(form.get('weekId') || '')
    const section = String(form.get('section') || '')
    const userAccessToken = (form.get('userAccessToken') as string | null) || undefined
    if (!(file instanceof File)) return NextResponse.json({ error: 'Thiếu file ảnh' }, { status: 400 })
    if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'Chỉ nhận ảnh PNG, JPEG, WebP, GIF' }, { status: 415 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Ảnh lớn hơn 4 MB' }, { status: 413 })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekId) || !SECTIONS.has(section)) {
      return NextResponse.json({ error: 'weekId/section không hợp lệ' }, { status: 400 })
    }
    const folderId = process.env.WEEKLY_REPORT_DRIVE_FOLDER_ID || process.env.DRIVE_FOLDER_ID
    if (!folderId) return NextResponse.json({ error: 'Chưa cấu hình thư mục Drive' }, { status: 500 })

    const drive = getServerDriveClient(userAccessToken)
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.type.split('/')[1]
    const created = await drive.files.create({
      requestBody: { name: `giao-ban-${weekId}-${section}-${Date.now()}.${ext}`, parents: [folderId] },
      media: { mimeType: file.type, body: Readable.from(buffer) },
      fields: 'id',
    })
    const id = created.data.id!
    // D-04: app Drive files are "anyone with link can view" by design.
    await drive.permissions.create({ fileId: id, requestBody: { role: 'reader', type: 'anyone' } })
    await getAdminFirestore().collection('weeklyReportImages').doc(id).set({
      weekId, section, mimeType: file.type, size: file.size, createdAt: new Date(),
    })
    return NextResponse.json({ imageId: id, url: `/api/weekly-reports/images/${id}` })
  } catch (e) {
    console.error('[weekly-reports/images] upload failed', e)
    return NextResponse.json({ error: 'Tải ảnh lên Drive thất bại' }, { status: 502 })
  }
}
