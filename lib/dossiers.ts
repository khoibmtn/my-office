import {
  collection, doc, getDoc, getDocs, query, where,
  serverTimestamp, writeBatch
} from 'firebase/firestore'
import { db } from './firebase'
import { appendAuditLogToBatch } from './audit'
import type { Dossier, DossierChecklistItem, DossierComment } from '@/types'

export async function createDossier(input: {
  name: string
  parentId: string | null
  description?: string
  color?: string
  actorId: string
}): Promise<string> {
  const dossierRef = doc(collection(db(), 'dossiers'))
  let level: 1 | 2 | 3 = 1
  let order: number | null = null

  if (input.parentId) {
    const parentSnap = await getDoc(doc(db(), 'dossiers', input.parentId))
    if (!parentSnap.exists()) throw new Error('Thư mục cha không tồn tại')
    const parentData = parentSnap.data() as Dossier
    if (parentData.level >= 3) throw new Error('Hệ thống chỉ hỗ trợ tối đa 3 cấp hồ sơ')
    level = (parentData.level + 1) as 2 | 3
  } else {
    // Level 1 dossier: assign order = maxOrder + 1 (placed at the bottom)
    const rootQ = query(
      collection(db(), 'dossiers'),
      where('ownerId', '==', input.actorId),
      where('parentId', '==', null)
    )
    const rootSnap = await getDocs(rootQ)
    const activeRoots = rootSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as Dossier))
      .filter(d => !d.deletedAt && !d.isArchived)
    
    const maxOrder = activeRoots.reduce((max, d) => Math.max(max, d.order || 0), 0)
    order = maxOrder + 1
  }

  // Enforce uniqueness per (ownerId, parentId, name)
  const normName = input.name.trim().toLowerCase()
  const dupQ = query(
    collection(db(), 'dossiers'),
    where('ownerId', '==', input.actorId),
    where('parentId', '==', input.parentId || null)
  )
  const dupSnap = await getDocs(dupQ)
  const isDuplicate = dupSnap.docs
    .map(d => d.data() as Dossier)
    .filter(d => !d.deletedAt)
    .some(d => d.name.trim().toLowerCase() === normName)

  if (isDuplicate) {
    throw new Error(`Thư mục "${input.name.trim()}" đã tồn tại ở cấp này`)
  }

  let sharedWith: string[] = []
  let effectiveOwner = input.actorId && input.actorId !== 'unknown' ? input.actorId : 'admin'

  if (input.parentId) {
    const parentRef = doc(db(), 'dossiers', input.parentId)
    const parentSnap = await getDoc(parentRef)
    if (parentSnap.exists()) {
      const parentData = parentSnap.data() as Dossier
      if (parentData.sharedWith && parentData.sharedWith.length > 0) {
        sharedWith = [...parentData.sharedWith]
      }
      if (parentData.ownerId && parentData.ownerId !== 'unknown') {
        effectiveOwner = parentData.ownerId
      }
    }
  }

  const batch = writeBatch(db())
  batch.set(dossierRef, {
    name: input.name.trim(),
    parentId: input.parentId || null,
    level,
    order,
    createdBy: input.actorId || 'admin',
    ownerId: effectiveOwner,
    description: input.description || '',
    notes: '',
    color: input.color || '#3b82f6',
    checklist: [],
    comments: [],
    sharedWith,
    tagIds: [],
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  appendAuditLogToBatch(batch, 'dossier', dossierRef.id, 'CREATE', input.actorId || 'admin', {
    name: input.name.trim(),
    level,
    parentId: input.parentId,
    order,
    color: input.color,
  })

  await batch.commit()
  return dossierRef.id
}

export async function updateDossier(
  dossierId: string,
  fields: Partial<{
    name: string
    description: string
    notes: string
    color: string
    checklist: DossierChecklistItem[]
    comments: DossierComment[]
    sharedWith: string[]
    tagIds: string[]
  }>,
  actorId: string
): Promise<void> {
  const batch = writeBatch(db())
  const ref = doc(db(), 'dossiers', dossierId)
  batch.update(ref, {
    ...fields,
    updatedAt: serverTimestamp(),
  })
  appendAuditLogToBatch(batch, 'dossier', dossierId, 'UPDATE', actorId, { fields })
  await batch.commit()
}

export async function addDossierComment(
  dossierId: string,
  comment: {
    senderId: string
    senderName: string
    content: string
  },
  actorId: string
): Promise<DossierComment> {
  const dossierRef = doc(db(), 'dossiers', dossierId)
  const snap = await getDoc(dossierRef)
  if (!snap.exists()) throw new Error('Hồ sơ không tồn tại')
  
  const data = snap.data() as Dossier
  const existingComments = data.comments || []
  
  const newComment: DossierComment = {
    id: Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
    senderId: comment.senderId,
    senderName: comment.senderName,
    content: comment.content.trim(),
    createdAt: { seconds: Math.floor(Date.now() / 1000) },
  }
  
  const nextComments = [...existingComments, newComment]
  await updateDossier(dossierId, { comments: nextComments }, actorId)
  return newComment
}

export async function deleteDossierComment(
  dossierId: string,
  commentId: string,
  actorId: string
): Promise<void> {
  const dossierRef = doc(db(), 'dossiers', dossierId)
  const snap = await getDoc(dossierRef)
  if (!snap.exists()) return
  
  const data = snap.data() as Dossier
  const existingComments = data.comments || []
  const nextComments = existingComments.filter(c => c.id !== commentId)
  await updateDossier(dossierId, { comments: nextComments }, actorId)
}

export async function shareDossier(
  dossierId: string,
  sharedWith: string[],
  actorId: string
): Promise<void> {
  const batch = writeBatch(db())

  // Fetch all dossiers to recursively find all descendants
  const allSnap = await getDocs(query(collection(db(), 'dossiers'), where('deletedAt', '==', null)))
  const allDossiers = allSnap.docs.map(d => ({ id: d.id, ...d.data() } as Dossier))

  const targetIds = new Set<string>([dossierId])
  const findDescendants = (pid: string) => {
    allDossiers
      .filter(d => d.parentId === pid)
      .forEach(child => {
        targetIds.add(child.id)
        findDescendants(child.id)
      })
  }
  findDescendants(dossierId)

  targetIds.forEach(id => {
    const ref = doc(db(), 'dossiers', id)
    batch.update(ref, {
      sharedWith,
      updatedAt: serverTimestamp(),
    })
    appendAuditLogToBatch(batch, 'dossier', id, 'UPDATE', actorId, {
      operation: 'SHARE',
      sharedWith,
    })
  })

  await batch.commit()
}

export async function deleteDossier(
  dossierId: string,
  option: 'move_to_parent' | 'release',
  actorId: string
): Promise<void> {
  // Child prevention invariant
  const childQ = query(
    collection(db(), 'dossiers'),
    where('parentId', '==', dossierId)
  )
  const childSnap = await getDocs(childQ)
  const activeChildren = childSnap.docs.map(d => d.data() as Dossier).filter(d => !d.deletedAt)
  if (activeChildren.length > 0) {
    throw new Error(`Hồ sơ này đang có ${activeChildren.length} hồ sơ con. Vui lòng di chuyển hoặc xóa các hồ sơ con trước khi xóa!`)
  }

  const dossierSnap = await getDoc(doc(db(), 'dossiers', dossierId))
  if (!dossierSnap.exists()) return
  const dossier = dossierSnap.data() as Dossier

  const docsQ = query(
    collection(db(), 'documents'),
    where('dossierIds', 'array-contains', dossierId)
  )
  const docsSnap = await getDocs(docsQ)

  const batch = writeBatch(db())

  // Soft delete dossier
  batch.update(doc(db(), 'dossiers', dossierId), {
    deletedAt: serverTimestamp(),
    deletedBy: actorId,
    updatedAt: serverTimestamp(),
  })

  // If deleted dossier is Level 1, compact remaining active Level 1 dossiers (1, 2, 3...)
  if (dossier.level === 1 || !dossier.parentId) {
    const allRootsQ = query(
      collection(db(), 'dossiers'),
      where('ownerId', '==', dossier.ownerId),
      where('parentId', '==', null)
    )
    const allRootsSnap = await getDocs(allRootsQ)
    const remainingRoots = allRootsSnap.docs
      .map(d => ({ ...d.data(), id: d.id } as Dossier))
      .filter(d => !d.deletedAt && !d.isArchived && d.id !== dossierId)
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name, 'vi'))

    remainingRoots.forEach((r, idx) => {
      const newOrder = idx + 1
      if (r.order !== newOrder) {
        batch.update(doc(db(), 'dossiers', r.id), {
          order: newOrder,
          updatedAt: serverTimestamp(),
        })
      }
    })
  }

  // Invariant: remove target dossierId, add parentId if move_to_parent, NEVER wipe out unrelated dossierIds
  docsSnap.docs.forEach((dDoc) => {
    const data = dDoc.data()
    const currentDossierIds: string[] = data.dossierIds || []
    let updatedDossierIds = currentDossierIds.filter((id) => id !== dossierId)

    if (option === 'move_to_parent' && dossier.parentId) {
      if (!updatedDossierIds.includes(dossier.parentId)) {
        updatedDossierIds.push(dossier.parentId)
      }
    }

    batch.update(doc(db(), 'documents', dDoc.id), {
      dossierIds: updatedDossierIds,
      updatedAt: serverTimestamp(),
    })
  })

  appendAuditLogToBatch(batch, 'dossier', dossierId, 'DELETE', actorId, { option })
  await batch.commit()
}

