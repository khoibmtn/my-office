'use client'

import React, { useState } from 'react'
import { FilePlus2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRole } from '@/hooks/useRole'
import { AdvisoryForm } from './AdvisoryForm'
import type { Document } from '@/types'

export interface AdvisoryButtonProps {
  document: Document
  label?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  onSaved?: (advisoryId: string) => void
}

export function AdvisoryButton({
  document,
  label = 'Tham mưu',
  variant = 'outline',
  size = 'sm',
  className = '',
  onSaved,
}: AdvisoryButtonProps) {
  const { isAdmin, loading } = useRole()
  const [open, setOpen] = useState(false)

  if (loading || !isAdmin) return null

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className={`min-h-[44px] sm:min-h-[36px] gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 ${className}`}
        title="Xử lý / Tham mưu văn bản"
      >
        <FilePlus2 className="w-4 h-4 shrink-0" />
        {size !== 'icon' && <span>{label}</span>}
      </Button>

      <AdvisoryForm
        open={open}
        onClose={() => setOpen(false)}
        sourceDocument={document}
        onSaved={onSaved}
      />
    </>
  )
}
