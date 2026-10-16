import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

/**
 * GET /api/drive/token
 * Returns a refreshed Google Drive access token using the server's refresh token.
 * This allows automatic, silent renewal without requiring user clicks or popups.
 */
export async function GET(request: NextRequest) {
  try {
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!refreshToken || !clientId || !clientSecret) {
      return NextResponse.json(
        { success: false, error: 'NO_SERVER_REFRESH_TOKEN', message: 'Chưa cấu hình Google Refresh Token trên server' },
        { status: 400, headers: corsHeaders() }
      )
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
    oauth2Client.setCredentials({ refresh_token: refreshToken })

    const res = await oauth2Client.getAccessToken()
    const token = res.token

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'EMPTY_TOKEN', message: 'Không nhận được token từ Google' },
        { status: 500, headers: corsHeaders() }
      )
    }

    const response = NextResponse.json(
      {
        success: true,
        token,
        expiresIn: 3600,
        email: 'khoibm.tn@gmail.com',
      },
      { headers: corsHeaders() }
    )

    // Set cookie for extension & middleware
    response.cookies.set('google_access_token', token, {
      path: '/',
      maxAge: 3600,
      sameSite: 'lax',
    })

    return response
  } catch (err: any) {
    console.error('[/api/drive/token] Error refreshing token:', err?.message || err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi cấp lại token' },
      { status: 500, headers: corsHeaders() }
    )
  }
}