export async function transferDossier(params: {
  dossierId: string
  targetOwnerId: string
  targetOwnerName: string
  selectedChildIds: string[]
  reassignUncompletedDocs: boolean
  actorId: string
}): Promise<void> {
  const { dossierId, targetOwnerId, selectedChildIds, reassignUncompletedDocs, actorId } = params

  const dossierSnap = await getDoc(doc(db(), 'dossiers', dossierId))
  if (!dossierSnap.exists()) throw new Error('Hồ sơ không tồn tại')
  const dossier = dossierSnap.data() as Dossier

  // Fetch all child dossiers
  const allChildrenQ = query(
    collection(db(), 'dossiers'),
    where('ownerId', '==', dossier.ownerId)
  )
  const allChildrenSnap = await getDocs(allChildrenQ)
  const allChildren = allChildrenSnap.docs
    .map(d => ({ ...d.data(), id: d.id } as Dossier))
    .filter(d => !d.deletedAt)

  // Find all descendants
  const descendantIds = new Set<string>()
  function collect(pid: string) {
    allChildren.filter(c => c.parentId === pid).forEach(c => {
      descendantIds.add(c.id)
      collect(c.id)
    })
  }
  collect(dossierId)

  const batch = writeBatch(db())

  // Update main dossier
  batch.update(doc(db(), 'dossiers', dossierId), {
    ownerId: targetOwnerId,
    updatedAt: serverTimestamp(),
  })

  // Process sub-dossiers with deterministic hierarchy rule
  descendantIds.forEach(cid => {
    if (selectedChildIds.includes(cid)) {
      batch.update(doc(db(), 'dossiers', cid), {
        ownerId: targetOwnerId,
        updatedAt: serverTimestamp(),
      })
    } else {
      // Deterministic hierarchy rule: unselected child becomes root level 1 dossier owned by original owner
      batch.update(doc(db(), 'dossiers', cid), {
        parentId: null,
        level: 1,
        updatedAt: serverTimestamp(),
      })
    }
  })

  // Reassign uncompleted documents if requested
  const allTransferredDossierIds = [dossierId, ...Array.from(descendantIds).filter(id => selectedChildIds.includes(id))]
  for (const did of allTransferredDossierIds) {
    const docsQ = query(collection(db(), 'documents'), where('dossierIds', 'array-contains', did))
    const docsSnap = await getDocs(docsQ)
    docsSnap.docs.forEach(dDoc => {
      const data = dDoc.data()
      if (reassignUncompletedDocs && data.status !== 'completed') {
        batch.update(doc(db(), 'documents', dDoc.id), {
          assigneeId: targetOwnerId,
          updatedAt: serverTimestamp(),
        })
      }
    })
  }

  appendAuditLogToBatch(batch, 'dossier', dossierId, 'TRANSFER', actorId, {
    fromOwnerId: dossier.ownerId,
    toOwnerId: targetOwnerId,
    selectedChildIds,
    reassignUncompletedDocs,
  })

  await batch.commit()
}

