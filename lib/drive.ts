// server-only — never import this from client components
import { Readable } from 'stream'
import { google } from 'googleapis'
import { detectLinkType, extractDriveFileId } from './link-detector'
import { safeFetchBuffer } from './server/safe-fetch'
import { PublicError } from './server/public-error'

function getDriveClient(userAccessToken?: string) {
  if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
    return google.drive({ version: 'v3', auth: oauth2Client })
  }
  if (userAccessToken) {
    const oauth2 = new google.auth.OAuth2()
    oauth2.setCredentials({ access_token: userAccessToken })
    return google.drive({ version: 'v3', auth: oauth2 })
  }
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
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
  // SSRF guard: public hosts only, size/time limits, redirects re-validated
  const { buffer, contentType } = await safeFetchBuffer(url)
  const filename = url.split('/').pop()?.split('?')[0] || 'file'

  // Validate: detect auth-wall responses like "Please login!" from qlvb.hpnet.vn
  const MIN_VALID_FILE_SIZE = 100 // bytes — any real document is larger than this
  if (buffer.length < MIN_VALID_FILE_SIZE) {
    const bodyText = buffer.toString('utf-8').trim()
    throw new PublicError(
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
  requirePublicSource = false,
}: {
  originalLink: string
  folderId: string
  userAccessToken?: string
  /**
   * Non-admin callers: only copy Drive files already shared as "anyone with the link",
   * otherwise the server's admin credentials could be used to publish the admin's private files.
   */
  requirePublicSource?: boolean
}): Promise<DriveResult> {
  const { type } = detectLinkType(originalLink)

  if (type === 'url') {
    return uploadUrlToDrive(originalLink, folderId, userAccessToken)
  }

  const fileId = extractDriveFileId(originalLink)
  if (!fileId) throw new PublicError('Không thể extract file ID từ link')

  const drive = getDriveClient(userAccessToken)
  if (requirePublicSource) {
    const shareHint =
      'Link Drive cần được chia sẻ ở chế độ "Bất kỳ ai có đường liên kết", hoặc hãy tải file lên trực tiếp.'
    let isPublic = false
    try {
      const meta = await drive.files.get({ fileId, fields: 'permissions(type)', supportsAllDrives: true })
      isPublic = (meta.data.permissions ?? []).some((p) => p.type === 'anyone')
    } catch {
      isPublic = false
    }
    if (!isPublic) throw new PublicError(shareHint)
  }
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
  userAccessToken?: string,
  requirePublicSource = false
): Promise<DriveResult[]> {
  return Promise.all(
    attachments.map((att) =>
      copyFileToDrive({ originalLink: att.originalLink, folderId, userAccessToken, requirePublicSource })
    )
  )
}
