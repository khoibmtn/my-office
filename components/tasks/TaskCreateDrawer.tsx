'use client'

import React, { useEffect, useMemo } from 'react'
import { X, ClipboardList, FileText } from 'lucide-react'
import type { Document } from '@/types'
import { TaskCreateForm, TaskCreateFormProps } from './TaskCreateForm'

function toDateString(val: any): string {
  if (!val) return ''
  try {
    const d = typeof val?.toDate === 'function' ? val.toDate() : val instanceof Date ? val : new Date(val)
    if (isNaN(d.getTime())) return ''
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return ''
  }
}

export interface TaskCreateDrawerProps {
  isOpen: boolean
  onClose: () => void
  document?: Document | null
  initialData?: TaskCreateFormProps['initialData']
  onSuccess?: (taskId: string) => void
}

export function TaskCreateDrawer({
  isOpen,
  onClose,
  document,
  initialData,
  onSuccess,
}: TaskCreateDrawerProps) {
  // Close on ESC
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Map document to initial data
  const mergedInitialData = useMemo(() => {
    if (!document) return initialData

    return {
      title: document.title || document.docNumber || initialData?.title || '',
      description: initialData?.description || (document.notes ? `Ghi chú: ${document.notes}` : (document.task ? `Nội dung: ${document.task}` : '')),
      priority: (document.priority as any) || initialData?.priority || 'normal',
      dueDate: document.deadline ? toDateString(document.deadline) : initialData?.dueDate || '',
      assigneeId: document.assigneeId || initialData?.assigneeId || '',
      collaboratorIds: document.coAssigneeIds || initialData?.collaboratorIds || [],
      departmentId: initialData?.departmentId || '',
      cooperatingDepartmentIds: initialData?.cooperatingDepartmentIds || [],
      dossierIds: document.dossierIds || initialData?.dossierIds || [],
      documentIds: document.id ? [document.id] : initialData?.documentIds || [],
      tagIds: document.tagIds || initialData?.tagIds || [],
      subtasks: initialData?.subtasks || [],
    }
  }, [document, initialData])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-3xl bg-slate-50 shadow-2xl border-l border-slate-200 flex flex-col h-full animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900 leading-tight">
                  Tạo công việc từ văn bản
                </h2>
                {document && (
                  <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                    <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-700">{document.docNumber || 'Văn bản'}</span>
                    {document.title && <span>- {document.title}</span>}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Đóng (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            <TaskCreateForm
              key={document?.id || 'new-drawer'}
              initialData={mergedInitialData}
              isDrawer={true}
              titleText={document ? `Tạo công việc từ: ${document.docNumber || document.title}` : 'Tạo công việc'}
              onSuccess={(taskId) => {
                if (onSuccess) onSuccess(taskId)
                onClose()
              }}
              onCancel={onClose}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
