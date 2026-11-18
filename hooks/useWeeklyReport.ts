'use client'

import { useEffect, useState } from 'react'
import { ensureWeek, subscribeWeek } from '@/lib/weekly-report/firestore'
import type { WeeklyReport } from '@/types/weekly-report'

/** Ensures the week exists (once per weekId), then streams it. */
export function useWeeklyReport(weekId: string): {
  report: WeeklyReport | null
  loading: boolean
  error: Error | null
  carriedCount: number
} {
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [carriedCount, setCarriedCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    let unsub: (() => void) | null = null
    setReport(null)
    setLoading(true)
    setError(null)
    setCarriedCount(0)

    ensureWeek(weekId)
      .then((res) => {
        if (cancelled) return
        setCarriedCount(res.carriedCount)
        setReport(res.report)
        unsub = subscribeWeek(
          weekId,
          (r) => {
            if (cancelled) return
            setReport(r)
            setLoading(false)
          },
          (e) => {
            if (cancelled) return
            setError(e instanceof Error ? e : new Error(String(e)))
            setLoading(false)
          },
        )
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e : new Error(String(e)))
        setLoading(false)
      })

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [weekId])

  return { report, loading, error, carriedCount }
}
