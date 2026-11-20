'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ListPlus, X } from 'lucide-react'
import { newId } from '@/lib/weekly-report/outline'
import { formatDMY } from '@/lib/weekly-report/period'
import { lineKey, nextWeekLines } from '@/lib/weekly-report/next-week-lines'
import type { WorkItem } from '@/types/weekly-report'

export interface PrevNextWeekImportProps {
  /** weekId of the previous stored week (null if none). */
  prevWeekId: string | null
  /** Its "3. Tuần tới" content (Tiptap JSON string or plain text). */
  prevNextWeek: string | null | undefined
  workItems: WorkItem[]
  onChange: (items: WorkItem[]) => void
  editable: boolean
}

/**
 * Button "Lấy từ Tuần tới tuần trước": each paragraph / list item of last week's
 * "3. Tuần tới" becomes one Mục 1 row (nested list items → child rows). Lines already
 * present in Mục 1 are skipped, so clicking twice never duplicates.
 */
export function PrevNextWeekImport({ prevWeekId, prevNextWeek, workItems, onChange, editable }: PrevNextWeekImportProps) {
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => setNotice(null), [prevWeekId])

  const lines = useMemo(() => nextWeekLines(prevNextWeek), [prevNextWeek])
  const pending = useMemo(() => {
    const have = new Set(workItems.map((it) => lineKey(it.text)))
    return lines.filter((l) => !have.has(lineKey(l.text)))
  }, [lines, workItems])

  if (!editable || !prevWeekId || lines.length === 0) {
    return notice ? <Notice text={notice} onClose={() => setNotice(null)} /> : null
  }

  const handleClick = () => {
    if (!pending.length) {
      setNotice('Các dòng của mục "Tuần tới" tuần trước đã có trong Mục 1.')
      return
    }
    const added: WorkItem[] = pending.map((l, i) => ({
      id: newId(),
      text: l.text,
      highlight: l.highlight,
      pinned: false,
      order: workItems.length + i,
      source: 'manual',
      taskId: null,
      children: l.children.map((c, j) => ({ id: newId(), text: c.text, highlight: c.highlight, order: j })),
    }))
    onChange([...workItems, ...added])
    setNotice(`Đã thêm ${added.length} dòng từ "Tuần tới" của giao ban ${formatDMY(prevWeekId)}. Sửa lại thành việc đã làm nếu cần.`)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={`Chuyển từng dòng mục "3. Tuần tới" của giao ban ${formatDMY(prevWeekId)} thành dòng việc đã làm`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 min-h-[44px] sm:min-h-[30px] text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <ListPlus className="h-3.5 w-3.5" />
        <span>Lấy từ Tuần tới tuần trước</span>
        {pending.length > 0 && (
          <span className="rounded bg-blue-50 px-1.5 text-[11px] font-semibold tabular-nums text-blue-700">{pending.length}</span>
        )}
      </button>
      {notice && <Notice text={notice} onClose={() => setNotice(null)} />}
    </>
  )
}

function Notice({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div role="status" className="flex w-full basis-full items-start justify-between gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">
      <span>{text}</span>
      <button type="button" onClick={onClose} aria-label="Đóng thông báo" className="shrink-0 text-blue-700 hover:text-blue-900">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
