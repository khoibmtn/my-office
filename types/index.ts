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
  priority?: string
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
  assigneeId?: string
  priority?: string
  notes?: string
  tags?: string[]
  deadline?: Timestamp
  attachmentInputs: AttachmentInput[]
}
