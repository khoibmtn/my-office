// server-only — never import this from client components
import { google } from 'googleapis'
import { detectLinkType, extractDriveFileId } from './link-detector'

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!),
  scopes: ['https://www.googleapis.com/auth/drive'],
})
const drive = google.drive({ version: 'v3', auth })

export interface DriveResult {
  driveFileId: string
  driveViewUrl: string
  mimeType: string
}

export async function copyFileToDrive({
  originalLink,
  folderId,
}: {
  originalLink: string
  folderId: string
}): Promise<DriveResult> {
  const { type } = detectLinkType(originalLink)
  if (type !== 'drive') throw new Error('Loại link chưa được hỗ trợ trong Phase 1')

  const fileId = extractDriveFileId(originalLink)
  if (!fileId) throw new Error('Không thể extract file ID từ link')

  const copied = await drive.files.copy({
    fileId,
    requestBody: { parents: [folderId] },
    fields: 'id,mimeType',
  })

  const id = copied.data.id!
  await drive.permissions.create({
    fileId: id,
    requestBody: { role: 'reader', type: 'anyone' },
  })

  return {
    driveFileId: id,
    driveViewUrl: `https://drive.google.com/file/d/${id}/preview`,
    mimeType: copied.data.mimeType!,
  }
}

export async function copyAttachmentsToDrive(
  attachments: Array<{ originalLink: string; title: string }>,
  folderId: string
): Promise<DriveResult[]> {
  return Promise.all(
    attachments.map((att) => copyFileToDrive({ originalLink: att.originalLink, folderId }))
  )
}
