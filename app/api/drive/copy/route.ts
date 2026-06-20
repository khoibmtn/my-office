import { NextResponse } from 'next/server'
import { copyFileToDrive, copyAttachmentsToDrive } from '@/lib/drive'
import { syncAfterDriveUpdate } from '@/lib/algolia-server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { docId, originalLink, attachments, folderId: bodyFolderId } = body
    const folderId = bodyFolderId ?? process.env.DRIVE_FOLDER_ID

    if (!originalLink || !folderId) {
      return NextResponse.json({ error: 'originalLink và folderId là bắt buộc' }, { status: 400 })
    }

    const [mainFile, attachmentResults] = await Promise.all([
      copyFileToDrive({ originalLink, folderId }),
      attachments?.length ? copyAttachmentsToDrive(attachments, folderId) : Promise.resolve([]),
    ])

    if (docId) {
      void syncAfterDriveUpdate(docId)
    }

    return NextResponse.json({ mainFile, attachments: attachmentResults })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
