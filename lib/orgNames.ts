import {
  collection, doc, getDocs, onSnapshot, writeBatch, serverTimestamp, query, orderBy
} from 'firebase/firestore'
import { db } from './firebase'

export interface OrgName {
  id: string
  name: string
  order: number
  createdAt?: any
}

/**
 * Subscribe to organization names (real-time).
 * Stored in Firestore: settings/orgNames/items/{id}
 */
export function subscribeOrgNames(
  onData: (names: OrgName[]) => void,
  onError?: (err: Error) => void
) {
  const col = collection(db(), 'settings', 'orgNames', 'items')
  const q = query(col, orderBy('order', 'asc'))
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as OrgName[]
    onData(items)
  }, (err) => onError?.(err as Error))
}

/** Get all org names once */
export async function getOrgNames(): Promise<OrgName[]> {
  const col = collection(db(), 'settings', 'orgNames', 'items')
  const q = query(col, orderBy('order', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as OrgName[]
}

/** Add a new org name */
export async function addOrgName(name: string, order: number): Promise<string> {
  const ref = doc(collection(db(), 'settings', 'orgNames', 'items'))
  const batch = writeBatch(db())
  batch.set(ref, {
    name: name.trim(),
    order,
    createdAt: serverTimestamp(),
  })
  await batch.commit()
  return ref.id
}

/** Update an org name */
export async function updateOrgName(id: string, name: string): Promise<void> {
  const ref = doc(db(), 'settings', 'orgNames', 'items', id)
  const batch = writeBatch(db())
  batch.update(ref, { name: name.trim() })
  await batch.commit()
}

/** Delete an org name */
export async function deleteOrgName(id: string): Promise<void> {
  const ref = doc(db(), 'settings', 'orgNames', 'items', id)
  const batch = writeBatch(db())
  batch.delete(ref)
  await batch.commit()
}

/** Reorder org names (batch update all orders) */
export async function reorderOrgNames(items: { id: string; order: number }[]): Promise<void> {
  const batch = writeBatch(db())
  for (const item of items) {
    const ref = doc(db(), 'settings', 'orgNames', 'items', item.id)
    batch.update(ref, { order: item.order })
  }
  await batch.commit()
}
