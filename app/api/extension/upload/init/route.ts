import * as fs from 'fs';
import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getAuth } from 'firebase-admin/auth'
import { initAdmin } from '@/lib/firebase-admin'

export async function POST(request: NextRequest) {
  try {
    const { fileName, mimeType, firebaseIdToken } = await request.json()
    
    if (!firebaseIdToken) {
      return NextResponse.json({ error: 'TOKEN_EXPIRED', message: 'Vui lòng mở My Office và đăng nhập lại (Chưa có ID token).' }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } })
    }

    try {
      initAdmin()
      await getAuth().verifyIdToken(firebaseIdToken)
    } catch (authErr) {
      return NextResponse.json({ error: 'TOKEN_EXPIRED', message: 'Phiên đăng nhập đã hết hạn. Vui lòng mở lại trang My Office để đăng nhập.' }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } })
    }
    
    if (!fileName) return NextResponse.json({ error: 'fileName required' }, { status: 400 })
    
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
        const auth = new google.auth.GoogleAuth({
          credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!),
          scopes: ['https://www.googleapis.com/auth/drive'],
        })
        client = await auth.getClient()
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
      
      return NextResponse.json({ uploadUrl }, { headers: { 'Access-Control-Allow-Origin': '*' } })
    } catch (err: any) {
      if (err.message && err.message.includes('Invalid Credentials')) {
        return NextResponse.json({ error: 'TOKEN_EXPIRED', message: 'Phiên đăng nhập đã hết hạn. Vui lòng mở lại trang My Office để đăng nhập.' }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      throw err
    }

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
