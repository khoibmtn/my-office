'use client'

import { useEffect, useRef } from 'react'
import { getDocs } from 'firebase/firestore'
import { queryActiveSeries, generateSeriesOccurrences } from '@/lib/tasks/series'
import type { TaskSeries } from '@/types/tasks'

const THROTTLE_INTERVAL_MS = 60 * 1000 // 60 seconds between syncs across tabs
const STORAGE_KEY = 'my_office_recurrence_last_sync'

/**
 * Client Opportunistic Scheduler Hook.
 * Automatically checks and triggers generation for active recurring series in the background
 * when the user is using the app.
 *
 * Safe, idempotent, non-blocking, and throttled to once per minute across the browser.
 */
export function useRecurringScheduler() {
  const isSyncingRef = useRef(false)

  useEffect(() => {
    let isMounted = true

    const runSync = async () => {
      if (isSyncingRef.current) return

      // Throttle check
      try {
        const lastSyncStr = localStorage.getItem(STORAGE_KEY)
        const now = Date.now()
        if (lastSyncStr) {
          const lastSync = parseInt(lastSyncStr, 10)
          if (!isNaN(lastSync) && now - lastSync < THROTTLE_INTERVAL_MS) {
            return
          }
        }
      } catch {
        // Ignore localStorage read errors in private browsing
      }

      isSyncingRef.current = true

      try {
        const snap = await getDocs(queryActiveSeries())
        if (!isMounted || snap.empty) {
          isSyncingRef.current = false
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

        try {
          localStorage.setItem(STORAGE_KEY, String(Date.now()))
        } catch {
          // Ignore localStorage write errors
        }
      } catch (err) {
        console.warn('[useRecurringScheduler] Sync error:', err)
      } finally {
        isSyncingRef.current = false
      }
    }

    // Run shortly after mount (1.5s delay to let critical UI hydration finish first)
    const timer = setTimeout(runSync, 1500)

    // Also periodic check every 60s while app is open
    const interval = setInterval(runSync, THROTTLE_INTERVAL_MS)

    return () => {
      isMounted = false
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [])
}
