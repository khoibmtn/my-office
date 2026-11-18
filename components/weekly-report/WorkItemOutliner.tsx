'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  IndentDecrease,
  IndentIncrease,
  Pin,
  Plus,
  Trash2,
} from 'lucide-react'
import { outlineReducer, type OutlineAction } from '@/lib/weekly-report/outline'
import type { WorkItem } from '@/types/weekly-report'

export interface WorkItemOutlinerProps {
  items: WorkItem[]
  onChange: (items: WorkItem[]) => void
  editable?: boolean
}

function collectIds(list: WorkItem[]): string[] {
  const ids: string[] = []
  for (const item of list) {
    ids.push(item.id)
    for (const child of item.children) {
      ids.push(child.id)
    }
  }
  return ids
}

function autoResizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

export function WorkItemOutliner({
  items,
  onChange,
  editable = true,
}: WorkItemOutlinerProps) {
  const inputRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map())
  // Mobile: show the row toolbar only for the row being edited (always visible from sm up)
  const [activeId, setActiveId] = useState<string | null>(null)
  const pendingFocusIdRef = useRef<string | null>(null)

  const setInputRef = (id: string) => (el: HTMLTextAreaElement | null) => {
    if (el) {
      inputRefs.current.set(id, el)
      autoResizeTextarea(el)
    } else {
      inputRefs.current.delete(id)
    }
  }

  useEffect(() => {
    const targetId = pendingFocusIdRef.current
    if (!targetId) return
    pendingFocusIdRef.current = null
    const el = inputRefs.current.get(targetId)
    if (el) {
      el.focus()
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
  }, [items])

  useLayoutEffect(() => {
    inputRefs.current.forEach((el) => autoResizeTextarea(el))
  }, [items])

  // Re-measure when the column width changes (sidebar, window resize, fonts loaded)
  useEffect(() => {
    const resizeAll = () => inputRefs.current.forEach((el) => autoResizeTextarea(el))
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resizeAll) : null
    inputRefs.current.forEach((el) => el && ro?.observe(el))
    document.fonts?.ready.then(resizeAll).catch(() => {})
    return () => ro?.disconnect()
  }, [items])

  const dispatch = (action: OutlineAction) => {
    if (!editable) return
    const next = outlineReducer(items, action)

    if (action.type === 'add') {
      const beforeIds = new Set(collectIds(items))
      const createdId = collectIds(next).find((id) => !beforeIds.has(id))
      if (createdId) pendingFocusIdRef.current = createdId
    } else if (action.type === 'addChild') {
      const beforeIds = new Set(collectIds(items))
      const createdId = collectIds(next).find((id) => !beforeIds.has(id))
      if (createdId) pendingFocusIdRef.current = createdId
    } else if (
      action.type === 'indent' ||
      action.type === 'outdent' ||
      action.type === 'moveUp' ||
      action.type === 'moveDown'
    ) {
      pendingFocusIdRef.current = action.id
    }

    onChange(next)
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    meta: {
      id: string
      text: string
      isChild: boolean
      topIndex: number
    },
  ) => {
    if (!editable || e.nativeEvent.isComposing) return

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      dispatch({ type: 'add', afterId: meta.id })
      return
    }

    if (e.key === 'Backspace' && meta.text === '') {
      e.preventDefault()
      const flat = collectIds(items)
      const idx = flat.indexOf(meta.id)
      const fallbackId = idx > 0 ? flat[idx - 1] : flat[idx + 1] ?? null
      if (fallbackId) pendingFocusIdRef.current = fallbackId
      dispatch({ type: 'remove', id: meta.id })
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        if (meta.isChild) dispatch({ type: 'outdent', id: meta.id })
      } else {
        if (!meta.isChild && meta.topIndex > 0) {
          dispatch({ type: 'indent', id: meta.id })
        }
      }
      return
    }

    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      dispatch({ type: e.key === 'ArrowUp' ? 'moveUp' : 'moveDown', id: meta.id })
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'h') {
      e.preventDefault()
      dispatch({ type: 'toggleHighlight', id: meta.id })
    }
  }

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-800">
            Chưa có dòng công việc nào trong tuần này.
          </p>
          <p className="mt-1 text-slate-600">
            Thêm các đầu việc đã triển khai trong tuần (có thể ghim việc thường xuyên để tự mang sang tuần sau hoặc đưa từ cột Gợi ý Công việc).
          </p>
          {editable && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'add', text: '' })}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 min-h-[44px] sm:min-h-[32px] text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm dòng đầu tiên</span>
            </button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item, idx) => (
            <li
              key={item.id}
              className={`px-1 py-1 transition-colors hover:bg-slate-50 ${
                item.highlight ? 'bg-red-50/30' : ''
              }`}
            >
              {/* Cấp 1 */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-1">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span
                    aria-hidden="true"
                    className={`mt-2 h-1.5 w-1.5 rounded-full shrink-0 ${
                      item.highlight ? 'bg-red-700' : 'bg-slate-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <textarea
                      ref={setInputRef(item.id)}
                      onFocus={() => setActiveId(item.id)}
                      rows={1}
                      value={item.text}
                      disabled={!editable}
                      placeholder="Nhập nội dung công việc tuần qua…"
                      aria-label={`Dòng việc ${idx + 1}`}
                      onChange={(e) => {
                        autoResizeTextarea(e.currentTarget)
                        dispatch({ type: 'update', id: item.id, text: e.target.value })
                      }}
                      onKeyDown={(e) =>
                        handleKeyDown(e, {
                          id: item.id,
                          text: item.text,
                          isChild: false,
                          topIndex: idx,
                        })
                      }
                      className={`w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1 text-sm leading-normal focus:border-slate-300 focus:bg-white focus:outline-none disabled:cursor-default ${
                        item.highlight
                          ? 'font-bold text-red-700 placeholder:font-normal placeholder:text-red-300'
                          : 'text-slate-900 placeholder:text-slate-400'
                      }`}
                    />

                    {(item.pinned || item.source === 'carried' || item.source === 'task') && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 px-2">
                        {item.pinned && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            <Pin className="h-3 w-3" />
                            <span>Ghim tuần sau</span>
                          </span>
                        )}
                        {item.source === 'carried' && (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            Mang từ tuần trước
                          </span>
                        )}
                        {item.source === 'task' && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                            Từ Công việc
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {editable && (
                  <div className={`${activeId === item.id ? 'flex' : 'hidden'} sm:flex flex-wrap items-center gap-1 shrink-0 pl-4 sm:pl-0`}>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'togglePinned', id: item.id })}
                      aria-pressed={item.pinned}
                      title={item.pinned ? 'Bỏ ghim việc thường xuyên' : 'Ghim (việc thường xuyên, mang sang tuần sau)'}
                      aria-label={item.pinned ? 'Bỏ ghim' : 'Ghim việc thường xuyên'}
                      className={`inline-flex items-center justify-center rounded-md min-h-[44px] sm:min-h-[32px] min-w-[44px] sm:min-w-[32px] sm:min-h-[28px] sm:min-w-[28px] px-2 transition-colors ${
                        item.pinned
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Pin className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'toggleHighlight', id: item.id })}
                      aria-pressed={item.highlight}
                      title="Tô đỏ đậm (Ctrl/⌘+Shift+H)"
                      aria-label="Tô đỏ đậm"
                      className={`inline-flex items-center justify-center rounded-md min-h-[44px] sm:min-h-[32px] min-w-[44px] sm:min-w-[32px] sm:min-h-[28px] sm:min-w-[28px] px-2 text-xs font-bold transition-colors ${
                        item.highlight
                          ? 'bg-red-700 text-white'
                          : 'text-red-700 hover:bg-red-50 border border-slate-200'
                      }`}
                    >
                      Đỏ
                    </button>

                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => dispatch({ type: 'indent', id: item.id })}
                      title="Lùi thành ý con (Tab)"
                      aria-label="Lùi cấp"
                      className="inline-flex items-center justify-center rounded-md min-h-[44px] sm:min-h-[32px] min-w-[44px] sm:min-w-[32px] sm:min-h-[28px] sm:min-w-[28px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <IndentIncrease className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => dispatch({ type: 'moveUp', id: item.id })}
                      title="Đưa lên (Alt+↑)"
                      aria-label="Đưa lên"
                      className="inline-flex items-center justify-center rounded-md min-h-[44px] sm:min-h-[32px] min-w-[44px] sm:min-w-[32px] sm:min-h-[28px] sm:min-w-[28px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      disabled={idx === items.length - 1}
                      onClick={() => dispatch({ type: 'moveDown', id: item.id })}
                      title="Đưa xuống (Alt+↓)"
                      aria-label="Đưa xuống"
                      className="inline-flex items-center justify-center rounded-md min-h-[44px] sm:min-h-[32px] min-w-[44px] sm:min-w-[32px] sm:min-h-[28px] sm:min-w-[28px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'remove', id: item.id })}
                      title="Xoá dòng"
                      aria-label="Xoá dòng"
                      className="inline-flex items-center justify-center rounded-md min-h-[44px] sm:min-h-[32px] min-w-[44px] sm:min-w-[32px] sm:min-h-[28px] sm:min-w-[28px] text-slate-500 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Cấp 2 (dòng con) */}
              {item.children.length > 0 && (
                <ul className="mt-1 space-y-0.5 border-l-2 border-slate-200 pl-3 sm:pl-5 ml-2">
                  {item.children.map((child, childIdx) => (
                    <li
                      key={child.id}
                      className={`flex flex-col sm:flex-row sm:items-start gap-1.5 rounded-md p-1.5 ${
                        child.highlight ? 'bg-red-50/60' : 'bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <span
                          aria-hidden="true"
                          className={`mt-2 h-1.5 w-1.5 rounded-full border shrink-0 ${
                            child.highlight
                              ? 'border-red-700 bg-red-700'
                              : 'border-slate-500 bg-white'
                          }`}
                        />
                        <textarea
                          ref={setInputRef(child.id)}
                          onFocus={() => setActiveId(child.id)}
                          rows={1}
                          value={child.text}
                          disabled={!editable}
                          placeholder="Ý chi tiết…"
                          aria-label={`Ý con ${childIdx + 1} của dòng ${idx + 1}`}
                          onChange={(e) => {
                            autoResizeTextarea(e.currentTarget)
                            dispatch({ type: 'update', id: child.id, text: e.target.value })
                          }}
                          onKeyDown={(e) =>
                            handleKeyDown(e, {
                              id: child.id,
                              text: child.text,
                              isChild: true,
                              topIndex: idx,
                            })
                          }
                          className={`w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1 text-sm leading-relaxed focus:border-slate-300 focus:bg-white focus:outline-none disabled:cursor-default ${
                            child.highlight
                              ? 'font-bold text-red-700 placeholder:font-normal placeholder:text-red-300'
                              : 'text-slate-800 placeholder:text-slate-400'
                          }`}
                        />
                      </div>

                      {editable && (
                        <div className={`${activeId === child.id ? 'flex' : 'hidden'} sm:flex flex-wrap items-center gap-1 shrink-0 pl-3 sm:pl-0`}>
                          <button
                            type="button"
                            onClick={() => dispatch({ type: 'toggleHighlight', id: child.id })}
                            aria-pressed={child.highlight}
                            title="Tô đỏ đậm (Ctrl/⌘+Shift+H)"
                            aria-label="Tô đỏ đậm ý con"
                            className={`inline-flex items-center justify-center rounded-md min-h-[44px] sm:min-h-[32px] min-w-[44px] sm:min-w-[32px] sm:min-h-[28px] sm:min-w-[28px] px-2 text-xs font-bold transition-colors ${
                              child.highlight
                                ? 'bg-red-700 text-white'
                                : 'text-red-700 hover:bg-red-50 border border-slate-200 bg-white'
                            }`}
                          >
                            Đỏ
                          </button>

                          <button
                            type="button"
                            onClick={() => dispatch({ type: 'outdent', id: child.id })}
                            title="Ra cấp chính (Shift+Tab)"
                            aria-label="Ra cấp chính"
                            className="inline-flex items-center justify-center rounded-md min-h-[44px] sm:min-h-[32px] min-w-[44px] sm:min-w-[32px] sm:min-h-[28px] sm:min-w-[28px] text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                          >
                            <IndentDecrease className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            disabled={childIdx === 0}
                            onClick={() => dispatch({ type: 'moveUp', id: child.id })}
                            title="Đưa lên (Alt+↑)"
                            aria-label="Đưa ý con lên"
                            className="inline-flex items-center justify-center rounded-md min-h-[44px] sm:min-h-[32px] min-w-[44px] sm:min-w-[32px] sm:min-h-[28px] sm:min-w-[28px] text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            disabled={childIdx === item.children.length - 1}
                            onClick={() => dispatch({ type: 'moveDown', id: child.id })}
                            title="Đưa xuống (Alt+↓)"
                            aria-label="Đưa ý con xuống"
                            className="inline-flex items-center justify-center rounded-md min-h-[44px] sm:min-h-[32px] min-w-[44px] sm:min-w-[32px] sm:min-h-[28px] sm:min-w-[28px] text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => dispatch({ type: 'remove', id: child.id })}
                            title="Xoá ý con"
                            aria-label="Xoá ý con"
                            className="inline-flex items-center justify-center rounded-md min-h-[44px] sm:min-h-[32px] min-w-[44px] sm:min-w-[32px] sm:min-h-[28px] sm:min-w-[28px] text-slate-500 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => dispatch({ type: 'add', text: '' })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 min-h-[44px] sm:min-h-[32px] text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm dòng</span>
          </button>

          <p className="hidden sm:block text-xs text-slate-500">
            Phím tắt: Enter thêm dòng · Tab / Shift+Tab lùi cấp · Alt+↑/↓ đổi thứ tự · Ctrl/⌘+Shift+H tô đỏ
          </p>
        </div>
      )}
    </div>
  )
}
