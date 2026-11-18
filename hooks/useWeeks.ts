'use client'

import { useEffect, useState } from 'react'
import { subscribeWeeks } from '@/lib/weekly-report/firestore'
import type { WeeklyReport } from '@/types/weekly-report'

export function useWeeks(): { weeks: WeeklyReport[]; loading: boolean } {
  const [weeks, setWeeks] = useState<WeeklyReport[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    return subscribeWeeks(
      (w) => { setWeeks(w); setLoading(false) },
      () => setLoading(false),
    )
  }, [])
  return { weeks, loading }
}
