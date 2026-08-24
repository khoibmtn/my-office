'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRole } from './useRole'
import type { Dossier, DossierComment } from '@/types'

export function getCommentTimestamp(c: DossierComment): number {
  if (!c.createdAt) return 0
  const ts: any = c.createdAt
  if (ts.toMillis && typeof ts.toMillis === 'function') return ts.toMillis()
  if (ts.toDate && typeof ts.toDate === 'function') return ts.toDate().getTime()
  if (ts.seconds) return ts.seconds * 1000
  if (ts instanceof Date) return ts.getTime()
  const d = new Date(ts)
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

export function useDossierUnread(dossiers: Dossier[]) {
  const { staffId, staffName, isAdmin } = useRole()
  const userKey = staffId || (isAdmin ? 'admin' : 'guest')
  const [readVersion, setReadVersion] = useState(0)

  // Listen to read events and storage changes
  useEffect(() => {
    const handleRead = () => {
      setReadVersion(v => v + 1)
    }
    window.addEventListener('myoffice_dossier_read', handleRead)
    window.addEventListener('storage', handleRead)
    return () => {
      window.removeEventListener('myoffice_dossier_read', handleRead)
      window.removeEventListener('storage', handleRead)
    }
  }, [])

  // Mark a dossier as read
  const markAsRead = useCallback((dossierId: string) => {
    if (!dossierId || typeof window === 'undefined') return
    const key = `myoffice_dossier_read_${dossierId}_${userKey}`
    localStorage.setItem(key, String(Date.now()))
    window.dispatchEvent(new CustomEvent('myoffice_dossier_read', { detail: { dossierId } }))
    setReadVersion(v => v + 1)
  }, [userKey])

  // Compute unread counts per dossier (direct unread)
  const unreadMap = useMemo(() => {
    const map: Record<string, number> = {}
    if (typeof window === 'undefined' || !dossiers) return map

    dossiers.forEach(d => {
      const key = `myoffice_dossier_read_${d.id}_${userKey}`
      const lastReadStr = localStorage.getItem(key)
      const lastRead = lastReadStr ? Number(lastReadStr) : 0

      const unreadComments = (d.comments || []).filter(c => {
        const isMine =
          (staffId && c.senderId === staffId) ||
          (isAdmin && (c.senderId === 'admin' || c.senderName === 'Admin' || c.senderId === 'anonymous')) ||
          (staffName && c.senderName === staffName)
        if (isMine) return false
        const commentTime = getCommentTimestamp(c)
        return commentTime > lastRead
      })

      map[d.id] = unreadComments.length
    })

    return map
  }, [dossiers, userKey, staffId, staffName, isAdmin, readVersion])

  // Get total unread count in a subtree rooted at dossierId
  const getSubtreeUnread = useCallback((dossierId: string): number => {
    let total = unreadMap[dossierId] || 0
    const children = dossiers.filter(d => d.parentId === dossierId && !d.deletedAt && !d.isArchived)
    children.forEach(c => {
      total += getSubtreeUnread(c.id)
    })
    return total
  }, [unreadMap, dossiers])

  return {
    unreadMap,
    getSubtreeUnread,
    markAsRead,
  }
}
