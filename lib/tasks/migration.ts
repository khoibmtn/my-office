/**
 * Checklist -> Task Migration Engine
 * Migrates legacy DossierChecklistItem[] into real Task entities in Firestore.
 * Supports idempotency via migratedFromChecklistId and dual-read verification.
 */

import {
  collection, doc, getDocs, query, where,
  writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Task, TaskStatus } from '@/types/tasks'
import type { Dossier, DossierChecklistItem } from '@/types'

const TASKS_COLLECTION = 'tasks'
const DOSSIERS_COLLECTION = 'dossiers'

export interface MigrationResult {
  totalDossiersScanned: number
  dossiersWithChecklists: number
  totalItemsScanned: number
  migratedCount: number
  skippedCount: number
  errors: Array<{ dossierId: string; error: string }>
}

/**
 * Migrate all dossiers' checklists into Firestore tasks.
 * Idempotent: Skips items already migrated (matching migratedFromChecklistId).
 */
export async function migrateAllChecklists(actorId: string = 'migration_script'): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalDossiersScanned: 0,
    dossiersWithChecklists: 0,
    totalItemsScanned: 0,
    migratedCount: 0,
    skippedCount: 0,
    errors: [],
  }

  try {
    const dossiersSnap = await getDocs(collection(db(), DOSSIERS_COLLECTION))
    result.totalDossiersScanned = dossiersSnap.size

    for (const dossierDoc of dossiersSnap.docs) {
      const dossier = { id: dossierDoc.id, ...dossierDoc.data() } as Dossier
      const checklist = dossier.checklist || []
      if (checklist.length === 0) continue

      result.dossiersWithChecklists++
      result.totalItemsScanned += checklist.length

      try {
        // Fetch existing migrated tasks for this dossier
        const existingTasksQuery = query(
          collection(db(), TASKS_COLLECTION),
          where('dossierIds', 'array-contains', dossier.id),
          where('source', '==', 'dossier_checklist')
        )
        const existingTasksSnap = await getDocs(existingTasksQuery)
        const existingMigratedItemIds = new Set<string>()

        existingTasksSnap.docs.forEach(tDoc => {
          const t = tDoc.data() as Task
          if (t.migratedFromChecklistId) {
            existingMigratedItemIds.add(t.migratedFromChecklistId)
          }
        })

        const itemsToMigrate = checklist.filter(item => !existingMigratedItemIds.has(item.id))
        result.skippedCount += (checklist.length - itemsToMigrate.length)

        if (itemsToMigrate.length === 0) continue

        // Write batch
        const batch = writeBatch(db())

        for (const item of itemsToMigrate) {
          const taskRef = doc(collection(db(), TASKS_COLLECTION))
          const isCompleted = !!item.completed
          const status: TaskStatus = isCompleted ? 'completed' : 'pending'

          const newTask: Omit<Task, 'id'> = {
            taskCode: null,
            title: item.title,
            description: null,
            type: 'single',
            status,
            priority: 'normal',
            progress: isCompleted ? 100 : 0,
            progressMode: 'manual',
            isClosed: isCompleted,

            startDate: null,
            dueDate: null,
            completedAt: isCompleted
              ? (item.completedAt instanceof Timestamp
                  ? item.completedAt
                  : item.completedAt
                  ? Timestamp.fromDate(new Date((item.completedAt as any)?.toDate ? (item.completedAt as any).toDate() : item.completedAt))
                  : (serverTimestamp() as any))
              : null,
            estimatedMinutes: null,
            occurrenceDate: null,
            visibleFrom: null,

            createdBy: dossier.ownerId || actorId,
            assigneeId: null,
            assigneeName: item.completedBy || null,
            collaboratorIds: [],
            followerIds: [],

            departmentId: null,
            cooperatingDepartmentIds: [],
            assigneeDepartmentId: null,

            blockedReason: null,
            blockedByTaskIds: [],
            blockedNote: null,
            previousStatus: null,

            dossierIds: [dossier.id],
            documentIds: [],
            parentTaskId: null,
            dependsOnTaskIds: [],
            relatedTaskIds: [],

            seriesId: null,
            occurrenceKey: null,
            templateId: null,

            tagIds: [],
            attachments: [],
            source: 'dossier_checklist',

            createdAt: serverTimestamp() as any,
            updatedAt: serverTimestamp() as any,
            deletedAt: null,
            migratedFromChecklistId: item.id,
          }

          batch.set(taskRef, newTask)
          result.migratedCount++
        }

        await batch.commit()
      } catch (err: any) {
        console.error(`Error migrating dossier ${dossier.id}:`, err)
        result.errors.push({
          dossierId: dossier.id,
          error: err?.message || String(err),
        })
      }
    }
  } catch (err: any) {
    console.error('Fatal migration error:', err)
    result.errors.push({ dossierId: 'global', error: err?.message || String(err) })
  }

  return result
}

