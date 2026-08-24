import {
  collection, doc, getDocs, query, serverTimestamp, writeBatch
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

  const snap = await getDocs(collection(db(), 'tags'))
  const existing = snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Tag))
    .filter(t => !t.deletedAt)
    .find(t => t.name.trim().toLowerCase() === normalized)

  if (existing) return existing.id

  const tagRef = doc(collection(db(), 'tags'))
  const color = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
  const batch = writeBatch(db())
  batch.set(tagRef, {
    name: name.trim(),
    color,
    createdBy: actorId,
    deletedAt: null,
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
    const snap = await getDocs(collection(db(), 'tags'))
    snap.docs.forEach(d => {
      const data = d.data() as Tag
      if (!data.deletedAt) {
        tagCache.set(d.id, { ...data, id: d.id })
      }
    })
  }
  return tagIds.map(id => tagCache.get(id)).filter(Boolean) as Tag[]
}
