import { NextResponse } from 'next/server'
import { copyFileToDrive, copyAttachmentsToDrive } from '@/lib/drive'
import { syncAfterDriveUpdate } from '@/lib/algolia-server'
import { authenticateRequest } from '@/lib/api-auth'
import { publicMessage } from '@/lib/server/public-error'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const auth = await authenticateRequest(request, { body })
    if (!auth.ok) return auth.response
    const isAdmin = auth.caller.kind === 'admin'
    const { docId, originalLink, attachments } = body
    // Only the admin may target another folder or use a browser token; staff always go to the app folder
    const folderId = (isAdmin ? body.folderId : undefined) ?? process.env.DRIVE_FOLDER_ID
    const userAccessToken = isAdmin ? body.userAccessToken : undefined
    const requirePublicSource = !isAdmin

    if (!originalLink || !folderId) {
      return NextResponse.json({ error: 'originalLink và folderId là bắt buộc' }, { status: 400 })
    }

    const [mainFile, attachmentResults] = await Promise.all([
      copyFileToDrive({ originalLink, folderId, userAccessToken, requirePublicSource }),
      attachments?.length
        ? copyAttachmentsToDrive(attachments, folderId, userAccessToken, requirePublicSource)
        : Promise.resolve([]),
    ])

    if (docId) {
      void syncAfterDriveUpdate(docId)
    }

    return NextResponse.json({ mainFile, attachments: attachmentResults })
  } catch (e: unknown) {
    console.error('[/api/drive/copy] Error:', e)
    return NextResponse.json({ error: publicMessage(e, 'Không sao chép được file vào Google Drive') }, { status: 500 })
  }
}
