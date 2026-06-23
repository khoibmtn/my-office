import * as fs from 'fs';
import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'stream'
import { google } from 'googleapis'
import { initAdmin, getAdminFirestore, verifyIdTokenREST } from '@/lib/firebase-admin'
import { syncToAlgolia } from '@/lib/algolia-server'
import { FieldValue } from 'firebase-admin/firestore'

function getDriveClient() {
  if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
    return google.drive({ version: 'v3', auth: oauth2Client })
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
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
      supportsAllDrives: true,
    })
    id = created.data.id!
    mimeType = created.data.mimeType ?? file.type
    await drive.permissions.create({
      fileId: id,
      requestBody: { role: 'reader', type: 'anyone' },
    })
  } catch (err: any) {
    if (err.message && err.message.includes('Invalid Credentials')) {
      throw new Error('TOKEN_EXPIRED')
    }
    throw err
  }

  return {
    driveFileId: id,
    driveViewUrl: `https://drive.google.com/file/d/${id}/preview`,
    mimeType: mimeType,
  }
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  const match = dateStr.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (!match) return null
  const [, dd, mm, yyyy, h, m, s] = match
  const date = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd))
  if (h && m) {
    date.setHours(parseInt(h), parseInt(m), s ? parseInt(s) : 0)
  }
  return date
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
    let data: Record<string, any> = {}
    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('application/json')) {
      data = await request.json()
    } else {
      const form = await request.formData()
      form.forEach((value, key) => {
        data[key] = value
      })
      data.mainFile = form.get('mainFile') as File | null
      const attachmentFiles: File[] = []
      for (let i = 0; i < 20; i++) {
        const att = form.get(`attachment_${i}`) as File | null
        if (att) attachmentFiles.push(att)
        else break
      }
      if (attachmentFiles.length > 0) {
        data.attachmentFiles = attachmentFiles
      }
    }

    // Extract metadata
    const title = data.title ?? ''
    const docNumber = data.docNumber ?? ''
    const issueDate = data.issueDate ?? ''
    const deadline = data.deadline ?? ''
    const assignee = data.assignee ?? ''
    const sender = data.sender ?? ''
    const leader = data.leader ?? ''
    const originalLink = data.originalLink ?? ''
    const priority = data.priority ?? 'normal'
    const notes = data.notes ?? ''
    const tags = data.tags ?? ''
    const firebaseIdToken = data.firebaseIdToken ?? ''

    if (!firebaseIdToken) {
      return NextResponse.json(
        { error: 'TOKEN_EXPIRED', message: 'Vui lòng mở My Office và đăng nhập lại (Chưa có ID token).' },
        { status: 401, headers: corsHeaders() }
      )
    }

    try {
      await verifyIdTokenREST(firebaseIdToken)
    } catch (authErr) {
      return NextResponse.json(
        { error: 'TOKEN_EXPIRED', message: 'Phiên đăng nhập đã hết hạn. Vui lòng mở lại trang My Office để đăng nhập.' },
        { status: 401, headers: corsHeaders() }
      )
    }

    // Check for pre-uploaded files (from the new background upload approach)
    const mainFileId = data.mainFileId ?? null
    const mainFileUrl = data.mainFileUrl ?? null
    const mainMimeType = data.mainMimeType ?? null
    const attachmentsJson = data.attachmentsJson ?? null

    // Extract files (legacy approach)
    const mainFile = data.mainFile ?? null
    if (!mainFile && !mainFileId) {
      return NextResponse.json(
        { error: 'mainFile or mainFileId is required' },
        { status: 400, headers: corsHeaders() }
      )
    }

    const attachmentFiles: File[] = data.attachmentFiles ?? []

    const folderId = process.env.DRIVE_FOLDER_ID!
    const drive = getDriveClient()

    // Upload main file to Drive (if not pre-uploaded)
    let mainResult
    if (mainFileId && mainFileUrl && mainMimeType) {
      mainResult = { driveFileId: mainFileId, driveViewUrl: mainFileUrl, mimeType: mainMimeType }
      // Grant read permission for files uploaded via resumable session
      try {
        await drive.permissions.create({
          fileId: mainFileId,
          requestBody: { role: 'reader', type: 'anyone' },
          supportsAllDrives: true,
        })
      } catch(e) {}
    } else {
      mainResult = await uploadFileToDrive(drive, mainFile!, folderId)
    }

    // Upload attachments (if not pre-uploaded)
    let attachmentResults
    if (attachmentsJson) {
      attachmentResults = JSON.parse(attachmentsJson)
      // Grant read permission for pre-uploaded attachments
      for (const att of attachmentResults) {
        if (att.driveFileId) {
          try {
            await drive.permissions.create({
              fileId: att.driveFileId,
              requestBody: { role: 'reader', type: 'anyone' },
              supportsAllDrives: true,
            })
          } catch(e) {}
        }
      }
    } else {
      attachmentResults = await Promise.all(
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
    }

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
      assignee: assignee === 'Bùi Minh Khôi' ? '' : assignee,
      notes,
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
        attachments: attachmentResults.map((a: any) => ({
          driveFileId: a.driveFileId,
          driveViewUrl: a.driveViewUrl,
        })),
        appUrl: `/documents/${docId}`,
      },
      { headers: corsHeaders() }
    )
  } catch (e: unknown) {
    console.error('[extension/submit] Error:', e)
    if (e instanceof Error && e.message === 'TOKEN_EXPIRED') {
      return NextResponse.json(
        { error: 'TOKEN_EXPIRED', message: 'Phiên đăng nhập đã hết hạn. Vui lòng mở lại trang My Office để đăng nhập.' },
        { status: 401, headers: corsHeaders() }
      )
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500, headers: corsHeaders() }
    )
  }
}
