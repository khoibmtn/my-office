'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  CheckCheck,
  CheckSquare,
  MessageSquare,
  FileText,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import type { Notification } from '@/types/tasks'

interface NotificationBellProps {
  userId?: string | null
}

function formatRelativeTime(ts: any): string {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)

  if (diffSec < 60) return 'Vừa xong'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} phút trước`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} giờ trước`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays} ngày trước`

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  })
}

function getNotificationIcon(category: string, entityType: string) {
  if (category === 'MENTIONED' || category === 'COMMENT_ADDED') {
    return <MessageSquare className="w-4 h-4 text-purple-600" />
  }
  if (category === 'TASK_COMPLETED') {
    return <Sparkles className="w-4 h-4 text-emerald-600" />
  }
  if (entityType === 'task') {
    return <CheckSquare className="w-4 h-4 text-blue-600" />
  }
  if (entityType === 'document') {
    return <FileText className="w-4 h-4 text-amber-600" />
  }
  return <Bell className="w-4 h-4 text-slate-500" />
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const router = useRouter()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(userId)
  const [isOpen, setIsOpen] = useState(false)
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const filteredNotifications = notifications.filter((n) => {
    if (tab === 'unread') return !n.isRead
    return true
  })

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.isRead) {
      await markAsRead(notif.id)
    }
    setIsOpen(false)

    if (notif.entityType === 'task') {
      router.push(`/tasks/${notif.entityId}`)
    } else if (notif.entityType === 'document') {
      router.push(`/documents/${notif.entityId}`)
    }
  }

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Thông báo"
        title="Thông báo"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white animate-in zoom-in">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Thông báo</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-600 rounded-full">
                  {unreadCount} mới
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                title="Đánh dấu tất cả đã đọc"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Đã đọc tất cả
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-100 bg-slate-50/50 px-3 pt-2 text-xs">
            <button
              onClick={() => setTab('all')}
              className={`pb-2 px-2 font-medium transition-colors border-b-2 ${
                tab === 'all'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Tất cả ({notifications.length})
            </button>
            <button
              onClick={() => setTab('unread')}
              className={`pb-2 px-2 font-medium transition-colors border-b-2 ${
                tab === 'unread'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Chưa đọc ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">
                  {tab === 'unread'
                    ? 'Tuyệt vời! Bạn không có thông báo chưa đọc nào.'
                    : 'Chưa có thông báo nào.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3 text-left hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 items-start relative ${
                    !notif.isRead ? 'bg-blue-50/40' : ''
                  }`}
                >
                  <div className="p-2 bg-slate-100 rounded-xl shrink-0 mt-0.5">
                    {getNotificationIcon(notif.category, notif.entityType)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4
                        className={`text-xs truncate ${
                          !notif.isRead
                            ? 'font-bold text-slate-900'
                            : 'font-semibold text-slate-700'
                        }`}
                      >
                        {notif.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {notif.body}
                    </p>

                    {notif.actorName && (
                      <span className="inline-block mt-1 text-[10px] text-slate-400">
                        Bởi {notif.actorName}
                      </span>
                    )}
                  </div>

                  {!notif.isRead && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
