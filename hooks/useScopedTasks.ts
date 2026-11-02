'use client'

import { useState, useEffect } from 'react'
import { ensureAuth } from '@/lib/firebase'
import {
  queryDocumentTasks,
  queryDossierTasks,
  querySeriesTasks,
  subscribeToQuery,
  toMillis,
} from '@/lib/tasks/firestore'
import type { Task } from '@/types/tasks'

function sortTasksByCreatedDesc(items: Task[]): Task[] {
  return items
    .filter((t) => t.deletedAt == null)
    .sort((a, b) => (toMillis(b.createdAt) ?? 0) - (toMillis(a.createdAt) ?? 0))
}

/**
 * Subscribe to all non-deleted tasks linked to a specific document (including closed >30 days).
 */
export function useDocumentTasks(documentId: string | null | undefined) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState<boolean>(Boolean(documentId))

  useEffect(() => {
    if (!documentId) {
      setTasks([])
      setLoading(false)
      return
    }

    let unsub: (() => void) | null = null
    let cancelled = false
    setTasks([])
    setLoading(true)

    ensureAuth()
      .then(() => {
        if (cancelled) return
        unsub = subscribeToQuery(
          queryDocumentTasks(documentId),
          (items) => {
            if (cancelled) return
            setTasks(sortTasksByCreatedDesc(items as Task[]))
            setLoading(false)
          },
          (err) => {
            console.error('[useDocumentTasks] subscription error:', err)
            if (!cancelled) setLoading(false)
          }
        )
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [documentId])

  return { tasks, loading }
}

/**
 * Subscribe to all non-deleted tasks linked to a specific dossier (including closed >30 days).
 */
export function useDossierTasks(dossierId: string | null | undefined) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState<boolean>(Boolean(dossierId))

  useEffect(() => {
    if (!dossierId) {
      setTasks([])
      setLoading(false)
      return
    }

    let unsub: (() => void) | null = null
    let cancelled = false
    setTasks([])
    setLoading(true)

    ensureAuth()
      .then(() => {
        if (cancelled) return
        unsub = subscribeToQuery(
          queryDossierTasks(dossierId),
          (items) => {
            if (cancelled) return
            setTasks(sortTasksByCreatedDesc(items as Task[]))
            setLoading(false)
          },
          (err) => {
            console.error('[useDossierTasks] subscription error:', err)
            if (!cancelled) setLoading(false)
          }
        )
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [dossierId])

  return { tasks, loading }
}

/**
 * Subscribe to all non-deleted tasks belonging to a specific recurring series
 * (or all occurrence tasks across series when `seriesId` is omitted).
 */
export function useSeriesTasks(seriesId?: string | null) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState<boolean>(seriesId !== null && seriesId !== '')

  useEffect(() => {
    if (seriesId === null || seriesId === '') {
      setTasks([])
      setLoading(false)
      return
    }

    let unsub: (() => void) | null = null
    let cancelled = false
    setTasks([])
    setLoading(true)

    ensureAuth()
      .then(() => {
        if (cancelled) return
        unsub = subscribeToQuery(
          querySeriesTasks(seriesId),
          (items) => {
            if (cancelled) return
            setTasks(sortTasksByCreatedDesc(items as Task[]))
            setLoading(false)
          },
          (err) => {
            console.error('[useSeriesTasks] subscription error:', err)
            if (!cancelled) setLoading(false)
          }
        )
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [seriesId])

  return { tasks, loading }
}
