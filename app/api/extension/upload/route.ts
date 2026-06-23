import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'stream'
import { google } from 'googleapis'
import { getAuth } from 'firebase-admin/auth'
import { initAdmin } from '@/lib/firebase-admin'

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!),
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  return google.drive({ version: 'v3', auth })
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const file = form.get('file') as File
    const firebaseIdToken = form.get('firebaseIdToken') as string
    
    if (!firebaseIdToken) {
      return NextResponse.json({ error: 'TOKEN_EXPIRED', message: 'Vui lòng mở My Office và đăng nhập lại (Chưa có ID token).' }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } })
    }

    try {
      initAdmin()
      await getAuth().verifyIdToken(firebaseIdToken)
    } catch (authErr) {
      return NextResponse.json({ error: 'TOKEN_EXPIRED', message: 'Phiên đăng nhập đã hết hạn. Vui lòng mở lại trang My Office để đăng nhập.' }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } })
    }
    
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })
    
    const buffer = Buffer.from(await file.arrayBuffer())
    
    let drive = getDriveClient()
    const folderId = process.env.DRIVE_FOLDER_ID!
    let id: string
    let mimeType: string

    try {
      const created = await drive.files.create({
        requestBody: { name: file.name, parents: [folderId] },
        media: {
          mimeType: file.type || 'application/octet-stream',
          body: Readable.from(buffer),
        },
        fields: 'id,mimeType',
      })
      id = created.data.id!
      mimeType = created.data.mimeType ?? file.type
      await drive.permissions.create({
        fileId: id,
        requestBody: { role: 'reader', type: 'anyone' },
      })
    } catch (err: any) {
      if (err.message && err.message.includes('Invalid Credentials')) {
        return NextResponse.json({ error: 'TOKEN_EXPIRED', message: 'Phiên đăng nhập đã hết hạn. Vui lòng mở lại trang My Office để đăng nhập.' }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      throw err
    }

    return NextResponse.json({
      driveFileId: id,
      driveViewUrl: `https://drive.google.com/file/d/${id}/preview`,
      mimeType: mimeType,
    }, { headers: { 'Access-Control-Allow-Origin': '*' } })
    
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
    },
  })
}
