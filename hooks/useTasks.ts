'use client'

import { useState, useEffect, useMemo } from 'react'
import { ensureAuth } from '@/lib/firebase'
import {
  queryMyTasks,
  queryAllActiveTasks,
  queryDepartmentTasks,
  queryDossierTasks,
  queryDocumentTasks,
  subscribeToQuery,
} from '@/lib/tasks/firestore'
import type { Task } from '@/types/tasks'

type TaskFilter = {
  view: 'my' | 'all' | 'created' | 'department' | 'dossier' | 'document'
  assigneeId?: string
  departmentId?: string
  dossierId?: string
  documentId?: string
}

export function useTasks(filter: TaskFilter) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub: (() => void) | null = null

    ensureAuth().then(() => {
      unsub = subscribeToQuery(
        queryAllActiveTasks(),
        (items) => {
          let list = items as Task[]

          switch (filter.view) {
            case 'my':
              if (filter.assigneeId) {
                list = list.filter(t =>
                  t.assigneeId === filter.assigneeId ||
                  t.collaboratorIds?.includes(filter.assigneeId!)
                )
              }
              break
            case 'created':
              if (filter.assigneeId) {
                list = list.filter(t => t.createdBy === filter.assigneeId)
              }
              break
            case 'department':
              if (filter.departmentId) {
                list = list.filter(t => t.departmentId === filter.departmentId)
              }
              break
            case 'dossier':
              if (filter.dossierId) {
                list = list.filter(t => t.dossierIds?.includes(filter.dossierId!))
              }
              break
            case 'document':
              if (filter.documentId) {
                list = list.filter(t => t.documentIds?.includes(filter.documentId!))
              }
              break
            case 'all':
            default:
              break
          }

          setTasks(list)
          setLoading(false)
        },
        (err) => {
          console.error('[useTasks] subscription error:', err)
          setLoading(false)
        }
      )
    }).catch(() => setLoading(false))

    return () => { if (unsub) unsub() }
  }, [filter.view, filter.assigneeId, filter.departmentId, filter.dossierId, filter.documentId])

  return { tasks, loading }
}
