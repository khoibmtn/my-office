'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Copy, Check, ExternalLink, FileText, Paperclip, Download, FileSpreadsheet, FileImage, FileArchive, File as FileGeneric, Send } from 'lucide-react'
import { doc as firestoreDoc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getDocument, updateDocument } from '@/lib/firestore'
import { parseFileNameFromUrl, getStructuredMainFileName } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { useRole } from '@/hooks/useRole'
import { useStaff } from '@/hooks/useStaff'
import type { Document } from '@/types'

function getDaysRemaining(ts: { toDate(): Date } | undefined): number | null {
  if (!ts) return null
  const now = new Date(); now.setHours(0,0,0,0)
  const dl = ts.toDate(); dl.setHours(0,0,0,0)
  return Math.ceil((dl.getTime() - now.getTime()) / 86400000)
}

function getStatusInfo(doc: Document, days: number | null) {
  if (doc.status === 'completed') return { label: '✅ Hoàn thành', cls: 'status-done' }
  if (days !== null && days < 0) return { label: '🔴 Quá hạn', cls: 'status-overdue' }
  if (days !== null && days <= 1) return { label: '🟠 Sắp hết hạn', cls: 'status-urgent' }
  return { label: '⏳ Chờ xử lý', cls: 'status-pending' }
}

function toLocalISODate(d: any): string {
  if (!d) return ''
  const dt = d?.toDate ? d.toDate() : (d instanceof Date ? d : new Date(d))
  if (isNaN(dt.getTime())) return ''
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getFileIcon(fileName: string, mimeType?: string, defaultColor: string = 'text-slate-500') {
  const name = (fileName || '').toLowerCase()
  const mime = (mimeType || '').toLowerCase()
  
  let color = defaultColor;
  let text = 'FILE';

  if (name.endsWith('.pdf') || mime.includes('pdf')) { color = 'text-red-500'; text = 'PDF'; }
  else if (name.endsWith('.doc') || name.endsWith('.docx') || mime.includes('word')) { color = 'text-blue-600'; text = 'DOC'; }
  else if (name.endsWith('.xls') || name.endsWith('.xlsx') || mime.includes('excel') || mime.includes('spreadsheet')) { color = 'text-green-600'; text = 'XLS'; }
  else if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || mime.includes('image')) { color = 'text-purple-500'; text = 'IMG'; }
  else if (name.endsWith('.zip') || name.endsWith('.rar') || mime.includes('zip') || mime.includes('compressed')) { color = 'text-amber-500'; text = 'ZIP'; }

  return (
    <svg width="20" height="22" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={`flex-shrink-0 ${color}`} style={{ marginTop: '1px' }}>
      <path d="M14 2H6C4.89543 2 4 2.89543 4 4V24C4 25.1046 4.89543 26 6 26H18C19.1046 26 20 25.1046 20 24V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="2" y="14" width="20" height="8" rx="2" fill="currentColor" stroke="currentColor" strokeWidth="1"/>
      <text x="12" y="18.5" fill="white" fontSize="6.5" fontWeight="900" fontFamily="sans-serif" textAnchor="middle" dominantBaseline="middle">{text}</text>
    </svg>
  )
}

interface DocumentModalProps {
  docId: string | null
  onClose: () => void
}

