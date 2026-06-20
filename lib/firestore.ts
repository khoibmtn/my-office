import {
  addDoc,
  collection,
  doc,
  updateDoc,
  getDoc,
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
  try {
    const body = { originalLink, attachments, folderId }

    const result = await retryWithBackoff(() =>
      fetch('/api/drive/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (res) => {
        if (!res.ok) throw new Error(`Drive copy failed: ${res.status}`)
        return res.json()
      })
    )

    await updateDocumentDriveInfo(docId, result.mainFile, result.attachments ?? [])
  } catch {
    await updateDocumentStatus(docId, 'upload_failed')
  }
}
