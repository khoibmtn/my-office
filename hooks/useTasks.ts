'use client'

import { useState, useEffect, useMemo } from 'react'
import { ensureAuth } from '@/lib/firebase'
import {
  queryMyTasks,
  queryAllActiveTasks,
  queryDepartmentTasks,
  queryDossierTasks,
  subscribeToQuery,
} from '@/lib/tasks/firestore'
import type { Task } from '@/types/tasks'

type TaskFilter = {
  view: 'my' | 'all' | 'department' | 'dossier'
  assigneeId?: string
  departmentId?: string
  dossierId?: string
}

export function useTasks(filter: TaskFilter) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub: (() => void) | null = null

    ensureAuth().then(() => {
      let q
      switch (filter.view) {
        case 'my':
          if (!filter.assigneeId) { setLoading(false); return }
          q = queryMyTasks(filter.assigneeId)
          break
        case 'department':
          if (!filter.departmentId) { setLoading(false); return }
          q = queryDepartmentTasks(filter.departmentId)
          break
        case 'dossier':
          if (!filter.dossierId) { setLoading(false); return }
          q = queryDossierTasks(filter.dossierId)
          break
        case 'all':
        default:
          q = queryAllActiveTasks()
          break
      }

      unsub = subscribeToQuery(
        q,
        (items) => {
          setTasks(items as Task[])
          setLoading(false)
        },
        () => setLoading(false)
      )
    }).catch(() => setLoading(false))

    return () => { if (unsub) unsub() }
  }, [filter.view, filter.assigneeId, filter.departmentId, filter.dossierId])

  return { tasks, loading }
}
