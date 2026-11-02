'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { useTasks, isVisibleTask } from '@/hooks/useTasks'
import { TaskCalendar } from '@/components/tasks/TaskCalendar'

export default function CalendarPage() {
  const { tasks, loading } = useTasks({ view: 'all' })
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const visibleTasks = useMemo(() => {
    return tasks.filter((t) => isVisibleTask(t, now))
  }, [tasks, now])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900">Lịch công việc</h1>
        <p className="text-sm text-slate-500">Xem công việc theo hạn hoàn thành</p>
      </div>
      <TaskCalendar tasks={visibleTasks} />
    </div>
  )
}
