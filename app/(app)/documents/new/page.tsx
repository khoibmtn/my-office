import { DocumentForm } from '@/components/documents/DocumentForm'

export default function NewDocumentPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-xl font-semibold mb-6">Thêm văn bản</h1>
      <DocumentForm />
    </div>
  )
}
