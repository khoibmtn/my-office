'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { useSearch } from '@/hooks/useSearch'
import type { SearchFilters } from '@/hooks/useSearch'
import { SearchFilters as SearchFiltersPanel } from './SearchFilters'
import { SearchResultCard } from './SearchResultCard'

export function SearchClient() {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<SearchFilters>({})
  const { hits, loading } = useSearch(query, filters)

  return (
    <div className="space-y-4">
      <Input
        placeholder="Tìm kiếm văn bản..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full text-base"
      />
      <div className="flex gap-4 items-start">
        <SearchFiltersPanel filters={filters} onChange={setFilters} />
        <div className="flex-1 space-y-3">
          {!query && (
            <p className="text-sm text-slate-500">Nhập từ khóa để tìm kiếm</p>
          )}
          {query && loading && (
            <p className="text-sm text-slate-500">Đang tìm...</p>
          )}
          {query && !loading && hits.length === 0 && (
            <p className="text-sm text-slate-500">Không tìm thấy kết quả</p>
          )}
          {query && !loading && hits.length > 0 && (
            <>
              <p className="text-sm text-slate-600">
                {hits.length} kết quả cho &ldquo;{query}&rdquo;
              </p>
              {hits.map((hit) => (
                <SearchResultCard key={hit.objectID} hit={hit} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
