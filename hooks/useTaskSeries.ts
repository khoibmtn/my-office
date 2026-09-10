'use client'

import { useState, useEffect } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { queryActiveSeries, querySeriesByDepartment } from '@/lib/tasks/series'
import type { TaskSeries } from '@/types/tasks'

interface UseTaskSeriesOptions {
  departmentId?: string
}

export function useTaskSeries(opts: UseTaskSeriesOptions = {}) {
  const [seriesList, setSeriesList] = useState<TaskSeries[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = opts.departmentId
      ? querySeriesByDepartment(opts.departmentId)
      : queryActiveSeries()

    const unsubscribe = onSnapshot(q, (snap) => {
      const items = snap.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((s: any) => !s.deletedAt) as TaskSeries[]
      setSeriesList(items)
      setLoading(false)
    }, (err) => {
      console.error('TaskSeries subscription error:', err)
      setLoading(false)
    })

    return unsubscribe
  }, [opts.departmentId])

  return { seriesList, loading }
}
