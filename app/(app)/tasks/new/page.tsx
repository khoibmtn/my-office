'use client'

import React, { Suspense } from 'react'
import { TaskCreateForm } from '@/components/tasks/TaskCreateForm'

export default function NewTaskPage() {
  return (
    <Suspense fallback={null}>
      <TaskCreateForm />
    </Suspense>
  )
}
