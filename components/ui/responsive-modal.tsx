'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ResponsiveModalProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export function ResponsiveModal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: ResponsiveModalProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 transition-opacity" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex flex-col w-full max-h-[92dvh] overflow-y-auto bg-white rounded-t-2xl shadow-xl border-t border-slate-200 focus:outline-none',
            'sm:inset-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:max-w-lg sm:max-h-[90dvh] sm:rounded-2xl sm:border',
            className
          )}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2.5 bg-white border-b border-slate-200 shrink-0">
            <DialogPrimitive.Title className="text-base font-semibold text-slate-900 truncate">
              {title || 'Hộp thoại'}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              type="button"
              aria-label="Đóng"
              className="tap -mr-1 w-11 h-11 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <X className="w-5 h-5" />
              <span className="sr-only">Đóng</span>
            </DialogPrimitive.Close>
          </div>

          <div className={cn('flex-1 p-4', !footer && 'safe-bottom')}>
            {children}
          </div>

          {footer && (
            <div className="sticky bottom-0 z-10 px-4 pt-3 bg-white border-t border-slate-200 shrink-0 safe-bottom">
              <div className="pb-3">{footer}</div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