export async function toggleDocumentDossier(
  documentId: string,
  dossierId: string,
  action: 'add' | 'remove',
  actorId: string
): Promise<void> {
  const docSnap = await getDoc(doc(db(), 'documents', documentId))
  if (!docSnap.exists()) return
  const data = docSnap.data()
  const current: string[] = data.dossierIds || []

  let updated: string[] = []
  if (action === 'add') {
    if (!current.includes(dossierId)) updated = [...current, dossierId]
    else updated = current
  } else {
    updated = current.filter(id => id !== dossierId)
  }

  const batch = writeBatch(db())
  batch.update(doc(db(), 'documents', documentId), {
    dossierIds: updated,
    updatedAt: serverTimestamp(),
  })
  appendAuditLogToBatch(batch, 'document', documentId, 'ASSIGN', actorId, { dossierId, action })
  await batch.commit()
}

export async function addDocumentToDossiers(
  documentId: string,
  dossierIds: string[],
  actorId: string
): Promise<void> {
  const docRef = doc(db(), 'documents', documentId)
  const docSnap = await getDoc(docRef)
  if (!docSnap.exists()) throw new Error('Văn bản không tồn tại')

  const currentDossiers: string[] = docSnap.data().dossierIds || []
  const newDossierIds = Array.from(new Set([...currentDossiers, ...dossierIds]))

  const batch = writeBatch(db())
  batch.update(docRef, {
    dossierIds: newDossierIds,
    updatedAt: serverTimestamp(),
  })
  appendAuditLogToBatch(batch, 'document', documentId, 'ASSIGN', actorId, {
    addedDossierIds: dossierIds,
  })
  await batch.commit()
}

