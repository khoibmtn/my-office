import {
  collection, doc, getDocs, onSnapshot, query,
  orderBy, serverTimestamp, writeBatch, updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Department } from '@/types/departments'

const COLLECTION = 'departments'

export async function getDepartments(): Promise<Department[]> {
  const snap = await getDocs(query(collection(db(), COLLECTION), orderBy('order', 'asc')))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Department))
    .filter(d => d.isActive)
}

export async function createDepartment(data: {
  name: string
  code: string
  type: Department['type']
  parentId?: string | null
  headStaffId?: string | null
  order?: number
}): Promise<string> {
  const batch = writeBatch(db())
  const ref = doc(collection(db(), COLLECTION))
  batch.set(ref, {
    name: data.name,
    code: data.code,
    type: data.type,
    parentId: data.parentId ?? null,
    headStaffId: data.headStaffId ?? null,
    deputyStaffIds: [],
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
  fields: Partial<Pick<Department, 'name' | 'code' | 'type' | 'parentId' | 'headStaffId' | 'deputyStaffIds' | 'order' | 'isActive'>>
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
