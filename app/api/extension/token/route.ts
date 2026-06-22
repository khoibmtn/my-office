import { NextRequest, NextResponse } from 'next/server'

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
 * GET /api/extension/token
 * Returns the user's Google access token from cookie.
 * Extension calls this to get the token for Drive uploads.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get('google_access_token')?.value

  if (!token) {
    return NextResponse.json(
      { error: 'No token found. Please login to My Office first.' },
      { status: 401, headers: corsHeaders() }
    )
  }

  return NextResponse.json(
    { token },
    { headers: corsHeaders() }
  )
}