export async function removeDocumentFromDossier(
  documentId: string,
  dossierId: string,
  actorId: string
): Promise<void> {
  const docRef = doc(db(), 'documents', documentId)
  const docSnap = await getDoc(docRef)
  if (!docSnap.exists()) throw new Error('Văn bản không tồn tại')

  const currentDossiers: string[] = docSnap.data().dossierIds || []
  const updated = currentDossiers.filter((id) => id !== dossierId)

  const batch = writeBatch(db())
  batch.update(docRef, {
    dossierIds: updated,
    updatedAt: serverTimestamp(),
  })
  appendAuditLogToBatch(batch, 'document', documentId, 'ASSIGN', actorId, {
    removedDossierId: dossierId,
  })
  await batch.commit()
}

export async function moveDocumentDossier(
  documentId: string,
  fromDossierId: string | null,
  toDossierId: string,
  actorId: string
): Promise<void> {
  const docSnap = await getDoc(doc(db(), 'documents', documentId))
  if (!docSnap.exists()) return
  const data = docSnap.data()
  const current: string[] = data.dossierIds || []

  let updated = [...current]
  if (fromDossierId) {
    updated = updated.filter(id => id !== fromDossierId)
  }
  if (!updated.includes(toDossierId)) {
    updated.push(toDossierId)
  }

  const batch = writeBatch(db())
  batch.update(doc(db(), 'documents', documentId), {
    dossierIds: updated,
    updatedAt: serverTimestamp(),
  })
  appendAuditLogToBatch(batch, 'document', documentId, 'ASSIGN', actorId, {
    action: 'MOVE',
    fromDossierId,
    toDossierId,
  })
  await batch.commit()
}

