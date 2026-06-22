import { NextResponse } from 'next/server'
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

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    const folderId = (form.get('folderId') as string) ?? process.env.DRIVE_FOLDER_ID
    const userAccessToken = form.get('userAccessToken') as string | undefined ?? undefined

    if (!file || !folderId) {
      return NextResponse.json({ error: 'file và folderId là bắt buộc' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const drive = getDriveClient(userAccessToken)

    const created = await drive.files.create({
      requestBody: { name: file.name, parents: [folderId] },
      media: { mimeType: file.type || 'application/octet-stream', body: Readable.from(buffer) },
      fields: 'id,mimeType',
    })

    const id = created.data.id!
    await drive.permissions.create({ fileId: id, requestBody: { role: 'reader', type: 'anyone' } })

    return NextResponse.json({
      driveFileId: id,
      driveViewUrl: `https://drive.google.com/file/d/${id}/preview`,
      mimeType: created.data.mimeType ?? file.type,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
