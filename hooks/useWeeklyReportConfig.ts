'use client'

import { useEffect, useState } from 'react'
import { subscribeConfig } from '@/lib/weekly-report/firestore'
import { DEFAULT_WEEKLY_REPORT_CONFIG, type WeeklyReportConfig } from '@/types/weekly-report'

export function useWeeklyReportConfig(): { config: WeeklyReportConfig; loading: boolean } {
  const [config, setConfig] = useState<WeeklyReportConfig>(DEFAULT_WEEKLY_REPORT_CONFIG)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    return subscribeConfig(
      (c) => { setConfig(c); setLoading(false) },
      () => setLoading(false),
    )
  }, [])
  return { config, loading }
}