export async function toggleArchiveDossier(
  dossierId: string,
  archive: boolean,
  actorId: string
): Promise<void> {
  const dossierSnap = await getDoc(doc(db(), 'dossiers', dossierId))
  if (!dossierSnap.exists()) return
  const dossier = dossierSnap.data() as Dossier

  const batch = writeBatch(db())
  const ref = doc(db(), 'dossiers', dossierId)

  if (dossier.level === 1 || !dossier.parentId) {
    const allRootsQ = query(
      collection(db(), 'dossiers'),
      where('ownerId', '==', dossier.ownerId),
      where('parentId', '==', null)
    )
    const allRootsSnap = await getDocs(allRootsQ)

    if (archive) {
      // Archiving Level 1 dossier: clear order & compact remaining active Level 1 dossiers
      batch.update(ref, {
        isArchived: true,
        order: null,
        updatedAt: serverTimestamp(),
      })

      const remainingRoots = allRootsSnap.docs
        .map(d => ({ ...d.data(), id: d.id } as Dossier))
        .filter(d => !d.deletedAt && !d.isArchived && d.id !== dossierId)
        .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name, 'vi'))

      remainingRoots.forEach((r, idx) => {
        const newOrder = idx + 1
        if (r.order !== newOrder) {
          batch.update(doc(db(), 'dossiers', r.id), {
            order: newOrder,
            updatedAt: serverTimestamp(),
          })
        }
      })
    } else {
      // Unarchiving Level 1 dossier: place at the bottom (maxOrder + 1)
      const activeRoots = allRootsSnap.docs
        .map(d => ({ ...d.data(), id: d.id } as Dossier))
        .filter(d => !d.deletedAt && !d.isArchived && d.id !== dossierId)
      
      const maxOrder = activeRoots.reduce((max, d) => Math.max(max, d.order || 0), 0)
      batch.update(ref, {
        isArchived: false,
        order: maxOrder + 1,
        updatedAt: serverTimestamp(),
      })
    }
  } else {
    batch.update(ref, {
      isArchived: archive,
      updatedAt: serverTimestamp(),
    })
  }

  appendAuditLogToBatch(batch, 'dossier', dossierId, 'UPDATE', actorId, {
    field: 'isArchived',
    value: archive,
  })
  await batch.commit()
}

/**
 * Move a dossier hierarchy into another target dossier or Root.
 * Enforces max 3-level depth invariant.
 */
