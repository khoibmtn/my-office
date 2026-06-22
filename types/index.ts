import { Timestamp } from 'firebase/firestore'

export type DocumentStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'uploading'
  | 'upload_failed'

export type DriveUploadStatus = 'uploading' | 'upload_failed' | 'pending'

export interface Attachment {
  id: string
  title: string
  originalLink: string
  driveFileId: string
  driveViewUrl: string
  mimeType: string
  uploadedAt: Timestamp
}

export interface Document {
  id: string
  title: string
  docNumber?: string
  issueDate?: Timestamp
  sender?: string
  originalLink: string
  driveFileId: string
  driveViewUrl: string
  mimeType: string
  attachments: Attachment[]
  status: DocumentStatus
  deadline?: Timestamp
  task?: string
  assignee?: string
  notes?: string
  tags?: string[]
  textSnippet?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface AttachmentInput {
  title: string
  originalLink: string
}

export interface CreateDocumentInput {
  title: string
  docNumber?: string
  originalLink: string
  task?: string
  assignee?: string
  notes?: string
  tags?: string[]
  deadline?: Timestamp
  attachmentInputs: AttachmentInput[]
}
