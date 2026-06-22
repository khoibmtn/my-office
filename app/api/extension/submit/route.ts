import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'stream'
import { google } from 'googleapis'
import { initAdmin, getAdminFirestore } from '@/lib/firebase-admin'
import { syncToAlgolia } from '@/lib/algolia-server'
import { FieldValue } from 'firebase-admin/firestore'

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

async function uploadFileToDrive(
  drive: ReturnType<typeof google.drive>,
  file: File,
  folderId: string
) {
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

  return {
    driveFileId: id,
    driveViewUrl: `https://drive.google.com/file/d/${id}/preview`,
    mimeType: created.data.mimeType ?? file.type,
  }
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  const match = dateStr.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd))
}

// CORS headers for Chrome Extension
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()

    // Extract metadata
    const title = (form.get('title') as string) ?? ''
    const docNumber = (form.get('docNumber') as string) ?? ''
    const issueDate = (form.get('issueDate') as string) ?? ''
    const deadline = (form.get('deadline') as string) ?? ''
    const assignee = (form.get('assignee') as string) ?? ''
    const sender = (form.get('sender') as string) ?? ''
    const leader = (form.get('leader') as string) ?? ''
    const originalLink = (form.get('originalLink') as string) ?? ''
    const priority = (form.get('priority') as string) ?? 'normal'
    const notes = (form.get('notes') as string) ?? ''
    const tags = (form.get('tags') as string) ?? ''
    const userAccessToken = (form.get('userAccessToken') as string) ?? undefined

    // Extract files
    const mainFile = form.get('mainFile') as File | null
    if (!mainFile) {
      return NextResponse.json(
        { error: 'mainFile is required' },
        { status: 400, headers: corsHeaders() }
      )
    }

    const attachmentFiles: File[] = []
    for (let i = 0; i < 20; i++) {
      const att = form.get(`attachment_${i}`) as File | null
      if (att) attachmentFiles.push(att)
      else break
    }

    const folderId = process.env.DRIVE_FOLDER_ID!
    const drive = getDriveClient(userAccessToken)

    // Upload main file to Drive
    const mainResult = await uploadFileToDrive(drive, mainFile, folderId)

    // Upload attachments
    const attachmentResults = await Promise.all(
      attachmentFiles.map(async (file, i) => {
        const result = await uploadFileToDrive(drive, file, folderId)
        return {
          id: file.name,
          title: file.name,
          originalLink: '',
          ...result,
          uploadedAt: new Date(),
        }
      })
    )

    // Create Firestore document
    initAdmin()
    const db = getAdminFirestore()
    const deadlineDate = parseDate(deadline)
    const issueDateParsed = parseDate(issueDate)

    const docData = {
      title,
      docNumber,
      issueDate: issueDateParsed ? issueDateParsed : null,
      sender: sender || '',
      originalLink,
      driveFileId: mainResult.driveFileId,
      driveViewUrl: mainResult.driveViewUrl,
      mimeType: mainResult.mimeType,
      attachments: attachmentResults,
      status: 'pending',
      priority,
      deadline: deadlineDate ? deadlineDate : null,
      task: '',
      assignee,
      notes: [
        sender ? `CQBH: ${sender}` : '',
        leader ? `Lãnh đạo: ${leader}` : '',
        notes && !notes.includes(sender || '___') ? notes : '',
      ].filter(Boolean).join('\n'),
      tags: tags ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      textSnippet: title.slice(0, 500),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    const docRef = await db.collection('documents').add(docData)
    const docId = docRef.id

    // Sync to Algolia
    void syncToAlgolia(docId, {
      title,
      notes: docData.notes,
      textSnippet: docData.textSnippet,
      status: 'pending',
      assignee,
      deadline: deadlineDate ? deadlineDate.getTime() : null,
      tags: docData.tags,
      attachmentCount: attachmentResults.length,
    })

    return NextResponse.json(
      {
        docId,
        driveFileId: mainResult.driveFileId,
        driveViewUrl: mainResult.driveViewUrl,
        attachments: attachmentResults.map((a) => ({
          driveFileId: a.driveFileId,
          driveViewUrl: a.driveViewUrl,
        })),
        appUrl: `/documents/${docId}`,
      },
      { headers: corsHeaders() }
    )
  } catch (e: unknown) {
    console.error('[extension/submit] Error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500, headers: corsHeaders() }
    )
  }
}
