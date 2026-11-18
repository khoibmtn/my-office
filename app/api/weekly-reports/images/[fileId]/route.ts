import { NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase-admin'
import { getServerDriveClient } from '@/lib/weekly-report/server'

export const runtime = 'nodejs'

/**
 * Serve a registered weekly-report image. No token (img tags), but only ids present in
 * weeklyReportImages are served. Immutable + long CDN cache so each image costs ~1 function call.
 */
export async function GET(_req: Request, { params }: { params: { fileId: string } }) {
  const fileId = params.fileId
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(fileId)) return new NextResponse('Not found', { status: 404 })
  try {
    const reg = await getAdminFirestore().collection('weeklyReportImages').doc(fileId).get()
    if (!reg.exists) return new NextResponse('Not found', { status: 404 })
    const mimeType = String(reg.data()?.mimeType || 'image/jpeg')
    const drive = getServerDriveClient()
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' })
    return new NextResponse(Buffer.from(res.data as ArrayBuffer), {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'X-Robots-Tag': 'noindex',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e) {
    console.error('[weekly-reports/images] read failed', e)
    return new NextResponse('Không đọc được ảnh', { status: 502 })
  }
}
