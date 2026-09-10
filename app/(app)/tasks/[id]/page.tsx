'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useTaskDetail } from '@/hooks/useTaskDetail'
import { useRole } from '@/hooks/useRole'
import { TaskDetail } from '@/components/tasks/TaskDetail'

export default function TaskDetailPage() {
  const params = useParams()
  const taskId = params?.id as string
  const { isAdmin, staffId, staffName } = useRole()

  const { task, comments, activities, subtasks, loading } = useTaskDetail(taskId)

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!task) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-sm">Không tìm thấy công việc</p>
      </div>
    )
  }

  return (
    <TaskDetail
      task={task}
      comments={comments}
      activities={activities}
      subtasks={subtasks}
      actorId={staffId || 'unknown'}
      actorName={staffName || 'Unknown'}
      actorRole={isAdmin ? 'admin' : 'staff'}
      actorDepartmentIds={[]}
    />
  )
}