/**
 * Verify dual-read state for a dossier:
 * Returns checklist count vs migrated task count.
 */
export async function verifyDossierTasks(dossierId: string): Promise<{
  checklistCount: number
  migratedTaskCount: number
  isConsistent: boolean
}> {
  const dossierDoc = await getDocs(query(collection(db(), DOSSIERS_COLLECTION), where('__name__', '==', dossierId)))
  if (dossierDoc.empty) {
    return { checklistCount: 0, migratedTaskCount: 0, isConsistent: true }
  }

  const checklist = (dossierDoc.docs[0].data() as Dossier).checklist || []

  const tasksQuery = query(
    collection(db(), TASKS_COLLECTION),
    where('dossierIds', 'array-contains', dossierId),
    where('deletedAt', '==', null)
  )
  const tasksSnap = await getDocs(tasksQuery)

  return {
    checklistCount: checklist.length,
    migratedTaskCount: tasksSnap.size,
    isConsistent: checklist.length <= tasksSnap.size,
  }
}

/**
 * Migrate a single dossier's checklist to Tasks immediately.
 */
export async function migrateSingleDossierChecklist(
  dossierId: string,
  checklist: DossierChecklistItem[],
  ownerId?: string | null,
  actorId: string = 'user'
): Promise<number> {
  if (!checklist || checklist.length === 0) return 0

  // Check which are already migrated
  const existingTasksQuery = query(
    collection(db(), TASKS_COLLECTION),
    where('dossierIds', 'array-contains', dossierId),
    where('source', '==', 'dossier_checklist')
  )
  const existingTasksSnap = await getDocs(existingTasksQuery)
  const existingMigratedItemIds = new Set<string>()

  existingTasksSnap.docs.forEach(tDoc => {
    const t = tDoc.data() as Task
    if (t.migratedFromChecklistId) {
      existingMigratedItemIds.add(t.migratedFromChecklistId)
    }
  })

  const itemsToMigrate = checklist.filter(item => !existingMigratedItemIds.has(item.id))
  if (itemsToMigrate.length === 0) return 0

  const batch = writeBatch(db())

  for (const item of itemsToMigrate) {
    const taskRef = doc(collection(db(), TASKS_COLLECTION))
    const isCompleted = !!item.completed
    const status: TaskStatus = isCompleted ? 'completed' : 'pending'

    const newTask: Omit<Task, 'id'> = {
      taskCode: null,
      title: item.title,
      description: null,
      type: 'single',
      status,
      priority: 'normal',
      progress: isCompleted ? 100 : 0,
      progressMode: 'manual',
      isClosed: isCompleted,

      startDate: null,
      dueDate: null,
      completedAt: isCompleted
        ? (item.completedAt instanceof Timestamp
            ? item.completedAt
            : item.completedAt
            ? Timestamp.fromDate(new Date((item.completedAt as any)?.toDate ? (item.completedAt as any).toDate() : item.completedAt))
            : (serverTimestamp() as any))
        : null,
      estimatedMinutes: null,
      occurrenceDate: null,
      visibleFrom: null,

      createdBy: ownerId || actorId,
      assigneeId: null,
      assigneeName: item.completedBy || null,
      collaboratorIds: [],
      followerIds: [],

      departmentId: null,
      cooperatingDepartmentIds: [],
      assigneeDepartmentId: null,

      blockedReason: null,
      blockedByTaskIds: [],
      blockedNote: null,
      previousStatus: null,

      dossierIds: [dossierId],
      documentIds: [],
      parentTaskId: null,
      dependsOnTaskIds: [],
      relatedTaskIds: [],

      seriesId: null,
      occurrenceKey: null,
      templateId: null,

      tagIds: [],
      attachments: [],
      source: 'dossier_checklist',

      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
      deletedAt: null,
      migratedFromChecklistId: item.id,
    }

    batch.set(taskRef, newTask)
  }

  await batch.commit()
  return itemsToMigrate.length
}
