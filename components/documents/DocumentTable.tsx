'use client'

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Loader2, Trash2, Eye, RefreshCw, CheckCircle2, Clock, AlertTriangle, XCircle, CircleDot, Search, Pencil, ArrowUpDown } from 'lucide-react'
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
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-slate-400 opacity-0 group-hover:opacity-100 z-10 transition-opacity"
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
function getEffectiveStatus(doc: Document): { icon: React.ReactNode; label: string; cls: string } {
  if (doc.status === 'completed') return {
    icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    label: 'Hoàn thành', cls: 'status-completed'
  }
  if (doc.status === 'uploading') return {
    icon: <Loader2 className="h-4 w-4 animate-spin text-slate-400" />,
    label: 'Đang tải...', cls: 'status-uploading'
  }
  if (doc.status === 'upload_failed') return {
    icon: <XCircle className="h-4 w-4 text-red-500" />,
    label: 'Lỗi tải', cls: 'status-failed'
  }
  const days = getDaysRemaining(doc.deadline)
  if (days !== null && days < 0) return {
    icon: <XCircle className="h-4 w-4 text-red-600" />,
    label: 'Quá hạn', cls: 'status-overdue'
  }
  if (days !== null && days <= 1) return {
    icon: <AlertTriangle className="h-4 w-4 text-orange-500" />,
    label: days === 0 ? 'Hết hạn hôm nay' : 'Sắp hết hạn', cls: 'status-urgent'
  }
  if (days !== null && days <= 3) return {
    icon: <Clock className="h-4 w-4 text-amber-500" />,
    label: 'Gần hết hạn', cls: 'status-warning'
  }
  if (doc.status === 'in_progress') return {
    icon: <CircleDot className="h-4 w-4 text-blue-500" />,
    label: 'Đang xử lý', cls: 'status-progress'
  }
  return {
    icon: <Clock className="h-4 w-4 text-slate-400" />,
    label: 'Chờ xử lý', cls: 'status-pending'
  }
}

// === Component ===

