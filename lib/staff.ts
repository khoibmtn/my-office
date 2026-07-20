import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import type { StaffMember, RolePermissions } from '../types'

const STAFF_COLLECTION = 'staff'

// ============================================================
// SHA-256 password hashing (simple, for internal app)
// ============================================================

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ============================================================
// Generate short ID (8 chars)
// ============================================================

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

// ============================================================
// Staff CRUD
// ============================================================

export async function getAllStaff(): Promise<StaffMember[]> {
  const q = query(collection(db(), STAFF_COLLECTION), orderBy('shortName', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as StaffMember))
}

export async function getStaffById(staffId: string): Promise<StaffMember | null> {
  const snap = await getDoc(doc(db(), STAFF_COLLECTION, staffId))
  if (!snap.exists()) return null
  return { ...snap.data(), id: snap.id } as StaffMember
}

export async function getStaffByNickname(nickname: string): Promise<StaffMember | null> {
  const q = query(
    collection(db(), STAFF_COLLECTION),
    where('nickname', '==', nickname.toLowerCase().trim())
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { ...d.data(), id: d.id } as StaffMember
}

export async function createStaff(input: {
  fullName: string
  shortName: string
  nickname: string
  password: string
  title?: string
  position?: string
}): Promise<string> {
  // Check nickname uniqueness
  const existing = await getStaffByNickname(input.nickname)
  if (existing) {
    throw new Error(`Nickname "${input.nickname}" đã tồn tại`)
  }

  const id = generateId()
  const passwordHash = await hashPassword(input.password)

  await addDoc(collection(db(), STAFF_COLLECTION), {
    id,
    fullName: input.fullName.trim(),
    shortName: input.shortName.trim(),
    nickname: input.nickname.toLowerCase().trim(),
    passwordHash,
    title: input.title?.trim() || '',
    position: input.position?.trim() || '',
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return id
}

export async function updateStaff(
  docId: string,
  fields: Partial<{
    fullName: string
    shortName: string
    nickname: string
    title: string
    position: string
    isActive: boolean
  }>
): Promise<void> {
  // If nickname is being changed, check uniqueness
  if (fields.nickname) {
    const existing = await getStaffByNickname(fields.nickname)
    if (existing && existing.id !== docId) {
      throw new Error(`Nickname "${fields.nickname}" đã tồn tại`)
    }
    fields.nickname = fields.nickname.toLowerCase().trim()
  }

  await updateDoc(doc(db(), STAFF_COLLECTION, docId), {
    ...fields,
    updatedAt: serverTimestamp(),
  })
}

export async function changeStaffPassword(docId: string, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword)
  await updateDoc(doc(db(), STAFF_COLLECTION, docId), {
    passwordHash,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteStaff(docId: string): Promise<void> {
  await deleteDoc(doc(db(), STAFF_COLLECTION, docId))
}

// ============================================================
// Staff Login Verification (client-side, for internal app)
// ============================================================

export async function verifyStaffLogin(nickname: string, password: string): Promise<StaffMember | null> {
  const staff = await getStaffByNickname(nickname)
  if (!staff || !staff.isActive) return null

  const inputHash = await hashPassword(password)
  if (inputHash !== staff.passwordHash) return null

  return staff
}

// ============================================================
// Permissions
// ============================================================

const DEFAULT_STAFF_PERMISSIONS: RolePermissions = {
  canViewAll: true,
  canAddDocument: false,
  canEditDocument: false,
  canDeleteDocument: false,
  canAssignStaff: false,
  canSetDeadline: false,
  canSetCompletedDate: false,
  canEditNotes: false,
  canToggleComplete: false,
  canCompleteAssigned: true,
  canCopyTaskString: true,
  canAccessSettings: false,
}

const DEFAULT_GUEST_PERMISSIONS: RolePermissions = {
  canViewAll: true,
  canAddDocument: false,
  canEditDocument: false,
  canDeleteDocument: false,
  canAssignStaff: false,
  canSetDeadline: false,
  canSetCompletedDate: false,
  canEditNotes: false,
  canToggleComplete: false,
  canCompleteAssigned: false,
  canCopyTaskString: true,
  canAccessSettings: false,
}

export async function getPermissions(): Promise<{ staff: RolePermissions; guest: RolePermissions }> {
  const snap = await getDoc(doc(db(), 'settings', 'permissions'))
  if (snap.exists()) {
    const data = snap.data()
    return {
      staff: { ...DEFAULT_STAFF_PERMISSIONS, ...data.staff },
      guest: { ...DEFAULT_GUEST_PERMISSIONS, ...data.guest },
    }
  }
  return { staff: DEFAULT_STAFF_PERMISSIONS, guest: DEFAULT_GUEST_PERMISSIONS }
}

export async function savePermissions(perms: { staff: RolePermissions; guest: RolePermissions }): Promise<void> {
  const { setDoc } = await import('firebase/firestore')
  await setDoc(doc(db(), 'settings', 'permissions'), perms)
}

export { DEFAULT_STAFF_PERMISSIONS, DEFAULT_GUEST_PERMISSIONS }
