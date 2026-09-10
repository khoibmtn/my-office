'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'
import { useTasks } from '@/hooks/useTasks'
import { useRole } from '@/hooks/useRole'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'

export default function KanbanPage() {
  const { staffId, staffName } = useRole()
  const { tasks, loading } = useTasks({ view: 'all' })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 h-[calc(100vh-56px)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900">Kanban</h1>
        <p className="text-sm text-slate-500">Kéo thả để chuyển trạng thái công việc</p>
      </div>

      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          tasks={tasks}
          actorId={staffId || 'unknown'}
          actorName={staffName || 'Unknown'}
        />
      </div>
    </div>
  )
}
