import {
  collection, doc, getDoc, getDocs, query, where,
  serverTimestamp, writeBatch
} from 'firebase/firestore'
import { db } from './firebase'
import { appendAuditLogToBatch } from './audit'
import type { Dossier, DossierChecklistItem } from '@/types'

export async function createDossier(input: {
  name: string
  parentId: string | null
  description?: string
  actorId: string
}): Promise<string> {
  const dossierRef = doc(collection(db(), 'dossiers'))
  let level: 1 | 2 | 3 = 1

  if (input.parentId) {
    const parentSnap = await getDoc(doc(db(), 'dossiers', input.parentId))
    if (!parentSnap.exists()) throw new Error('Thư mục cha không tồn tại')
    const parentData = parentSnap.data() as Dossier
    if (parentData.level >= 3) throw new Error('Hệ thống chỉ hỗ trợ tối đa 3 cấp hồ sơ')
    level = (parentData.level + 1) as 2 | 3
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

  const batch = writeBatch(db())
  batch.set(dossierRef, {
    name: input.name.trim(),
    parentId: input.parentId || null,
    level,
    createdBy: input.actorId,
    ownerId: input.actorId,
    description: input.description || '',
    checklist: [],
    tagIds: [],
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  appendAuditLogToBatch(batch, 'dossier', dossierRef.id, 'CREATE', input.actorId, {
    name: input.name.trim(),
    level,
    parentId: input.parentId,
  })

  await batch.commit()
  return dossierRef.id
}

export async function updateDossier(
  dossierId: string,
  fields: Partial<{
    name: string
    description: string
    checklist: DossierChecklistItem[]
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
    .map(d => ({ id: d.id, ...d.data() } as Dossier))
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
  const batch = writeBatch(db())
  const ref = doc(db(), 'dossiers', dossierId)
  batch.update(ref, {
    isArchived: archive,
    updatedAt: serverTimestamp(),
  })
  appendAuditLogToBatch(batch, 'dossier', dossierId, 'UPDATE', actorId, {
    field: 'isArchived',
    value: archive,
  })
  await batch.commit()
}

