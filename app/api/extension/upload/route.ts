import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'stream'
import { google } from 'googleapis'

function getDriveClient(userAccessToken?: string) {
  if (userAccessToken) {
    const oauth2 = new google.auth.OAuth2()
    oauth2.setCredentials({ access_token: userAccessToken })
    return google.drive({ version: 'v3', auth: oauth2 })
  }
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
    const userAccessToken = form.get('userAccessToken') as string
    
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })
    
    const drive = getDriveClient(userAccessToken || undefined)
    const folderId = process.env.DRIVE_FOLDER_ID!
    
    const buffer = Buffer.from(await file.arrayBuffer())
    const created = await drive.files.create({
      requestBody: { name: file.name, parents: [folderId] },
      media: {
        mimeType: file.type || 'application/octet-stream',
        body: Readable.from(buffer),
      },
      fields: 'id,mimeType',
    })

    const id = created.data.id!
    await drive.permissions.create({
      fileId: id,
      requestBody: { role: 'reader', type: 'anyone' },
    })

    return NextResponse.json({
      driveFileId: id,
      driveViewUrl: `https://drive.google.com/file/d/${id}/preview`,
      mimeType: created.data.mimeType ?? file.type,
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
