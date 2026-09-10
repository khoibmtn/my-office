/**
 * Notification data layer & helpers.
 * Handles user notifications for task, document, and dossier events.
 */

import {
  collection, doc, query, where, orderBy, limit,
  getDocs, updateDoc, writeBatch, serverTimestamp,
  Timestamp, type Query, type DocumentData,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Notification } from '@/types/tasks'

const NOTIFICATIONS_COLLECTION = 'notifications'

/**
 * Query active notifications for a specific user.
 * Ordered by newest first, limited to 50.
 */
export function queryUserNotifications(recipientId: string): Query<DocumentData> {
  return query(
    collection(db(), NOTIFICATIONS_COLLECTION),
    where('recipientId', '==', recipientId)
  )
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const ref = doc(db(), NOTIFICATIONS_COLLECTION, notificationId)
  await updateDoc(ref, {
    isRead: true,
    readAt: serverTimestamp(),
  })
}

/**
 * Mark all unread notifications for a user as read in a batch.
 */
export async function markAllNotificationsAsRead(recipientId: string): Promise<void> {
  const q = query(
    collection(db(), NOTIFICATIONS_COLLECTION),
    where('recipientId', '==', recipientId),
    where('isRead', '==', false)
  )
  const snap = await getDocs(q)
  if (snap.empty) return

  const batch = writeBatch(db())
  snap.docs.forEach(d => {
    batch.update(d.ref, {
      isRead: true,
      readAt: serverTimestamp(),
    })
  })
  await batch.commit()
}

/**
 * Helper to queue notifications in an existing WriteBatch.
 */
export function queueNotification(
  batch: ReturnType<typeof writeBatch>,
  params: {
    recipientId: string
    type?: 'immediate' | 'scheduled' | 'digest'
    category: string
    entityType: 'task' | 'document' | 'dossier'
    entityId: string
    title: string
    body: string
    actorId: string
    actorName: string
  }
) {
  const notifRef = doc(collection(db(), NOTIFICATIONS_COLLECTION))
  batch.set(notifRef, {
    recipientId: params.recipientId,
    type: params.type || 'immediate',
    category: params.category,
    entityType: params.entityType,
    entityId: params.entityId,
    title: params.title,
    body: params.body,
    actorId: params.actorId,
    actorName: params.actorName,
    isRead: false,
    readAt: null,
    scheduledFor: null,
    createdAt: serverTimestamp(),
  })
}
