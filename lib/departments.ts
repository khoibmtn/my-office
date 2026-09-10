import {
  collection, doc, getDocs, getDoc, onSnapshot, query,
  orderBy, serverTimestamp, writeBatch, updateDoc, where, arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Department } from '@/types/departments'
import type { StaffMember } from '@/types/index'

const COLLECTION = 'departments'

export async function getDepartments(): Promise<Department[]> {
  const snap = await getDocs(query(collection(db(), COLLECTION), orderBy('order', 'asc')))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Department))
    .filter(d => d.isActive)
}

export async function getDepartmentById(deptId: string): Promise<Department | null> {
  const snap = await getDoc(doc(db(), COLLECTION, deptId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Department
}

export async function createDepartment(data: {
  name: string
  code: string
  shortName?: string
  type: Department['type']
  parentId?: string | null
  headStaffId?: string | null
  description?: string
  phone?: string
  location?: string
  color?: string
  order?: number
}): Promise<string> {
  const batch = writeBatch(db())
  const ref = doc(collection(db(), COLLECTION))
  batch.set(ref, {
    name: data.name,
    code: data.code,
    shortName: data.shortName || data.code,
    type: data.type,
    parentId: data.parentId ?? null,
    headStaffId: data.headStaffId ?? null,
    deputyStaffIds: [],
    memberCount: 0,
    description: data.description || '',
    phone: data.phone || '',
    location: data.location || '',
    color: data.color || '',
    order: data.order ?? 0,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
  return ref.id
}

export async function updateDepartment(
  deptId: string,
  fields: Partial<Pick<Department, 'name' | 'code' | 'shortName' | 'type' | 'parentId' | 'headStaffId' | 'deputyStaffIds' | 'order' | 'isActive' | 'description' | 'phone' | 'location' | 'color' | 'memberCount'>>
): Promise<void> {
  await updateDoc(doc(db(), COLLECTION, deptId), {
    ...fields,
    updatedAt: serverTimestamp(),
  })
}

export function subscribeDepartments(
  onData: (departments: Department[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(collection(db(), COLLECTION), orderBy('order', 'asc'))
  return onSnapshot(
    q,
    (snap) => {
      const depts = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Department))
        .filter(d => d.isActive)
      onData(depts)
    },
    (err) => {
      console.error('[departments] onSnapshot error:', err)
      onError?.(err)
    }
  )
}

// ============================================================
// Department Member Management
// ============================================================

/**
 * Get staff members belonging to a department.
 * Queries staff collection where departmentIds array-contains deptId.
 */
export async function getDepartmentMembers(deptId: string): Promise<StaffMember[]> {
  const q = query(
    collection(db(), 'staff'),
    where('departmentIds', 'array-contains', deptId)
  )
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ ...d.data(), id: d.data().id || d.id } as StaffMember))
    .filter(s => s.isActive)
}

/**
 * Subscribe to staff members of a department (real-time).
 */
export function subscribeDepartmentMembers(
  deptId: string,
  onData: (members: StaffMember[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(
    collection(db(), 'staff'),
    where('departmentIds', 'array-contains', deptId)
  )
  return onSnapshot(
    q,
    (snap) => {
      const members = snap.docs
        .map(d => ({ ...d.data(), id: d.data().id || d.id } as StaffMember))
        .filter(s => s.isActive)
      onData(members)
    },
    (err) => {
      console.error(`[departments] members onSnapshot error for ${deptId}:`, err)
      onError?.(err)
    }
  )
}

/**
 * Assign a staff member to a department.
 * Updates staff's departmentIds and optionally sets as primary.
 */
export async function assignStaffToDepartment(
  staffDocId: string,
  deptId: string,
  options?: { asPrimary?: boolean }
): Promise<void> {
  const updates: Record<string, any> = {
    departmentIds: arrayUnion(deptId),
    updatedAt: serverTimestamp(),
  }
  if (options?.asPrimary) {
    updates.primaryDepartmentId = deptId
  }
  await updateDoc(doc(db(), 'staff', staffDocId), updates)
}

/**
 * Remove a staff member from a department.
 * Also clears primaryDepartmentId if it was this department.
 */
export async function removeStaffFromDepartment(
  staffDocId: string,
  deptId: string
): Promise<void> {
  const staffRef = doc(db(), 'staff', staffDocId)
  const staffSnap = await getDoc(staffRef)
  if (!staffSnap.exists()) return

  const data = staffSnap.data()
  const updates: Record<string, any> = {
    departmentIds: arrayRemove(deptId),
    updatedAt: serverTimestamp(),
  }
  // Clear primary if it was this department
  if (data.primaryDepartmentId === deptId) {
    const remaining = (data.departmentIds || []).filter((id: string) => id !== deptId)
    updates.primaryDepartmentId = remaining.length > 0 ? remaining[0] : null
  }
  await updateDoc(staffRef, updates)
}

/**
 * Set the head (trưởng khoa/phòng) of a department.
 */
export async function setDepartmentHead(deptId: string, staffId: string | null): Promise<void> {
  await updateDoc(doc(db(), COLLECTION, deptId), {
    headStaffId: staffId,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Add a deputy (phó khoa/phòng) to a department.
 */
export async function addDepartmentDeputy(deptId: string, staffId: string): Promise<void> {
  await updateDoc(doc(db(), COLLECTION, deptId), {
    deputyStaffIds: arrayUnion(staffId),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Remove a deputy from a department.
 */
export async function removeDepartmentDeputy(deptId: string, staffId: string): Promise<void> {
  await updateDoc(doc(db(), COLLECTION, deptId), {
    deputyStaffIds: arrayRemove(staffId),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Soft-delete a department (set isActive = false).
 */
export async function deleteDepartment(deptId: string): Promise<void> {
  await updateDoc(doc(db(), COLLECTION, deptId), {
    isActive: false,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Recalculate and update the memberCount for a department.
 */
export async function updateMemberCount(deptId: string): Promise<number> {
  const members = await getDepartmentMembers(deptId)
  const count = members.length
  await updateDoc(doc(db(), COLLECTION, deptId), {
    memberCount: count,
    updatedAt: serverTimestamp(),
  })
  return count
}

