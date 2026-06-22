import {
  addDoc,
  collection,
  doc,
  deleteDoc as firestoreDeleteDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Document, CreateDocumentInput, DocumentStatus } from '../types'

const COLLECTION = 'documents'

export async function createDocument(input: CreateDocumentInput): Promise<string> {
  const ref = await addDoc(collection(db(), COLLECTION), {
    title: input.title,
    originalLink: input.originalLink,
    task: input.task ?? '',
    assignee: input.assignee ?? '',
    notes: input.notes ?? '',
    tags: input.tags ?? [],
    deadline: input.deadline ?? null,
    priority: input.priority ?? 'normal',
    attachments: [],
    status: 'uploading' as DocumentStatus,
    driveFileId: '',
    driveViewUrl: '',
    mimeType: '',
    textSnippet: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateDocumentDriveInfo(
  docId: string,
  main: { driveFileId: string; driveViewUrl: string; mimeType: string },
  attachmentResults: Array<{ id: string; driveFileId: string; driveViewUrl: string; mimeType: string }>
): Promise<void> {
  await updateDoc(doc(db(), COLLECTION, docId), {
    driveFileId: main.driveFileId,
    driveViewUrl: main.driveViewUrl,
    mimeType: main.mimeType,
    attachments: attachmentResults,
    status: 'pending' as DocumentStatus,
    updatedAt: serverTimestamp(),
  })
}

export async function updateDocument(
  docId: string,
  fields: Partial<{ title: string; originalLink: string; notes: string; status: DocumentStatus; assignee: string; priority: string; tags: string[]; deadline: unknown; completedDate: unknown; issueDate: unknown; sender: string; leader: string; driveViewUrl: string; mimeType: string }>
): Promise<void> {
  // Firestore rejects undefined — replace with empty string for optional string fields
  const safe = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, v === undefined ? '' : v])
  )
  await updateDoc(doc(db(), COLLECTION, docId), { ...safe, updatedAt: serverTimestamp() })
}

export async function updateDocumentStatus(
  docId: string,
  status: DocumentStatus
): Promise<void> {
  await updateDoc(doc(db(), COLLECTION, docId), {
    status,
    updatedAt: serverTimestamp(),
  })
}

export async function getDocument(docId: string): Promise<Document | null> {
  const snap = await getDoc(doc(db(), COLLECTION, docId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Document
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  delays = [1000, 2000, 4000]
): Promise<T> {
  let lastError: unknown
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < delays.length) {
        await new Promise((res) => setTimeout(res, delays[i]))
      }
    }
  }
  throw lastError
}

export async function submitDocumentWithDriveCopy(
  docId: string,
  originalLink: string,
  attachments: Array<{ title: string; originalLink: string }>,
  folderId?: string
): Promise<void> {
  const userAccessToken = typeof window !== 'undefined' ? localStorage.getItem('google_access_token') : null
  try {
    // All URLs (Drive + external) go through server-side /api/drive/copy
    // This avoids CORS issues — server-side fetch is not subject to browser CORS
    const body = { docId, originalLink, attachments, folderId, userAccessToken }
    const result = await retryWithBackoff(() =>
      fetch('/api/drive/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      })
    )

    const mainFile = result.mainFile
    const attachmentResults: Array<{ driveFileId: string; driveViewUrl: string; mimeType: string }> = result.attachments ?? []

    await updateDocumentDriveInfo(docId, mainFile, attachmentResults.map((r, i) => ({
      id: attachments[i]?.title ?? String(i),
      ...r,
    })))
  } catch (err) {
    console.error('[Drive upload failed]', err)
    await updateDocumentStatus(docId, 'upload_failed')
    throw err
  }
}

export async function deleteDocument(docId: string, deleteDriveFiles = false): Promise<void> {
  if (deleteDriveFiles) {
    try {
      const snap = await getDoc(doc(db(), COLLECTION, docId))
      if (snap.exists()) {
        const data = snap.data()
        const token = localStorage.getItem('google_access_token')
        if (token) {
          const fileIds = [data.driveFileId, ...(data.attachments || []).map((a: { driveFileId: string }) => a.driveFileId)].filter(Boolean)
          await Promise.allSettled(
            fileIds.map(fid =>
              fetch(`https://www.googleapis.com/drive/v3/files/${fid}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              })
            )
          )
        }
      }
    } catch (err) {
      console.warn('Drive file deletion failed:', err)
    }
  }
  await firestoreDeleteDoc(doc(db(), COLLECTION, docId))
}
