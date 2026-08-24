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

export async function updateOrMergeTag(
  targetTagId: string,
  newName: string,
  newColor: string | undefined,
  actorId: string
): Promise<{ merged: boolean; finalTagId: string; mergedIntoName?: string }> {
  const trimmed = newName.trim()
  if (!trimmed) throw new Error('Tên nhãn không được để trống')

  const snap = await getDocs(collection(db(), 'tags'))
  const allTags = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tag)).filter(t => !t.deletedAt)

  const currentTag = allTags.find(t => t.id === targetTagId)
  if (!currentTag) throw new Error('Không tìm thấy nhãn')

  const normalizedNewName = trimmed.toLowerCase()
  const existingDuplicate = allTags.find(
    t => t.id !== targetTagId && t.name.trim().toLowerCase() === normalizedNewName
  )

  const batch = writeBatch(db())

  if (existingDuplicate) {
    // MERGE logic: Target tag is merged into existingDuplicate!
    batch.update(doc(db(), 'tags', targetTagId), {
      deletedAt: serverTimestamp(),
      deletedBy: actorId,
      mergedInto: existingDuplicate.id,
    })

    // Query all documents referencing targetTagId or targetTag.name
    const docsSnap = await getDocs(collection(db(), 'documents'))
    docsSnap.docs.forEach(docSnap => {
      const data = docSnap.data()
      const tagIds: string[] = data.tagIds || []
      const tags: string[] = data.tags || []
      
      const hasTagId = tagIds.includes(targetTagId)
      const hasTagName = tags.some(t => t.toLowerCase() === currentTag.name.toLowerCase())

      if (hasTagId || hasTagName) {
        let updatedTagIds = tagIds.filter(id => id !== targetTagId)
        if (!updatedTagIds.includes(existingDuplicate.id)) {
          updatedTagIds.push(existingDuplicate.id)
        }

        let updatedTags = tags.filter(t => t.toLowerCase() !== currentTag.name.toLowerCase())
        if (!updatedTags.some(t => t.toLowerCase() === existingDuplicate.name.toLowerCase())) {
          updatedTags.push(existingDuplicate.name)
        }

        batch.update(doc(db(), 'documents', docSnap.id), {
          tagIds: updatedTagIds,
          tags: updatedTags,
        })
      }
    })

    appendAuditLogToBatch(batch, 'tag', targetTagId, 'MERGE', actorId, {
      mergedInto: existingDuplicate.id,
      oldName: currentTag.name,
      newName: existingDuplicate.name,
    })

    await batch.commit()
    tagCache.delete(targetTagId)
    return { merged: true, finalTagId: existingDuplicate.id, mergedIntoName: existingDuplicate.name }
  } else {
    // RENAME / UPDATE COLOR logic
    const oldName = currentTag.name
    batch.update(doc(db(), 'tags', targetTagId), {
      name: trimmed,
      color: newColor || currentTag.color,
      updatedAt: serverTimestamp(),
      updatedBy: actorId,
    })

    // Update string tag references in documents if name changed
    if (oldName.toLowerCase() !== trimmed.toLowerCase()) {
      const docsSnap = await getDocs(collection(db(), 'documents'))
      docsSnap.docs.forEach(docSnap => {
        const data = docSnap.data()
        const tags: string[] = data.tags || []
        if (tags.some(t => t.toLowerCase() === oldName.toLowerCase())) {
          const updatedTags = tags.map(t =>
            t.toLowerCase() === oldName.toLowerCase() ? trimmed : t
          )
          batch.update(doc(db(), 'documents', docSnap.id), {
            tags: updatedTags,
          })
        }
      })
    }

    appendAuditLogToBatch(batch, 'tag', targetTagId, 'UPDATE', actorId, {
      oldName,
      newName: trimmed,
    })

    await batch.commit()
    tagCache.delete(targetTagId)
    return { merged: false, finalTagId: targetTagId }
  }
}
