import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { authenticateRequest } from '@/lib/api-auth'

const noStore = { 'Cache-Control': 'no-store' }

/**
 * GET /api/drive/token
 * Returns a refreshed Google Drive access token using the server's refresh token.
 * This allows automatic, silent renewal without requiring user clicks or popups.
 * Requires the admin's Firebase ID token (Authorization: Bearer).
 */
export async function GET(request: NextRequest) {
  // Returns an access token for the admin's Drive — admin Google account only
  const auth = await authenticateRequest(request, { adminOnly: true })
  if (!auth.ok) return auth.response
  try {
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!refreshToken || !clientId || !clientSecret) {
      return NextResponse.json(
        { success: false, error: 'NO_SERVER_REFRESH_TOKEN', message: 'Chưa cấu hình Google Refresh Token trên server' },
        { status: 400, headers: noStore }
      )
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
    oauth2Client.setCredentials({ refresh_token: refreshToken })

    const res = await oauth2Client.getAccessToken()
    const token = res.token

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'EMPTY_TOKEN', message: 'Không nhận được token từ Google' },
        { status: 500, headers: noStore }
      )
    }

    const response = NextResponse.json(
      {
        success: true,
        token,
        expiresIn: 3600,
        email: 'khoibm.tn@gmail.com',
      },
      { headers: noStore }
    )

    return response
  } catch (err: any) {
    console.error('[/api/drive/token] Error refreshing token:', err?.message || err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi cấp lại token' },
      { status: 500, headers: noStore }
    )
  }
}