export function DocumentTable({ documents }: { documents: Document[] }) {
  const staffList = useStaff()
  const settings = useSettings()
  const [retrying, setRetrying] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterPerson, setFilterPerson] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)
  
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    stt: 36, issueDate: 90, docNumber: 130, title: 250, status: 120, deadline: 90, remaining: 80, assignee: 130, actions: 130
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

  // Search + Filter pipeline
  const filteredDocs = useMemo(() => {
    let result = documents
    // Fuzzy search across all fields
    if (searchQuery.trim()) {
      result = result.filter(d => {
        const searchable = [
          d.title, d.docNumber, d.assignee, d.notes,
          d.sender, formatDate(d.issueDate), formatDate(d.deadline),
          d.status, ...(d.tags || []),
        ].filter(Boolean).join(' ')
        return wordMatch(searchable, searchQuery)
      })
    }
    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter(d => {
        if (filterStatus === 'completed') return d.status === 'completed'
        if (filterStatus === 'pending') return d.status !== 'completed'
        if (filterStatus === 'overdue') { const days = getDaysRemaining(d.deadline); return days !== null && days < 0 }
        if (filterStatus === 'urgent') { const days = getDaysRemaining(d.deadline); return days !== null && days >= 0 && days <= 3 }
        return true
      })
    }
    if (filterPerson !== 'all') result = result.filter(d => d.assignee === filterPerson)
    if (filterPriority !== 'all') result = result.filter(d => (d.priority || 'normal') === filterPriority)

    // Sorting
    if (sortConfig) {
      result = [...result].sort((a, b) => {
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
  }, [documents, filterStatus, filterPerson, filterPriority, searchQuery, wordMatch, sortConfig])

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
    const newStatus: DocumentStatus = doc.status === 'completed' ? 'pending' : 'completed'
    await updateDocument(doc.id, { status: newStatus })
  }, [])

  const handleAssign = useCallback(async (docId: string, person: string) => {
    await updateDocument(docId, { assignee: person })
  }, [])

  // Unique assignees from data for filter
  const assignees = useMemo(() => {
    const set = new Set<string>()
    documents.forEach(d => { if (d.assignee) set.add(d.assignee) })
    staffList.forEach(s => set.add(s))
    return Array.from(set).sort()
  }, [documents, staffList])

  return (
    <>
      {/* Search + Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Tìm kiếm văn bản..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>
        <div className="filter-group">
          <label>Trạng thái:</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">Tất cả</option>
            <option value="pending">Chưa hoàn thành</option>
            <option value="completed">Hoàn thành</option>
            <option value="urgent">Gần hết hạn (≤3 ngày)</option>
            <option value="overdue">Quá hạn</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Mức độ khẩn:</label>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="all">Tất cả</option>
            <option value="normal">Thường</option>
            <option value="urgent">Khẩn</option>
            <option value="very_urgent">Thượng khẩn</option>
            <option value="express">Hỏa tốc</option>
            <option value="express_scheduled">Hỏa tốc hẹn giờ</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Người thực hiện:</label>
          <select value={filterPerson} onChange={e => setFilterPerson(e.target.value)}>
            <option value="all">Tất cả</option>
            {assignees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <span className="filter-count">{filteredDocs.length}/{documents.length} văn bản</span>
      </div>

      <Table className="doc-table">
        <TableHeader>
          <TableRow className="doc-table-header">
            <ThResizable width={colWidths.stt} minWidth={30} onWidthChange={(w: number) => handleWidthChange('stt', w)} className="cursor-pointer hover:bg-slate-700/50" onClick={() => setSortConfig(null)}>#</ThResizable>
            <ThResizable width={colWidths.issueDate} minWidth={60} onWidthChange={(w: number) => handleWidthChange('issueDate', w)} className="cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort('issueDate')}>Ngày BH <ArrowUpDown className="h-3 w-3 inline ml-1"/></ThResizable>
            <ThResizable width={colWidths.docNumber} minWidth={80} onWidthChange={(w: number) => handleWidthChange('docNumber', w)} className="cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort('docNumber')}>Mã hiệu <ArrowUpDown className="h-3 w-3 inline ml-1"/></ThResizable>
            <ThResizable width={colWidths.title} minWidth={150} onWidthChange={(w: number) => handleWidthChange('title', w)} className="cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort('title')}>Tiêu đề <ArrowUpDown className="h-3 w-3 inline ml-1"/></ThResizable>
            <ThResizable width={colWidths.status} minWidth={90} onWidthChange={(w: number) => handleWidthChange('status', w)} className="cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort('status')}>Tình trạng <ArrowUpDown className="h-3 w-3 inline ml-1"/></ThResizable>
            <ThResizable width={colWidths.deadline} minWidth={70} onWidthChange={(w: number) => handleWidthChange('deadline', w)} className="cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort('deadline')}>Deadline <ArrowUpDown className="h-3 w-3 inline ml-1"/></ThResizable>
            <ThResizable width={colWidths.remaining} minWidth={60} onWidthChange={(w: number) => handleWidthChange('remaining', w)} className="cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort('deadline')}>Còn lại <ArrowUpDown className="h-3 w-3 inline ml-1"/></ThResizable>
            <ThResizable width={colWidths.assignee} minWidth={90} onWidthChange={(w: number) => handleWidthChange('assignee', w)} className="cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort('assignee')}>Người TH <ArrowUpDown className="h-3 w-3 inline ml-1"/></ThResizable>
            <ThResizable width={colWidths.actions} minWidth={100} onWidthChange={(w: number) => handleWidthChange('actions', w)}>Actions</ThResizable>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredDocs.map((doc, idx) => {
            const days = getDaysRemaining(doc.deadline)
            const eff = getEffectiveStatus(doc)
            const rowDanger = days !== null && days <= 0
            const rowWarning = days !== null && days === 1

            const priorityLabels: Record<string, { label: string, color: string }> = {
              normal: { label: 'Thường', color: 'bg-slate-100 text-slate-600' },
              urgent: { label: 'Khẩn', color: 'bg-amber-100 text-amber-700' },
              very_urgent: { label: 'Thượng khẩn', color: 'bg-orange-100 text-orange-700' },
              express: { label: 'Hỏa tốc', color: 'bg-red-100 text-red-700' },
              express_scheduled: { label: 'Hỏa tốc hẹn giờ', color: 'bg-rose-100 text-rose-700' }
            }
            const prio = priorityLabels[doc.priority || 'normal']

            return (
              <TableRow
                key={doc.id}
                className={`doc-row ${idx % 2 === 0 ? 'row-even' : 'row-odd'} ${rowDanger ? 'row-danger' : rowWarning ? 'row-warning' : ''} ${doc.status === 'completed' ? 'row-completed' : ''}`}
              >
                <TableCell className="text-center text-slate-400 font-mono text-xs">{idx + 1}</TableCell>
                <TableCell className="text-xs">{formatDate(doc.issueDate)}</TableCell>
                <TableCell className="font-semibold text-slate-800 text-xs">
                  <Highlight text={doc.docNumber || '—'} query={searchQuery} />
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
                  </span>
                </TableCell>
                <TableCell>
                  <button
                    className={`status-chip ${eff.cls}`}
                    onClick={() => handleToggleComplete(doc)}
                    title={doc.status === 'completed' ? 'Bấm để đánh dấu chưa hoàn thành' : 'Bấm để đánh dấu hoàn thành'}
                  >
                    {eff.icon}
                    <span>{eff.label}</span>
                  </button>
                </TableCell>
                <TableCell className="text-xs">{formatDate(doc.deadline)}</TableCell>
                <TableCell>
                  <span className={`days-badge ${days !== null && days <= 0 ? 'days-danger' : days !== null && days === 1 ? 'days-warning' : days !== null && days <= 3 ? 'days-caution' : ''}`}>
                    {getDaysLabel(days)}
                  </span>
                </TableCell>
                <TableCell>
                  <select
                    className="assign-select"
                    value={doc.assignee || ''}
                    onChange={e => handleAssign(doc.id, e.target.value)}
                  >
                    <option value="">— Chưa giao —</option>
                    {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {doc.status === 'upload_failed' ? (
                      <Button size="sm" variant="outline" onClick={() => handleRetry(doc)} disabled={retrying === doc.id}>
                        {retrying === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      </Button>
                    ) : doc.status !== 'uploading' && (
                      <>
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setViewingId(doc.id)} title="Xem">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8" asChild title="Sửa">
                          <Link href={`/documents/${doc.id}/edit`}>
                            <Pencil className="h-4 w-4 text-slate-600" />
                          </Link>
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm" variant="ghost"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(doc.id, doc.title)}
                      disabled={deleting === doc.id}
                    >
                      {deleting === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <DocumentModal docId={viewingId} onClose={() => setViewingId(null)} />

      <style jsx global>{`
        .filters-bar {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 12px;
          padding: 10px 16px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
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
          min-width: 220px;
          transition: all 0.2s;
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
          font-size: 14px;
          line-height: 1;
          transition: all 0.15s;
        }
        .search-clear:hover { background: #cbd5e1; color: #334155; }
        .filter-count {
          margin-left: auto;
          font-size: 12px;
          color: #94a3b8;
          font-weight: 500;
        }

        .doc-table {
          table-layout: fixed;
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
        .row-warning { background: #fffbeb !important; border-left: 3px solid #f59e0b; }
        .row-warning:hover { background: #fef3c7 !important; }
        .row-danger { background: #fef2f2 !important; border-left: 3px solid #ef4444; }
        .row-danger:hover { background: #fee2e2 !important; }
        .row-completed { opacity: 0.7; }
        .row-completed td { text-decoration: line-through; color: #94a3b8; }
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
        .status-completed { background: #dcfce7; color: #166534; }
        .status-pending { background: #f1f5f9; color: #475569; }
        .status-progress { background: #dbeafe; color: #1d4ed8; }
        .status-urgent { background: #ffedd5; color: #c2410c; }
        .status-warning { background: #fef3c7; color: #b45309; }
        .status-overdue { background: #fee2e2; color: #dc2626; }
        .status-uploading { background: #f1f5f9; color: #64748b; }
        .status-failed { background: #fee2e2; color: #dc2626; }

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
          border: 1px solid #e2e8f0;
          border-radius: 5px;
          background: #fff;
          color: #334155;
          cursor: pointer;
          width: 100%;
          max-width: 120px;
        }
        .assign-select:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </>
  )
}
