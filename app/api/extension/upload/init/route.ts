import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, corsHeaders, preflight } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  try {
    const { google } = await import('googleapis')

    const body = await request.json()
    const { fileName, mimeType } = body

    // qlvb-watcher: ingestSecret; extension: admin Firebase ID token or staff session token
    const auth = await authenticateRequest(request, { body, allowIngest: true })
    if (!auth.ok) return auth.response

    if (!fileName) return NextResponse.json({ error: 'fileName required' }, { status: 400, headers: corsHeaders(request) })
    
    const folderId = process.env.DRIVE_FOLDER_ID!

    try {
      let client: any
      if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        )
        oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
        client = oauth2Client
      } else {
        const saAuth = new google.auth.GoogleAuth({
          credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
          scopes: ['https://www.googleapis.com/auth/drive'],
        })
        client = await saAuth.getClient()
      }
      
      const res = await client.request({
        url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
        method: 'POST',
        headers: {
          'X-Upload-Content-Type': mimeType || 'application/octet-stream',
        },
        data: {
          name: fileName,
          parents: [folderId]
        }
      })

      const uploadUrl = res.headers.location
      
      return NextResponse.json({ uploadUrl }, { headers: corsHeaders(request) })
    } catch (err: any) {
      if (err.message && err.message.includes('Invalid Credentials')) {
        return NextResponse.json({ error: 'TOKEN_EXPIRED', message: 'Phiên đăng nhập đã hết hạn. Vui lòng mở lại trang My Office để đăng nhập.' }, { status: 401, headers: corsHeaders(request) })
      }
      throw err
    }

  } catch (err: any) {
    console.error('[extension/upload/init] Error:', err)
    return NextResponse.json({ error: 'Không khởi tạo được phiên upload Drive' }, { status: 500, headers: corsHeaders(request) })
  }
}

export async function OPTIONS(request: NextRequest) {
  return preflight(request)
}
