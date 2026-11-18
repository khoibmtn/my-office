'use client'

import { useEffect, useState } from 'react'
import { subscribeAdvisoryBySource, subscribeAdvisoryByWeek } from '@/lib/weekly-report/firestore'
import type { AdvisoryDoc } from '@/types/weekly-report'

type Params = { weekId: string } | { sourceDocumentId: string }

export function useAdvisoryDocs(params: Params): { docs: AdvisoryDoc[]; loading: boolean } {
  const weekId = 'weekId' in params ? params.weekId : null
  const sourceId = 'sourceDocumentId' in params ? params.sourceDocumentId : null
  const [docs, setDocs] = useState<AdvisoryDoc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const onData = (d: AdvisoryDoc[]) => { setDocs(d); setLoading(false) }
    const onErr = () => setLoading(false)
    if (weekId) return subscribeAdvisoryByWeek(weekId, onData, onErr)
    if (sourceId) return subscribeAdvisoryBySource(sourceId, onData, onErr)
    setDocs([])
    setLoading(false)
    return undefined
  }, [weekId, sourceId])

  return { docs, loading }
}
