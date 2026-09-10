'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db, ensureAuth } from '@/lib/firebase'
import {
  queryTaskComments,
  queryTaskActivities,
  querySubtasks,
  subscribeToQuery,
} from '@/lib/tasks/firestore'
import type { Task, TaskComment, TaskActivity } from '@/types/tasks'

export function useTaskDetail(taskId: string | null) {
  const [task, setTask] = useState<Task | null>(null)
  const [comments, setComments] = useState<TaskComment[]>([])
  const [activities, setActivities] = useState<TaskActivity[]>([])
  const [subtasks, setSubtasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!taskId) {
      setTask(null)
      setComments([])
      setActivities([])
      setSubtasks([])
      setLoading(false)
      return
    }

    const unsubs: (() => void)[] = []
    let loadCount = 0
    const checkLoaded = () => {
      loadCount++
      if (loadCount >= 4) setLoading(false)
    }

    ensureAuth().then(() => {
      // Subscribe to task document
      unsubs.push(
        onSnapshot(
          doc(db(), 'tasks', taskId),
          (snap) => {
            if (snap.exists()) {
              setTask({ id: snap.id, ...snap.data() } as Task)
            } else {
              setTask(null)
            }
            checkLoaded()
          },
          (err) => {
            console.error('[useTaskDetail] task error:', err)
            checkLoaded()
          }
        )
      )

      // Subscribe to comments
      unsubs.push(
        subscribeToQuery(
          queryTaskComments(taskId),
          (items) => { setComments(items as TaskComment[]); checkLoaded() },
          () => checkLoaded()
        )
      )

      // Subscribe to activities
      unsubs.push(
        subscribeToQuery(
          queryTaskActivities(taskId),
          (items) => { setActivities(items as TaskActivity[]); checkLoaded() },
          () => checkLoaded()
        )
      )

      // Subscribe to subtasks
      unsubs.push(
        subscribeToQuery(
          querySubtasks(taskId),
          (items) => { setSubtasks(items as Task[]); checkLoaded() },
          () => checkLoaded()
        )
      )
    }).catch(() => setLoading(false))

    return () => unsubs.forEach(u => u())
  }, [taskId])

  return { task, comments, activities, subtasks, loading }
}
