'use client'

import { useState, useEffect, useMemo } from 'react'
import { onSnapshot } from 'firebase/firestore'
import {
  queryUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/lib/tasks/notifications'
import type { Notification } from '@/types/tasks'

export function useNotifications(userId?: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setNotifications([])
      setLoading(false)
      return
    }

    const q = queryUserNotifications(userId)
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Notification[]
        items.sort((a: any, b: any) => {
          const timeA = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0)
          const timeB = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0)
          return timeB - timeA
        })
        setNotifications(items)
        setLoading(false)
      },
      (err) => {
        console.error('Notifications subscription error:', err)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [userId])

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length
  }, [notifications])

  const handleMarkAsRead = async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    )
    await markNotificationAsRead(id)
  }

  const handleMarkAllAsRead = async () => {
    if (!userId) return
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    await markAllNotificationsAsRead(userId)
  }

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
  }
}
