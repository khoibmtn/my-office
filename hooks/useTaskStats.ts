'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db, ensureAuth } from '@/lib/firebase'
import type { TaskStats } from '@/types/tasks'

/**
 * Subscribe to TaskStats for a specific scope.
 * Document ID format: "{scope}_{scopeId}" e.g. "user_staff001", "department_dept01", "global_all"
 */
export function useTaskStats(scope: 'user' | 'department' | 'global', scopeId: string) {
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!scopeId) { setLoading(false); return }

    let unsub: (() => void) | null = null
    const docId = `${scope}_${scopeId}`

    ensureAuth().then(() => {
      unsub = onSnapshot(
        doc(db(), 'taskStats', docId),
        (snap) => {
          if (snap.exists()) {
            setStats({ id: snap.id, ...snap.data() } as TaskStats)
          } else {
            // No stats doc yet — return zeros
            setStats({
              id: docId,
              scope,
              scopeId,
              pending: 0,
              inProgress: 0,
              blocked: 0,
              completed: 0,
              cancelled: 0,
              overdue: 0,
              completedThisWeek: 0,
              completedThisMonth: 0,
              updatedAt: null as any,
            })
          }
          setLoading(false)
        },
        (err) => {
          console.error('[useTaskStats] error:', err)
          setLoading(false)
        }
      )
    }).catch(() => setLoading(false))

    return () => { if (unsub) unsub() }
  }, [scope, scopeId])

  return { stats, loading }
}
