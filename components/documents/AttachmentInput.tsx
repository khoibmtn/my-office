'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AttachmentInput as AttachmentInputItem } from '@/types'
import { X, Plus } from 'lucide-react'
import { v4 as uuid } from 'uuid'

interface Props {
  value: (AttachmentInputItem & { id: string })[]
  onChange: (items: (AttachmentInputItem & { id: string })[]) => void
}

export function AttachmentInput({ value, onChange }: Props) {
  const addRow = () =>
    onChange([...value, { id: uuid(), title: '', originalLink: '' }])

  const removeRow = (id: string) =>
    onChange(value.filter((item) => item.id !== id))

  const updateRow = (id: string, field: keyof AttachmentInputItem, val: string) =>
    onChange(value.map((item) => (item.id === id ? { ...item, [field]: val } : item)))

  return (
    <div className="flex flex-col gap-2">
      {value.map((item) => (
        <div key={item.id} className="flex gap-2">
          <Input
            placeholder="Tên đính kèm"
            value={item.title}
            onChange={(e) => updateRow(item.id, 'title', e.target.value)}
          />
          <Input
            placeholder="Link file đính kèm"
            value={item.originalLink}
            onChange={(e) => updateRow(item.id, 'originalLink', e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Xóa đính kèm"
            disabled={value.length <= 1}
            onClick={() => removeRow(item.id)}
            className="min-h-[44px] min-w-[44px]"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="link" onClick={addRow} className="w-fit p-0">
        <Plus className="h-4 w-4 mr-1" />
        + Thêm đính kèm
      </Button>
    </div>
  )
}
