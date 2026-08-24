import {
  collection, doc, getDocs, query, where, serverTimestamp, writeBatch
} from 'firebase/firestore'
import { db } from './firebase'
import { appendAuditLogToBatch } from './audit'
import type { Tag } from '@/types'

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4',
  '#3B82F6', '#8B5CF6', '#EC4899', '#64748B', '#14B8A6'
]

const tagCache = new Map<string, Tag>()

export async function createTag(name: string, actorId: string): Promise<string> {
  const normalized = name.trim().toLowerCase()
  if (!normalized) throw new Error('Tên nhãn không được để trống')

  const q = query(collection(db(), 'tags'), where('deletedAt', '==', null))
  const snap = await getDocs(q)
  const existing = snap.docs.find(d => (d.data() as Tag).name.trim().toLowerCase() === normalized)
  if (existing) return existing.id

  const tagRef = doc(collection(db(), 'tags'))
  const color = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
  const batch = writeBatch(db())
  batch.set(tagRef, {
    name: name.trim(),
    color,
    createdBy: actorId,
    createdAt: serverTimestamp(),
  })
  appendAuditLogToBatch(batch, 'tag', tagRef.id, 'CREATE', actorId, { name: name.trim() })
  await batch.commit()
  return tagRef.id
}

export async function deleteTag(tagId: string, actorId: string): Promise<void> {
  const batch = writeBatch(db())
  batch.update(doc(db(), 'tags', tagId), {
    deletedAt: serverTimestamp(),
    deletedBy: actorId,
  })
  appendAuditLogToBatch(batch, 'tag', tagId, 'DELETE', actorId, {})
  await batch.commit()
  tagCache.delete(tagId)
}

export async function resolveTagIds(tagIds: string[]): Promise<Tag[]> {
  if (!tagIds || tagIds.length === 0) return []
  const missing = tagIds.filter(id => !tagCache.has(id))
  if (missing.length > 0) {
    const q = query(collection(db(), 'tags'), where('deletedAt', '==', null))
    const snap = await getDocs(q)
    snap.docs.forEach(d => tagCache.set(d.id, { id: d.id, ...d.data() } as Tag))
  }
  return tagIds.map(id => tagCache.get(id)).filter(Boolean) as Tag[]
}
