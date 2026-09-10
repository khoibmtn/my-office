'use client'

import { useState, useEffect } from 'react'
import { fetchOrCreateDefaultTemplates } from '@/lib/tasks/templates'
import type { TaskTemplate } from '@/types/tasks'

export function useTaskTemplates() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrCreateDefaultTemplates()
      .then((items) => {
        setTemplates(items)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Fetch templates error:', err)
        setLoading(false)
      })
  }, [])

  return { templates, loading }
}
