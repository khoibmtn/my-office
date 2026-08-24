import { doc, serverTimestamp, WriteBatch } from 'firebase/firestore'
import { db } from './firebase'
import type { AuditLogMetadata } from '@/types'

export function appendAuditLogToBatch(
  batch: WriteBatch,
  entityType: 'dossier' | 'document' | 'tag',
  entityId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'TRANSFER' | 'ASSIGN',
  actorId: string,
  metadata: AuditLogMetadata = {}
): void {
  const logRef = doc(db(), 'auditLogs', `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`)
  batch.set(logRef, {
    entityType,
    entityId,
    action,
    actorId,
    metadata,
    createdAt: serverTimestamp(),
  })
}
