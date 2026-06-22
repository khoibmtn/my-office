'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Copy, Check, ExternalLink, FileText, Paperclip, Download, FileSpreadsheet, FileImage, FileArchive, File as FileGeneric } from 'lucide-react'
import { getDocument } from '@/lib/firestore'
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

function getFileIcon(fileName: string, mimeType?: string, defaultColor: string = 'text-slate-500') {
  const name = (fileName || '').toLowerCase()
  const mime = (mimeType || '').toLowerCase()
  
  if (name.endsWith('.pdf') || mime.includes('pdf')) return <FileText size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
  if (name.endsWith('.doc') || name.endsWith('.docx') || mime.includes('word')) return <FileText size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
  if (name.endsWith('.xls') || name.endsWith('.xlsx') || mime.includes('excel') || mime.includes('spreadsheet')) return <FileSpreadsheet size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
  if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || mime.includes('image')) return <FileImage size={14} className="text-purple-500 flex-shrink-0 mt-0.5" />
  if (name.endsWith('.zip') || name.endsWith('.rar') || mime.includes('zip') || mime.includes('compressed')) return <FileArchive size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
  
  return <FileGeneric size={14} className={`${defaultColor} flex-shrink-0 mt-0.5`} />
}

interface DocumentModalProps {
  docId: string | null
  onClose: () => void
}

export function DocumentModal({ docId, onClose }: DocumentModalProps) {
  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeUrl, setActiveUrl] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (!docId) return
    setLoading(true)
    getDocument(docId).then((d) => {
      setDoc(d)
      if (d?.driveViewUrl) setActiveUrl(d.driveViewUrl)
      setLoading(false)
    })
  }, [docId])

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

  if (!docId) return null

  const allFiles = doc ? [
    {
      id: 'main',
      label: 'File chính',
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

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-container">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-info">
            <h2>{doc?.title || 'Đang tải...'}</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
              {doc?.docNumber && (
                <span className="modal-doc-number">{doc.docNumber}</span>
              )}
              {doc && (() => {
                const days = getDaysRemaining(doc.deadline)
                const si = getStatusInfo(doc, days)
                return <span className={`modal-status-badge ${si.cls}`}>{si.label}</span>
              })()}
            </div>
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
                {doc.deadline && (() => {
                  const days = getDaysRemaining(doc.deadline)
                  const daysText = days === null ? '' : days < 0 ? ` (quá ${Math.abs(days)} ngày)` : days === 0 ? ' (hôm nay!)' : ` (còn ${days} ngày)`
                  return (
                    <div className="meta-row">
                      <span className="meta-label">Deadline:</span>
                      <span>{doc.deadline.toDate().toLocaleDateString('vi-VN')}<strong style={{color: days !== null && days <= 1 ? '#ef4444' : days !== null && days <= 3 ? '#f59e0b' : '#22c55e'}}>{daysText}</strong></span>
                    </div>
                  )
                })()}
                {doc.assignee && (
                  <div className="meta-row">
                    <span className="meta-label">Người nhận:</span>
                    <span>{doc.assignee}</span>
                  </div>
                )}
                {doc.sender && (
                  <div className="meta-row">
                    <span className="meta-label">CQBH:</span>
                    <span>{doc.sender}</span>
                  </div>
                )}
                {doc.notes && (() => {
                  const lines = doc.notes.split('\n').map(l => l.trim()).filter(Boolean)
                  const filtered = lines.filter(l => {
                    if (doc.sender && l.includes(doc.sender) && /^(CQBH|CQ ban hành)/i.test(l)) return false
                    if (doc.leader && l.includes(doc.leader) && /^Lãnh đạo/i.test(l)) return false
                    return true
                  })
                  if (filtered.length === 0) return null
                  return (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-2 mx-4 mt-2">
                      <p className="text-xs font-semibold text-amber-800 mb-1">📝 Ghi chú cá nhân:</p>
                      <p className="text-sm text-amber-900 whitespace-pre-wrap">{filtered.join('\n')}</p>
                    </div>
                  )
                })()}
              </div>

              {/* File list */}
              <div className="modal-file-list">
                <h3>Danh sách tệp ({allFiles.length})</h3>
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
                            title="Copy link"
                          >
                            {copiedId === f.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                          </button>
                          <a
                            href={`https://drive.google.com/uc?export=download&id=${f.driveId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="icon-btn"
                            title="Tải xuống"
                          >
                            <Download size={14} />
                          </a>
                          <a
                            href={`https://drive.google.com/file/d/${f.driveId}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="icon-btn"
                            title="Mở Drive"
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
