'use client'

import React, { useState, useRef, useMemo, useEffect } from 'react'
import { Plus, SlidersHorizontal, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ADMIN_EMAIL, useRole } from '@/hooks/useRole'
import { useStaff } from '@/hooks/useStaff'
import { createTask } from '@/lib/tasks/mutations'
import { periodEndTimestamp } from '@/lib/tasks/weekly-bridge'
import { formatDMY } from '@/lib/weekly-report/period'
import type { ISODate } from '@/types/weekly-report'
import { TaskCreateDrawer } from './TaskCreateDrawer'

export interface TaskQuickAddProps {
  defaultDueDate: ISODate
  onCreated?: (taskId: string) => void
}

export function TaskQuickAdd({ defaultDueDate, onCreated }: TaskQuickAddProps) {
  const { isAdmin, staffId, staffName } = useRole()
  const { staff: staffList } = useStaff()

  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const matchedStaff = useMemo(() => {
    return staffList.find(
      (s) =>
        s.isActive &&
        (s.id === staffId ||
          (s as { staffId?: string }).staffId === staffId ||
          (isAdmin &&
            (s.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() ||
              s.organizationRole === 'admin')))
    )
  }, [staffList, staffId, isAdmin])

  const defaultAssigneeId = matchedStaff?.id || staffId || 'admin'
  const defaultAssigneeName = matchedStaff
    ? matchedStaff.shortName || matchedStaff.fullName
    : staffName || 'Admin'
  const defaultDeptId = matchedStaff?.primaryDepartmentId ?? null

  const showSuccessFeedback = (message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setFeedback({ type: 'success', message })
    timerRef.current = setTimeout(() => {
      setFeedback(null)
    }, 2500)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || submitting) return

    setSubmitting(true)
    setFeedback(null)
    try {
      const taskId = await createTask(
        {
          title: trimmed,
          priority: 'normal',
          dueDate: periodEndTimestamp(defaultDueDate),
          assigneeId: defaultAssigneeId,
          assigneeName: defaultAssigneeName,
          assigneeDepartmentId: defaultDeptId,
          departmentId: defaultDeptId || undefined,
          source: 'manual',
        },
        defaultAssigneeId,
        defaultAssigneeName
      )
      setTitle('')
      showSuccessFeedback('Đã tạo công việc')
      onCreated?.(taskId)
      requestAnimationFrame(() => inputRef.current?.focus())
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tạo công việc'
      setFeedback({ type: 'error', message: msg })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white border border-slate-200 rounded-xl p-2 shadow-2xs focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all"
      >
        <div className="flex-1 min-w-0 flex items-center gap-2 px-1">
          <Plus className="w-4 h-4 text-blue-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (feedback?.type === 'error') setFeedback(null)
            }}
            placeholder={`Thêm việc nhanh — gõ tiêu đề rồi nhấn Enter (hạn ${formatDMY(defaultDueDate)})…`}
            aria-label="Thêm công việc nhanh"
            disabled={submitting}
            className="w-full min-h-[44px] bg-transparent text-base text-slate-900 placeholder:text-slate-400 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0 justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={!title.trim() || submitting}
            className="min-h-[44px] h-11 sm:h-9 sm:min-h-[38px] px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            Thêm
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDrawerOpen(true)}
            className="min-h-[44px] h-11 sm:h-9 sm:min-h-[38px] px-3 text-slate-700 border-slate-200 hover:bg-slate-50 text-sm font-medium"
          >
            <SlidersHorizontal className="w-4 h-4 mr-1.5 text-slate-500" />
            Chi tiết
          </Button>
        </div>
      </form>

      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg ${
            feedback.type === 'success'
              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
              : 'text-red-700 bg-red-50 border border-red-200 font-medium'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <TaskCreateDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        initialData={{
          title: title.trim(),
          dueDate: defaultDueDate,
          assigneeId: matchedStaff?.id || '',
          priority: 'normal',
        }}
        onSuccess={(taskId) => {
          setTitle('')
          showSuccessFeedback('Đã tạo công việc')
          onCreated?.(taskId)
        }}
      />
    </div>
  )
}
