'use client'

import { useState, useEffect, useMemo } from 'react'
import { ensureAuth } from '@/lib/firebase'
import {
  queryAllActiveTasks,
  queryRecentClosedTasks,
  subscribeToQuery,
  isVisibleTask,
  computeTaskStats,
  filterTasksByParams,
  toMillis,
  getVietnamTimeBounds,
  getClosedTasksSinceMs,
  mergeTaskSnapshots,
  THIRTY_DAYS_MS,
  type ComputedTaskStats,
  type SpecialTaskStatus,
  type TaskQueryFilterParams,
} from '@/lib/tasks/firestore'
import type { Task } from '@/types/tasks'

export {
  isVisibleTask,
  computeTaskStats,
  filterTasksByParams,
  toMillis,
  getVietnamTimeBounds,
  getClosedTasksSinceMs,
  mergeTaskSnapshots,
  type ComputedTaskStats,
  type SpecialTaskStatus,
  type TaskQueryFilterParams,
}

export type TaskFilter = {
  view: 'my' | 'all' | 'created' | 'department' | 'dossier' | 'document'
  assigneeId?: string
  departmentId?: string
  dossierId?: string
  documentId?: string
}

type Subscriber = (tasks: Task[], loading: boolean) => void

// Module-level singleton state: at most 2 Firestore listeners across the entire app
const subscribers = new Set<Subscriber>()
let openTasksCache: Task[] = []
let closedTasksCache: Task[] = []
let mergedTasksCache: Task[] = []
const deletedTaskIds = new Set<string>()
const retainedSince = new Map<string, number>()
let closedListenerFailed = false
let openLoaded = false
let closedLoaded = false
let sharedLoading = true
let unsubOpen: (() => void) | null = null
let unsubClosed: (() => void) | null = null
let isStarting = false
let activeListenerCount = 0

function rebuildMergedTasks() {
  mergedTasksCache = mergeTaskSnapshots(
    openTasksCache,
    closedTasksCache,
    mergedTasksCache,
    deletedTaskIds,
    { allowRetain: !closedListenerFailed, retainedSince }
  )
  sharedLoading = !(openLoaded && closedLoaded)
}

function notifySubscribers() {
  subscribers.forEach((cb) => cb(mergedTasksCache, sharedLoading))
}

function startSharedListeners() {
  if (unsubOpen || unsubClosed || isStarting) return
  isStarting = true

  ensureAuth()
    .then(() => {
      isStarting = false
      if (subscribers.size === 0) return
      if (unsubOpen || unsubClosed) return

      // Recompute cutoff whenever shared listeners are created:
      // min(now - 30 days, start of current month in Asia/Ho_Chi_Minh)
      const sinceMs = getClosedTasksSinceMs(Date.now())

      // Listener 1: open tasks (isClosed == false)
      unsubOpen = subscribeToQuery(
        queryAllActiveTasks(),
        (items, meta) => {
          meta?.deletedIds.forEach((id) => deletedTaskIds.add(id))
          openTasksCache = (items as Task[]).filter((t) => t.deletedAt == null)
          for (const t of openTasksCache) {
            deletedTaskIds.delete(t.id)
          }
          openLoaded = true
          rebuildMergedTasks()
          notifySubscribers()
        },
        (err) => {
          console.error('[useTasks:open] subscription error:', err)
          openLoaded = true
          rebuildMergedTasks()
          notifySubscribers()
        }
      )

      // Listener 2: closed tasks (completed or cancelled) updated since min(now-30d, monthStartVN)
      unsubClosed = subscribeToQuery(
        queryRecentClosedTasks(sinceMs),
        (items, meta) => {
          meta?.deletedIds.forEach((id) => deletedTaskIds.add(id))
          closedListenerFailed = false
          closedTasksCache = (items as Task[]).filter((t) => t.deletedAt == null)
          for (const t of closedTasksCache) {
            deletedTaskIds.delete(t.id)
          }
          closedLoaded = true
          rebuildMergedTasks()
          notifySubscribers()
        },
        (err) => {
          console.error('[useTasks:closed] subscription error:', err)
          closedListenerFailed = true
          closedLoaded = true
          rebuildMergedTasks()
          notifySubscribers()
        }
      )

      activeListenerCount = 2
    })
    .catch((err) => {
      console.error('[useTasks] ensureAuth error:', err)
      isStarting = false
      openLoaded = true
      closedLoaded = true
      sharedLoading = false
      notifySubscribers()
    })
}

function stopSharedListeners() {
  if (unsubOpen) {
    unsubOpen()
    unsubOpen = null
  }
  if (unsubClosed) {
    unsubClosed()
    unsubClosed = null
  }
  activeListenerCount = 0
  isStarting = false
  openTasksCache = []
  closedTasksCache = []
  mergedTasksCache = []
  deletedTaskIds.clear()
  retainedSince.clear()
  closedListenerFailed = false
  openLoaded = false
  closedLoaded = false
  sharedLoading = true
}

/** Inspection helper: number of active hook subscribers */
export function getTaskSubscriberCount(): number {
  return subscribers.size
}

/** Inspection helper: number of active Firestore listeners (max 2) */
export function getActiveTaskListenerCount(): number {
  return activeListenerCount
}

export function useTasks(filter: TaskFilter) {
  const [allTasks, setAllTasks] = useState<Task[]>(() => mergedTasksCache)
  const [loading, setLoading] = useState<boolean>(() => sharedLoading)

  useEffect(() => {
    const handleUpdate: Subscriber = (nextTasks, nextLoading) => {
      setAllTasks(nextTasks)
      setLoading(nextLoading)
    }

    subscribers.add(handleUpdate)
    if (!sharedLoading || mergedTasksCache.length > 0) {
      setAllTasks(mergedTasksCache)
      setLoading(sharedLoading)
    }
    startSharedListeners()

    return () => {
      subscribers.delete(handleUpdate)
      if (subscribers.size === 0) {
        stopSharedListeners()
      }
    }
  }, [])

  const tasks = useMemo(() => {
    let list = allTasks.filter((t) => t.deletedAt == null)

    switch (filter.view) {
      case 'my':
        if (filter.assigneeId) {
          list = list.filter(
            (t) =>
              t.assigneeId === filter.assigneeId ||
              t.collaboratorIds?.includes(filter.assigneeId!)
          )
        }
        break
      case 'created':
        if (filter.assigneeId) {
          list = list.filter((t) => t.createdBy === filter.assigneeId)
        }
        break
      case 'department':
        if (filter.departmentId) {
          list = list.filter(
            (t) => (t.departmentId || t.assigneeDepartmentId) === filter.departmentId
          )
        }
        break
      case 'dossier':
        if (filter.dossierId) {
          list = list.filter((t) => t.dossierIds?.includes(filter.dossierId!))
        }
        break
      case 'document':
        if (filter.documentId) {
          list = list.filter((t) => t.documentIds?.includes(filter.documentId!))
        }
        break
      case 'all':
      default:
        break
    }

    return list
  }, [allTasks, filter.view, filter.assigneeId, filter.departmentId, filter.dossierId, filter.documentId])

  return { tasks, loading }
}
