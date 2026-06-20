import { SearchClient } from '@/components/search/SearchClient'

export const metadata = { title: 'Tìm kiếm' }

export default function SearchPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Tìm kiếm</h1>
      <SearchClient />
    </div>
  )
}