export async function moveDossierHierarchy(
  dossierId: string,
  newParentId: string | null,
  actorId: string,
  allDossiers: Dossier[]
): Promise<void> {
  const targetDossier = allDossiers.find(d => d.id === dossierId)
  if (!targetDossier) throw new Error('Hồ sơ không tồn tại')

  if (targetDossier.parentId === newParentId) return

  // Prevent moving into itself or any descendant
  const getDescendantIds = (id: string): string[] => {
    const children = allDossiers.filter(d => d.parentId === id)
    return [id, ...children.flatMap(c => getDescendantIds(c.id))]
  }
  const selfAndDescendants = getDescendantIds(dossierId)
  if (newParentId && selfAndDescendants.includes(newParentId)) {
    throw new Error('Không thể di chuyển hồ sơ vào chính nó hoặc vào hồ sơ con của nó')
  }

  // Calculate height of moving subtree
  const getSubtreeHeight = (id: string): number => {
    const children = allDossiers.filter(d => d.parentId === id && !d.deletedAt)
    if (children.length === 0) return 1
    return 1 + Math.max(...children.map(c => getSubtreeHeight(c.id)))
  }
  const subtreeHeight = getSubtreeHeight(dossierId)

  // Calculate target parent level
  let targetParentLevel = 0
  if (newParentId) {
    const parent = allDossiers.find(d => d.id === newParentId)
    if (!parent) throw new Error('Hồ sơ đích không tồn tại')
    targetParentLevel = parent.level
  }

  if (targetParentLevel + subtreeHeight > 3) {
    throw new Error(
      `Không thể di chuyển: Tổng số cấp hồ sơ sau khi di chuyển (${targetParentLevel + subtreeHeight}) sẽ vượt quá giới hạn 3 cấp!`
    )
  }

  const newLevel = (targetParentLevel + 1) as 1 | 2 | 3
  const batch = writeBatch(db())

  // Handle order for Level 1 vs Sub-dossier
  let newOrder: number | null = targetDossier.order || null

  if (newParentId === null) {
    // Moving to Level 1: assign maxOrder + 1 (placed at the bottom)
    const activeRoots = allDossiers.filter(
      d => !d.parentId && !d.deletedAt && !d.isArchived && d.id !== dossierId
    )
    const maxOrder = activeRoots.reduce((max, d) => Math.max(max, d.order || 0), 0)
    newOrder = maxOrder + 1
  } else if (targetDossier.parentId === null) {
    // Moving away from Level 1 to a child position: clear order & compact remaining active Level 1 dossiers
    newOrder = null
    const remainingRoots = allDossiers
      .filter(d => !d.parentId && !d.deletedAt && !d.isArchived && d.id !== dossierId)
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name, 'vi'))

    remainingRoots.forEach((r, idx) => {
      const expectedOrder = idx + 1
      if (r.order !== expectedOrder) {
        batch.update(doc(db(), 'dossiers', r.id), {
          order: expectedOrder,
          updatedAt: serverTimestamp(),
        })
      }
    })
  }

  // Update target dossier
  const dossierRef = doc(db(), 'dossiers', dossierId)
  batch.update(dossierRef, {
    parentId: newParentId || null,
    level: newLevel,
    order: newOrder,
    updatedAt: serverTimestamp(),
  })

  // Recursive level updater for descendants
  const updateChildLevels = (parentId: string, parentLevel: number) => {
    const children = allDossiers.filter(d => d.parentId === parentId)
    children.forEach(child => {
      const childNewLevel = (parentLevel + 1) as 1 | 2 | 3
      const childRef = doc(db(), 'dossiers', child.id)
      batch.update(childRef, {
        level: childNewLevel,
        order: null, // Sub-dossiers don't have order
        updatedAt: serverTimestamp(),
      })
      updateChildLevels(child.id, childNewLevel)
    })
  }

  updateChildLevels(dossierId, newLevel)

  appendAuditLogToBatch(batch, 'dossier', dossierId, 'UPDATE', actorId, {
    action: 'MOVE_DOSSIER',
    oldParentId: targetDossier.parentId,
    newParentId: newParentId || null,
    oldLevel: targetDossier.level,
    newLevel,
  })

  await batch.commit()
}

/**
 * Reorder Level 1 dossiers up or down.
 */
export async function reorderLevel1Dossiers(
  dossierId: string,
  direction: 'up' | 'down',
  actorId: string,
  allDossiers: Dossier[]
): Promise<void> {
  const activeRoots = allDossiers
    .filter(d => !d.parentId && !d.deletedAt && !d.isArchived)
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name, 'vi'))

  const currentIndex = activeRoots.findIndex(d => d.id === dossierId)
  if (currentIndex === -1) return

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
  if (targetIndex < 0 || targetIndex >= activeRoots.length) return

  // Swap target and current in list
  const reordered = [...activeRoots]
  const [moved] = reordered.splice(currentIndex, 1)
  reordered.splice(targetIndex, 0, moved)

  const batch = writeBatch(db())

  reordered.forEach((d, idx) => {
    const expectedOrder = idx + 1
    if (d.order !== expectedOrder) {
      batch.update(doc(db(), 'dossiers', d.id), {
        order: expectedOrder,
        updatedAt: serverTimestamp(),
      })
    }
  })

  appendAuditLogToBatch(batch, 'dossier', dossierId, 'UPDATE', actorId, {
    action: 'REORDER_DOSSIER',
    direction,
  })

  await batch.commit()
}
