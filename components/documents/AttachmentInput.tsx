'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AttachmentInput as AttachmentInputItem } from '@/types'
import { X, Plus, Eye, ExternalLink } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { parseFileNameFromUrl } from '@/lib/utils'

interface Props {
  value: (AttachmentInputItem & { id: string })[]
  onChange: (items: (AttachmentInputItem & { id: string })[]) => void
  onPreview?: (url: string, title?: string, id?: string) => void
  activePreviewId?: string | null
}

export function AttachmentInput({ value, onChange, onPreview, activePreviewId }: Props) {
  const addRow = () =>
    onChange([...value, { id: uuid(), title: '', originalLink: '' }])

  const removeRow = (id: string) =>
    onChange(value.filter((item) => item.id !== id))

  const updateRowUrl = (id: string, val: string) =>
    onChange(value.map((item) => (item.id === id ? { ...item, originalLink: val, title: parseFileNameFromUrl(val) } : item)))

  return (
    <div className="flex flex-col gap-2">
      {value.map((item, index) => {
        const isActive = activePreviewId === item.id
        return (
          <div key={item.id} className="flex items-center gap-1.5">
            <Input
              placeholder={`Link đính kèm ${index + 1} (Drive / URL)`}
              value={item.originalLink}
              onChange={(e) => updateRowUrl(item.id, e.target.value)}
              className="flex-1 h-9 text-xs"
            />
            {item.originalLink && onPreview && (
              <Button
                type="button"
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPreview(item.originalLink, item.title || `Đính kèm ${index + 1}`, item.id)}
                className={`h-9 px-2 text-xs shrink-0 font-medium ${
                  isActive
                    ? 'bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-2xs border border-blue-600'
                    : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                }`}
                title={isActive ? 'Đang xem file này (bấm để đóng xem trước)' : 'Xem trước file này'}
              >
                <Eye className={`h-3.5 w-3.5 mr-1 ${isActive ? 'text-white' : ''}`} />
                {isActive ? 'Đang xem' : 'Xem'}
              </Button>
            )}
            {item.originalLink && (
              <a
                href={item.originalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 shrink-0 transition-colors"
                title="Mở trong tab mới"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Xóa đính kèm"
              disabled={value.length <= 1}
              onClick={() => removeRow(item.id)}
              className="h-9 w-9 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        className="w-fit text-xs h-8 border-dashed border-slate-300 text-slate-600 hover:text-blue-600 hover:border-blue-400 mt-0.5"
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Thêm đính kèm
      </Button>
    </div>
  )
}
