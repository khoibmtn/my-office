'use client'

import React, { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { TasksWorkspace } from '@/components/tasks/TasksWorkspace'

function TasksFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  )
}

export default function KanbanPage() {
  return (
    <Suspense fallback={<TasksFallback />}>
      <TasksWorkspace initialMode="kanban" />
    </Suspense>
  )
}
