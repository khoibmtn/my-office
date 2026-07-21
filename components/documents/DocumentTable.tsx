'use client'

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Loader2, Trash2, Eye, RefreshCw, CheckCircle2, Clock, CircleDot, Search, Pencil, ArrowUpDown, ClipboardCopy, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { Document, DocumentStatus } from '@/types'
import { submitDocumentWithDriveCopy, deleteDocument, updateDocument } from '@/lib/firestore'
import { DocumentModal } from './DocumentModal'
import Link from 'next/link'
import { useStaff } from '@/hooks/useStaff'
import { useSettings } from '@/hooks/useSettings'
import { usePermissions } from '@/hooks/usePermissions'
import { useRole } from '@/hooks/useRole'

// === Components ===

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return <>{text}</>
  const regex = new RegExp(`(${words.join('|')})`, 'gi')
  const parts = String(text).split(regex)
  return (
    <>
      {parts.map((part, i) =>
        words.some(w => w === part.toLowerCase()) ? (
          <mark key={i} className="bg-yellow-200 text-slate-900 rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

function ThResizable({ width, minWidth = 30, onWidthChange, children, className, onClick }: any) {
  const thRef = useRef<HTMLTableCellElement>(null)
  
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.pageX
    const startWidth = thRef.current?.offsetWidth || width

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(minWidth, startWidth + (moveEvent.pageX - startX))
      if (thRef.current) {
        thRef.current.style.width = `${newWidth}px`
        thRef.current.style.minWidth = `${newWidth}px`
        thRef.current.style.maxWidth = `${newWidth}px`
      }
    }
    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      const finalWidth = Math.max(minWidth, startWidth + (upEvent.pageX - startX))
      onWidthChange(finalWidth)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <TableHead 
      ref={thRef} 
      className={`relative group ${className || ''}`} 
      style={{ width, minWidth: width, maxWidth: width }} 
      onClick={onClick}
    >
      {children}
      <div 
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-slate-400 opacity-0 group-hover:opacity-100 z-10 transition-opacity hidden lg:block"
        onMouseDown={handleMouseDown}
        onClick={(e) => e.stopPropagation()} 
      />
    </TableHead>
  )
}

// === Helpers ===

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatDate(ts: any): string {
  if (!ts) return '—'
  let d: Date
  if (typeof ts.toDate === 'function') d = ts.toDate()
  else if (ts instanceof Date) d = ts
  else if (typeof ts === 'string') {
    // Try parse "dd/mm/yyyy" or ISO
    const m = ts.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (m) return `${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[3]}`
    d = new Date(ts)
  }
  else if (ts.seconds) d = new Date(ts.seconds * 1000) // Firestore timestamp object
  else return '—'
  if (isNaN(d!.getTime())) return '—'
  return `${String(d!.getDate()).padStart(2, '0')}/${String(d!.getMonth() + 1).padStart(2, '0')}/${d!.getFullYear()}`
}

function formatDateShort(ts: any): string {
  if (!ts) return '—'
  let d: Date
  if (typeof ts.toDate === 'function') d = ts.toDate()
  else if (ts instanceof Date) d = ts
  else if (ts.seconds) d = new Date(ts.seconds * 1000)
  else return '—'
  if (isNaN(d!.getTime())) return '—'
  return `${String(d!.getDate()).padStart(2, '0')}/${String(d!.getMonth() + 1).padStart(2, '0')}`
}


function getDaysRemaining(ts: { toDate(): Date } | undefined): number | null {
  if (!ts) return null
  const now = new Date(); now.setHours(0,0,0,0)
  const dl = ts.toDate(); dl.setHours(0,0,0,0)
  return Math.ceil((dl.getTime() - now.getTime()) / 86400000)
}

function getDaysLabel(d: number | null): string {
  if (d === null) return '—'
  if (d < 0) return `Quá ${Math.abs(d)}d`
  if (d === 0) return 'Hôm nay!'
  return `${d} ngày`
}

// Determine effective display status based on deadline
function getEffectiveStatus(doc: Document, overrideStatus?: string): { icon: React.ReactNode; label: string; cls: string } {
  const status = overrideStatus || doc.status
  if (status === 'completed') return {
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: 'Hoàn thành', cls: 'status-completed'
  }
  if (status === 'uploading') return {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    label: 'Đang tải...', cls: 'status-uploading'
  }
  if (doc.assignee) return {
    icon: <CircleDot className="h-4 w-4" />,
    label: 'Đang xử lý', cls: 'status-progress'
  }
  return {
    icon: <Clock className="h-4 w-4" />,
    label: 'Chưa giao', cls: 'status-pending'
  }
}

// Helper: get reporting week range (Fri-Thu)
function getReportingWeekRange(): { from: Date; to: Date } {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const day = now.getDay() // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  // Find previous Friday: if today is Fri(5), go back 7 days; else go back to last Fri
  const daysSinceFri = day >= 5 ? day - 5 : day + 2
  const prevFri = new Date(now)
  prevFri.setDate(now.getDate() - daysSinceFri)
  if (day === 5) prevFri.setDate(now.getDate() - 7) // If today is Friday, prev Friday
  // Thu = prevFri + 6 days
  const nextThu = new Date(prevFri)
  nextThu.setDate(prevFri.getDate() + 6)
  nextThu.setHours(23, 59, 59, 999)
  return { from: prevFri, to: nextThu }
}

// Helper: get last month range
function getLastMonthRange(): { from: Date; to: Date } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
  return { from, to }
}

// Helper: toDateSafe
function toDateSafe(ts: any): Date | null {
  if (!ts) return null
  if (typeof ts.toDate === 'function') return ts.toDate()
  if (ts instanceof Date) return ts
  if (ts.seconds) return new Date(ts.seconds * 1000)
  return null
}

// === Mobile Card Component ===
function DocumentCard({
  doc, idx, days, eff, rowClass, prio, searchQuery,
  onToggleComplete, onView, onDelete, onRetry, onAssign,
  retrying, deleting, staffList, perms, currentStaffId, getStaffName, settings,
}: {
  doc: Document; idx: number; days: number | null;
  eff: { icon: React.ReactNode; label: string; cls: string };
  rowClass: string; prio: { label: string; color: string } | null;
  searchQuery: string;
  onToggleComplete: (doc: Document) => void;
  onView: (id: string) => void;
  onDelete: (id: string, title: string) => void;
  onRetry: (doc: Document) => void;
  onAssign: (id: string, person: string) => void;
  retrying: string | null; deleting: string | null;
  staffList: any[]; perms: any; currentStaffId: string | null;
  getStaffName: (id: string | undefined) => string; settings: any;
}) {
  const urgencyColor = rowClass === 'row-overdue' ? settings.overdueColor
    : rowClass === 'row-expired' ? settings.expiredColor
    : rowClass === 'row-urgent1' ? settings.urgent1Color
    : rowClass === 'row-urgent2' ? settings.urgent2Color
    : rowClass === 'row-normal' ? settings.normalColor
    : rowClass === 'row-completed' ? settings.completedColor
    : '#e2e8f0'

  return (
    <div
      className="doc-card"
      style={{ borderLeftColor: urgencyColor }}
    >
      {/* Header: doc number + priority */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <div className="font-semibold text-slate-800 text-sm">
            <Highlight text={doc.docNumber || '—'} query={searchQuery} />
          </div>
          {doc.sender && (
            <div className="text-[11px] text-slate-400 italic truncate">
              <Highlight text={doc.sender} query={searchQuery} />
            </div>
          )}
        </div>
        {prio && doc.priority && doc.priority !== 'normal' && (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap shrink-0 ${prio.color}`}>
            {prio.label}
          </span>
        )}
      </div>

      {/* Title */}
      <div className="text-xs text-slate-700 mb-1.5 leading-relaxed">
        <Highlight text={doc.title} query={searchQuery} />
        {doc.attachments && doc.attachments.length > 0 && (
          <span className="text-slate-500 ml-1 font-medium whitespace-nowrap">
            ({doc.attachments.length} 📎)
          </span>
        )}
      </div>

      {doc.notes && (
        <div className="text-[11px] text-slate-500 italic mb-2 line-clamp-2" title={doc.notes}>
          📝 <Highlight text={doc.notes} query={searchQuery} />
        </div>
      )}

      {/* Metadata row */}
      <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-2.5 flex-wrap">
        <span className="flex items-center gap-1">
          📅 {formatDateShort(doc.issueDate)}
        </span>
        {days !== null && (
          <span className={`days-badge ${days <= 0 ? 'days-danger' : days === 1 ? 'days-warning' : days <= 3 ? 'days-caution' : ''}`}>
            ⏳ {getDaysLabel(days)}
          </span>
        )}
        <span className="flex items-center gap-1">
          👤 
          {perms.canAssignStaff ? (
            <select
              className="assign-select !w-auto !p-0 !bg-transparent font-medium focus:!bg-white"
              value={doc.assigneeId || ''}
              onChange={e => onAssign(doc.id, e.target.value)}
            >
              <option value="">Chưa giao</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.shortName}</option>)}
            </select>
          ) : (
            <span className="font-medium">{doc.assigneeId ? getStaffName(doc.assigneeId) : (doc.assignee || 'Chưa giao')}</span>
          )}
        </span>
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(perms.canToggleComplete || (perms.canCompleteAssigned && doc.assigneeId === currentStaffId)) ? (
          <button
            className={`status-chip ${eff.cls} !p-1.5 sm:!py-1 sm:!px-2`}
            onClick={() => onToggleComplete(doc)}
            title={doc.status === 'completed' ? 'Bấm để chuyển về trạng thái chờ' : 'Bấm để đánh dấu hoàn thành'}
          >
            {eff.icon}
          </button>
        ) : (
          <span className={`status-chip ${eff.cls} !p-1.5 sm:!py-1 sm:!px-2 opacity-60 cursor-default`}>
            {eff.icon}
          </span>
        )}

        <div className="flex-1" />

        {doc.status === 'upload_failed' && perms.canEditDocument ? (
          <Button size="sm" variant="outline" onClick={() => onRetry(doc)} disabled={retrying === doc.id}>
            {retrying === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
        ) : doc.status !== 'uploading' && (
          <>
            <button
              onClick={() => onView(doc.id)}
              className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Xem"
            >
              <Eye className="h-4 w-4" />
            </button>
            {perms.canEditDocument && (
              <Link
                href={`/documents/${doc.id}/edit`}
                className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                title="Sửa"
              >
                <Pencil className="h-4 w-4" />
              </Link>
            )}
          </>
        )}
        {perms.canDeleteDocument && (
          <button
            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            onClick={() => onDelete(doc.id, doc.title)}
            disabled={deleting === doc.id}
            title="Xóa"
          >
            {deleting === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        )}
      </div>

      {doc.completedDate && (() => {
        const cd = toDateSafe(doc.completedDate)
        if (!cd) return null
        return (
          <div className="text-[10px] italic mt-1.5">
            <span className="text-red-600">HT:</span>{' '}
            <span className="text-slate-500">{cd.toLocaleDateString('vi-VN')}</span>
          </div>
        )
      })()}
    </div>
  )
}

// === Pagination Component ===
function Pagination({
  currentPage, totalPages, pageSize, totalItems,
  onPageChange, onPageSizeChange,
}: {
  currentPage: number; totalPages: number; pageSize: number; totalItems: number;
  onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4 px-1 text-sm text-slate-500">
      <div className="flex items-center gap-2">
        <span className="text-xs">Hiển thị</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="pl-2 pr-7 py-1 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[10, 20, 50].map((n) => <option key={n} value={n}>{n} dòng</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs">Trang</span>
        <input
          type="text"
          inputMode="numeric"
          value={currentPage}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '')
            if (v === '') return
            const n = Math.min(Math.max(1, parseInt(v, 10)), totalPages)
            onPageChange(n)
          }}
          className="w-10 text-center py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-xs">/ {totalPages}</span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <span className="text-slate-400 text-xs tabular-nums">
        {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalItems)} / {totalItems} văn bản
      </span>
    </div>
  )
}

// === Main Component ===

export function DocumentTable({ documents }: { documents: Document[] }) {
  const { staff, getStaffName } = useStaff()
  const staffList = useMemo(() => staff.filter(s => s.isActive), [staff])
  const settings = useSettings()
  const perms = usePermissions()
  const { role, staffId: currentStaffId } = useRole()
  const [retrying, setRetrying] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [copyModalContent, setCopyModalContent] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('pending')
  const [badgeFilters, setBadgeFilters] = useState<string[]>([])
  const [priorityBadgeFilters, setPriorityBadgeFilters] = useState<string[]>([])
  const [staffBadgeFilter, setStaffBadgeFilter] = useState<string | null>(
    // Staff users: auto-filter to their assigned documents
    role === 'staff' && currentStaffId ? currentStaffId : null
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [timePeriod, setTimePeriod] = useState<string>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    stt: 36, issueDate: 90, docNumber: 120, title: 300, status: 110, deadline: 90, remaining: 70, assignee: 100, actions: 110
  })

  useEffect(() => {
    const saved = localStorage.getItem('docTableWidths')
    if (saved) {
      try { setColWidths(JSON.parse(saved)) } catch {}
    }
  }, [])

  const handleWidthChange = useCallback((key: string, w: number) => {
    setColWidths(prev => {
      const next = { ...prev, [key]: w }
      localStorage.setItem('docTableWidths', JSON.stringify(next))
      return next
    })
  }, [])

  // Word match helper
  const wordMatch = useCallback((text: string, query: string) => {
    const queryWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
    if (queryWords.length === 0) return true
    const t = String(text).toLowerCase()
    return queryWords.every(word => t.includes(word))
  }, [])

  // Compute period range
  const periodRange = useMemo((): { from: Date; to: Date } | null => {
    if (timePeriod === 'today') return null
    if (timePeriod === 'week') return getReportingWeekRange()
    if (timePeriod === 'last_month') return getLastMonthRange()
    if (timePeriod === 'custom' && customFrom && customTo) {
      const f = new Date(customFrom); f.setHours(0, 0, 0, 0)
      const t = new Date(customTo); t.setHours(23, 59, 59, 999)
      return { from: f, to: t }
    }
    return null
  }, [timePeriod, customFrom, customTo])

  // Get effective status for a doc given period range
  const getDocEffectiveStatus = useCallback((doc: Document): string => {
    if (!periodRange || timePeriod === 'today') return doc.status
    const completedD = toDateSafe(doc.completedDate)
    if (!completedD) return doc.status === 'completed' ? doc.status : (doc.assignee ? 'in_progress' : 'pending')
    if (completedD > periodRange.to) return doc.assignee ? 'in_progress' : 'pending'
    return 'completed'
  }, [periodRange, timePeriod])

  // Base docs for counting stats (before search and badge filters)
  const baseDocs = useMemo(() => {
    let result = documents
    
    // Time period filter
    if (timePeriod !== 'today' && periodRange) {
      const A = periodRange.from
      const B = periodRange.to
      result = result.filter(d => {
        const issueD = toDateSafe(d.issueDate)
        const completedD = toDateSafe(d.completedDate)
        if (!issueD || issueD > B) return false
        
        // At this point, issueD <= B.
        // Include if it's still pending (no completedDate) 
        // OR completed during/after the period (completedDate >= A)
        if (!completedD) return true
        if (completedD >= A) return true
        
        return false
      })
    }
    
    // Status filter (using effective status for period)
    if (filterStatus !== 'all') {
      result = result.filter(d => {
        const effSt = getDocEffectiveStatus(d)
        if (filterStatus === 'completed') return effSt === 'completed'
        if (filterStatus === 'pending') return effSt !== 'completed'
        return true
      })
    }
    return result
  }, [documents, filterStatus, timePeriod, periodRange, getDocEffectiveStatus])

  // Count stats (using effective status)
  const stats = useMemo(() => {
    let overdue = 0, expired = 0, urgent1 = 0, urgent2 = 0, normal = 0, completed = 0
    baseDocs.forEach(d => {
      const effSt = getDocEffectiveStatus(d)
      if (effSt === 'completed') { completed++; return }
      const days = getDaysRemaining(d.deadline)
      if (days === null) { /* no deadline */ }
      else if (days < 0) overdue++
      else if (days === 0) expired++
      else if (days >= 1 && days <= 3) urgent1++
      else if (days >= 4 && days <= 7) urgent2++
      else normal++
    })
    return { overdue, expired, urgent1, urgent2, normal, completed }
  }, [baseDocs, getDocEffectiveStatus])

  // Staff stats from baseDocs
  const staffStats = useMemo(() => {
    const counts: Record<string, number> = {}
    baseDocs.forEach(d => {
      const name = d.assigneeId ? getStaffName(d.assigneeId) : (d.assignee || '(Chưa giao)')
      if (!name) {
        counts['(Chưa giao)'] = (counts['(Chưa giao)'] || 0) + 1
      } else {
        counts[name] = (counts[name] || 0) + 1
      }
    })
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]))
  }, [baseDocs, getStaffName])

  // Priority stats from baseDocs
  const priorityStats = useMemo(() => {
    const counts: Record<string, number> = {}
    baseDocs.forEach(d => {
      const p = d.priority || 'normal'
      counts[p] = (counts[p] || 0) + 1
    })
    return counts
  }, [baseDocs])

  const filteredDocs = useMemo(() => {
    let result = baseDocs

    // Fuzzy search across all fields
    if (searchQuery.trim()) {
      result = result.filter(d => {
        const searchable = [
          d.title, d.docNumber, d.assignee, d.notes,
          d.sender, d.leader, formatDate(d.issueDate), formatDate(d.deadline),
          d.status, ...(d.tags || []),
        ].filter(Boolean).join(' ')
        return wordMatch(searchable, searchQuery)
      })
    }

    // Badge filters
    if (badgeFilters.length > 0) {
      result = result.filter(d => {
        const days = getDaysRemaining(d.deadline)
        return badgeFilters.some(bf => {
          if (bf === 'completed') return d.status === 'completed'
          if (d.status === 'completed') return false
          if (bf === 'overdue') return days !== null && days < 0
          if (bf === 'expired') return days !== null && days === 0
          if (bf === 'urgent1') return days !== null && days >= 1 && days <= 3
          if (bf === 'urgent2') return days !== null && days >= 4 && days <= 7
          if (bf === 'normal') return days === null || days > 7
          return false
        })
      })
    }

    // Priority badge filters
    if (priorityBadgeFilters.length > 0) {
      result = result.filter(d => priorityBadgeFilters.includes(d.priority || 'normal'))
    }

    // Staff badge filter
    if (staffBadgeFilter) {
      result = result.filter(d => {
        if (staffBadgeFilter === '(Chưa giao)') return !d.assignee && !d.assigneeId
        // Match by staffId or by display name
        const displayName = d.assigneeId ? getStaffName(d.assigneeId) : d.assignee
        return d.assigneeId === staffBadgeFilter || displayName === staffBadgeFilter
      })
    }

    // Sorting
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        if (sortConfig.key === 'remaining') {
          const daysA = getDaysRemaining(a.deadline)
          const daysB = getDaysRemaining(b.deadline)
          const valA = daysA === null ? Infinity : daysA
          const valB = daysB === null ? Infinity : daysB
          return sortConfig.direction === 'asc' ? valB - valA : valA - valB
        }

        let valA: any = (a as any)[sortConfig.key]
        let valB: any = (b as any)[sortConfig.key]

        if (sortConfig.key === 'issueDate' || sortConfig.key === 'deadline') {
          valA = valA?.toMillis ? valA.toMillis() : (valA ? new Date(valA).getTime() : 0)
          valB = valB?.toMillis ? valB.toMillis() : (valB ? new Date(valB).getTime() : 0)
        } else if (sortConfig.key === 'createdAt') {
          valA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0
          valB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    } else {
      // Default sort
      result = [...result].sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0
        return tB - tA
      })
    }

    return result
  }, [baseDocs, badgeFilters, priorityBadgeFilters, staffBadgeFilter, searchQuery, wordMatch, sortConfig])

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1) }, [searchQuery, badgeFilters, priorityBadgeFilters, staffBadgeFilter, filterStatus, timePeriod])

  // Pagination
  const showPagination = filteredDocs.length >= 10
  const totalPages = showPagination ? Math.max(1, Math.ceil(filteredDocs.length / pageSize)) : 1
  const safePage = Math.min(currentPage, totalPages)
  const pagedDocs = showPagination
    ? filteredDocs.slice((safePage - 1) * pageSize, safePage * pageSize)
    : filteredDocs

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const handleRetry = useCallback(async (doc: Document) => {
    setRetrying(doc.id)
    try {
      await submitDocumentWithDriveCopy(
        doc.id, doc.originalLink,
        (doc.attachments ?? []).map(({ title, originalLink }) => ({ title, originalLink }))
      )
    } finally { setRetrying(null) }
  }, [])

  const handleDelete = useCallback(async (docId: string, title: string) => {
    const choice = confirm(
      `Xóa văn bản "${title}"?\n\n` +
      `Bấm OK để xóa văn bản VÀ file trên Google Drive.\n` +
      `(File trên Drive sẽ bị xóa vĩnh viễn)`
    )
    if (!choice) return
    setDeleting(docId)
    try { await deleteDocument(docId, true) }
    catch (err) { alert('Lỗi: ' + (err instanceof Error ? err.message : String(err))) }
    finally { setDeleting(null) }
  }, [])

  const handleToggleComplete = useCallback(async (doc: Document) => {
    if (doc.status === 'completed') {
      const newStatus: DocumentStatus = doc.assignee ? 'in_progress' : 'pending'
      await updateDocument(doc.id, { status: newStatus, completedDate: null })
    } else {
      await updateDocument(doc.id, { status: 'completed', completedDate: new Date() })
    }
  }, [])

  const handleAssign = useCallback(async (docId: string, staffIdOrName: string) => {
    if (!perms.canAssignStaff) return
    const doc = documents.find(d => d.id === docId)
    if (!doc) return
    let newStatus = doc.status
    if (doc.status !== 'completed') {
      newStatus = staffIdOrName ? 'in_progress' : 'pending'
    }
    // Find staff member to get both ID and name
    const member = staffList.find(s => s.id === staffIdOrName)
    await updateDocument(docId, {
      assigneeId: member?.id || '',
      assignee: member?.shortName || '',
      status: newStatus,
    })
  }, [documents, staffList, perms.canAssignStaff])

  // Unique assignees from data for filter
  const assignees = useMemo(() => {
    const set = new Set<string>()
    documents.forEach(d => { if (d.assignee) set.add(d.assignee) })
    staffList.forEach(s => set.add(s.shortName))
    return Array.from(set).sort()
  }, [documents, staffList])

  // Priority labels
  const priorityLabels: Record<string, { label: string, color: string }> = {
    normal: { label: 'Thường', color: 'bg-slate-100 text-slate-600' },
    urgent: { label: 'Khẩn', color: 'bg-amber-100 text-amber-700' },
    very_urgent: { label: 'Thượng khẩn', color: 'bg-orange-100 text-orange-700' },
    express: { label: 'Hỏa tốc', color: 'bg-red-100 text-red-700' },
    express_scheduled: { label: 'Hỏa tốc hẹn giờ', color: 'bg-rose-100 text-rose-700' }
  }

  // Row class helper
  const getRowClass = (doc: Document) => {
    const days = getDaysRemaining(doc.deadline)
    if (doc.status === 'completed') return 'row-completed'
    if (days !== null) {
      if (days < 0) return 'row-overdue'
      if (days === 0) return 'row-expired'
      if (days >= 1 && days <= 3) return 'row-urgent1'
      if (days >= 4 && days <= 7) return 'row-urgent2'
      return 'row-normal'
    }
    return ''
  }

  return (
    <>
      {/* === FILTERS === */}
      <div className="flex flex-col gap-2 mb-3">
        {(timePeriod === 'today' || periodRange) && (
          <div className="text-blue-600 font-bold text-sm lg:text-[15px] px-1">
            {timePeriod === 'today' ? (
              <>Thống kê văn bản đến hôm nay, ngày {new Date().toLocaleDateString('vi-VN')}</>
            ) : (
              <>Thống kê văn bản từ {periodRange!.from.toLocaleDateString('vi-VN')} đến {periodRange!.to.toLocaleDateString('vi-VN')}</>
            )}
          </div>
        )}

        {/* Filter bar - responsive */}
        <div className="filters-bar">
          {/* Row 1: Time + Status + Priority */}
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap flex-1 min-w-0">
            <div className="filter-group">
              <Calendar size={16} className="text-slate-500 hidden sm:block" />
              <select
                value={timePeriod}
                onChange={e => {
                  const val = e.target.value
                  setTimePeriod(val)
                  if (val === 'today') {
                    setFilterStatus('pending')
                  } else {
                    setFilterStatus('all')
                  }
                  e.target.blur()
                }}
              >
                <option value="today">Đến hôm nay</option>
                <option value="week">Tuần này</option>
                <option value="last_month">Tháng trước</option>
                <option value="custom">Bất kỳ</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="hidden sm:inline">Lọc danh sách:</label>
              <select 
                value={filterStatus} 
                onChange={e => { setFilterStatus(e.target.value); e.target.blur() }}
                className={filterStatus !== 'all' ? 'select-colored' : ''}
                style={{
                  background: filterStatus === 'completed' ? settings.completedColor : filterStatus === 'pending' ? '#f59e0b' : undefined,
                  color: filterStatus === 'all' ? undefined : '#fff',
                  borderColor: filterStatus === 'completed' ? settings.completedColor : filterStatus === 'pending' ? '#f59e0b' : undefined,
                  fontWeight: filterStatus === 'all' ? undefined : 600,
                }}
              >
                <option value="all">Tất cả</option>
                <option value="pending">Chưa hoàn thành</option>
                <option value="completed">Đã hoàn thành</option>
              </select>
            </div>

            {/* Priority filters - scroll on mobile */}
            <div className="filter-group overflow-x-auto flex-nowrap hidden sm:flex">
              <label className="hidden md:inline">Mức độ khẩn:</label>
              {[
                { key: 'normal', label: 'Thường', color: '#64748b' },
                { key: 'urgent', label: 'Khẩn', color: '#f59e0b' },
                { key: 'very_urgent', label: 'Thượng khẩn', color: '#f97316' },
                { key: 'express', label: 'Hỏa tốc', color: '#ef4444' },
                { key: 'express_scheduled', label: 'Hỏa tốc hẹn giờ', color: '#e11d48' }
              ].map(p => {
                const count = priorityStats[p.key] || 0
                if (count === 0) return null
                const isSelected = priorityBadgeFilters.includes(p.key)
                return (
                  <button
                    key={p.key}
                    onClick={() => setPriorityBadgeFilters(prev =>
                      prev.includes(p.key) ? prev.filter(x => x !== p.key) : [...prev, p.key]
                    )}
                    className="badge-filter px-2 py-0.5 rounded shadow-sm flex items-center gap-1 transition-all border text-xs font-semibold whitespace-nowrap shrink-0"
                    style={{
                      '--badge-color': p.color,
                      background: isSelected ? p.color : `color-mix(in srgb, ${p.color} 25%, #ffffff)`,
                      borderColor: p.color,
                      color: isSelected ? '#fff' : p.color,
                      boxShadow: isSelected ? `0 0 0 2px #fff, 0 0 0 3px ${p.color}` : 'none'
                    } as React.CSSProperties}
                  >
                    {p.label} ({count})
                    {isSelected && <span className="opacity-70 hover:opacity-100 font-normal ml-0.5 text-sm leading-none">×</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Search box */}
          <div className="search-box w-full sm:w-auto sm:min-w-[200px]">
            <Search size={16} />
            <input
              type="text"
              placeholder="Tìm kiếm văn bản..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => setSearchQuery('')}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <span className="filter-count hidden sm:inline">{filteredDocs.length}/{baseDocs.length} văn bản</span>
        </div>

        {/* Mobile priority filters */}
        <div className="sm:hidden scroll-x-badges px-1">
          {[
            { key: 'normal', label: 'Thường', color: '#64748b' },
            { key: 'urgent', label: 'Khẩn', color: '#f59e0b' },
            { key: 'very_urgent', label: 'T.khẩn', color: '#f97316' },
            { key: 'express', label: 'Hỏa tốc', color: '#ef4444' },
            { key: 'express_scheduled', label: 'HT hẹn giờ', color: '#e11d48' }
          ].map(p => {
            const count = priorityStats[p.key] || 0
            if (count === 0) return null
            const isSelected = priorityBadgeFilters.includes(p.key)
            return (
              <button
                key={p.key}
                onClick={() => setPriorityBadgeFilters(prev =>
                  prev.includes(p.key) ? prev.filter(x => x !== p.key) : [...prev, p.key]
                )}
                className="badge-filter px-2 py-0.5 rounded shadow-sm flex items-center gap-1 transition-all border text-[11px] font-semibold whitespace-nowrap shrink-0"
                style={{
                  '--badge-color': p.color,
                  background: isSelected ? p.color : `color-mix(in srgb, ${p.color} 25%, #ffffff)`,
                  borderColor: p.color,
                  color: isSelected ? '#fff' : p.color,
                  boxShadow: isSelected ? `0 0 0 2px #fff, 0 0 0 3px ${p.color}` : 'none'
                } as React.CSSProperties}
              >
                {p.label} ({count})
              </button>
            )
          })}
        </div>

        {timePeriod === 'custom' && (
          <div className="flex items-center gap-4 px-1 sm:px-4 text-sm">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-sm">
              <label className="text-slate-500 font-medium text-xs">Từ</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="text-xs outline-none bg-transparent" />
              <label className="text-slate-500 font-medium text-xs ml-2">Đến</label>
              <input type="date" value={customTo} min={customFrom || undefined} onChange={e => setCustomTo(e.target.value)} className="text-xs outline-none bg-transparent" />
            </div>
          </div>
        )}
      </div>

      {/* Urgency + Staff badges */}
      <div className="flex flex-col xl:flex-row gap-2 mb-4 text-xs font-semibold items-start justify-between">
        {/* Row 1: Urgency Badges */}
        <div className="scroll-x-badges sm:flex sm:flex-wrap sm:gap-2 sm:overflow-visible items-start w-full xl:w-auto xl:flex-1 min-w-0">
          {[
            { key: 'overdue', count: stats.overdue, color: settings.overdueColor, label: 'Quá hạn' },
            { key: 'expired', count: stats.expired, color: settings.expiredColor, label: 'Hết hạn (0 ngày)' },
            { key: 'urgent1', count: stats.urgent1, color: settings.urgent1Color, label: 'Cận hạn 1-3 ngày' },
            { key: 'urgent2', count: stats.urgent2, color: settings.urgent2Color, label: 'Cận hạn 4-7 ngày' },
            { key: 'normal', count: stats.normal, color: settings.normalColor, label: 'Còn hạn > 7 ngày' },
            ...(filterStatus === 'all' ? [{ key: 'completed', count: stats.completed, color: settings.completedColor, label: 'Hoàn thành' }] : [])
          ].map(b => {
            if (b.count === 0) return null
            const isSelected = badgeFilters.includes(b.key)
            return (
              <button
                key={b.key}
                onClick={() => {
                  setBadgeFilters(prev => 
                    prev.includes(b.key) ? prev.filter(x => x !== b.key) : [...prev, b.key]
                  )
                }}
                className="badge-filter px-2 py-1 rounded shadow-sm flex items-center gap-1 transition-all border whitespace-nowrap shrink-0"
                style={{ 
                  '--badge-color': b.color,
                  background: isSelected ? b.color : `color-mix(in srgb, ${b.color} 25%, #ffffff)`,
                  borderColor: b.color,
                  color: isSelected ? '#fff' : b.color,
                  boxShadow: isSelected ? `0 0 0 2px #fff, 0 0 0 4px ${b.color}` : 'none'
                } as React.CSSProperties}
              >
                {b.label}: {b.count}
                {isSelected && <span className="opacity-70 hover:opacity-100 font-normal ml-1 text-sm leading-none">×</span>}
              </button>
            )
          })}
        </div>

        {/* Row 2: Staff Badges & Actions */}
        <div className="flex items-start gap-2 w-full xl:w-auto min-w-0">
          <div className="scroll-x-badges flex-1 min-w-0 sm:flex sm:flex-wrap sm:gap-2 sm:overflow-visible items-start xl:justify-end">
            {staffStats.map(([name, count]) => {
              const isSelected = staffBadgeFilter === name
              return (
                <button
                  key={name}
                  onClick={() => setStaffBadgeFilter(staffBadgeFilter === name ? null : name)}
                  className="badge-filter px-2 py-1 rounded shadow-sm flex items-center gap-1 transition-all border text-xs font-semibold whitespace-nowrap shrink-0"
                  style={{
                    '--badge-color': isSelected ? '#475569' : '#475569',
                    background: isSelected ? '#475569' : '#f1f5f9',
                    borderColor: isSelected ? '#334155' : '#cbd5e1',
                    color: isSelected ? '#fff' : '#475569',
                    boxShadow: isSelected ? '0 0 0 2px #fff, 0 0 0 4px #475569' : 'none'
                  } as React.CSSProperties}
                >
                  {name}: {count}
                  {isSelected && <span className="opacity-70 hover:opacity-100 font-normal ml-1 text-sm leading-none">×</span>}
                </button>
              )
            })}
          </div>

          <button
            className="badge-filter px-2 py-1 rounded shadow-sm flex items-center gap-1 transition-all border text-xs font-semibold shrink-0"
            style={{
              '--badge-color': '#3b82f6',
              background: '#eff6ff',
              borderColor: '#93c5fd',
              color: '#2563eb',
            } as React.CSSProperties}
            title="Copy thống kê theo nhân viên"
            onClick={() => {
              const lines: string[] = []
              
              // Header: period info
              const now = new Date()
              if (timePeriod === 'today' || !periodRange) {
                lines.push(`Thống kê văn bản tính đến ngày ${now.toLocaleDateString('vi-VN')}`)
              } else {
                lines.push(`Thống kê văn bản từ ngày ${periodRange.from.toLocaleDateString('vi-VN')} đến ${periodRange.to.toLocaleDateString('vi-VN')}`)
              }
              // Summary line
              let totalAll = baseDocs.length
              let totalCompleted = 0
              baseDocs.forEach(d => { if (getDocEffectiveStatus(d) === 'completed') totalCompleted++ })
              lines.push(`TS văn bản: ${totalAll}, Đã hoàn thành: ${totalCompleted}, Chưa hoàn thành: ${totalAll - totalCompleted}`)
              lines.push('')
              
              let idx = 1
              // Group baseDocs by assignee
              const grouped: Record<string, typeof baseDocs> = {}
              baseDocs.forEach(d => {
                const name = d.assignee || '(Chưa giao)'
                if (!grouped[name]) grouped[name] = []
                grouped[name].push(d)
              })
              const sortedNames = Object.keys(grouped).sort()
              sortedNames.forEach(name => {
                const docs = grouped[name]
                const total = docs.length
                lines.push(`${idx}. ${name}: ${total} văn bản`)
                // Breakdown by deadline using effective status
                let overdue = 0, expired = 0, u1 = 0, u2 = 0, normal = 0, completed = 0, noDeadline = 0
                docs.forEach(d => {
                  const effSt = getDocEffectiveStatus(d)
                  if (effSt === 'completed') { completed++; return }
                  const days = getDaysRemaining(d.deadline)
                  if (days === null) noDeadline++
                  else if (days < 0) overdue++
                  else if (days === 0) expired++
                  else if (days >= 1 && days <= 3) u1++
                  else if (days >= 4 && days <= 7) u2++
                  else normal++
                })
                if (overdue > 0) lines.push(`   - Quá hạn: ${overdue}`)
                if (expired > 0) lines.push(`   - Hết hạn (0 ngày): ${expired}`)
                if (u1 > 0) lines.push(`   - Cận hạn 1-3 ngày: ${u1}`)
                if (u2 > 0) lines.push(`   - Cận hạn 4-7 ngày: ${u2}`)
                if (normal > 0) lines.push(`   - Còn hạn > 7 ngày: ${normal}`)
                if (noDeadline > 0) lines.push(`   - Không có hạn: ${noDeadline}`)
                if (completed > 0) lines.push(`   - Hoàn thành: ${completed}`)
                idx++
              })
              setCopyModalContent(lines.join('\n'))
            }}
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Copy</span>
          </button>

          {/* Mobile count */}
          <span className="sm:hidden text-xs text-slate-400 font-normal self-center ml-auto shrink-0">
            {filteredDocs.length}/{baseDocs.length}
          </span>
        </div>
      </div>

      {/* === DESKTOP TABLE (hidden on mobile) === */}
      <div className="hidden sm:block">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="doc-table" style={{ minWidth: '900px' }}>
              <TableHeader>
                <TableRow className="doc-table-header">
                  <ThResizable width={colWidths.stt} minWidth={30} onWidthChange={(w: number) => handleWidthChange('stt', w)} className="cursor-pointer hover:bg-slate-700/50" onClick={() => setSortConfig(null)}>#</ThResizable>
                  <ThResizable width={colWidths.issueDate} minWidth={60} onWidthChange={(w: number) => handleWidthChange('issueDate', w)} className="cursor-pointer hover:bg-slate-700/50 hidden md:table-cell" onClick={() => handleSort('issueDate')}>Ngày ban hành <ArrowUpDown className="h-3 w-3 inline ml-1"/></ThResizable>
                  <ThResizable width={colWidths.docNumber} minWidth={80} onWidthChange={(w: number) => handleWidthChange('docNumber', w)} className="cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort('docNumber')}>Mã hiệu <ArrowUpDown className="h-3 w-3 inline ml-1"/></ThResizable>
                  <ThResizable width={colWidths.title} minWidth={150} onWidthChange={(w: number) => handleWidthChange('title', w)} className="cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort('title')}>Tiêu đề <ArrowUpDown className="h-3 w-3 inline ml-1"/></ThResizable>
                  <ThResizable width={colWidths.deadline} minWidth={70} onWidthChange={(w: number) => handleWidthChange('deadline', w)} className="cursor-pointer hover:bg-slate-700/50 hidden lg:table-cell" onClick={() => handleSort('deadline')}>Deadline <ArrowUpDown className="h-3 w-3 inline ml-1"/></ThResizable>
                  <ThResizable width={colWidths.remaining} minWidth={60} onWidthChange={(w: number) => handleWidthChange('remaining', w)} className="cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort('remaining')}>Còn lại <ArrowUpDown className="h-3 w-3 inline ml-1"/></ThResizable>
                  <ThResizable width={colWidths.assignee} minWidth={90} onWidthChange={(w: number) => handleWidthChange('assignee', w)} className="cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort('assignee')}>Người TH <ArrowUpDown className="h-3 w-3 inline ml-1"/></ThResizable>
                  <TableHead className="doc-table-header border-0 sticky right-0 z-10 bg-slate-800 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.15)]">Xử lý</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedDocs.map((doc, idx) => {
                  const days = getDaysRemaining(doc.deadline)
                  const docEffStatus = getDocEffectiveStatus(doc)
                  const eff = getEffectiveStatus(doc, docEffStatus)
                  const rowClass = getRowClass(doc)
                  const prio = priorityLabels[doc.priority || 'normal']

                  return (
                    <TableRow
                      key={doc.id}
                      className={`doc-row ${idx % 2 === 0 ? 'row-even' : 'row-odd'} ${rowClass}`}
                    >
                      <TableCell className="text-center text-slate-400 font-mono text-xs">
                        {showPagination ? (safePage - 1) * pageSize + idx + 1 : idx + 1}
                      </TableCell>
                      <TableCell className="text-xs hidden md:table-cell">
                        <div className="font-medium">{formatDate(doc.issueDate)}</div>
                        {doc.issueDate && (doc.issueDate.toDate().getHours() !== 0 || doc.issueDate.toDate().getMinutes() !== 0) && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {doc.issueDate.toDate().getHours()}:{String(doc.issueDate.toDate().getMinutes()).padStart(2, '0')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-800 text-xs">
                        <Highlight text={doc.docNumber || '—'} query={searchQuery} />
                        {doc.sender && (
                          <div className="text-[10px] text-slate-400 italic font-normal mt-0.5">
                            <Highlight text={doc.sender} query={searchQuery} />
                          </div>
                        )}
                      </TableCell>
                      <TableCell style={{ maxWidth: colWidths.title || 250 }}>
                        <span className="text-xs flex flex-col gap-1 items-start">
                          {prio && doc.priority && doc.priority !== 'normal' && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${prio.color}`}>
                              {prio.label}
                            </span>
                          )}
                          <span>
                            <Highlight text={doc.title} query={searchQuery} />
                            {doc.attachments && doc.attachments.length > 0 && (
                              <span className="text-slate-500 ml-1 font-medium whitespace-nowrap">
                                ({doc.attachments.length} 📎)
                              </span>
                            )}
                          </span>
                          {doc.notes && (
                            <span className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2" title={doc.notes}>
                              📝 <Highlight text={doc.notes} query={searchQuery} />
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs hidden lg:table-cell">{formatDate(doc.deadline)}</TableCell>
                      <TableCell>
                        <span className={`days-badge ${days !== null && days <= 0 ? 'days-danger' : days !== null && days === 1 ? 'days-warning' : days !== null && days <= 3 ? 'days-caution' : ''}`}>
                          {getDaysLabel(days)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {perms.canAssignStaff ? (
                          <select
                            className="assign-select"
                            value={doc.assigneeId || ''}
                            onChange={e => handleAssign(doc.id, e.target.value)}
                          >
                            <option value="">— Chưa giao —</option>
                            {staffList.map(s => <option key={s.id} value={s.id}>{s.shortName}</option>)}
                          </select>
                        ) : (
                          <span className="text-xs text-slate-600">
                            {doc.assigneeId ? getStaffName(doc.assigneeId) : (doc.assignee || '—')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)]">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-0.5 flex-wrap">
                            {(perms.canToggleComplete || (perms.canCompleteAssigned && doc.assigneeId === currentStaffId)) && (
                              <button
                                className={`status-chip mr-1 ${eff.cls}`}
                                onClick={() => handleToggleComplete(doc)}
                                title={doc.status === 'completed' ? 'Bấm để chuyển về trạng thái chờ' : 'Bấm để đánh dấu hoàn thành'}
                              >
                                {eff.icon}
                                <span className="hidden xl:inline">{eff.label}</span>
                              </button>
                            )}
                            {!perms.canToggleComplete && !(perms.canCompleteAssigned && doc.assigneeId === currentStaffId) && (
                              <span className={`status-chip mr-1 ${eff.cls} opacity-60 cursor-default`}>
                                {eff.icon}
                                <span className="hidden xl:inline">{eff.label}</span>
                              </span>
                            )}
                            {doc.status === 'upload_failed' && perms.canEditDocument ? (
                              <Button size="sm" variant="outline" onClick={() => handleRetry(doc)} disabled={retrying === doc.id}>
                                {retrying === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                              </Button>
                            ) : doc.status !== 'uploading' && (
                              <>
                                <button
                                  onClick={() => setViewingId(doc.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                  title="Xem"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                {perms.canEditDocument && (
                                  <Link
                                    href={`/documents/${doc.id}/edit`}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                    title="Sửa"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Link>
                                )}
                              </>
                            )}
                            {perms.canDeleteDocument && (
                              <button
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                onClick={() => handleDelete(doc.id, doc.title)}
                                disabled={deleting === doc.id}
                                title="Xóa"
                              >
                                {deleting === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </button>
                            )}
                          </div>
                          {doc.completedDate && (() => {
                            const cd = toDateSafe(doc.completedDate)
                            if (!cd) return null
                            return (
                              <div style={{ fontSize: '10px', fontStyle: 'italic', marginTop: '2px' }}>
                                <span style={{ color: '#dc2626' }}>HT:</span>{' '}
                                <span style={{ color: '#64748b' }}>{cd.toLocaleDateString('vi-VN')}</span>
                              </div>
                            )
                          })()}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* === MOBILE CARD LIST (shown only on mobile) === */}
      <div className="sm:hidden flex flex-col gap-2">
        {pagedDocs.map((doc, idx) => {
          const days = getDaysRemaining(doc.deadline)
          const docEffStatus = getDocEffectiveStatus(doc)
          const eff = getEffectiveStatus(doc, docEffStatus)
          const rowClass = getRowClass(doc)
          const prio = priorityLabels[doc.priority || 'normal'] || null

          return (
            <DocumentCard
              key={doc.id}
              doc={doc}
              idx={idx}
              days={days}
              eff={eff}
              rowClass={rowClass}
              prio={prio}
              searchQuery={searchQuery}
              onToggleComplete={handleToggleComplete}
              onView={setViewingId}
              onDelete={handleDelete}
              onRetry={handleRetry}
              onAssign={handleAssign}
              retrying={retrying}
              deleting={deleting}
              staffList={staffList}
              perms={perms}
              currentStaffId={currentStaffId}
              getStaffName={getStaffName}
              settings={settings}
            />
          )
        })}
      </div>

      {/* === PAGINATION === */}
      {showPagination && (
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredDocs.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1) }}
        />
      )}

      <DocumentModal docId={viewingId} onClose={() => setViewingId(null)} />

      {copyModalContent !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) setCopyModalContent(null) }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <ClipboardCopy className="w-5 h-5 text-blue-600" />
                Sửa & Copy thống kê
              </h2>
              <button onClick={() => setCopyModalContent(null)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex-1">
              <textarea 
                className="w-full h-[60vh] sm:h-96 p-3 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y shadow-inner"
                value={copyModalContent}
                onChange={e => setCopyModalContent(e.target.value)}
              />
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors" onClick={() => setCopyModalContent(null)}>
                Hủy
              </button>
              <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2" onClick={() => {
                navigator.clipboard.writeText(copyModalContent)
                setCopyModalContent(null)
              }}>
                <CheckCircle2 className="w-4 h-4" />
                Copy & Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .filters-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 0;
          padding: 8px 12px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          flex-wrap: wrap;
        }
        @media (max-width: 639px) {
          .filters-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
            padding: 10px;
          }
        }
        .badge-filter:hover {
          background: var(--badge-color) !important;
          color: #fff !important;
          box-shadow: 0 0 0 2px #fff, 0 0 0 3px var(--badge-color) !important;
          transform: translateY(-1px);
        }
        .filter-group {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .filter-group label {
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          white-space: nowrap;
        }
        .filter-group select {
          font-size: 12px;
          padding: 4px 8px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #f8fafc;
          color: #334155;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .filter-group select:hover {
          background: #eef1f5;
          border-color: #94a3b8;
        }
        .filter-group select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.15);
        }
        .search-box {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
          transition: all 0.15s ease;
        }
        .search-box:hover {
          background: #eef1f5;
          border-color: #94a3b8;
        }
        .search-box:focus-within {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.15);
          background: #fff;
        }
        .search-box input {
          border: none;
          outline: none;
          background: transparent;
          font-size: 13px;
          flex: 1;
          color: #1e293b;
          min-width: 0;
        }
        .search-box input::placeholder {
          color: #94a3b8;
        }
        .search-box svg {
          color: #94a3b8;
          flex-shrink: 0;
        }
        .search-clear {
          border: none;
          background: #e2e8f0;
          color: #64748b;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .search-clear:hover { background: #cbd5e1; color: #334155; }
        .filter-count {
          margin-left: auto;
          font-size: 12px;
          color: #94a3b8;
          font-weight: 500;
          white-space: nowrap;
        }

        /* Table styles */
        .doc-table {
          width: 100%;
        }

        .doc-table-header {
          background: linear-gradient(135deg, #1e293b, #334155) !important;
        }
        .doc-table-header th {
          color: #f1f5f9 !important;
          font-weight: 600 !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.4px !important;
          padding: 10px 8px !important;
        }
        .doc-row td {
          padding: 8px !important;
          vertical-align: middle !important;
          word-wrap: break-word;
        }
        .row-even { background: #ffffff; }
        .row-odd { background: #f1f5f9; }
        .doc-row:hover { background: #e0e7ff !important; }
        
        .row-overdue { background: color-mix(in srgb, ${settings.overdueColor} 12%, #ffffff) !important; border-left: 3px solid ${settings.overdueColor}; }
        .row-overdue:hover { background: color-mix(in srgb, ${settings.overdueColor} 20%, #ffffff) !important; }
        
        .row-expired { background: color-mix(in srgb, ${settings.expiredColor} 12%, #ffffff) !important; border-left: 3px solid ${settings.expiredColor}; }
        .row-expired:hover { background: color-mix(in srgb, ${settings.expiredColor} 20%, #ffffff) !important; }
        
        .row-urgent1 { background: color-mix(in srgb, ${settings.urgent1Color} 12%, #ffffff) !important; border-left: 3px solid ${settings.urgent1Color}; }
        .row-urgent1:hover { background: color-mix(in srgb, ${settings.urgent1Color} 20%, #ffffff) !important; }
        
        .row-urgent2 { background: color-mix(in srgb, ${settings.urgent2Color} 12%, #ffffff) !important; border-left: 3px solid ${settings.urgent2Color}; }
        .row-urgent2:hover { background: color-mix(in srgb, ${settings.urgent2Color} 20%, #ffffff) !important; }
        
        .row-normal { background: color-mix(in srgb, ${settings.normalColor} 12%, #ffffff) !important; border-left: 3px solid ${settings.normalColor}; }
        .row-normal:hover { background: color-mix(in srgb, ${settings.normalColor} 20%, #ffffff) !important; }
        
        .row-completed { background: color-mix(in srgb, ${settings.completedColor} 8%, #ffffff) !important; border-left: 3px solid ${settings.completedColor}; }
        .row-completed:hover { background: color-mix(in srgb, ${settings.completedColor} 15%, #ffffff) !important; }
        .row-completed .status-chip { text-decoration: none; }
        .row-completed .assign-select { text-decoration: none; }

        .status-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          background: transparent;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .status-chip:hover { transform: scale(1.05); }
        .status-completed { background: ${settings.completedColor}; color: #fff; }
        .status-pending { background: #94a3b8; color: #fff; }
        .status-progress { background: #3b82f6; color: #fff; }
        .status-urgent1 { background: ${settings.urgent1Color}; color: #fff; }
        .status-urgent2 { background: ${settings.urgent2Color}; color: #fff; }
        .status-overdue { background: ${settings.overdueColor}; color: #fff; }
        .status-expired { background: ${settings.expiredColor}; color: #fff; }
        .status-uploading { background: #cbd5e1; color: #475569; }
        .status-failed { background: #dc2626; color: #fff; }

        .days-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }
        .days-danger { background: #fee2e2; color: #dc2626; }
        .days-warning { background: #ffedd5; color: #ea580c; }
        .days-caution { background: #fef3c7; color: #d97706; }

        .assign-select {
          font-size: 11px;
          padding: 3px 6px;
          border: 1px solid transparent;
          border-radius: 5px;
          background: transparent;
          color: #334155;
          cursor: pointer;
          width: 100%;
          max-width: 120px;
          transition: all 0.15s ease;
        }
        .assign-select:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }
        .assign-select:focus {
          outline: none;
          background: #fff;
          border-color: #3b82f6;
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* Mobile card styles */
        .doc-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-left: 4px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 14px;
          transition: all 0.15s ease;
        }
        .doc-card:active {
          background: #f8fafc;
          transform: scale(0.99);
        }
      `}</style>
    </>
  )
}
