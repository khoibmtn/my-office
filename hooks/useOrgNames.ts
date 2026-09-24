'use client'

import { useState, useEffect } from 'react'
import { subscribeOrgNames, type OrgName } from '@/lib/orgNames'

export function useOrgNames() {
  const [orgNames, setOrgNames] = useState<OrgName[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = subscribeOrgNames(
      (names) => { setOrgNames(names); setLoading(false) },
      () => setLoading(false)
    )
    return unsub
  }, [])

  return { orgNames, loading }
}
