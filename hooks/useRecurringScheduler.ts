'use client'

import { useEffect, useRef } from 'react'
import { getDocs } from 'firebase/firestore'
import { useRole } from '@/hooks/useRole'
import { queryActiveSeries, generateSeriesOccurrences } from '@/lib/tasks/series'
import type { TaskSeries } from '@/types/tasks'

export const RECURRENCE_THROTTLE_INTERVAL_MS = 60 * 60 * 1000 // 1 hour between runs
export const RECURRENCE_LAST_RUN_STORAGE_KEY = 'myoffice_recurrence_last_run'

/**
 * Client Opportunistic Scheduler Hook (fallback to server cron).
 * Only runs when the current user is an admin (`useRole().isAdmin`)
 * and at most once per hour (tracked in `localStorage['myoffice_recurrence_last_run']`).
 */
export function useRecurringScheduler() {
  const { isAdmin, loading } = useRole()
  const isSyncingRef = useRef(false)

  useEffect(() => {
    if (loading || !isAdmin) return

    let isMounted = true

    const runSync = async () => {
      if (!isAdmin || isSyncingRef.current) return

      const nowMs = Date.now()
      try {
        const lastRunStr = localStorage.getItem(RECURRENCE_LAST_RUN_STORAGE_KEY)
        if (lastRunStr) {
          const lastRun = parseInt(lastRunStr, 10)
          if (!isNaN(lastRun) && nowMs - lastRun < RECURRENCE_THROTTLE_INTERVAL_MS) {
            return
          }
        }
      } catch {
        // Ignore localStorage read errors in restricted/private browsing
      }

      isSyncingRef.current = true
      try {
        try {
          localStorage.setItem(RECURRENCE_LAST_RUN_STORAGE_KEY, String(nowMs))
        } catch {
          // Ignore localStorage write errors
        }

        const snap = await getDocs(queryActiveSeries())
        if (!isMounted || snap.empty) {
          return
        }

        const now = new Date()

        for (const d of snap.docs) {
          if (!isMounted) break
          const series = { id: d.id, ...d.data() } as TaskSeries
          if (series.status !== 'active') continue

          const rollingDays = series.rollingWindowDays || 14
          const windowEnd = new Date(now.getTime() + rollingDays * 86400000)

          try {
            await generateSeriesOccurrences(series, windowEnd)
          } catch (err) {
            console.warn(`[useRecurringScheduler] Failed to generate for series ${series.id}:`, err)
          }
        }
      } catch (err) {
        console.warn('[useRecurringScheduler] Sync error:', err)
      } finally {
        isSyncingRef.current = false
      }
    }

    const timer = setTimeout(runSync, 1500)
    const interval = setInterval(runSync, RECURRENCE_THROTTLE_INTERVAL_MS)

    return () => {
      isMounted = false
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [isAdmin, loading])
}