export function DocumentModal({ docId, onClose }: DocumentModalProps) {
  const { user } = useAuth()
  const perms = usePermissions()
  const { staffId: currentStaffId } = useRole()
  const { staff, getStaffName } = useStaff()
  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeUrl, setActiveUrl] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [staffList, setStaffList] = useState<{name: string}[]>([])

  useEffect(() => {
    getDoc(firestoreDoc(db(), 'settings', 'general')).then(snap => {
      if (snap.exists() && snap.data().staff) {
        setStaffList(snap.data().staff)
      }
    }).catch(err => console.error(err))
  }, [])

  useEffect(() => {
    if (!docId) return
    setLoading(true)
    getDocument(docId).then((d) => {
      setDoc(d)
      if (d?.driveViewUrl) setActiveUrl(d.driveViewUrl)
      setLoading(false)
    })
  }, [docId])

  const handleUpdateDeadline = async (val: string) => {
    if (!doc) return
    let newDeadline = null
    if (val) {
      newDeadline = new Date(val + 'T00:00:00')
      if (doc.issueDate) {
        const issueMidnight = new Date(doc.issueDate.toDate())
        issueMidnight.setHours(0, 0, 0, 0)
        if (newDeadline < issueMidnight) {
          alert('Hạn xử lý không được chọn trước ngày ban hành văn bản!')
          return
        }
      }
    }
    setDoc(prev => prev ? { ...prev, deadline: newDeadline ? { toDate: () => newDeadline } as any : undefined } : prev)
    updateDocument(doc.id, { deadline: newDeadline })
  }

  const handleUpdateCompletedDate = async (val: string) => {
    if (!doc) return
    if (val) {
      const localMidnight = new Date(val + 'T00:00:00')
      if (doc.issueDate) {
        const issueMidnight = new Date(doc.issueDate.toDate())
        issueMidnight.setHours(0, 0, 0, 0)
        if (localMidnight < issueMidnight) {
          alert('Ngày hoàn thành không được chọn trước ngày ban hành văn bản!')
          return
        }
      }
      setDoc(prev => prev ? { ...prev, completedDate: { toDate: () => localMidnight } as any, status: 'completed' } : prev)
      updateDocument(doc.id, { completedDate: localMidnight, status: 'completed' })
    } else {
      const newStatus = doc.assignee ? 'in_progress' : 'pending'
      setDoc(prev => prev ? { ...prev, completedDate: undefined, status: newStatus } as any : prev)
      updateDocument(doc.id, { completedDate: null, status: newStatus })
    }
  }

  const handleUpdateAssignee = async (newAssignee: string) => {
    if (!doc) return
    const newStatus = doc.completedDate ? 'completed' : (newAssignee ? 'in_progress' : 'pending')
    setDoc(prev => prev ? { ...prev, assignee: newAssignee, status: newStatus } : prev)
    updateDocument(doc.id, { assignee: newAssignee || undefined, status: newStatus })
  }

  const handleUpdateNotes = async (newNotes: string) => {
    if (!doc || doc.notes === newNotes) return
    setDoc(prev => prev ? { ...prev, notes: newNotes } : prev)
    updateDocument(doc.id, { notes: newNotes })
  }

  const handleCopy = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const allFiles = doc ? [
    {
      id: 'main',
      label: doc.originalLink ? parseFileNameFromUrl(doc.originalLink, getStructuredMainFileName(doc)) : getStructuredMainFileName(doc),
      type: 'main' as const,
      url: doc.driveViewUrl,
      driveId: doc.driveFileId,
      mimeType: doc.mimeType,
    },
    ...(doc.attachments ?? []).map((a, i) => ({
      id: `att-${i}`,
      label: a.title || `Đính kèm ${i + 1}`,
      type: 'attachment' as const,
      url: a.driveViewUrl,
      driveId: a.driveFileId,
      mimeType: a.mimeType,
    })),
  ] : []

  const handleCopyAll = useCallback(async () => {
    if (!doc || !allFiles.length) return
    
    const lines = []
    lines.push(`Giao việc cho: ${doc.assignee || ''}`)
    
    if (doc.deadline) {
      const days = getDaysRemaining(doc.deadline)
      const daysText = days === null ? '' : days < 0 ? ` (quá ${Math.abs(days)} ngày)` : days === 0 ? ' (hôm nay!)' : ` (còn ${days} ngày)`
      lines.push(`Hạn xử lý: ${doc.deadline.toDate().toLocaleDateString('vi-VN')}${daysText}`)
    }
    
    lines.push(`Nội dung văn bản: ${doc.title || ''}`)
    
    const mainFile = allFiles[0]
    if (mainFile) {
      lines.push(mainFile.url)
      lines.push('') // Dòng trắng
    }
    
    if (allFiles.length > 1) {
      const attCount = allFiles.length - 1
      lines.push(`Các văn bản đính kèm (${attCount}):`)
      for (let i = 1; i < allFiles.length; i++) {
        const att = allFiles[i]
        lines.push(att.url)
        if (i < allFiles.length - 1) lines.push('') // Dòng trắng giữa các link
      }
    }
    
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }, [allFiles, doc])

  if (!docId) return null

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-container">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-info">
            <h2 style={{ fontSize: '1.1rem', lineHeight: '1.4' }}>{doc?.title || 'Đang tải...'}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="modal-loading">
            <div className="spinner" />
            <p>Đang tải văn bản...</p>
          </div>
        ) : doc ? (
          <div className="modal-body">
            {/* Left: details + file list */}
            <div className="modal-sidebar">
              {/* Meta */}
              <div className="modal-meta">
                <div className="meta-row">
                  <span className="meta-label">Số VB:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{doc.docNumber || 'Không có'}</span>
                    {(() => {
                      const days = getDaysRemaining(doc.deadline)
                      const si = getStatusInfo(doc, days)
                      return <span className={`modal-status-badge ${si.cls}`}>{si.label}</span>
                    })()}
                  </div>
                </div>
                {doc.sender && (
                  <div className="meta-row">
                    <span className="meta-label">Cơ quan ban hành:</span>
                    <span>{doc.sender}</span>
                  </div>
                )}
                {doc.issueDate && (() => {
                  const d = doc.issueDate.toDate()
                  const dateStr = d.toLocaleDateString('vi-VN')
                  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0
                  const timeStr = hasTime ? ` ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}` : ''
                  return (
                    <div className="meta-row">
                      <span className="meta-label">Ngày ban hành:</span>
                      <span>{dateStr}{timeStr}</span>
                    </div>
                  )
                })()}
                <div className="meta-row" style={{ alignItems: 'center' }}>
                  <span className="meta-label">Deadline:</span>
                  <div className="flex items-center gap-2">
                    {perms.canSetDeadline ? (
                      <input
                        type="date"
                        value={toLocalISODate(doc.deadline)}
                        min={toLocalISODate(doc.issueDate) || undefined}
                        onChange={(e) => handleUpdateDeadline(e.target.value)}
                        style={{ fontSize: '13px', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '5px', background: '#f1f5f9', cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.borderColor = '#94a3b8' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1' }}
                      />
                    ) : (
                      <span style={{ fontSize: '13px' }}>
                        {doc.deadline ? doc.deadline.toDate().toLocaleDateString('vi-VN') : '—'}
                      </span>
                    )}
                    {doc.deadline && (() => {
                      const days = getDaysRemaining(doc.deadline)
                      const daysText = days === null ? '' : days < 0 ? `(quá ${Math.abs(days)} ngày)` : days === 0 ? '(hôm nay!)' : `(còn ${days} ngày)`
                      return (
                        <strong style={{color: days !== null && days <= 1 ? '#ef4444' : days !== null && days <= 3 ? '#f59e0b' : '#22c55e', fontSize: '12px'}}>
                          {daysText}
                        </strong>
                      )
                    })()}
                  </div>
                </div>
                <div className="meta-row" style={{ alignItems: 'center' }}>
                  <span className="meta-label">Hoàn thành:</span>
                  {perms.canSetCompletedDate || (perms.canCompleteAssigned && doc.assigneeId === currentStaffId) ? (
                    <input
                      type="date"
                      value={toLocalISODate(doc.completedDate)}
                      min={toLocalISODate(doc.issueDate) || undefined}
                      onChange={(e) => handleUpdateCompletedDate(e.target.value)}
                      style={{ fontSize: '13px', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '5px', background: '#f1f5f9', cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.borderColor = '#94a3b8' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1' }}
                    />
                  ) : (
                    <span style={{ fontSize: '13px' }}>
                      {doc.completedDate ? doc.completedDate.toDate().toLocaleDateString('vi-VN') : '—'}
                    </span>
                  )}
                </div>
                <div className="meta-row" style={{ alignItems: 'center' }}>
                  <span className="meta-label">Người được giao:</span>
                  {perms.canAssignStaff ? (
                    <select
                      value={doc.assigneeId || ''}
                      onChange={(e) => {
                        const member = staff.find(s => s.id === e.target.value)
                        handleUpdateAssignee(member?.shortName || '')
                        if (member) {
                          updateDocument(doc.id, { assigneeId: member.id, assignee: member.shortName })
                          setDoc(prev => prev ? { ...prev, assigneeId: member.id, assignee: member.shortName } : prev)
                        } else {
                          updateDocument(doc.id, { assigneeId: '', assignee: '' })
                          setDoc(prev => prev ? { ...prev, assigneeId: '', assignee: '' } : prev)
                        }
                      }}
                      style={{ fontSize: '13px', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '5px', background: '#f1f5f9', cursor: 'pointer', transition: 'all 0.15s', flex: 1 }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.borderColor = '#94a3b8' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1' }}
                    >
                      <option value="">-- Chưa giao --</option>
                      {staff.filter(s => s.isActive).map((s) => (
                        <option key={s.id} value={s.id}>{s.shortName}</option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ fontSize: '13px' }}>
                      {doc.assigneeId ? getStaffName(doc.assigneeId) : (doc.assignee || '—')}
                    </span>
                  )}
                </div>
                <div className="meta-row" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
                  <span className="meta-label" style={{ marginTop: 2, marginBottom: 4 }}>Ghi chú:</span>
                  {perms.canEditNotes ? (
                    <textarea
                      key={doc.id}
                      defaultValue={doc.notes || ''}
                      onBlur={(e) => {
                        e.currentTarget.style.background = '#f1f5f9';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        handleUpdateNotes(e.target.value);
                      }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement
                        target.style.height = 'auto'
                        target.style.height = target.scrollHeight + 'px'
                      }}
                      placeholder="Nhập ghi chú..."
                      style={{ 
                        width: '100%', 
                        minHeight: '60px', 
                        fontSize: '13px', 
                        padding: '8px', 
                        border: '1px solid #cbd5e1', 
                        borderRadius: '5px', 
                        background: '#f1f5f9', 
                        resize: 'none', 
                        overflow: 'hidden',
                        transition: 'border-color 0.15s, background 0.15s' 
                      }}
                      onFocus={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#3b82f6' }}
                      ref={el => {
                        if (el) {
                          el.style.height = 'auto'
                          el.style.height = el.scrollHeight + 'px'
                        }
                      }}
                    />
                  ) : (
                    <div style={{ 
                      width: '100%', 
                      minHeight: '40px', 
                      fontSize: '13px', 
                      padding: '8px', 
                      background: '#f8fafc', 
                      borderRadius: '5px',
                      whiteSpace: 'pre-wrap',
                      color: doc.notes ? '#334155' : '#94a3b8',
                      fontStyle: doc.notes ? 'normal' : 'italic',
                    }}>
                      {doc.notes || 'Không có ghi chú'}
                    </div>
                  )}
                </div>
              </div>

              {/* File list */}
              <div className="modal-file-list">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ marginBottom: 0 }}>Danh sách tệp ({allFiles.length})</h3>
                  <button
                    className="icon-btn hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    style={{ width: 26, height: 26, padding: 0 }}
                    onClick={handleCopyAll}
                    data-tooltip="Copy thông tin giao việc"
                    data-tooltip-align="right"
                  >
                    {copiedAll ? <Check size={15} className="text-green-500" strokeWidth={2.5} /> : <Send size={15} className="text-slate-700" strokeWidth={2.5} />}
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {allFiles.map((f) => (
                    <div
                      key={f.id}
                      className={`modal-file-item ${activeUrl === f.url ? 'active' : ''}`}
                      onClick={() => setActiveUrl(f.url)}
                    >
                      <div className="file-item-row1">
                        <div className="file-item-meta">
                          {getFileIcon(f.label, f.mimeType, f.type === 'main' ? 'text-blue-600' : 'text-purple-500')}
                          <span className={`file-type-badge ${f.type}`}>
                            {f.type === 'main' ? 'Chính' : 'Đính kèm'}
                          </span>
                        </div>
                        <div className="file-actions" onClick={e => e.stopPropagation()}>
                          <button
                            className="icon-btn"
                            onClick={() => handleCopy(f.url, f.id)}
                            data-tooltip="Copy link"
                          >
                            {copiedId === f.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                          </button>
                          <a
                            href={`https://drive.google.com/uc?export=download&id=${f.driveId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="icon-btn"
                            data-tooltip="Tải file"
                          >
                            <Download size={14} />
                          </a>
                          <a
                            href={`https://drive.google.com/file/d/${f.driveId}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="icon-btn"
                            data-tooltip="Mở trong trình duyệt"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </div>
                      <div className="file-item-row2">
                        <span className="file-label" title={f.label}>{f.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: iframe preview */}
            <div className="modal-preview">
              {activeUrl ? (
                <iframe
                  src={activeUrl}
                  className="preview-iframe"
                  title="Document preview"
                />
              ) : (
                <div className="preview-placeholder">
                  <p>Chọn một file để xem</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="modal-loading">
            <p>Không tìm thấy văn bản.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 999;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .modal-container {
          width: 92vw;
          height: 88vh;
          max-width: 1400px;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 25px 60px rgba(0,0,0,0.3);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.25s ease;
        }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .modal-header-info h2 {
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
          line-height: 1.3;
        }
        .modal-doc-number {
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
        }
        .modal-status-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 6px;
          font-weight: 600;
        }
        .status-done { background: #dcfce7; color: #166534; }
        .status-overdue { background: #fee2e2; color: #dc2626; }
        .status-urgent { background: #ffedd5; color: #c2410c; }
        .status-pending { background: #f1f5f9; color: #475569; }
        .modal-close {
          background: none;
          border: none;
          padding: 6px;
          cursor: pointer;
          border-radius: 6px;
          color: #64748b;
          transition: all 0.15s;
        }
        .modal-close:hover { background: #fee2e2; color: #ef4444; }

        .modal-loading {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #64748b;
        }
        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e2e8f0;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .modal-body {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .modal-sidebar {
          width: 340px;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }

        .modal-meta {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 13px;
        }
        .meta-row {
          display: flex;
          gap: 6px;
          margin-bottom: 4px;
        }
        .meta-label {
          font-weight: 600;
          color: #475569;
          white-space: nowrap;
        }
        .modal-notes {
          font-size: 12px;
          color: #64748b;
          margin-top: 6px;
          white-space: pre-line;
        }

        .modal-file-list {
          flex: 1;
          padding: 12px 16px;
        }
        .modal-file-list h3 {
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .modal-file-item {
          display: flex;
          flex-direction: column;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.15s;
          cursor: pointer;
          padding: 6px 10px 8px 10px;
          gap: 2px;
        }
        .modal-file-item.active {
          border-color: #3b82f6;
          background: #eff6ff;
        }
        .modal-file-item:hover {
          border-color: #94a3b8;
        }
        .file-item-row1 {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }
        .file-item-meta {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .file-item-row2 {
          width: 100%;
          padding-left: 2px;
        }
        .file-label {
          font-size: 11px;
          font-style: italic;
          color: #475569;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.4;
          word-break: break-all;
        }
        .file-type-badge {
          font-size: 9px;
          padding: 1px 5px;
          border-radius: 4px;
          font-weight: 600;
          white-space: nowrap;
        }
        .file-type-badge.main { background: #dbeafe; color: #1d4ed8; }
        .file-type-badge.attachment { background: #f3e8ff; color: #7c3aed; }

        .file-actions {
          display: flex;
          gap: 2px;
        }
        .icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border: none;
          background: none;
          border-radius: 6px;
          cursor: pointer;
          color: #64748b;
          transition: all 0.15s;
          text-decoration: none;
        }
        .icon-btn:hover { background: #f1f5f9; color: #334155; }

        .modal-preview {
          flex: 1;
          display: flex;
          background: #f8fafc;
        }
        .preview-iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
        .preview-placeholder {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 14px;
        }
      `}</style>
    </div>
  )
}
