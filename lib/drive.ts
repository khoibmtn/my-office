// server-only — never import this from client components
import { Readable } from 'stream'
import { google } from 'googleapis'
import { detectLinkType, extractDriveFileId } from './link-detector'

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

export interface DriveResult {
  driveFileId: string
  driveViewUrl: string
  mimeType: string
}

async function setPublicReader(drive: ReturnType<typeof google.drive>, fileId: string) {
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
  })
}

async function uploadUrlToDrive(url: string, folderId: string, userAccessToken?: string): Promise<DriveResult> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch URL thất bại: ${res.status}`)

  const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
  const filename = url.split('/').pop()?.split('?')[0] ?? 'file'
  const buffer = Buffer.from(await res.arrayBuffer())

  // Validate: detect auth-wall responses like "Please login!" from qlvb.hpnet.vn
  const MIN_VALID_FILE_SIZE = 100 // bytes — any real document is larger than this
  if (buffer.length < MIN_VALID_FILE_SIZE) {
    const bodyText = buffer.toString('utf-8').trim()
    throw new Error(
      `Server trả về nội dung không hợp lệ (${buffer.length} bytes): "${bodyText}". ` +
      `Có thể trang gốc yêu cầu đăng nhập. Hãy tải file về máy rồi dùng "Tải file lên trực tiếp".`
    )
  }

  const drive = getDriveClient(userAccessToken)
  const created = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType: contentType, body: Readable.from(buffer) },
    fields: 'id,mimeType',
  })

  const id = created.data.id!
  await setPublicReader(drive, id)
  return {
    driveFileId: id,
    driveViewUrl: `https://drive.google.com/file/d/${id}/preview`,
    mimeType: created.data.mimeType ?? contentType,
  }
}

export async function copyFileToDrive({
  originalLink,
  folderId,
  userAccessToken,
}: {
  originalLink: string
  folderId: string
  userAccessToken?: string
}): Promise<DriveResult> {
  const { type } = detectLinkType(originalLink)

  if (type === 'url') {
    return uploadUrlToDrive(originalLink, folderId, userAccessToken)
  }

  const fileId = extractDriveFileId(originalLink)
  if (!fileId) throw new Error('Không thể extract file ID từ link')

  const drive = getDriveClient(userAccessToken)
  const copied = await drive.files.copy({
    fileId,
    requestBody: { parents: [folderId] },
    fields: 'id,mimeType',
  })

  const id = copied.data.id!
  await setPublicReader(drive, id)

  return {
    driveFileId: id,
    driveViewUrl: `https://drive.google.com/file/d/${id}/preview`,
    mimeType: copied.data.mimeType!,
  }
}

export async function copyAttachmentsToDrive(
  attachments: Array<{ originalLink: string; title: string }>,
  folderId: string,
  userAccessToken?: string
): Promise<DriveResult[]> {
  return Promise.all(
    attachments.map((att) => copyFileToDrive({ originalLink: att.originalLink, folderId, userAccessToken }))
  )
}
