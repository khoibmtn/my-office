'use client'

import { useState, useEffect } from 'react'
import { ensureAuth } from '@/lib/firebase'
import { subscribeDepartments } from '@/lib/departments'
import type { Department } from '@/types/departments'

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub: (() => void) | null = null

    ensureAuth().then(() => {
      unsub = subscribeDepartments(
        (depts) => {
          setDepartments(depts)
          setLoading(false)
        },
        () => setLoading(false)
      )
    }).catch(() => setLoading(false))

    return () => { if (unsub) unsub() }
  }, [])

  return { departments, loading }
}
