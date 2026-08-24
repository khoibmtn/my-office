import { Timestamp } from 'firebase/firestore'

export type DocumentStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'uploading'
  | 'upload_failed'

export type DriveUploadStatus = 'uploading' | 'upload_failed' | 'pending'

export type UserRole = 'admin' | 'staff' | 'guest'

export interface StaffMember {
  id: string              // auto-generated (nanoid 8 chars)
  fullName: string        // "Nguyễn Văn Giang"
  shortName: string       // "Giang" (hiển thị trên bảng)
  nickname: string        // "giang" (đăng nhập, unique, lowercase)
  passwordHash: string    // SHA-256 hash
  title: string           // Chức danh: "Chuyên viên"
  position: string        // Chức vụ: "Phó trưởng phòng"
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface RolePermissions {
  canViewAll: boolean
  canAddDocument: boolean
  canEditDocument: boolean
  canDeleteDocument: boolean
  canAssignStaff: boolean
  canSetDeadline: boolean
  canSetCompletedDate: boolean
  canEditNotes: boolean
  canToggleComplete: boolean       // Bấm hoàn thành tất cả
  canCompleteAssigned: boolean     // Bấm hoàn thành chỉ việc được giao
  canCopyTaskString: boolean
  canAccessSettings: boolean
  canCreateDossier?: boolean
  canEditDossier?: boolean
  canDeleteDossier?: boolean
  canTransferDossier?: boolean
}

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
  leader?: string
  originalLink: string
  driveFileId: string
  driveViewUrl: string
  mimeType: string
  attachments: Attachment[]
  status: DocumentStatus
  deadline?: Timestamp
  completedDate?: Timestamp
  task?: string
  assignee?: string          // Legacy: staff name (kept for backward compat)
  assigneeId?: string        // New: staff ID
  coAssigneeIds?: string[]   // Người phối hợp (mảng staffId)
  coAssignees?: string[]     // Legacy/Short names người phối hợp
  dossierIds?: string[]      // Danh sách ID các hồ sơ chứa văn bản này
  priority?: string
  notes?: string
  tags?: string[]            // Legacy tag names
  tagIds?: string[]          // Mảng ID các nhãn/tag (Tham chiếu /tags)
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
  assigneeId?: string
  coAssigneeIds?: string[]
  dossierIds?: string[]
  priority?: string
  notes?: string
  tags?: string[]
  tagIds?: string[]
  deadline?: Timestamp
  attachmentInputs: AttachmentInput[]
}

export interface DossierChecklistItem {
  id: string
  title: string
  completed: boolean
  completedAt?: Timestamp | null
  completedBy?: string | null
  order: number
}

export interface DossierComment {
  id: string
  senderId: string
  senderName: string
  content: string
  createdAt: Timestamp | { seconds: number; nanoseconds?: number }
}

export interface Dossier {
  id: string
  name: string
  parentId: string | null
  level: 1 | 2 | 3
  createdBy: string
  ownerId: string
  description: string
  notes?: string
  checklist: DossierChecklistItem[]
  comments?: DossierComment[]
  sharedWith?: string[]
  tagIds: string[]
  isArchived?: boolean
  color?: string
  order?: number
  deletedAt?: Timestamp
  deletedBy?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Tag {
  id: string
  name: string
  color: string
  createdBy: string
  deletedAt?: Timestamp
  deletedBy?: string
  createdAt: Timestamp
}

export interface AuditLogMetadata {
  fromOwnerId?: string
  toOwnerId?: string
  transferredChildIds?: string[]
  reassignedDocumentIds?: string[]
  field?: string
  operation?: string
  [key: string]: any
}

export interface AuditLog {
  id: string
  entityType: 'dossier' | 'document' | 'tag'
  entityId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'TRANSFER' | 'ASSIGN'
  actorId: string
  metadata: AuditLogMetadata
  createdAt: Timestamp
}

