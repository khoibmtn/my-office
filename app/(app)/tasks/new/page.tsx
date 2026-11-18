'use client'

import React, { Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { TaskCreateForm } from '@/components/tasks/TaskCreateForm'

function NewTaskContent() {
  const searchParams = useSearchParams()
  const title = searchParams.get('title') || undefined
  const dueDate = searchParams.get('dueDate') || undefined
  const assigneeId = searchParams.get('assigneeId') || undefined

  const initialData = useMemo(() => {
    if (!title && !dueDate && !assigneeId) return undefined
    return { title, dueDate, assigneeId }
  }, [title, dueDate, assigneeId])

  return <TaskCreateForm initialData={initialData} />
}

export default function NewTaskPage() {
  return (
    <Suspense fallback={null}>
      <NewTaskContent />
    </Suspense>
  )
}
