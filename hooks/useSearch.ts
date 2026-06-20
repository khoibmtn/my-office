'use client'

import { useState, useEffect, useRef } from 'react'
import { searchClient, INDEX_NAME } from '@/lib/algolia'

export type AlgoliaHit = {
  objectID: string
  title: string
  status: string
  assignee: string
  deadline: number | null
  tags: string[]
  attachmentCount: number
  _highlightResult?: { title?: { value: string } }
}

export type SearchFilters = {
  status?: string[]
  assignee?: string
  deadlineFrom?: number
  deadlineTo?: number
}

function buildFilters(filters?: SearchFilters): string {
  if (!filters) return ''
  const parts: string[] = []
  if (filters.status?.length) {
    parts.push('(' + filters.status.map((s) => `status:${s}`).join(' OR ') + ')')
  }
  if (filters.assignee) parts.push(`assignee:${filters.assignee}`)
  if (filters.deadlineFrom != null) parts.push(`deadline >= ${filters.deadlineFrom}`)
  if (filters.deadlineTo != null) parts.push(`deadline <= ${filters.deadlineTo}`)
  return parts.join(' AND ')
}

export function useSearch(
  query: string,
  filters?: SearchFilters
): { hits: AlgoliaHit[]; loading: boolean } {
  const [hits, setHits] = useState<AlgoliaHit[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!query.trim()) {
      setHits([])
      setLoading(false)
      return
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const client = searchClient()
        const result = await client.search<AlgoliaHit>({
          requests: [{ indexName: INDEX_NAME, query, filters: buildFilters(filters) }],
        })
        setHits((result.results[0] as { hits: AlgoliaHit[] }).hits)
      } catch (e) {
        console.error('useSearch error:', e)
        setHits([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, JSON.stringify(filters)]) // eslint-disable-line react-hooks/exhaustive-deps

  return { hits, loading }
}
